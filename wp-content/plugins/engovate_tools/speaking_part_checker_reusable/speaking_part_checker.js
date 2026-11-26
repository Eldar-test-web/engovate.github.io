jQuery(document).ready(function ($) {

    var pronunciationJSON = null;
    var bandScoreJSON = null;

    // Publish at most one answer to the public UGC library per page load. Sent with the check request so
    // the server only attempts the publish on the first check.
    var ugcSaveUsedThisPageLoad = false;

    $(".speaking-part-checker-form").on("submit", async function (event) {
        event.preventDefault();

        //Check character count
        var checkResult = window.contentEditableDiv.checkContentEditorCharacterRequirement("The topic", "#speaking-part-topic");
        if (checkResult) {
            alert(checkResult);
            return;
        }

        var userAudioData = window.speakingPartCheckerReusable.getAudioRecorderData('#user-audio-record-wrapper');
        if (!userAudioData) {
            alert('Please record your answer!');
            return;
        }

        if (window.speakingPartCheckerReusable.getAudioRecorderRecordingTime('#user-audio-record-wrapper') < speaking_part_checker_ajax.mintime) {
            alert('Please record your answer for at least ' + speaking_part_checker_ajax.mintime + ' seconds!');
            return;
        }

        try {
            // 16 kHz mono, as MP3 when the encoder loads and WAV otherwise
            userAudioData = await convertAudioFileForUpload(userAudioData);
            
            //just reset the textarea to remove old highlight if any
            window.contentEditableDiv.resetContentEditor("#speaking-part-topic");

            var topic = window.contentEditableDiv.getContentEditorPlainText("#speaking-part-topic");

            //reset
            pronunciationJSON = null;
            bandScoreJSON = null;
            window.speakingPartCheckerReusable.resetSpeakingBandScoreContainer('#speaking-band-score-container');

            let formData = new FormData();
            formData.append('action', 'speaking_part_' + speaking_part_checker_ajax.partnumber + '_check');
            formData.append('speaking_part_' + speaking_part_checker_ajax.partnumber + '_checker_nonce', $('#speaking_part_' + speaking_part_checker_ajax.partnumber + '_checker_nonce').val());
            formData.append('audio_data', userAudioData);
            formData.append('topic', topic);
            formData.append('attempt_ugc_save', ugcSaveUsedThisPageLoad ? 0 : 1);

            var limitMessage = checkOrSaveRateLimit('speaking_part_' + speaking_part_checker_ajax.partnumber + '_check');
            if (limitMessage) {
                alert(limitMessage);
                $('.payment-popup-container').css('display', 'flex');
                return;
            }

            // Show loading state
            $('#pronunciation-result-container').hide();
            $(".submit-button").prop("disabled", true);
            $(".improve-button").prop("disabled", true);
            $(".enhance-natural-button").prop("disabled", true);
            $(".submit-button").text("Evaluating...");
            window.contentEditableDiv.setContentEditorReadOnly("#speaking-part-topic", true);
            $(".speaking-part-checker-form").after('<div class="spinner"></div>');

            // Two calls, and the marking happens on the Worker either way, so the band scores are
            // still worked out on the server from answers it alone can read.
            //
            // workerAudio is what lets the Worker do the SPEECH step too: for a part whose server
            // side asks for that, PHP answers the first call with ONE token and never reads the
            // recording, and the browser carries the bytes to the Worker instead - transcribe,
            // refine and mark all happen in a single Worker request. A part whose server side has
            // not been converted answers with the usual map of tokens, this option is ignored, and
            // the recording is handled exactly as it was before.
            //
            // Either way the second call drops the upload, unless the Worker could not transcribe -
            // then it is kept, because the server has to do the speech step itself.
            let data;
            try {
                data = await window.aiWorkerSealedCall({
                    ajaxurl: speaking_part_checker_ajax.ajaxurl,
                    formData: formData,
                    workerAudio: userAudioData
                });
            } catch (rejection) {
                // hardError is the server refusing outright - a spent limit, a topic that is too
                // long, an unverified account - which arrives as HTTP 200 with success:false.
                // Anything else is the request itself failing.
                var refused = rejection && rejection.hardError && rejection.hardError.data;
                if (refused && refused['error'] == 'rate_limit_exceeded') {
                    alert(checkOrSaveRateLimit('speaking_part_' + speaking_part_checker_ajax.partnumber + '_check', refused['retry_after']));
                    $('.payment-popup-container').css('display', 'flex');
                } else if (refused && refused['error'] == 'user_not_verified') {
                    $('.fast-verification-popup-container').css('display', 'flex');
                } else {
                    alert((refused && refused['message']) || "Error processing speech. There might be a problem with your browser. Please try again or switch to a different browser, preferably Google Chrome, for better compatibility.");
                }
                console.log(rejection);
                return;
            }

            if (!data) {
                alert("Error processing speech. There might be a problem with your browser. Please try again or switch to a different browser, preferably Google Chrome, for better compatibility.");
                console.log(data);
                return;
            }

            // Process successful response
            bandScoreJSON = data['content_result'];
            pronunciationJSON = data['pronunciation_result'];
            var textStatsResult = data['text_stats'];
            var wordRepetitions = data['word_repetitions'];

            window.speakingPartCheckerReusable.displayContentAssessmentResult('#speaking-band-score-container', bandScoreJSON);
            window.speakingPartCheckerReusable.displayTextStatsResult('#speaking-band-score-container', textStatsResult);
            window.speakingPartCheckerReusable.displayWordRepetitionResult('#speaking-band-score-container', wordRepetitions);
            // The word buttons play the file that was marked. The recorder's own player is empty when
            // the answer was uploaded instead of recorded, and nothing would play.
            window.speakingPartCheckerReusable.displaySpeechAccuracyResult('#pronunciation-result-container', pronunciationJSON, new Audio(URL.createObjectURL(userAudioData)));
            window.speakingPartCheckerReusable.setOnExportAnswerResultButtonClick('#speaking-band-score-container', topic, data);
            window.speakingPartCheckerReusable.setAudioRecorderScriptText('#user-audio-record-wrapper', pronunciationJSON['refined_transcript']);

            $('#pronunciation-result-container').show();

            // Allow the server to publish only on the first check of this page load.
            ugcSaveUsedThisPageLoad = true;

        } catch (error) {
            alert("Error processing speech. There might be a problem with your browser. Please try again or switch to a different browser, preferably Google Chrome, for better compatibility.");
            console.error(error);
        } finally {
            // Clean up regardless of success or failure
            $(".speaking-part-checker-form").siblings('.spinner').remove();
            $(".submit-button").prop("disabled", false);
            $(".improve-button").prop("disabled", false);
            $(".enhance-natural-button").prop("disabled", false);
            $(".submit-button").text("Check Speech");
            window.contentEditableDiv.setContentEditorReadOnly("#speaking-part-topic", false);
        }
    });

    //----AUDIO RECORDING----//
    window.speakingPartCheckerReusable.setUpAudioRecorder('#user-audio-record-wrapper', speaking_part_checker_ajax.maxtime,
        () => { //onStart
            $(".submit-button").prop("disabled", true);
            $(".improve-button").prop("disabled", true);
            $(".enhance-natural-button").prop("disabled", true);
        },
        () => { //onFinalized
            $(".submit-button").prop("disabled", false);
            $(".improve-button").prop("disabled", false);
            $(".enhance-natural-button").prop("disabled", false);
        }
    );

    //----GENERATE RANDOM QUESTION----//
    $(".generate-random-question-button").on("click", function (event) {
        generateRandomQuestion();
    });

    function generateRandomQuestion() {
        // if(!confirm('This will remove your current question and generate a new one. Are you sure you want to continue?')) {
        //     return;
        // }

        window.contentEditableDiv.setContentEditorPlainText('#speaking-part-topic', '');

        var action = 'speaking_part_' + speaking_part_checker_ajax.partnumber + '_generate_random_question';

        let formData = new FormData();
        formData.append('action', action);
        formData.append('speaking_part_' + speaking_part_checker_ajax.partnumber + '_checker_nonce', $('#speaking_part_' + speaking_part_checker_ajax.partnumber + '_checker_nonce').val());

        var limitMessage = checkOrSaveRateLimit(action);
        if (limitMessage) {
            alert(limitMessage);
            $('.payment-popup-container').css('display', 'flex');
            return;
        }

        $(".generate-random-question-button").prop("disabled", true);
        $(".generate-random-question-button").html("Randomizing... <i class='fa-solid fa-spinner fa-spin'></i>");

        window.aiWorkerCall({
            ajaxurl: speaking_part_checker_ajax.ajaxurl,
            formData: formData,
            json: true,
        })
            .then(function (json) {
                // Parts 1 and 3 come back as "questions", part 2 as "topics"; several come back and
                // choosing one is this tool's job, on either path.
                var items = json && (json['questions'] || json['topics']);
                if (!Array.isArray(items) || !items.length) {
                    alert("Error generating random question. Please try again.");
                    console.log(json);
                    return;
                }

                var question = window.contentEditableDiv.deepCleanText(items[Math.floor(Math.random() * items.length)]);
                window.contentEditableDiv.setContentEditorPlainText('#speaking-part-topic', question);

                //set timeout to make this run after the complete callback of the ajax call
                setTimeout(function() {
                    if(question.length > 20) {
                        $('.generate-random-question-button').html('<i class="fa-solid fa-shuffle"></i>');
                    }
                    else {
                        $('.generate-random-question-button').html('Randomize <i class="fa-solid fa-shuffle"></i>');
                    }
                }, 100);
            })
            .fail(function (rejection) {
                var response = rejection && rejection.hardError;

                if (response && response.data) {
                    if (response.data['error'] == 'rate_limit_exceeded') {
                        alert(checkOrSaveRateLimit(action, response.data['retry_after']));
                        $('.payment-popup-container').css('display', 'flex');
                    }
                    else if (response.data['error'] == 'user_not_verified') {
                        $('.fast-verification-popup-container').css('display', 'flex');
                    }
                    else {
                        alert("Error generating random question. Please try again.");
                    }
                }
                else {
                    alert("Error: Unable to generate random question. Please try again.");
                }
                console.log(response);
            })
            .always(function () {
                $(".generate-random-question-button").prop("disabled", false);
                $(".generate-random-question-button").html("Randomize <i class='fa-solid fa-shuffle'></i>");
            });
    }

    $(document).on('input paste keyup change', '#speaking-part-topic .content-editable-div', function(e) {
        //make the generate random question button less visible if the input is long. Prevent users from accidentally overwriting the text.
        if($(this).text().length > 20) {
            $('.generate-random-question-button').html('<i class="fa-solid fa-shuffle"></i>');
        }
        else {
            $('.generate-random-question-button').html('Randomize <i class="fa-solid fa-shuffle"></i>');
        }
    });

    //----NATURALNESS ENHANCEMENT----//
    $(".enhance-natural-button").on("click", function (event) {
        enhanceNaturalness();
    });

    function enhanceNaturalness() {
        //get answer and topic
        var topic = window.contentEditableDiv.getContentEditorPlainText("#speaking-part-topic");
        var answer = pronunciationJSON ? pronunciationJSON['refined_transcript'] : '';

        if (answer.trim().length == 0) {
            alert('Please check your speech first!');
            return;
        }

        //Check character count
        var checkResult = window.contentEditableDiv.checkContentEditorCharacterRequirement("The topic", "#speaking-part-topic");
        if (checkResult) {
            alert(checkResult);
            return;
        }

        //reset
        window.contentEditableDiv.setContentEditorPlainText('#unimproved-speech', '');
        window.contentEditableDiv.setContentEditorPlainText('#improved-speech', '');
        $('.compare-natural-container').hide();

        let formData = new FormData();
        formData.append('action', 'speaking_part_' + speaking_part_checker_ajax.partnumber + '_enhance_natural');
        formData.append('speaking_part_' + speaking_part_checker_ajax.partnumber + '_checker_nonce', $('#speaking_part_' + speaking_part_checker_ajax.partnumber + '_checker_nonce').val());
        formData.append('topic', topic);
        formData.append('answer', answer);

        window.textImproverReusable.loadDiff('#compare-natural-form',
            formData,
            () => { //beforeSend
                $(".improve-button").prop("disabled", true);
                $(".enhance-natural-button").prop("disabled", true);
                $(".submit-button").prop("disabled", true);
                $(".enhance-natural-button").text("Improving...");
                $(".speaking-part-checker-form").after('<div class="spinner"></div>');
            },
            () => { //onSuccess
                $('.compare-natural-container').show();
            },
            () => { //complete
                $(".improve-button").prop("disabled", false);
                $(".enhance-natural-button").prop("disabled", false);
                $(".submit-button").prop("disabled", false);
                $(".enhance-natural-button").text("Improve Naturalness");
                $(".speaking-part-checker-form").siblings('.spinner').remove();
            });
    }

    //----SPEECH IMPROVEMENT----//
    $(".improve-button").on("click", function (event) {
        improveUserSpeech();
    });

    function improveUserSpeech() {
        //get answer and topic
        var topic = window.contentEditableDiv.getContentEditorPlainText("#speaking-part-topic");
        var answer = pronunciationJSON ? pronunciationJSON['refined_transcript'] : '';

        if (answer.trim().length == 0) {
            alert('Please check your speech first!');
            return;
        }

        //Check character count
        var checkResult = window.contentEditableDiv.checkContentEditorCharacterRequirement("The topic", "#speaking-part-topic");
        if (checkResult) {
            alert(checkResult);
            return;
        }

        //reset
        window.contentEditableDiv.setContentEditorPlainText('#unenhanced-speech', '');
        window.contentEditableDiv.setContentEditorPlainText('#enhanced-speech', '');
        $('.compare-enhance-container').hide();

        let formData = new FormData();
        formData.append('action', 'speaking_part_' + speaking_part_checker_ajax.partnumber + '_improve');
        formData.append('speaking_part_' + speaking_part_checker_ajax.partnumber + '_checker_nonce', $('#speaking_part_' + speaking_part_checker_ajax.partnumber + '_checker_nonce').val());
        formData.append('topic', topic);
        formData.append('answer', answer);

        window.textImproverReusable.loadDiff('#compare-enhance-form',
            formData,
            () => { //beforeSend
                $(".improve-button").prop("disabled", true);
                $(".enhance-natural-button").prop("disabled", true);
                $(".submit-button").prop("disabled", true);
                $(".improve-button").text("Enhancing...");
                $(".speaking-part-checker-form").after('<div class="spinner"></div>');
            },
            () => { //onSuccess
                $('.compare-enhance-container').show();
            },
            () => { //complete
                $(".improve-button").prop("disabled", false);
                $(".enhance-natural-button").prop("disabled", false);
                $(".submit-button").prop("disabled", false);
                $(".improve-button").text("Enhance Speech");
                $(".speaking-part-checker-form").siblings('.spinner').remove();
            });
    }

    //---- PLAY TTS AUDIO ---//
    $(".male-audio-button, .female-audio-button").on("click", function (e) {
        let audioButton = $(this);
        let isThisPlaying = audioButton.attr('playing');

        //no matter which button, just reset all
        $(".male-audio-button, .female-audio-button").find('i').replaceWith('<i class="fa-solid fa-volume-high"></i>');
        $(".male-audio-button, .female-audio-button").attr('playing', 'false');
        window.TTSAudio.stopTTSAudio();

        if (!isThisPlaying || isThisPlaying == 'false') {
            window.TTSAudio.playTTSAudio($(this).parent().find('.content-editable-div').text(), false, audioButton.text().includes('Male'), () => {
                audioButton.find('i').replaceWith('<i class="fa-solid fa-volume-high"></i>');
                audioButton.attr('playing', 'false');
            });

            audioButton.find('i').replaceWith('<i class="fa-solid fa-pause"></i>');
            audioButton.attr('playing', 'true');
        }
    });

    //--- DOWNLOAD AUDIO ---//
    $(".download-male-audio-button, .download-female-audio-button").on("click", function (e) {
        let audioButton = $(this);
        let audioType = audioButton.text().includes('Male') ? 'male' : 'female';
        let text = $(this).parent().find('.content-editable-div').text();

        if (text.trim().length == 0) {
            alert('There is no text to generate audio from!');
            return;
        }

        window.speechDownloader.downloadAudio(text, audioType, () => {
            audioButton.prop("disabled", true);
            audioButton.find('i').replaceWith('<i class="fa-solid fa-spinner fa-spin"></i>');
        }, () => {
            audioButton.prop("disabled", false);
            audioButton.find('i').replaceWith('<i class="fa-solid fa-download"></i>');
        });
    });

    //---- CONVERT AUDIO FILE FOR UPLOAD ----//
    // Shared by every submit on the page, so the encoder is fetched once at most.
    let mp3EncoderLoaded = null;

    async function convertAudioFileForUpload(file) {
        let audioContext = null;
        
        return new Promise((resolve, reject) => {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const reader = new FileReader();
    
            reader.onload = async function(e) {
                try {
                    const buffer = await audioContext.decodeAudioData(e.target.result);
                    const duration = buffer.duration;
    
                    // Use 16kHz sample rate to reduce the file size
                    const targetSampleRate = 16000;
                    const numberOfSamples = Math.floor(
                        duration * targetSampleRate
                    );
                    
                    const offlineAudioContext = new OfflineAudioContext(
                        1, // mono
                        numberOfSamples,
                        targetSampleRate
                    );
    
                    const soundSource = offlineAudioContext.createBufferSource();
                    soundSource.buffer = buffer;
                    soundSource.connect(offlineAudioContext.destination);
                    soundSource.start();
    
                    try {
                        const renderedBuffer = await offlineAudioContext.startRendering();

                        // MP3 is about a fifth of the size of WAV, and on a slow phone connection the
                        // upload is most of the wait. The encoder is fetched the first time someone
                        // submits rather than with the page, because most visitors never do. If it
                        // cannot be had - a network that blocks the CDN, or one that hangs - the
                        // answer goes as WAV, as it always has.
                        mp3EncoderLoaded = mp3EncoderLoaded || new Promise((settled) => {
                            const script = document.createElement('script');
                            script.src = 'https://cdn.jsdelivr.net/npm/lamejs@1.2.1/lame.min.js';
                            // Settles whether or not the script arrives; window.lamejs below says which.
                            script.onload = settled;
                            script.onerror = settled;
                            // A blocked CDN can hang instead of failing, and the learner is waiting.
                            setTimeout(settled, 5000);
                            document.head.appendChild(script);
                        });
                        await mp3EncoderLoaded;

                        let newFile = null;
                        if (window.lamejs) {
                            try {
                                const samples = renderedBuffer.getChannelData(0);
                                const pcm = new Int16Array(samples.length);
                                for (let i = 0; i < samples.length; i++) {
                                    // The same 16-bit conversion audioBufferToWav uses.
                                    pcm[i] = Math.max(-1, Math.min(1, samples[i])) * 0x7fff;
                                }

                                // Mono, 48 kbps. At 32 kbps the word scores drifted further from WAV in testing.
                                const encoder = new window.lamejs.Mp3Encoder(1, renderedBuffer.sampleRate, 48);
                                const chunks = [];
                                // 1152 samples is one MP3 frame, the size the encoder works in.
                                for (let n = 0; n < pcm.length; n += 1152) {
                                    const chunk = encoder.encodeBuffer(pcm.subarray(n, n + 1152));
                                    if (chunk.length) chunks.push(chunk);
                                }
                                const tail = encoder.flush();
                                if (tail.length) chunks.push(tail);

                                newFile = new File(chunks, file.name, { type: 'audio/mpeg' });
                            } catch (mp3Error) {
                                // A device the encoder does not run on should still be able to submit.
                            }
                        }
                        if (!newFile) {
                            newFile = new File([audioBufferToWav(renderedBuffer)], file.name, { type: 'audio/wav' });
                        }
                        resolve(newFile);
                    } catch (renderError) {
                        reject(`Error rendering audio: ${renderError}`);
                    }
                } catch (decodeError) {
                    reject(`Error decoding audio data: ${decodeError}`);
                } finally {
                    // Clean up AudioContext
                    if (audioContext && audioContext.state !== 'closed') {
                        await audioContext.close();
                    }
                }
            };
    
            reader.onerror = function(error) {
                reject(`Error reading audio file: ${error}`);
                if (audioContext && audioContext.state !== 'closed') {
                    audioContext.close();
                }
            };
    
            reader.readAsArrayBuffer(file);
        });
    }

    // Helper function to convert an AudioBuffer to a WAV file
    function audioBufferToWav(buffer) {
        const numChannels = buffer.numberOfChannels;
        const sampleRate = buffer.sampleRate;
        const format = 1; // PCM
        const bitDepth = 16;

        const samples = buffer.length;
        const blockAlign = numChannels * (bitDepth / 8);
        const byteRate = sampleRate * blockAlign;
        const dataSize = samples * blockAlign;
        const fileSize = 44 + dataSize;

        const wavBuffer = new ArrayBuffer(fileSize);
        const view = new DataView(wavBuffer);

        // RIFF chunk descriptor
        writeString(view, 0, "RIFF");
        view.setUint32(4, fileSize - 8, true); // File size minus RIFF and size fields
        writeString(view, 8, "WAVE");

        // fmt sub-chunk
        writeString(view, 12, "fmt ");
        view.setUint32(16, 16, true); // Subchunk size
        view.setUint16(20, format, true); // Audio format (PCM)
        view.setUint16(22, numChannels, true); // Number of channels
        view.setUint32(24, sampleRate, true); // Sample rate
        view.setUint32(28, byteRate, true); // Byte rate
        view.setUint16(32, blockAlign, true); // Block align
        view.setUint16(34, bitDepth, true); // Bits per sample

        // data sub-chunk
        writeString(view, 36, "data");
        view.setUint32(40, dataSize, true); // Data size

        // Write PCM samples
        let offset = 44;
        const interleave = (buffers) => {
            const result = new Float32Array(buffers[0].length * buffers.length);
            for (let i = 0; i < buffers[0].length; i++) {
                for (let channel = 0; channel < buffers.length; channel++) {
                    result[i * buffers.length + channel] = buffers[channel][i];
                }
            }
            return result;
        };

        const interleaved = interleave(
            Array.from({ length: numChannels }, (_, i) => buffer.getChannelData(i))
        );

        for (let i = 0; i < interleaved.length; i++, offset += 2) {
            const sample = Math.max(-1, Math.min(1, interleaved[i])); // Clamp to [-1, 1]
            view.setInt16(offset, sample * 0x7fff, true); // Convert to 16-bit PCM
        }

        return new Blob([wavBuffer], { type: "audio/wav" });
    }

    function writeString(view, offset, string) {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    }

    //--- ASK BEFORE LEAVING ---//
    window.addEventListener("beforeunload", (event) => {
        event.preventDefault();
        event.returnValue = ""; // This will trigger the default browser message
    });
});