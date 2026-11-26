// Shared request helper for the AI tools.
//
// Resolves to the ANSWER - a string for a text tool, the parsed document for a JSON one. Reading a
// field out of it is the calling tool's job. Rejects with { hardError: <response> } when the server
// refused outright - a spent rate limit, over-length input, an unverified account - which the caller
// should show rather than retry.

(function ($) {
    'use strict';

    // fetch() for the gateway, with a limit on how long the page waits for it to start answering.
    // Past the limit the page gives up on the gateway and asks the server to do the work instead, as
    // it already does when the gateway refuses or cannot be reached. Without a limit, a request that
    // was held open rather than refused (some security software and networks do that) kept the page
    // waiting forever, because the page only turns to the server once the request has ended.
    //
    // 90 seconds is long enough for a slow answer to get through, and short enough that the server
    // still has time to take the work over. The clock stops as soon as the answer starts arriving, so
    // speech that plays while it streams in is never cut off.
    function fetchFromWorker(url, request) {
        var controller = new AbortController();
        var timer = setTimeout(function () {
            controller.abort(new Error('no answer after 90 seconds'));
        }, 90000);

        request.signal = controller.signal;
        return fetch(url, request).finally(function () { clearTimeout(timer); });
    }

    // options:
    //   ajaxurl   where to post
    //   formData  a FormData holding the action, the nonce and the tool's own fields
    //   onReply   called once with the first reply, for values the tool needs from it
    //   json      true when the reply needs parsing
    //   workerImage  a Blob to post to the Worker beside the token, for a vision call
    //   stream    true to take speech as it is made: resolves with the fetch Response itself when the
    //             audio comes that way, and with base64 as usual when it does not
    window.aiWorkerCall = function (options) {
        var paidToken = null;

        // Copied rather than posted directly, because this runs again when the second PHP call fails and
        // the copy must not carry the previous attempt's paid_token.
        function post(extra) {
            var form = new FormData();

            options.formData.forEach(function (value, key) { form.append(key, value); });
            Object.keys(extra || {}).forEach(function (key) { form.append(key, extra[key]); });

            return $.ajax({
                url: options.ajaxurl,
                type: 'POST',
                data: form,
                processData: false,
                contentType: false
            }).then(function (response) {
                if (!response || !response.success) {
                    return $.Deferred().reject({ hardError: response }).promise();
                }
                return response.data;
            });
        }

        // Why the gateway leg failed, in words, sent along with the retry so the server can log it.
        var workerFailure = '';

        function readWorkerAnswer(data) {
            // Streamed speech, handed over unread for the caller to play as it arrives.
            if (data instanceof Response) {
                return data;
            }

            if (!data || data['error']) {
                // Not an answer - retry on the other path rather than showing an error.
                workerFailure = 'the gateway sent no answer' + (data && data['error'] ? ' (' + data['error'] + ')' : '');
                throw new Error(workerFailure);
            }

            if (!options.json) {
                return data.message;
            }
            try {
                return JSON.parse(data.message);
            }
            catch (error) {
                workerFailure = 'the gateway answer was not valid JSON';
                throw error;
            }
        }

        return post().then(function (data) {
            // The first reply carries anything the tool needs that the answer itself will not.
            if (options.onReply && data) {
                options.onReply(data);
            }

            // No token means PHP answered directly, and we are done.
            if (!data || !data.token) {
                return data ? data.answer : null;
            }

            paidToken = data.token;

            // An image cannot ride inside the token, so a vision call posts multipart with the
            // bytes beside it. Everything else sends the token on its own as JSON.
            var workerRequest = { method: 'POST' };
            if (options.workerImage) {
                var workerForm = new FormData();
                workerForm.append('token', paidToken);
                workerForm.append('image', options.workerImage, 'image.jpg');
                workerRequest.body = workerForm;
                // No content-type header: the browser has to set it, because only it knows the
                // multipart boundary it just generated.
            }
            else {
                workerRequest.headers = { 'content-type': 'application/json' };
                workerRequest.body = JSON.stringify(options.stream ? { token: paidToken, stream: true } : { token: paidToken });
            }

            var workerStarted = Date.now();

            return fetchFromWorker(data.url, workerRequest).then(function (response) {
                if (!response.ok) {
                    workerFailure = 'the gateway answered HTTP ' + response.status;
                    throw new Error(workerFailure);
                }
                if (options.stream && (response.headers.get('content-type') || '').indexOf('audio/') === 0) {
                    return response;
                }
                return response.json().then(null, function (error) {
                    workerFailure = 'the gateway reply was not JSON';
                    throw error;
                });
            }, function (error) {
                // fetch itself failed: offline, blocked, the connection dropped, or no answer in time.
                workerFailure = 'could not reach the gateway (' + (error && error.message ? error.message : 'network error') + ')';
                throw error;
            }).then(readWorkerAnswer).then(null, function () {
                // Second leg failed - retry on the first path, saying why.
                return post({
                    paid_token: paidToken,
                    ai_worker_failure: (workerFailure || 'unknown') + ', after ' + (Date.now() - workerStarted) + ' ms'
                }).then(function (retry) {
                    return retry ? retry.answer : null;
                });
            });
        });
    };

    // A TWO-PHASE call, for a tool whose answer is scored or saved on the server and whose working
    // must not be readable on the way there.
    //
    // Phase 1 posts the form and gets back a flow blob plus one token per prompt. The tokens run on
    // the Worker side by side rather than one after another in PHP, and each answer comes back
    // SEALED - so what the browser carries between the two phases is ciphertext it cannot read, and
    // only the server, which holds the key, ever sees the intermediate results. Phase 2 posts the
    // flow and the sealed answers back; the server opens them, finishes the job and replies with
    // the same shape a single-request version would have.
    //
    // A token the Worker could not answer is simply left out of phase 2, and the server makes that
    // one call itself - so an unreachable Worker means slow, never broken.
    //
    // options:
    //   ajaxurl      where to post
    //   formData     a FormData holding the action, the nonce and the tool's own fields
    //   workerAudio  a Blob to post to the Worker beside the token, for a chained speech-assessment
    //                call - the recording cannot ride inside the token
    //
    // A finishing call can itself answer with ANOTHER flow, for a tool whose later prompts quote an
    // earlier answer - the writing checkers correct the grammar first, and their grading prompt
    // quotes the error count. The Worker leg and the finishing call then simply run again, up to
    // MAX_ROUNDS times. The server only does that for a page that says it can follow it, which is
    // what the ai_worker_rounds field below is for.
    //
    // Resolves with the server's final data, or rejects with { hardError: <response> } when the
    // server refused outright.
    window.aiWorkerSealedCall = function (options) {
        function buildForm(extra, dropUploads) {
            var form = new FormData();

            options.formData.forEach(function (value, key) {
                // Three tools put a real file in here: writing task 1 academic sends the chart
                // image, and the speaking checkers and the speaking test send the recording.
                // Everything else on this path is strings, which always go both times.
                //
                // Usually the second call does not need the file: whatever it was for was dealt with
                // on the first call and the result is inside the flow, so sending it again would
                // upload the same bytes twice - on a phone the slowest part of the whole check.
                // The exception is a speech step that ran on the Worker and failed, where PHP has
                // to transcribe for itself and needs the recording; that call passes keepUploads.
                if (dropUploads && typeof Blob !== 'undefined' && value instanceof Blob) {
                    return;
                }

                form.append(key, value);
            });
            // Tells the server this script can follow a flow through more than one round - see
            // ai_worker_client_takes_rounds() in ai_worker_gateway.php. A page still running an older
            // copy of this file sends nothing, and the server keeps that page on a single round.
            form.append('ai_worker_rounds', '1');
            Object.keys(extra || {}).forEach(function (key) { form.append(key, extra[key]); });

            return form;
        }

        function post(extra, dropUploads) {
            return new Promise(function (resolve, reject) {
                $.ajax({
                    url: options.ajaxurl,
                    type: 'POST',
                    data: buildForm(extra, dropUploads),
                    processData: false,
                    contentType: false
                }).done(resolve).fail(reject);
            });
        }

        // 429 ONLY, and that narrowness is the point. WordPress.com sheds bursts of fast requests
        // with a 429 BEFORE PHP runs, so nothing happened and trying again is free and correct.
        //
        // Every other failure is left alone deliberately. A dropped connection or a gateway timeout
        // might mean the server finished and only the reply was lost - retrying those would redo
        // work that is already done, and a tool that saves something on its second PHP call would save it
        // twice. The learner is no worse off than they were before this gateway existed: the request
        // failed, they see an error, they try again.
        var RETRY_DELAYS_MS = [1000, 3000, 8000];

        function finish(sealed, attempt, keepUploads) {
            return post(sealed, !keepUploads).catch(function (jqXHR) {
                var status = jqXHR ? jqXHR.status : 0;
                if (attempt >= RETRY_DELAYS_MS.length || status !== 429) {
                    throw jqXHR;
                }

                // Retry-After wins when the server sends one - it knows what it is waiting for.
                // Otherwise back off on a fixed curve, with jitter so a burst of learners hitting
                // the same limit do not all come back in the same instant.
                // Capped, because Retry-After is the server's opinion and it can be enormous. An
                // uncapped one leaves the returned promise unsettled for as long as it says - so the
                // caller's spinner and disabled buttons stay put - and then lands the retry past the
                // flow's own expiry, where it would fail anyway. Capped, the whole budget is at most
                // about 90 seconds, which a flow outlives comfortably.
                var after = parseInt(jqXHR.getResponseHeader('Retry-After'), 10);
                var wait = after > 0 ? Math.min(after * 1000, 30000)
                    : RETRY_DELAYS_MS[attempt] + Math.floor(Math.random() * 500);

                return new Promise(function (resolve) { setTimeout(resolve, wait); })
                    .then(function () { return finish(sealed, attempt + 1, keepUploads); });
            });
        }

        // How many Worker legs one call may run. The writing checkers use two - the grammar correction,
        // then the two grading prompts that quote its result. The cap is only there so a server that
        // kept answering with flows could not send the page round and round.
        var MAX_ROUNDS = 3;

        // Runs one round's Worker leg, and resolves with what the finishing call has to post: the
        // flow, whichever sealed answers came back, and whether the upload has to go again.
        function runWorkerLeg(data) {
            // A SINGLE token means the chained speaking-check call: one Worker request does
            // transcribe -> refine -> mark, and answers with a MAP of sealed answers rather than
            // one. Everything after that is identical, because the map is keyed by the same names
            // the parallel path uses.
            //
            // Branching on the token ALONE, not on the token and the recording together. A caller
            // that has not been taught to pass workerAudio yet still gets a single token from a
            // server that has, and pairing the two conditions sent that case into the parallel path
            // below - where data.tokens does not exist and Object.keys threw. Without a recording
            // there is simply no Worker leg to run, so it posts straight back and PHP does the work.
            // Why answers are missing, in words, sent with the finishing call so the server can log it.
            var workerStarted = Date.now();
            var workerFailure = '';

            if (data.token) {
                var workerLeg;
                if (options.workerAudio) {
                    var audioForm = new FormData();
                    audioForm.append('token', data.token);
                    audioForm.append('audio', options.workerAudio, 'audio.wav');
                    // No content-type header: only the browser knows the multipart boundary.

                    workerLeg = fetchFromWorker(data.url, { method: 'POST', body: audioForm }).then(function (workerResponse) {
                        if (!workerResponse.ok) {
                            workerFailure = 'the gateway answered HTTP ' + workerResponse.status;
                            return null;
                        }
                        return workerResponse.json();
                    }).catch(function (error) {
                        workerFailure = 'the gateway request failed (' + (error && error.message ? error.message : 'network error') + ')';
                        return null;
                    });
                }
                else {
                    workerFailure = 'this page sent no recording to the gateway';
                    workerLeg = Promise.resolve(null);
                }

                return workerLeg.then(function (body) {
                    // The recording had no speech in it. Sending it to the server would only get the
                    // same answer more slowly, so the check ends here with the server's own error.
                    if (body && body.error === 'no_speech') {
                        return Promise.reject({ hardError: { success: false, data: { error: 'no_speech', message: 'We could not finish checking your answer. Please try again.' } } });
                    }

                    var map = (body && body.sealed && typeof body.sealed === 'object') ? body.sealed : {};
                    var sealed = { flow: data.flow };
                    Object.keys(map).forEach(function (name) {
                        if (map[name]) { sealed['sealed_' + name] = map[name]; }
                    });

                    if (!workerFailure && Object.keys(map).length === 0) {
                        workerFailure = 'the gateway sent no answers' + (body && body.error ? ' (' + body.error + ')' : '');
                    }
                    if (workerFailure) {
                        sealed.ai_worker_failure = workerFailure + ', after ' + (Date.now() - workerStarted) + ' ms';
                    }

                    // Keep the upload ONLY when the Worker could not transcribe. PHP then has to do
                    // the whole thing itself and needs the bytes; on the happy path resending them
                    // would upload the recording twice, which on a phone is the slow part.
                    return { sealed: sealed, keepUploads: Object.keys(map).length === 0 };
                });
            }

            var names = Object.keys(data.tokens);
            // One entry per answer that did not come back, e.g. "correction: the gateway answered HTTP 502".
            var failures = [];

            return Promise.all(names.map(function (name) {
                return fetchFromWorker(data.url, {
                    method: 'POST',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({ token: data.tokens[name] })
                }).then(function (workerResponse) {
                    if (!workerResponse.ok) {
                        failures.push(name + ': the gateway answered HTTP ' + workerResponse.status);
                        return null;
                    }
                    return workerResponse.json();
                }).then(function (body) {
                    // Only a sealed answer is worth carrying on with. Anything else - a provider
                    // outage, a plain-text reply from a Worker that predates sealing - is left out
                    // so the server makes this call itself.
                    if (body && !body.sealed) {
                        failures.push(name + ': the gateway sent no answer' + (body.error ? ' (' + body.error + ')' : ''));
                    }
                    return body && body.sealed ? body.sealed : null;
                }).catch(function (error) {
                    failures.push(name + ': the gateway request failed (' + (error && error.message ? error.message : 'network error') + ')');
                    return null;
                });
            })).then(function (sealedAnswers) {
                var sealed = { flow: data.flow };

                names.forEach(function (name, index) {
                    if (sealedAnswers[index]) {
                        sealed['sealed_' + name] = sealedAnswers[index];
                    }
                });

                if (failures.length) {
                    sealed.ai_worker_failure = failures.join('; ') + ', after ' + (Date.now() - workerStarted) + ' ms';
                }

                return { sealed: sealed, keepUploads: false };
            });
        }

        // Reads a reply from the server. A flow in it means there is a Worker leg to run and another
        // call to make; anything else is the result.
        function settle(response, round) {
            if (!response || !response.success) {
                return Promise.reject({ hardError: response });
            }

            var data = response.data;

            // No flow means the server answered outright - the gateway is off, sealing failed, or
            // this was the last round - and this is already the final result.
            if (!data || !data.flow || (!data.tokens && !data.token)) {
                return data;
            }

            if (round > MAX_ROUNDS) {
                return Promise.reject({ hardError: response });
            }

            return runWorkerLeg(data).then(function (leg) {
                return finish(leg.sealed, 0, leg.keepUploads);
            }).then(function (next) {
                return settle(next, round + 1);
            });
        }

        // A recording that is going to the Worker is left out of phase 1. The server does not need it
        // to set the check up, and on a slow phone the upload is most of the wait, so sending it to
        // both would double that. ai_worker_audio_direct tells the server it was left out. If the
        // Worker is off, the server has to do the check itself, so it asks for the recording - before
        // charging anything - and phase 1 goes again with it.
        //
        // Phase 1 is NOT retried otherwise: a repeat would charge the rate limit a second time, and
        // nothing has been spent yet, so the learner losing this one costs only the click.
        var direct = !!options.workerAudio;
        return post(direct ? { ai_worker_audio_direct: '1' } : null, direct).then(function (response) {
            if (direct && response && response.success && response.data && response.data.send_recording) {
                return post();
            }
            return response;
        }).then(function (response) {
            return settle(response, 1);
        });
    };

    // Text normalisation matching what the server applies to text it handles itself. An answer that
    // comes straight back from the gateway never passes through the server, so anything that has to
    // line up with server-normalised text - a diff, a highlight, two panes shown side by side - has
    // to be put through this first.
    //
    // keepParagraph defaults to true; pass false to flatten newlines to spaces, or set keepTwoNewLine
    // to separate paragraphs with a blank line instead.
    window.aiWorkerCleanText = function (text, keepParagraph, keepTwoNewLine) {
        if (typeof text !== 'string') {
            return '';
        }
        if (keepParagraph === undefined) {
            keepParagraph = true;
        }

        // No encoding step here - a JS string is already Unicode.
        text = text
            .replace(/[\u2018\u2019]/g, "'")
            .replace(/[\u201C\u201D]/g, '"')
            .replace(/\u2032/g, "'")
            .replace(/\u2033/g, '"')
            .replace(/`/g, "'")
            .replace(/\u2013/g, '-')
            .replace(/\u2014/g, ' - ')
            .replace(/\u00A0/g, ' ');

        // The character class is spelled out rather than using \s, which in JS also matches unicode
        // spaces the server's \s does not.
        text = text.replace(/ +/g, ' ');
        text = text.replace(/[ \t\n\r\f\v]*\n[ \t\n\r\f\v]*/g, '\n');
        text = text.replace(/\n{2,}/g, '\n');

        if (!keepParagraph) {
            text = text.replace(/\n/g, ' ');
        }
        if (keepTwoNewLine) {
            text = text.replace(/[ \t\n\r\f\v]*\n[ \t\n\r\f\v]*/g, '\n\n');
        }

        // The server strips one level of backslashes from the text it handles, so this does too;
        // without it the two sides diverge on any text containing one.
        return text.trim().replace(/\\(.)/g, function (m, c) { return c === '0' ? '\0' : c; });
    };

    window.aiWorkerResizeImageToJpeg = function (file, maxWidth, maxHeight) {
        return new Promise(function (resolve, reject) {
            var url = URL.createObjectURL(file);
            var image = new Image();

            image.onload = function () {
                URL.revokeObjectURL(url);

                var width = image.naturalWidth;
                var height = image.naturalHeight;

                // The server's rule: only ever scale down, and keep the aspect ratio.
                if (width > maxWidth || height > maxHeight) {
                    var ratio = width / height;
                    if (width > height) {
                        width = maxWidth;
                        height = Math.trunc(maxWidth / ratio);
                        if (height > maxHeight) {
                            width = Math.trunc(maxHeight * ratio);
                            height = maxHeight;
                        }
                    }
                    else {
                        height = maxHeight;
                        width = Math.trunc(maxHeight * ratio);
                        if (width > maxWidth) {
                            height = Math.trunc(maxWidth / ratio);
                            width = maxWidth;
                        }
                    }
                }

                var canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                var context = canvas.getContext('2d');

                // White first: a transparent PNG would otherwise flatten to black on a JPEG, which
                // is what the server paints behind it too.
                context.fillStyle = '#ffffff';
                context.fillRect(0, 0, width, height);
                context.drawImage(image, 0, 0, width, height);

                canvas.toBlob(function (blob) {
                    if (blob) {
                        resolve(blob);
                    }
                    else {
                        reject(new Error('could not encode image'));
                    }
                }, 'image/jpeg', 1);
            };

            image.onerror = function () {
                URL.revokeObjectURL(url);
                reject(new Error('could not read image'));
            };

            image.src = url;
        });
    };
})(jQuery);
