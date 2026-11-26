jQuery(document).ready(function($) {

    // The last couple of turns plus a running summary, sent with each message.
    var userLastMessages = [];
    var aiLastMessages = [];
    var summarizedContext = '';

    var $messages = $('#ielts-mentor-messages');
    var $input = $('#ielts-mentor-input');
    var $form = $('#ielts-mentor-form');
    var $sendButton = $form.find('.ielts-mentor-send');

    function scrollToBottom() {
        $messages.scrollTop($messages[0].scrollHeight);
    }

    function pushTrimmed(arr, value) {
        arr.push(value);
        while (arr.length > 2) {
            arr.shift();
        }
    }

    function appendUserMessage(text) {
        var $wrap = $('<div class="mentor-message-wrapper mentor-user-message"></div>');
        var $bubble = $('<div class="mentor-bubble"></div>');
        $bubble.append($('<span class="mentor-text"></span>').text(text));
        $wrap.append($bubble);
        $messages.append($wrap);
        scrollToBottom();
    }

    function appendAiMessage(text, recommended) {
        var $wrap = $('<div class="mentor-message-wrapper mentor-ai-message"></div>');
        var $bubble = $('<div class="mentor-bubble"></div>');
        // The audio button and the text must stay side by side in the bubble: playAudioOnButton reads
        // the text next to the button and puts the generated <audio> right after it.
        $bubble.append('<span class="mentor-audio-button"><i class="fa-solid fa-caret-right"></i></span>');
        $bubble.append($('<span class="mentor-text"></span>').text(text));
        $wrap.append($bubble);

        // The cards sit under the bubble, not in it, so they are never read aloud.
        if (recommended && recommended.length) {
            var $res = $('<div class="mentor-resources"></div>');
            $res.append('<div class="mentor-resources-title">Recommended on our site:</div>');
            recommended.forEach(function(r) {
                var $a = $('<a class="mentor-resource-card" target="_blank" rel="noopener"></a>').attr('href', r.url);
                $a.append($('<span class="mentor-resource-type"></span>').text(r.type));
                $a.append($('<span class="mentor-resource-title"></span>').text(r.title));
                $res.append($a);
            });
            $wrap.append($res);
        }

        $messages.append($wrap);
        scrollToBottom();
        return $wrap;
    }

    function sendMessage() {
        // This send is the last tap before the reply is auto-played from the AJAX callback, so it is our
        // chance to start the shared AudioContext while the tap still counts - iOS refuses to start it
        // from the callback. Doing it here covers both the Send button and the Enter key.
        unlockAvatarAudioContext();

        var message = $.trim($input.val());
        if (message === '' || message === 'Recording...' || message === 'Finalizing input...') {
            return;
        }

        var limitMessage = checkOrSaveRateLimit('chat_with_ielts_mentor');
        if (limitMessage) {
            alert(limitMessage);
            $('.payment-popup-container').css('display', 'flex');
            return;
        }

        appendUserMessage(message);
        $messages.find('.mentor-starters').remove();
        setAndResizeTextArea($input, '');
        $sendButton.prop('disabled', true);

        var $typing = $('<div class="mentor-message-wrapper mentor-ai-message"><div class="mentor-bubble mentor-indicator"><span>.</span><span>.</span><span>.</span></div></div>');
        $messages.append($typing);
        scrollToBottom();

        var formData = new FormData();
        formData.append('action', 'chat_with_ielts_mentor');
        formData.append('ielts_mentor_nonce', $('#ielts_mentor_nonce').val());
        formData.append('message', message);
        formData.append('summarized_context', summarizedContext);
        userLastMessages.forEach(function(m) { formData.append('user_last_messages[]', m); });
        aiLastMessages.forEach(function(m) { formData.append('ai_last_messages[]', m); });

        // The pages the reply can recommend; the reply refers to them by their number in this list.
        var resources = [];

        window.aiWorkerCall({
            ajaxurl: engnovate_ielts_mentor_ajax.ajaxurl,
            formData: formData,
            json: true,
            onReply: function(data) {
                resources = (data && data.resources) || [];
            }
        })
            .then(function(json) {
                // Remove any list numbers written into the reply text; the links show under the reply.
                var reply = String((json && json.response) || '').replace(/\s*(?:recommended_resources\s*:?\s*\[[^\]]*\]|\[\s*recommended_resources\s*\]|\[\d+(?:\s*,\s*\d+)*\])/gi, '').trim()
                    || 'Sorry, I could not answer that. Please try rephrasing.';

                // At most three cards, and never the same page twice.
                var recommended = [];
                if (json && $.isArray(json.recommended_resources)) {
                    json.recommended_resources.forEach(function(index) {
                        var resource = resources[parseInt(index, 10)];
                        if (resource && recommended.length < 3 && recommended.indexOf(resource) === -1) {
                            recommended.push(resource);
                        }
                    });
                }

                var $wrap = appendAiMessage(reply, recommended);

                pushTrimmed(userLastMessages, message);
                pushTrimmed(aiLastMessages, reply);
                if (json && json.summary) {
                    summarizedContext = json.summary;
                }

                // Set audio button voice id
                var selectedVoiceId = $('#ielts-mentor-voice-selector').data('value');
                var aiAudioButton = $wrap.find('.mentor-audio-button');
                aiAudioButton.data('voice-id', selectedVoiceId);
                if ($('#ielts-mentor-autoplay').prop('checked')) {
                    playAudioOnButton(aiAudioButton);
                }
            })
            // The message was refused: show the reason, and the upgrade or verify popup when it applies.
            .fail(function(rejection) {
                var err = (rejection && rejection.hardError && rejection.hardError.data) || {};
                if (err.error === 'rate_limit_exceeded') {
                    alert(checkOrSaveRateLimit('chat_with_ielts_mentor', err.retry_after));
                    $('.payment-popup-container').css('display', 'flex');
                } else if (err.error === 'user_not_verified') {
                    $('.fast-verification-popup-container').css('display', 'flex');
                }
                appendAiMessage(err.message || 'Sorry, something went wrong. Please try again.', []);
            })
            .always(function() {
                $typing.remove();
                $sendButton.prop('disabled', false);
            });
    }

    $form.on('submit', function(e) {
        e.preventDefault();
        sendMessage();
    });

    // Starter questions under the greeting: a tap sends the question as if the learner had typed it,
    // then puts back anything the learner had already typed in the box.
    $messages.on('click', '.mentor-starter', function() {
        var draft = $input.val();
        setAndResizeTextArea($input, $(this).text());
        sendMessage();
        setAndResizeTextArea($input, draft);
    });

    // Enter to send, Shift+Enter for a newline.
    $input.on('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // Resolves with { url } for a clip that has fully arrived, or { url, whole } for one still arriving:
    // url plays it as it comes, and whole resolves with a URL for the complete clip once the last piece is in.
    function generateMentorAudio(text, voiceId) {
        return new Promise((resolve, reject) => {
            var limitMessage = checkOrSaveRateLimit('do_ielts_mentor_audio_generation');
            if (limitMessage) {
                alert(limitMessage);
                $('.payment-popup-container').css('display', 'flex');
                reject(new Error(limitMessage));
                return;
            }

            let formData = new FormData();
            formData.append('action', 'do_ielts_mentor_audio_generation');
            formData.append('ielts_mentor_nonce', $('#ielts_mentor_nonce').val());
            formData.append('message', text);
            formData.append('voice', voiceId);

            window.aiWorkerCall({
                ajaxurl: engnovate_ielts_mentor_ajax.ajaxurl,
                formData: formData,
                stream: true,
            })
                .then(function (answer) {
                    if (!answer) {
                        reject(new Error('Failed to generate audio'));
                        return;
                    }

                    // Streamed: the pieces go to the player as they arrive, so it starts before the clip is
                    // finished. The player takes one piece at a time, so feed() hands over the next whenever
                    // it is free. Every piece is also kept, to make the complete clip for replays.
                    if (answer instanceof Response) {
                        // iPhones have no MediaSource, only Apple's ManagedMediaSource (iOS 17.1+), which is fed the same way.
                        var MediaSourceType = window.MediaSource || window.ManagedMediaSource;
                        var mediaSource = (MediaSourceType && MediaSourceType.isTypeSupported('audio/mpeg')) ? new MediaSourceType() : null;
                        var sourceBuffer = null;
                        var reader = answer.body.getReader();
                        var chunks = [];
                        var fed = 0;
                        var finished = false;

                        var feed = function () {
                            // Not before the player has opened the stream, not while it is busy with a piece, and
                            // not once it has let go of it - stopped early, the pieces are still kept for replays.
                            if (!sourceBuffer || sourceBuffer.updating || mediaSource.readyState !== 'open') {
                                return;
                            }
                            if (fed < chunks.length) {
                                sourceBuffer.appendBuffer(chunks[fed++]);
                            }
                            else if (finished) {
                                mediaSource.endOfStream();
                            }
                        };

                        if (mediaSource) {
                            mediaSource.addEventListener('sourceopen', function () {
                                sourceBuffer = mediaSource.addSourceBuffer('audio/mpeg');
                                sourceBuffer.addEventListener('updateend', feed);
                                feed();
                            }, { once: true });
                        }

                        var whole = (function read() {
                            return reader.read().then(function (piece) {
                                if (piece.done) {
                                    finished = true;
                                    feed();
                                    return URL.createObjectURL(new Blob(chunks, { type: 'audio/mpeg' }));
                                }
                                chunks.push(piece.value);
                                feed();
                                return read();
                            });
                        })();

                        // The stream broke part-way. The player ends on what it already has, like a finished
                        // clip, rather than waiting for pieces that will not come.
                        whole.catch(function () {
                            finished = true;
                            feed();
                        });

                        // A browser that cannot play MP3 this way (such as an iPhone before iOS 17.1) waits for the
                        // complete clip, as before.
                        if (!mediaSource) {
                            resolve(whole.then(function (url) { return { url: url }; }));
                            return;
                        }

                        resolve({ url: URL.createObjectURL(mediaSource), whole: whole });
                        return;
                    }

                    // Convert base64 to blob
                    var byteCharacters = atob(answer);
                    var byteNumbers = new Array(byteCharacters.length);
                    for (var i = 0; i < byteCharacters.length; i++) {
                        byteNumbers[i] = byteCharacters.charCodeAt(i);
                    }
                    var byteArray = new Uint8Array(byteNumbers);
                    // Read the audio type from its first bytes: Safari will not play a blob whose declared type is wrong.
                    var isRiffWav = byteArray[0] === 0x52 && byteArray[1] === 0x49 && byteArray[2] === 0x46 && byteArray[3] === 0x46;
                    var blob = new Blob([byteArray], { type: isRiffWav ? 'audio/wav' : 'audio/mpeg' });
                    resolve({ url: URL.createObjectURL(blob) });
                })
                .fail(function (rejection) {
                    var response = rejection && rejection.hardError;

                    if (response && response.data) {
                        if (response.data['error'] == 'rate_limit_exceeded') {
                            alert(checkOrSaveRateLimit('do_ielts_mentor_audio_generation', response.data['retry_after']));
                            $('.payment-popup-container').css('display', 'flex');
                            reject(new Error(response.data['message']));
                        }
                        else if (response.data['error'] == 'user_not_verified') {
                            $('.fast-verification-popup-container').css('display', 'flex');
                            reject(new Error(response.data['message']));
                        }
                        else if (response.data['error'] && response.data['message']) {
                            if (response.data['error'] == 'invalid_input') { alert(response.data['message']); }
                            reject(new Error(response.data['message']));
                        }
                        else {
                            reject(new Error('Failed to generate audio'));
                        }
                    }
                    else {
                        reject(new Error('Failed to generate audio'));
                    }
                });
        });
    }

    $(document).on('click', '.mentor-audio-button', function () {
        playAudioOnButton($(this));
    });

    function playAudioOnButton(audioButton) {
        // Runs straight inside the click or send that started this playback, so the shared
        // AudioContext is started while the tap still counts. Later replies reuse that running context.
        unlockAvatarAudioContext();

        // prevent the double click case when the audio is about to play or server is generating audio
        if(audioButton.hasClass('disabled')) {
            return;
        }

        let isThisPlaying = audioButton.attr('playing');

        //no matter which button, just reset all
        $('.mentor-audio-button').html('<i class="fa-solid fa-caret-right"></i>');
        $('.mentor-audio-button').attr('playing', 'false');

        //find all audio elements and stop them
        window.TTSAudio.stopTTSAudio();
        $('.mentor-audio-button').closest('.mentor-ai-message').find('audio').each(function() {
            $(this)[0].pause();
            $(this)[0].currentTime = 0;
        });
        if(avatarModel) {
            stopAvatarSpeech();
        }

        // If the current button is already playing, we have already stopped it in the previous step, so we can just return
        if(isThisPlaying == 'true') {
            return;
        }

        // get the voice id
        var voiceId = audioButton.data('voice-id');

        if(!voiceId) {
            voiceId = $('#ielts-mentor-voice-selector').data('value');
            audioButton.data('voice-id', voiceId);
        }

        // before actually playing, set the loading state
        audioButton.addClass('disabled');
        audioButton.html('<i class="fa-solid fa-spinner fa-spin"></i>');

        // mark this button as playing
        audioButton.attr('playing', 'true');

        //browser voice
        if(voiceId == "browser-male" || voiceId == "browser-female") {
            // The browser voice gives the avatar no audio to measure, so the mouth is moved from the
            // text instead. The rate matches what tts_audio.js sets for each voice, so the guessed
            // position keeps pace with the real voice.
            var browserVoiceText = audioButton.siblings('.mentor-text').text();
            var isBrowserMaleVoice = voiceId == "browser-male";
            // ~13 characters/second matches English speech at rate 1.0 (roughly 155 words a minute).
            // 15 ran the mouth ahead of the voice.
            var browserVoiceRate = 13 * (isBrowserMaleVoice ? 1 : 0.9);
            var browserVoiceToken = ++browserVoiceUtteranceToken;
            window.TTSAudio.playTTSAudio(browserVoiceText, false, isBrowserMaleVoice, () => {
                if (browserVoiceToken === browserVoiceUtteranceToken) {
                    calibrateBrowserVoiceRate();
                    stopBrowserVoiceLipSync();
                }
                $('.mentor-audio-button').html('<i class="fa-solid fa-caret-right"></i>');
                $('.mentor-audio-button').attr('playing', 'false');
            }, () => {
                if (browserVoiceToken !== browserVoiceUtteranceToken) {
                    return; // replaced before this line ever began
                }
                // Start when the voice really starts rather than when speak() is called - the voice
                // takes a moment to begin, and starting early left the mouth a step ahead of it.
                startBrowserVoiceLipSync(browserVoiceText, browserVoiceRate);
            });
            setTimeout(() => { //a little hack to fix the case when users click between different audio buttons and the onEnd event of the previous button get called, which will mess up the state of the current button
                audioButton.html('<i class="fa-solid fa-pause"></i>');
                audioButton.removeClass('disabled');
            }, 100);
        }
        else { // AI server voice
            var audio = audioButton.closest('.mentor-ai-message').find('audio');
            // A streamed clip that has not been played yet.
            var streamUrl = audio.data('stream-url');

            // if no audio element, generate audio from server
            if(audio.length == 0 || (audio[0].src == '' && !streamUrl)) {
                generateMentorAudio(audioButton.siblings('.mentor-text').text(), voiceId)
                .then(function(result) {
                    // Add the audio source to the ai message
                    var audioElement = $('<audio></audio>').css('display', 'none');
                    if (result.whole) {
                        // Still arriving. A stream can only be played once, so it is kept for the first play
                        // and the complete clip for every play after. The element takes the complete clip
                        // unless the first play has already given it the stream.
                        audioElement.data('stream-url', result.url);
                        result.whole.then(function(wholeUrl) {
                            audioElement.data('whole-url', wholeUrl);
                            if (!audioElement.attr('src')) {
                                audioElement.attr('src', wholeUrl);
                            }
                        }, function() {
                            // The stream broke part-way, so it is forgotten and the next click asks for the audio again.
                            audioElement.removeAttr('src').removeData('stream-url');
                        });
                    }
                    else {
                        audioElement.attr('src', result.url);
                    }
                    audioButton.after(audioElement);
                    audioButton.attr('playing', 'false');
                    audioButton.html('<i class="fa-solid fa-caret-right"></i>');
                    audioButton.removeClass('disabled');
                    playAudioOnButton(audioButton); // call this function again to play the audio
                })
                .catch(function(error) {
                    console.error('Failed to generate audio:', error);
                    // fallback to browser voice audio if failed
                    audioButton.data('voice-id', 'browser-male');
                    audioButton.attr('playing', 'false');
                    audioButton.html('<i class="fa-solid fa-caret-right"></i>');
                    audioButton.removeClass('disabled');
                    playAudioOnButton(audioButton); // call this function again to play the audio
                });
            }
            else {
                audio.removeData('stream-url');

                // if not having avatar model, use the standard way to play the audio
                if(!avatarModel || !$('#ielts-mentor-show-avatar').is(':checked')) {
                    // Replays use the complete clip once it has arrived, because Apple's player (iPhones) may
                    // drop what it has already played to save memory.
                    var wholeUrl = audio.data('whole-url');
                    if (wholeUrl && audio[0].src != wholeUrl) {
                        audio[0].src = wholeUrl;
                    }
                    // The first play of a streamed clip plays the stream on this element. Apple's player only
                    // starts on an element with AirPlay switched off.
                    else if (audio[0].src == '') {
                        audio[0].disableRemotePlayback = true;
                        audio[0].src = streamUrl;
                    }

                    audio[0].addEventListener('canplaythrough', function() {
                        audioButton.html('<i class="fa-solid fa-pause"></i>');
                        audioButton.removeClass('disabled');
                    }, { once: true });

                    audio[0].addEventListener('ended', function() {
                        audioButton.attr('playing', 'false');
                        audioButton.html('<i class="fa-solid fa-caret-right"></i>');
                        audioButton.removeClass('disabled');
                    }, { once: true });

                    audio[0].addEventListener('error', function() {
                        audioButton.attr('playing', 'false');
                        audioButton.html('<i class="fa-solid fa-caret-right"></i>');
                        audioButton.removeClass('disabled');
                        console.error('Failed to play voice audio');
                    }, { once: true });

                    // play audio
                    audio[0].play().catch(function(error) {
                        audioButton.attr('playing', 'false');
                        audioButton.html('<i class="fa-solid fa-caret-right"></i>');
                        audioButton.removeClass('disabled');
                        console.error('Failed to play voice audio:', error);
                    });
                }
                else {
                    audioButton.html('<i class="fa-solid fa-pause"></i>');
                    audioButton.removeClass('disabled');

                    triggerAvatarSpeech({
                        // The avatar opens its own copy each time, so it needs one nothing else is playing:
                        // the complete clip once it has arrived, the stream before that.
                        audio_url: audio.data('whole-url') || streamUrl || audio[0].src,
                        motion_category: $('#ielts-mentor-avatar-selector').find('option:selected').data('speaking-motion-category'),
                        animation_index: $('#ielts-mentor-avatar-selector').find('option:selected').data('speaking-motion-index'),
                        on_finish: function() {
                            audioButton.html('<i class="fa-solid fa-caret-right"></i>');
                            audioButton.attr('playing', 'false');
                        }
                    });
                }
            }
        }
    }

    //---- AUDIO INPUT ----//
    // Microphone -> text, via the shared audio recorder's browser speech recognition.
    if (window.audioRecorderReusable && window.audioRecorderReusable.setOnDoRecordingEvent) {
        window.audioRecorderReusable.setOnDoRecordingEvent('#ielts-mentor-voice-input-recorder', 120, true,
            () => { //onStart
                setAndResizeTextArea($input, 'Recording...');
                $sendButton.prop('disabled', true);
            },
            (elapsedTime, percentage) => { //onTimerFill

            },
            (transcript) => { //onInterimTranscriptUpdate

            },
            (transcript) => { //onFullTranscriptUpdate
                setAndResizeTextArea($input, transcript);
            },
            () => { //onStop
                setAndResizeTextArea($input, 'Finalizing input...');
            },
            (audioData, duration, transcript) => { //onFinalized
                setAndResizeTextArea($input, transcript);
                $sendButton.prop('disabled', false);
                // Only the text is needed, so bring the mic button back and throw the recording away.
                // The recorder shows its recorded-audio player before this runs, so this reset sticks.
                window.audioRecorderReusable.resetAudioRecorder('#ielts-mentor-voice-input-recorder', true);
            }
        );

        window.audioRecorderReusable.setOnClickStopRecordingEvent('#ielts-mentor-voice-input-recorder', function() {});

        window.audioRecorderReusable.setOnRecordedAudioPlayerCloseEvent('#ielts-mentor-voice-input-recorder', true, function () {
            setAndResizeTextArea($input, '');
        });
    }

    //--- LOCAL SETTINGS MANAGER ---//
    // The keys start with "ieltsMentor" so the mentor neither picks up nor changes AI Conversation's settings.
    function loadLocalSettings() {
        var savedVoice = localStorage.getItem('ieltsMentorSelectedVoice');
        if(!savedVoice) {
            savedVoice = $('#ielts-mentor-default-voice-id').val();
        }
        // A previously saved voice may no longer exist in the dropdown. Fall back to the
        // default instead of leaving the selector empty, which would send an invalid voice.
        if ($('.mentor-voice-dropdown-item[data-value="' + savedVoice + '"]').length === 0) {
            savedVoice = $('#ielts-mentor-default-voice-id').val();
            localStorage.setItem('ieltsMentorSelectedVoice', savedVoice);
        }
        var dropdownItem = $('.mentor-voice-dropdown-item[data-value="' + savedVoice + '"]');
        if (dropdownItem.length > 0) {
            var voiceName = dropdownItem.find('span').text();
            $('.mentor-voice-dropdown-text').text(voiceName);
            $('#ielts-mentor-voice-selector').data('value', savedVoice);
            dropdownItem.addClass('selected');
        }

        var savedIsAutoPlayAIAudio = localStorage.getItem('ieltsMentorIsAutoPlayAIAudio');
        if (savedIsAutoPlayAIAudio) {
            $('#ielts-mentor-autoplay').prop('checked', savedIsAutoPlayAIAudio == 'true');
        }

        var savedAvatarModel = localStorage.getItem('ieltsMentorAvatarModel');
        if (savedAvatarModel) {
            $('#ielts-mentor-avatar-selector').val(savedAvatarModel);
            // initialize the avatar model will be done in the Avatar Manager section
        }

        var savedShowAvatar = localStorage.getItem('ieltsMentorShowAvatar');
        if (savedShowAvatar) {
            $('#ielts-mentor-show-avatar').prop('checked', savedShowAvatar == 'true');
            $('#ielts-mentor').toggleClass('hide-avatar', savedShowAvatar == 'false');
        }
    };

    // Load settings on page load. Make sure this load first before initializing any UI settings.
    loadLocalSettings();

    //--- AVATAR MANAGER ---//
    var avatarModel = null;
    var avatarApp = null;
    var currentAvatarModelUrl = null;

    $('#ielts-mentor-avatar-selector').on('change', function () {
        var avatarModel = $(this).val();
        localStorage.setItem('ieltsMentorAvatarModel', avatarModel);

        // get the avatar url from the selected option
        var avatarUrl = $(this).find('option:selected').data('avatar-url');
        initializeAvatarModel(avatarUrl);
    });

    // Initialize Avatar Model
    async function initializeAvatarModel(modelUrl = 'https://cdn.jsdelivr.net/gh/RaSan147/pixi-live2d-display@0.5.0-ls-8/test/assets/shizuku/shizuku.model.json') {
        if(currentAvatarModelUrl == modelUrl || !modelUrl) {
            return;
        }

        try {
            if (typeof window.PIXI === 'undefined' || typeof window.PIXI.live2d === 'undefined') {
                console.warn('Avatar libraries not loaded, skipping model initialization');
                document.getElementById('ielts-mentor-avatar-canvas').style.display = 'none';
                return;
            }

            console.log('Initializing new avatar model...');

            document.getElementById('ielts-mentor-avatar-canvas').style.display = 'none'; //display later after the model is loaded
            $('.ielts-mentor-avatar-container').find('.avatar-model-error').remove();
            $('.ielts-mentor-avatar-container').append('<div class="avatar-model-loading" style="font-style: italic; font-size: 20px; text-align: center;margin-bottom: 20px;">Loading avatar model...</div>');

            const { Application, Ticker } = window.PIXI;
            const { Live2DModel, ZipLoader } = window.PIXI.live2d;

            // Clean up existing avatar model
            if (avatarModel) {
                try {
                    // First, try to remove from stage if it's still there
                    if (avatarApp && avatarApp.stage && avatarModel.parent) {
                        avatarApp.stage.removeChild(avatarModel);
                    }

                    // Then try to destroy the model
                    if (typeof avatarModel.destroy === 'function') {
                        avatarModel.destroy();
                    }
                } catch (error) {
                    console.warn('Error destroying avatar model:', error);
                }
                avatarModel = null;
                stopBrowserVoiceLipSync(); // drop the handler before the model goes
                console.log('Old avatar model destroyed');
            }

            // Create PIXI application
            if (!avatarApp) {
                avatarApp = new Application({
                    view: document.getElementById('ielts-mentor-avatar-canvas'),
                    backgroundAlpha: 0
                });
            } else {
                try {
                    avatarApp.stage.removeChildren();
                } catch (error) {
                    console.warn('Error cleaning up stage:', error);
                }
            }

            // Only load JSZip if the model URL is a zip file
            if (modelUrl.toLowerCase().endsWith('.zip')) {
                const JSZip = await loadJSZip();

                // Configure ZipLoader to load zip files
                ZipLoader.zipReader = (data, url) => JSZip.loadAsync(data);

                ZipLoader.readText = (jsZip, path) => {
                    const file = jsZip.file(path);
                    if (!file) {
                        throw new Error('Cannot find file: ' + path);
                    }
                    return file.async('text');
                };

                ZipLoader.getFilePaths = (jsZip) => {
                    const paths = [];
                    jsZip.forEach(relativePath => paths.push(relativePath));
                    return Promise.resolve(paths);
                };

                ZipLoader.getFiles = (jsZip, paths) =>
                    Promise.all(paths.map(async path => {
                        const fileName = path.slice(path.lastIndexOf('/') + 1);
                        const blob = await jsZip.file(path).async('blob');
                        return new File([blob], fileName);
                    }));
            }

            avatarModel = await Live2DModel.from(modelUrl, {
                ticker: Ticker.shared,
                autoFocus: false
            });

            // Add model to stage
            avatarApp.stage.addChild(avatarModel);

            // Show the avatar canvas
            document.getElementById('ielts-mentor-avatar-canvas').style.display = 'block';

            // Position and scale the model
            avatarModel.x = avatarApp.screen.width / 2;
            avatarModel.y = avatarApp.screen.height / 2;
            avatarModel.anchor.set(0.5, 0.5);

            // Calculate scale to fit height without stretching
            const canvasHeight = avatarApp.screen.height;
            const modelHeight = avatarModel.height;
            const scaleFactor = canvasHeight / modelHeight;

            // Apply uniform scaling to maintain aspect ratio
            avatarModel.scale.set(scaleFactor, scaleFactor);

            currentAvatarModelUrl = modelUrl;
        } catch (error) {
            console.error('Failed to initialize Avatar model:', error);
            // Clean up avatar model
            if (avatarModel) {
                try {
                    // First, try to remove from stage if it's still there
                    if (avatarApp && avatarApp.stage && avatarModel.parent) {
                        avatarApp.stage.removeChild(avatarModel);
                    }

                    // Then try to destroy the model
                    if (typeof avatarModel.destroy === 'function') {
                        avatarModel.destroy();
                    }

                    avatarApp.stage.removeChildren();
                } catch (error) {
                    console.warn('Error destroying avatar model:', error);
                }
            }
            avatarModel = null;
            avatarApp = null;
            currentAvatarModelUrl = null;
            document.getElementById('ielts-mentor-avatar-canvas').style.display = 'none';
            $('.ielts-mentor-avatar-container').find('.avatar-model-error').remove();
            $('.ielts-mentor-avatar-container').append('<div class="avatar-model-error" style="color: red; font-weight: bold; font-style: italic; font-size: 20px; text-align: center;margin-bottom: 20px;">Failed to load Avatar model!</div>');
        } finally {
            $('.ielts-mentor-avatar-container').removeClass('speaking');
            $('.ielts-mentor-avatar-container').find('.avatar-model-loading').remove();
        }
    }

    // Helper function to dynamically load JSZip
    async function loadJSZip() {
        if (typeof JSZip !== 'undefined') {
            return JSZip;
        }

        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
            script.onload = () => resolve(JSZip);
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    // Initialize the Avatar model when page loads
    initializeAvatarModel($('#ielts-mentor-avatar-selector').find('option:selected').data('avatar-url'));

    // iOS: pixi-live2d-display opens a brand-new AudioContext for every line it speaks and never
    // starts it. Safari leaves a new AudioContext paused unless it is made during a tap, and a paused
    // one plays in silence: the avatar moves its mouth but makes no sound.
    //
    // Starting it later from an AJAX callback is refused on iOS, so instead we make ONE context during
    // a real tap and have the library reuse it. The override on purpose does not fill the library's
    // private list, so the library's clean-up never closes our shared context.
    var sharedAudioContext = null;

    function getSharedAudioContext() {
        if (!sharedAudioContext) {
            var AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
            if (!AudioContextConstructor) {
                return null;
            }
            sharedAudioContext = new AudioContextConstructor();
        }
        return sharedAudioContext;
    }

    // Install the override up front, before anything can call speak(), so every line shares one
    // context rather than making a fresh paused one.
    if (window.PIXI && window.PIXI.live2d && window.PIXI.live2d.SoundManager) {
        window.PIXI.live2d.SoundManager.addContext = function() {
            return getSharedAudioContext();
        };

        // A streamed reply plays through Apple's player on iPhones, which only starts on an element with
        // AirPlay switched off. The library makes a new element for every line, so it is switched off
        // here, as soon as the element exists and before it starts loading.
        var addSound = window.PIXI.live2d.SoundManager.add;
        window.PIXI.live2d.SoundManager.add = function() {
            var audio = addSound.apply(this, arguments);
            audio.disableRemotePlayback = true;
            return audio;
        };
    }

    // Call this from inside a real tap: a context made or started during a tap starts running and
    // stays running, whereas starting it from an AJAX callback is refused on iOS.
    function unlockAvatarAudioContext() {
        var context = getSharedAudioContext();
        if (context && context.state === 'suspended' && context.resume) {
            context.resume().catch(function() {});
        }
    }

    // Function to make the model react to conversation events
    function triggerAvatarSpeech($info) {
        var onFinish = $info['on_finish'] || function() {};

        if (!avatarModel) {
            onFinish();
            return;
        }

        var audioUrl = $info['audio_url'];
        var motionCategory = $info['motion_category'] || null;
        var animationIndex = $info['animation_index'] || null;

        try {
            $('.ielts-mentor-avatar-container').addClass('speaking');

            if(!motionCategory || !animationIndex || motionCategory == '' || animationIndex == '') {
                avatarModel.speak(audioUrl, {
                    resetExpression: true,
                    crossOrigin: 'anonymous',
                    onFinish: function() {
                        $('.ielts-mentor-avatar-container').removeClass('speaking');
                        onFinish();
                    }
                });
            }
            else {
                avatarModel.motion(motionCategory, animationIndex, 3, {
                    sound: audioUrl,
                    resetExpression: true,
                    crossOrigin: 'anonymous',
                    onFinish: function() {
                        $('.ielts-mentor-avatar-container').removeClass('speaking');
                        onFinish();
                    }
                });
            }
        } catch (error) {
            console.warn('Failed to trigger avatar speech:', error);
            $('.ielts-mentor-avatar-container').removeClass('speaking');
        }
    }

    function stopAvatarSpeech() {
        // Anything still running for the previous line is now out of date.
        // This must NOT live in stopBrowserVoiceLipSync(): start() calls that, which
        // would cancel the line being started before it ever ran.
        browserVoiceUtteranceToken++;

        stopBrowserVoiceLipSync(); // also clears the 'speaking' class
        if(avatarModel) {
            avatarModel.stopMotions();
        }
    }

    // --- MOUTH MOVEMENT FOR THE BROWSER VOICE ---
    // The library moves the mouth from the loudness of a real audio clip. The browser voice gives
    // us no clip to measure, so that never runs and the avatar would talk with its mouth shut.
    // Instead we fake a loudness from the text: open on vowels, less on other letters, shut on
    // spaces and punctuation.
    //
    // The write has to land at one exact point in each frame - see the hook in
    // startBrowserVoiceLipSync() for why earlier and later both fail.
    var browserVoiceMouthHandler = null;
    var browserVoiceLipSync = null;
    var browserVoiceStartedMotion = false;

    // Identifies the current line. The browser fires 'end' for a cancelled line too, and that can
    // arrive AFTER the next line has already started - the old callback would then stop the new
    // line's mouth movement and the avatar would speak the whole reply with its mouth shut. Every
    // callback remembers the number it was made with and does nothing if it is out of date.
    var browserVoiceUtteranceToken = 0;

    // No fixed characters-per-second figure can be right: it varies by device, voice and system.
    // Instead we time each line and correct the guess for the next one, so the mouth settles on
    // this device's real speaking rate within the first few replies.
    var browserVoiceTimeScale = 1;

    function setAvatarMouthOpen(value) {
        if (!avatarModel || !avatarModel.internalModel) {
            return;
        }
        var coreModel = avatarModel.internalModel.coreModel;
        if (!coreModel) {
            return;
        }

        // The two Cubism generations name this setting differently and write it
        // through different functions:
        //   Cubism 2 (e.g. Shizuku) -> "PARAM_MOUTH_OPEN_Y", setParamFloat(index, v)
        //   Cubism 4 (e.g. Kei)     -> "ParamMouthOpenY",    setParameterValueById(id, v)
        // The model's own motionManager.lipSyncIds already holds the right name, but
        // fall back to trying both if it is missing.
        var mouthIds = avatarModel.internalModel.motionManager.lipSyncIds;
        if (!mouthIds || !mouthIds.length) {
            mouthIds = ['PARAM_MOUTH_OPEN_Y', 'ParamMouthOpenY'];
        }

        // Test for Cubism 2 FIRST: a Cubism 4 model has no setParamFloat, while a Cubism 2 model can
        // have a setParameterValueById that quietly ignores Cubism 2 names - checking that one first
        // sent Shizuku down the wrong path and left its mouth shut.
        var isCubism2 = typeof coreModel.setParamFloat === 'function' && typeof coreModel.getParamIndex === 'function';

        for (var i = 0; i < mouthIds.length; i++) {
            try {
                if (isCubism2) {
                    var parameterIndex = coreModel.getParamIndex(mouthIds[i]);
                    if (parameterIndex >= 0) {
                        coreModel.setParamFloat(parameterIndex, value);
                    }
                } else if (typeof coreModel.setParameterValueById === 'function') {
                    coreModel.setParameterValueById(mouthIds[i], value);
                }
            } catch (mouthError) {
                // A model without this setting simply keeps its mouth shut.
            }
        }
    }

    // Walks the spoken TEXT in step with the guessed speaking rate, so the mouth opens on vowels,
    // moves less on other letters and closes on spaces and punctuation. That makes the movement
    // follow the actual words and pauses instead of flapping at a fixed beat. The browser voice gives
    // no audio to measure, so the position is always a guess - calibrateBrowserVoiceRate() corrects
    // the pace after each line.
    function startBrowserVoiceLipSync(text, charsPerSecond) {
        stopBrowserVoiceLipSync();
        if (!avatarModel || !avatarModel.internalModel || !$('#ielts-mentor-show-avatar').is(':checked')) {
            return;
        }

        var spokenText = String(text || '');
        var rate = charsPerSecond || 13;

        // Characters do NOT all take the same time, and a pause ADDS time rather than taking it
        // from the letters around it. An earlier version squeezed the pauses back into
        // text.length/rate, which sped the letters up - so every sentence ran slightly too fast and
        // the mouth drifted further ahead with each one. Letters now take a fixed time and
        // punctuation simply adds silence on top.
        var secondsPerCharacter = browserVoiceTimeScale / rate;
        var startTimes = new Array(spokenText.length);
        var runningTime = 0;
        for (var c = 0; c < spokenText.length; c++) {
            var ch = spokenText.charAt(c);
            startTimes[c] = runningTime;
            runningTime += secondsPerCharacter;
            if (ch === ' ') {
                runningTime += 0.04 * browserVoiceTimeScale;
            } else if (ch >= '0' && ch <= '9') {
                // "7" is spoken "seven" - far longer than one character's worth.
                runningTime += 0.18 * browserVoiceTimeScale;
            } else if (',;:'.indexOf(ch) !== -1) {
                runningTime += 0.20 * browserVoiceTimeScale;
            } else if ('.!?'.indexOf(ch) !== -1) {
                // A full stop between digits is a decimal point ("6.5"), not the end
                // of a sentence, so it gets no pause.
                var isDecimalPoint = ch === '.' &&
                    c > 0 && spokenText.charAt(c - 1) >= '0' && spokenText.charAt(c - 1) <= '9' &&
                    spokenText.charAt(c + 1) >= '0' && spokenText.charAt(c + 1) <= '9';
                if (!isDecimalPoint) {
                    runningTime += 0.45 * browserVoiceTimeScale;
                }
            }
        }

        browserVoiceLipSync = {
            text: spokenText,
            startTimes: startTimes,
            predictedDuration: runningTime,
            startedAt: Date.now(),
            cursor: 0,
            amplitude: 0
        };

        browserVoiceMouthHandler = function() {
            var state = browserVoiceLipSync;
            if (!state) {
                return;
            }
            var position = (Date.now() - state.startedAt) / 1000;
            while (state.cursor + 1 < state.startTimes.length && state.startTimes[state.cursor + 1] <= position) {
                state.cursor++;
            }
            // Past the guessed end of the line, stay shut. Comparing against the guessed length
            // matters: using the last character's start time left the mouth holding that
            // character's shape after the voice had already stopped.
            var index = position >= state.predictedDuration ? state.text.length : state.cursor;

            // A made-up LOUDNESS (not a mouth value): roughly what the library measures for speech at
            // this volume, so the library's own curve below gives the same look as real audio.
            var amplitude = 0;
            if (index < state.text.length) {
                var character = state.text.charAt(index).toLowerCase();
                if ('aeo'.indexOf(character) !== -1) {
                    amplitude = 0.45; // open vowels are the loudest
                } else if ('iuy'.indexOf(character) !== -1) {
                    amplitude = 0.35;
                } else if (character >= '0' && character <= '9') {
                    amplitude = 0.30; // digits are spoken as words ("seven"), not silence
                } else if (character.toUpperCase() !== character) {
                    amplitude = 0.22; // any other letter, including accented ones
                }
                // space and punctuation stay at 0 - a real pause
            }

            // Open gently over a few frames (a snap looked twitchy) but close quickly, the way real
            // speech drops away at a gap between words. Without the fast close the mouth never
            // reaches zero between words and just hangs half open for the whole line.
            var smoothing = amplitude > state.amplitude ? 0.18 : 0.5;
            state.amplitude += (amplitude - state.amplitude) * smoothing;

            // From here on this copies the library exactly, so the browser voice
            // and real audio move the mouth the same way:
            //   analyze()  rounds to one decimal place
            //   update()   clamp(pow(a, 0.7) * 1.2, a > 0 ? 0.4 : 0, 1)
            var analyzed = parseFloat(state.amplitude.toFixed(1));
            var floorValue = analyzed > 0 ? 0.4 : 0;
            var mouth = Math.pow(analyzed, 0.7) * 1.2;
            setAvatarMouthOpen(Math.min(1, Math.max(floorValue, mouth)));
        };

        // Write on 'beforeModelUpdate'. The frame ends like this:
        //     ... expressions, eye blink, natural movements ...
        //     library's own mouth write
        //     physics.update(); pose.update();
        //     emit('beforeModelUpdate')
        //     coreModel.update();     <- draws the settings onto the model
        //     coreModel.loadParam();  <- puts the saved settings back
        // So this event is the last moment a setting still gets drawn.
        // 'afterMotionUpdate' was too early (expressions overwrote us), and writing
        // after update() returned was too late: the value was written but never drawn.
        avatarModel.internalModel.on('beforeModelUpdate', browserVoiceMouthHandler);

        $('.ielts-mentor-avatar-container').addClass('speaking');

        // Play the same speaking motion the real-audio path uses, just without a sound attached -
        // otherwise the browser voice only moved the mouth while the body and face stayed still.
        // Our mouth write still wins: it runs on 'beforeModelUpdate', after this motion's face is applied.
        var speakingMotionCategory = $('#ielts-mentor-avatar-selector').find('option:selected').data('speaking-motion-category');
        var speakingMotionIndex = $('#ielts-mentor-avatar-selector').find('option:selected').data('speaking-motion-index');
        if (speakingMotionCategory && speakingMotionIndex !== undefined && speakingMotionIndex !== '') {
            try {
                avatarModel.motion(speakingMotionCategory, speakingMotionIndex, 3, {
                    resetExpression: true
                });
                browserVoiceStartedMotion = true;
            } catch (motionError) {
                console.warn('Could not play avatar speaking motion:', motionError);
            }
        }
    }

    // Called when speech finishes on its own: compare how long it really took with what we guessed
    // and nudge the scale toward the truth. Skipped for stopped playback (onEnd also fires on
    // cancel), which would otherwise teach it that every line is very short.
    function calibrateBrowserVoiceRate() {
        var state = browserVoiceLipSync;
        if (!state || !state.predictedDuration) {
            return;
        }
        var actual = (Date.now() - state.startedAt) / 1000;
        if (actual < 0.6) {
            return; // too short to be a real line
        }

        var correction = actual / state.predictedDuration;

        // Reject wild samples in BOTH directions. Rejecting only short ones used to let the scale
        // get stuck: one badly guessed line could push the scale to the 2.0 limit, after which every
        // normal line measured under 0.6, was thrown away as "cancelled", and the scale never came
        // back down for the rest of the page.
        if (correction < 0.6 || correction > 1.8) {
            return; // cancelled, or a line we guessed far too badly to learn from
        }
        // Move only part of the way so one odd line cannot skew it.
        browserVoiceTimeScale = Math.min(2, Math.max(0.5, browserVoiceTimeScale * (1 + (correction - 1) * 0.5)));
    }

    function stopBrowserVoiceLipSync() {
        if (browserVoiceMouthHandler && avatarModel && avatarModel.internalModel) {
            avatarModel.internalModel.off('beforeModelUpdate', browserVoiceMouthHandler);
            setAvatarMouthOpen(0); // leave the mouth closed
        }

        // Only stop a motion WE started - the real-audio path ties its motion to the audio itself,
        // and must not be cut short from here.
        if (browserVoiceStartedMotion && avatarModel) {
            avatarModel.stopMotions();
        }
        browserVoiceStartedMotion = false;
        browserVoiceMouthHandler = null;
        browserVoiceLipSync = null;
        $('.ielts-mentor-avatar-container').removeClass('speaking');
    }

    //--- VOICE SELECTION ---//
    var currentlyPlayingVoiceAudio = null;

    $('.mentor-voice-dropdown-toggle').on('click', function(e) {
        e.preventDefault();
        e.stopPropagation();

        var dropdown = $(this).closest('.mentor-voice-dropdown-container');
        var menu = dropdown.find('.mentor-voice-dropdown-menu');
        var isOpen = menu.hasClass('show');

        // Close all other dropdowns
        $('.mentor-voice-dropdown-menu').removeClass('show');
        $('.mentor-voice-dropdown-toggle').removeClass('active');

        // Toggle this dropdown
        if (!isOpen) {
            menu.addClass('show');
            $(this).addClass('active');
        }
    });

    // Close dropdown when clicking outside
    $(document).on('click', function(e) {
        if (!$(e.target).closest('.mentor-voice-dropdown-container').length) {
            $('.mentor-voice-dropdown-menu').removeClass('show');
            $('.mentor-voice-dropdown-toggle').removeClass('active');
            // Stop any currently playing audio
            if (currentlyPlayingVoiceAudio) {
                currentlyPlayingVoiceAudio.pause();
                currentlyPlayingVoiceAudio = null;
            }
            // Reset all play buttons to play state
            $('.mentor-voice-play-button').removeClass('playing').html('<i class="fa-solid fa-play"></i>');
        }
    });

    // Handle voice selection from dropdown
    $(document).on('click', '.mentor-voice-dropdown-item', function(e) {
        e.preventDefault();
        e.stopPropagation();

        var item = $(this);
        var value = item.data('value');
        var voiceName = item.find('span').text();
        var dropdown = item.closest('.mentor-voice-dropdown-container');
        var toggle = dropdown.find('.mentor-voice-dropdown-toggle');
        var menu = dropdown.find('.mentor-voice-dropdown-menu');

        // Stop any currently playing audio
        if (currentlyPlayingVoiceAudio) {
            currentlyPlayingVoiceAudio.pause();
            currentlyPlayingVoiceAudio = null;
        }

        // Reset all play buttons to play state
        $('.mentor-voice-play-button').removeClass('playing').html('<i class="fa-solid fa-play"></i>');

        // Update dropdown text
        toggle.find('.mentor-voice-dropdown-text').text(voiceName || 'Choose a voice...');
        $('#ielts-mentor-voice-selector').data('value', value);

        // Update selection
        $('.mentor-voice-dropdown-item').removeClass('selected');
        item.addClass('selected');

        // Close dropdown
        menu.removeClass('show');
        toggle.removeClass('active');

        // Update selected voice
        if (value) {
            localStorage.setItem('ieltsMentorSelectedVoice', value);
        } else {
            localStorage.removeItem('ieltsMentorSelectedVoice');
        }
    });

    // Handle voice play button clicks
    $(document).on('click', '.mentor-voice-play-button', function(e) {
        e.preventDefault();
        e.stopPropagation();

        var button = $(this);
        var voiceUrl = button.closest('.mentor-voice-dropdown-item').data('voice-url');

        // Check if this button is currently playing
        var isCurrentlyPlaying = button.hasClass('playing');

        // Stop any currently playing audio
        if (currentlyPlayingVoiceAudio) {
            currentlyPlayingVoiceAudio.pause();
            currentlyPlayingVoiceAudio = null;
        }

        window.TTSAudio.stopTTSAudio();
        stopAvatarSpeech(); // the voice preview cancels any reply that was speaking

        // Reset all play buttons to play state
        $('.mentor-voice-play-button').removeClass('playing').html('<i class="fa-solid fa-play"></i>');

        // If this button was already playing, just stop and return
        if (isCurrentlyPlaying) {
            return;
        }

        // Mark this button as playing
        button.addClass('playing');

        // no voiceUrl is browser voice
        if (!voiceUrl) {
            button.html('<i class="fa-solid fa-pause"></i>');
            window.TTSAudio.playTTSAudio('Hello, how are you?', false, button.closest('.mentor-voice-dropdown-item').data('value') == "browser-male", () => {
                button.removeClass('playing').html('<i class="fa-solid fa-play"></i>');
            });
        }
        else {
            // Update button to show loading state
            button.html('<i class="fa-solid fa-spinner fa-spin"></i>');
            button.prop('disabled', true);

            // Create and play audio
            var audio = new Audio(voiceUrl);
            currentlyPlayingVoiceAudio = audio;

            audio.addEventListener('canplaythrough', function() {
                button.prop('disabled', false);
                button.html('<i class="fa-solid fa-pause"></i>');
            });

            audio.addEventListener('ended', function() {
                button.removeClass('playing').html('<i class="fa-solid fa-play"></i>');
                currentlyPlayingVoiceAudio = null;
            });

            audio.addEventListener('error', function() {
                button.removeClass('playing').prop('disabled', false);
                button.html('<i class="fa-solid fa-play"></i>');
                currentlyPlayingVoiceAudio = null;
                console.error('Failed to load voice audio');
            });

            // play audio
            audio.play().catch(function(error) {
                console.error('Failed to play voice audio:', error);
                button.removeClass('playing').prop('disabled', false);
                button.html('<i class="fa-solid fa-play"></i>');
                currentlyPlayingVoiceAudio = null;
            });
        }
    });

    //--- TOGGLE BUTTONS ---//
    $('#ielts-mentor-autoplay').on('click', function (e) {
        localStorage.setItem('ieltsMentorIsAutoPlayAIAudio', $(this).prop('checked'));
    });

    $('#ielts-mentor-show-avatar').on('change', function() {
        var showAvatar = $(this).is(':checked');
        if (!showAvatar) {
            stopBrowserVoiceLipSync(); // stop driving a model nobody can see
        }
        $('#ielts-mentor').toggleClass('hide-avatar', !showAvatar);
        localStorage.setItem('ieltsMentorShowAvatar', showAvatar);
    });

    //--- AUTO RESIZING ---//
    $input.on('input', function () {
        autoResize(this);
    });

    function autoResize(textarea) {
        // Save current scroll position
        const scrollPos = window.scrollY;

        // Reset height to auto first to get the correct scrollHeight
        $(textarea).css("height", "auto");

        // Set new height based on scrollHeight with a small buffer
        const newHeight = Math.max(textarea.scrollHeight, textarea.offsetHeight) + 2;
        $(textarea).css("height", newHeight + "px");

        // Restore scroll position to prevent page jump
        window.scrollTo(0, scrollPos);
    }

    function setAndResizeTextArea(textarea, message) {
        textarea.val(message);
        // Delay the resize slightly to ensure content is updated
        requestAnimationFrame(() => autoResize(textarea[0]));
    }

    // Add resize handler for window changes
    $(window).on('resize', function() {
        autoResize($input[0]);
    });
});
