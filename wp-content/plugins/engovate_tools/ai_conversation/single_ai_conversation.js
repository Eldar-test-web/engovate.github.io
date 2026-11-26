jQuery(document).ready(function ($) {

    var currentAITaskIndex = -1;
    var currentUserTaskIndex = -1;
    var aiLastMessages = [];
    aiLastMessages.push($('.ai-message-wrapper').find('.ai-message-audio-button').siblings().text());
    var userLastMessages = [];
    var summarizedContext = "Just started";
    var isFinishedAllTasks = false;
    var lastClickedUserImproveSuggestionButton = null;
    var lastClickedCheckPronunciationButton = null;
    var lastClickedMessageTranslationButton = null;

    let emptyResponseAlternatives = [
        "My apologies, I didn't quite catch that. Could you please say it again?",
        "I'm sorry, I didn't understand that fully. Would you mind repeating?",
        "Pardon me, I didn't get that clearly. Could you repeat, please?",
        "I'm afraid I didn't comprehend what you said. Would you mind saying it one more time?",
        "Apologies, I didn't follow. Could you please repeat your statement?"
    ];

    $('body').append('<div class="user-message-improvement-suggestion-popup"></div>');
    $('body').append(`<div class="user-message-check-pronunciation-popup">
        <div class="pronunciation-result-container">
            <div class="pronunciation-overall-result">
                <div class="overall-accuracy-score">
                    <strong class="progress-bar" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100">0%</strong>
                    <strong class="progress-title">Accuracy</strong>
                    <span class="metric-explanation">
                        The overall pronunciation accuracy of your speech, reflecting how well the sounds can be understood by a native speaker.
                    </span>
                </div>
            </div>
            <div class="pronunciation-detail-popup">
                <div class="pronunciation-detail"></div>
            </div>
            <div class="pronunciation-transcript-label">What native speakers are likely to hear:</div>
            <div class="pronunciation-transcript"></div>
            <div class="pronunciation-result-tips">Tips: Click on each word to see feedback.</div>
        </div>
    </div>`);
    $('body').append('<div class="text-translation-popup"><select class="language-selector"></select><br><button>Translate</button></div>');

    function loadSupportedTranslationLanguages() {
        $.getJSON('https://api.cognitive.microsofttranslator.com/languages?api-version=3.0&scope=translation', function(data) {
            var languages = data.translation;

            for (var code in languages) {
                // Skip English
                if (code === 'en') continue;

                var option = $('<option></option>').val(code).text(languages[code].name);
                // Append the new option to all select elements
                $('.language-selector').append(option);
            }

            // Try to guess the user's preferred language based on their browser setting
            var userLanguage = (navigator.language || navigator.userLanguage).substring(0, 2);

            // If a matching option exists, select it. Otherwise, default to Vietnamese.
            if ($('.language-selector option[value="' + userLanguage + '"]').length > 0) {
                $('.language-selector').val(userLanguage);
            } else {
                $('.language-selector').val('vi');
            }
        }).fail(function() {
            console.error('Error: Unable to fetch languages');
        });
    }
    //get on load
    loadSupportedTranslationLanguages();

    function moveToMextTask() {

        if(isFinishedAllTasks) return;

        $('#div_user_task_' + currentUserTaskIndex).addClass('complete');
        currentUserTaskIndex++;
        currentAITaskIndex++;
        $('[id^="div_user_task_"]').removeClass('current');
        $('#div_user_task_' + currentUserTaskIndex).addClass('current');

        //If users have finished all the tasks
        let userTaskCount = $('[id^="user_task_"]').length;
        if(userTaskCount > 0 && currentUserTaskIndex >= userTaskCount && $('#mode').val() === "task_completion") {

            let userSentMessageCount = parseInt($('.sent-message-count').text());
            if(userSentMessageCount <= Math.round(userTaskCount * 3.5)) {
                $('.task-completion-performance').text('Excellent Performance').css('color', 'darkgreen');
                $('.task-excellent-status-info').hide();
            }
            else {
                if(userSentMessageCount <= Math.round(userTaskCount * 4.5)) {
                    $('.task-completion-performance').text('Good Performance').css('color', 'orangered');
                }
                else {
                    if(userSentMessageCount <= Math.round(userTaskCount * 6)) {
                        $('.task-completion-performance').text('Decent Performance').css('color', 'mediumblue');
                    }
                    else {
                        $('.task-completion-performance').text('Mediocre Performance').css('color', 'darkred');
                    }
                }
            }

            $('.task-completion-announcement').show();
            $('.task-completion-announcement').animate({opacity: '1'}, 500);
            setTimeout(function() {
                $('.task-completion-announcement').addClass('bounce');
            }, 500);
            setTimeout(function() {
                $('.task-completion-announcement').removeClass('bounce');
            }, 3500);
            setAndResizeTextArea($('#user-message-input'), 'Congratulations! You have finished all the tasks!');
            $(".chat-form :input").attr('disabled', true);
            $("#user-message-input").css('color', 'green');
            isFinishedAllTasks = true;
        }
    }

    //call on load
    moveToMextTask();

    $('.chat-form').on('submit', function (e) {
        e.preventDefault();

        // This submit is the last user activation before the AI's reply is
        // auto-played from an AJAX callback, so it is our chance to (re)start the
        // shared AudioContext while a gesture is still in scope — iOS refuses
        // resume() once the callback is running.
        unlockAvatarAudioContext();

        if($('#mode').val() === "task_completion" && isFinishedAllTasks) {
            return;
        }

        var textarea = $("#user-message-input");
        var userMessage = textarea.val().trim();
    
        var minlength = parseInt(textarea.attr('minlength'));
        var maxlength = parseInt(textarea.attr('maxlength'));

        if (userMessage.length < parseInt(textarea.attr('minlength'))) {
            alert("Your message should be at least " + minlength + " characters long.");
            return;
        }
    
        if (userMessage.length > parseInt(textarea.attr('maxlength'))) {
            alert("Your message should not exceed " + maxlength + " characters.");
            return;
        }

        //only keep the last 2 element
        var tempUserLastMessages = [...userLastMessages];
        tempUserLastMessages.push(userMessage);
        if (tempUserLastMessages.length > 2) {
            tempUserLastMessages.shift();
        }

        var userMessageWrapper = $(`<div class="user-message-wrapper"><div class="user-message"><span class="user-message-audio-button"><i class="fa-solid fa-caret-right"></i></span><span class="text-message">${userMessage}</span></div><div class="user-audio" style="display: none;"></div><div class="user-message-improvement-suggestion"><i class="fa-solid fa-wand-magic-sparkles"></i></div><div class="user-message-check-pronunciation"><i class="fa-solid fa-wave-square"></i></div></div>`);
        if ($('#user-audio-message-wrapper').is(':visible')) {
            //User have just recorded an audio, clone and add it to the current message
            var userMessageAudio = $('#user-audio-message-wrapper').find('audio').clone();
            userMessageWrapper.find('.user-audio').html(userMessageAudio);
        }
        $('.message-container').append(userMessageWrapper);

        var currentUserTask = "";
        if (currentUserTaskIndex < $('[id^="user_task_"]').length) {
            currentUserTask = $('#user_task_' + currentUserTaskIndex).val();
        }

        var currentAITask = "";
        if (currentAITaskIndex < $('[id^="ai_task_"]').length) {
            currentAITask = $('#ai_task_' + currentAITaskIndex).val();
        }
        
        var isAISuccessRespond = false;

        var limitMessage = checkOrSaveRateLimit('do_chat_with_ai');
        if (limitMessage) {
            alert(limitMessage);
            $('.payment-popup-container').css('display', 'flex');
            return;
        }

        let formData = new FormData();
        formData.append('action', 'do_chat_with_ai');
        formData.append('ai_conversation_nonce', $('#ai_conversation_nonce').val());
        formData.append('topic', $('#topic').val());
        formData.append('learning_focus', $('#learning-focus-selector').val());
        formData.append('summarized_context', summarizedContext);
        formData.append('mode', $('#mode').val());
        formData.append('user_role', $('#user_role').val());
        formData.append('ai_role', $('#ai_role').val());
        formData.append('user_task', currentUserTask);
        formData.append('ai_task', currentAITask);
        // FormData has no array convention, so the [] names the server expects are written out.
        tempUserLastMessages.forEach(function (m) { formData.append('user_last_messages[]', m); });
        aiLastMessages.forEach(function (m) { formData.append('ai_last_messages[]', m); });

        setAndResizeTextArea($('#user-message-input'), '');
        $('.chat-form').find('button[type="submit"').prop("disabled", true);
        $('#suggest-response-idea-button').prop("disabled", true);
        $('#user-audio-message-wrapper').hide();
        $('.user-message-improvement-suggestion-popup').hide();
        $('.message-container').append(`<div class="ai-message-wrapper"><div class="ai-message indicator"><span>.</span><span>.</span><span>.</span></div></div>`);
        $('.message-container').scrollTop($('.message-container')[0].scrollHeight);

        window.aiWorkerCall({
            ajaxurl: single_ai_conversation_ajax.ajaxurl,
            formData: formData,
            json: true,
        })
            .then(function (json) {
                if (!json) {
                    alert("Server Error. Please try again.");
                    console.log(json);
                    return;
                }

                isAISuccessRespond = true;

                //only keep the last 2 element
                userLastMessages.push(userMessage);
                if (userLastMessages.length > 2) {
                    userLastMessages.shift();
                }
                $('.sent-message-count').text(parseInt($('.sent-message-count').text()) + 1);

                if($('[id^="user_task_"]').length > 0 && $('#mode').val() === "task_completion") {
                    evaluateUserTaskCompletion();
                }

                var ai_next_response = json['partner_response'];
                if (ai_next_response && typeof ai_next_response !== 'string') {
                    ai_next_response = JSON.stringify(ai_next_response);
                }
                if(!ai_next_response) {
                    ai_next_response = emptyResponseAlternatives[Math.floor(Math.random() * emptyResponseAlternatives.length)];
                }

                //only keep the last 2 element
                aiLastMessages.push(ai_next_response);
                if (aiLastMessages.length > 2) {
                    aiLastMessages.shift();
                }

                // Create ai message UI and add it to the message container
                var aiMessageWrapper = $(`<div class="ai-message-wrapper"><div class="ai-message"><span class="ai-message-audio-button"><i class="fa-solid fa-caret-right"></i></span><span class="message-translation-button"><i class="fa-solid fa-language fa-2xs"></i></span><span class="text-message">${ai_next_response}</span></div></div>`);
                $('.message-container').append(aiMessageWrapper);
                $('.message-container').scrollTop($('.message-container')[0].scrollHeight);

                // Show improvement suggestion and pronunciation check buttons
                userMessageWrapper.find('.user-message-improvement-suggestion').show();
                if(userMessageWrapper.find('.user-audio').html()) {
                    userMessageWrapper.find('.user-message-check-pronunciation').show();
                }

                // Move user audio back to the user voice input wrapper so we can record again
                $('#user-audio-message-wrapper').children().appendTo('#user-voice-input-wrapper');
                window.audioRecorderReusable.resetAudioRecorder('#user-voice-input-recorder', false);

                // The refreshed conversation summary rides along in the same reply. Keep the current
                // context if the model didn't include one.
                var newContext = json['narrative'];
                if (newContext) {
                    summarizedContext = (typeof newContext === 'string') ? newContext : JSON.stringify(newContext);
                }

                // Set audio button voice id
                var selectedVoiceId = $('#voice-selector').data('value');
                var aiAudioButton = aiMessageWrapper.find('.ai-message-audio-button');
                aiAudioButton.data('voice-id', selectedVoiceId);
                if($('#auto-play-ai-audio-toggle').prop('checked')) {
                    playAudioOnButton(aiAudioButton);
                }
            })
            .fail(function (rejection) {
                var response = rejection && rejection.hardError;

                if (response && response.data) {
                    if (response.data['error'] == 'rate_limit_exceeded') {
                        alert(checkOrSaveRateLimit('do_chat_with_ai', response.data['retry_after']));
                        $('.payment-popup-container').css('display', 'flex');
                    }
                    else if (response.data['error'] == 'user_not_verified') {
                        $('.fast-verification-popup-container').css('display', 'flex');
                    }
                    else {
                        alert(response.data['message'] || "Server Error. Please try again.");
                    }
                }
                else {
                    alert("Error: Unable to communicate with the server. Try again.");
                }
            })
            .always(function () {
                $('.chat-form').find('button[type="submit"').prop("disabled", false);
                $('#suggest-response-idea-button').prop("disabled", false);
                $('.ai-message.indicator').closest('.ai-message-wrapper').remove();

                if(!isAISuccessRespond) {
                    setAndResizeTextArea($('#user-message-input'), userMessage);
                    if(userMessageWrapper.find('.user-audio').html()) {
                        $('#user-audio-message-wrapper').show();
                    }
                    userMessageWrapper.remove();
                }
            });
    });

    // Resolves with { url } for a clip that has fully arrived, or { url, whole } for one still arriving:
    // url plays it as it comes, and whole resolves with a URL for the complete clip once the last piece is in.
    function generateConversationAudio(text, voiceId) {
        return new Promise((resolve, reject) => {
            var limitMessage = checkOrSaveRateLimit('do_conversation_audio_generation');
            if (limitMessage) {
                alert(limitMessage);
                $('.payment-popup-container').css('display', 'flex');
                reject(new Error(limitMessage));
                return;
            }

            let formData = new FormData();
            formData.append('action', 'do_conversation_audio_generation');
            formData.append('ai_conversation_nonce', $('#ai_conversation_nonce').val());
            formData.append('message', text);
            formData.append('voice', voiceId);

            window.aiWorkerCall({
                ajaxurl: single_ai_conversation_ajax.ajaxurl,
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
                    // The audio can come back as either WAV or MP3, so read the container from the
                    // header rather than assuming one — Safari refuses to play a blob whose declared
                    // type does not match its contents.
                    var isRiffWav = byteArray[0] === 0x52 && byteArray[1] === 0x49 && byteArray[2] === 0x46 && byteArray[3] === 0x46;
                    var blob = new Blob([byteArray], { type: isRiffWav ? 'audio/wav' : 'audio/mpeg' });
                    resolve({ url: URL.createObjectURL(blob) });
                })
                .fail(function (rejection) {
                    var response = rejection && rejection.hardError;

                    if (response && response.data) {
                        if (response.data['error'] == 'rate_limit_exceeded') {
                            alert(checkOrSaveRateLimit('do_conversation_audio_generation', response.data['retry_after']));
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

    function evaluateUserTaskCompletion() {
        var currentUserTask = "";
        if (currentUserTaskIndex < $('[id^="user_task_"]').length) {
            currentUserTask = $('#user_task_' + currentUserTaskIndex).val();
        }

        var limitMessage = checkOrSaveRateLimit('evaluate_user_task_completion');
        if (limitMessage) {
            alert(limitMessage);
            $('.payment-popup-container').css('display', 'flex');
            return;
        }

        $.ajax({
            type: 'POST',
            url: single_ai_conversation_ajax.ajaxurl,
            data: {
                action: 'evaluate_user_task_completion',
                ai_conversation_nonce: $('#ai_conversation_nonce').val(),
                summarized_context: summarizedContext,
                user_role: $('#user_role').val(),
                ai_role: $('#ai_role').val(),
                user_last_messages: userLastMessages,
                ai_last_messages: aiLastMessages,
                user_task: currentUserTask,
            },
            success: function (response) {
                if(!response.success) {
                    if(response.data['error'] == 'rate_limit_exceeded') {
                        alert(checkOrSaveRateLimit('evaluate_user_task_completion', response.data['retry_after']));
                        $('.payment-popup-container').css('display', 'flex');
                    }
                    else {
                        if(response.data['error'] == 'user_not_verified') {
                            $('.fast-verification-popup-container').css('display', 'flex');
                        }
                        else {
                            alert("Server Error. Please try again.");
                        }
                    }
                }
                else {
                    if(response.data.chat_result["error"])
                    {
                        alert("Server Error. Please try again.");
                        console.log(response);
                    }
                    else
                    {
                        var userRoleSafeJsonKey = convertToSafeJsonKey($('#user_role').val());

                        result = safelyParseJsonString(response.data.chat_result['message'], [
                            userRoleSafeJsonKey + '_task_completion',
                        ]);

                        if (result) {
                            var user_task_accomplishment = result[userRoleSafeJsonKey + '_task_completion'];
                            if (user_task_accomplishment == "completed") {
                                moveToMextTask();
                            }
                        }
                    }
                }
            },
            error: function (error) {
                if (error && error['responseJSON']) {
                    console.log(error);
                    alert(error["responseJSON"]["message"]);
                }
                else {
                    alert("Error: Unable to communicate with the server. Try again.");
                }
            },
        });
    }

    $('.post-locker').on('click', function(e) {
        e.preventDefault();
        $('.payment-popup-container').css('display', 'flex');
    });

    $('.start-chatting-button').on('click', function () {
        $('.chat-container-overlay').hide();
        showOnScreenInstructionPopup();
        if($('#auto-play-ai-audio-toggle').prop('checked')) {
            playAudioOnButton($('.ai-message-wrapper').find('.ai-message-audio-button').first());
        }
    });

    $(document).on('click', '.ai-message-audio-button, .user-message-audio-button', function () {
        playAudioOnButton($(this));
    });

    function playAudioOnButton(audioButton) {
        // Runs synchronously inside the click/submit handler that started this
        // playback, so the shared AudioContext is created/resumed while the user
        // activation is still in scope. Later replies reuse that running context.
        unlockAvatarAudioContext();

        // prevent the double click case when the audio is about to play or server is generating audio
        if(audioButton.hasClass('disabled')) {
            return;
        }

        let isThisPlaying = audioButton.attr('playing');

        //no matter which button, just reset all
        $('.ai-message-audio-button').html('<i class="fa-solid fa-caret-right"></i>');
        $('.ai-message-audio-button').attr('playing', 'false');
        $('.user-message-audio-button').html('<i class="fa-solid fa-caret-right"></i>');
        $('.user-message-audio-button').attr('playing', 'false');

        //find all audio elements and stop them
        window.TTSAudio.stopTTSAudio();
        $('.ai-message-audio-button, .user-message-audio-button').closest('.ai-message-wrapper, .user-message-wrapper').find('audio').each(function() {
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
            voiceId = $('#voice-selector').data('value');
            audioButton.data('voice-id', voiceId);
        }

        // before actually playing, set the loading state
        audioButton.addClass('disabled');
        audioButton.html('<i class="fa-solid fa-spinner fa-spin"></i>');

        // mark this button as playing
        audioButton.attr('playing', 'true');

        //browser voice
        if(voiceId == "browser-male" || voiceId == "browser-female") {
            // SpeechSynthesis gives the avatar no audio to analyse, so drive the
            // mouth from the text instead. The rate mirrors what tts_audio.js sets
            // for each voice, so the estimated position tracks the real pace.
            var browserVoiceText = audioButton.siblings('.text-message').text();
            var isBrowserMaleVoice = voiceId == "browser-male";
            // ~13 characters/second matches English TTS at rate 1.0 (roughly
            // 155 wpm at 5.1 characters per word including the space). 15 ran the
            // mouth ahead of the voice.
            var browserVoiceRate = 13 * (isBrowserMaleVoice ? 1 : 0.9);
            var browserVoiceToken = ++browserVoiceUtteranceToken;
            window.TTSAudio.playTTSAudio(browserVoiceText, false, isBrowserMaleVoice, () => {
                if (browserVoiceToken === browserVoiceUtteranceToken) {
                    calibrateBrowserVoiceRate();
                    stopBrowserVoiceLipSync();
                }
                $('.ai-message-audio-button').html('<i class="fa-solid fa-caret-right"></i>');
                $('.ai-message-audio-button').attr('playing', 'false');
                $('.user-message-audio-button').html('<i class="fa-solid fa-caret-right"></i>');
                $('.user-message-audio-button').attr('playing', 'false');
            }, () => {
                if (browserVoiceToken !== browserVoiceUtteranceToken) {
                    return; // superseded before this utterance ever began
                }
                // Start on the real 'start' event rather than when speak() is
                // called — synthesis takes a moment to spin up, and starting early
                // left the mouth permanently a step ahead of the voice.
                startBrowserVoiceLipSync(browserVoiceText, browserVoiceRate);
            });
            setTimeout(() => { //a little hack to fix the case when users click between different audio buttons and the onEnd event of the previous button get called, which will mess up the state of the current button
                audioButton.html('<i class="fa-solid fa-pause"></i>');
                audioButton.removeClass('disabled');
            }, 100);
        }
        else { // AI server voice or user recorded voice
            var audio = audioButton.closest('.ai-message-wrapper, .user-message-wrapper').find('audio');
            // A streamed clip that has not been played yet.
            var streamUrl = audio.data('stream-url');

            // if no audio element, generate audio from server
            if(audio.length == 0 || (audio[0].src == '' && !streamUrl)) {
                generateConversationAudio(audioButton.siblings('.text-message').text(), voiceId)
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
                if(!avatarModel || !$('#show-avatar').is(':checked')) {
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
                        motion_category: $('#avatar-selector').find('option:selected').data('speaking-motion-category'),
                        animation_index: $('#avatar-selector').find('option:selected').data('speaking-motion-index'),
                        on_finish: function() {
                            audioButton.html('<i class="fa-solid fa-caret-right"></i>');
                            audioButton.attr('playing', 'false');
                        }
                    });
                }
            }
        }
    }

    $(document).on('click', '.message-translation-button', function () {

        var button = $(this);

        var popup = $('.text-translation-popup');
        if (popup.is(':visible') && lastClickedMessageTranslationButton[0] === button[0]) {
            popup.fadeOut('fast');
        } else {
            popup.fadeIn('fast');
        }
        var buttonOffset = button.offset();
        popup.css({
            'top': buttonOffset.top + 30,
            'left': buttonOffset.left
        });

        lastClickedMessageTranslationButton = button;
    });

    $(document).on('mousedown', function (e) {
        if (!$(e.target).closest('.text-translation-popup, .message-translation-button').length) {
            $('.text-translation-popup').hide();
        }
    });

    $('.text-translation-popup button').on('click', function () {
        if(!lastClickedMessageTranslationButton) return;

        var translationPopup = $('.text-translation-popup');
        var textMessageElement = lastClickedMessageTranslationButton.siblings('.text-message');
        var textToTranslate = textMessageElement.text();
        var toLanguage = translationPopup.find('select').val();
        var toLanguageText = translationPopup.find('select option:selected').text();

        translationPopup.hide();

        //if already translated, do nothing.
        if(textMessageElement.siblings(`.${toLanguage}-text-message`).length > 0) {
            return;
        }

        var limitMessage = checkOrSaveRateLimit('translate_text_response');
        if (limitMessage) {
            alert(limitMessage);
            $('.payment-popup-container').css('display', 'flex');
            return;
        }

        $.ajax({
            type: 'POST',
            url: single_ai_conversation_ajax.ajaxurl,
            data: {
                action: 'translate_text_response',
                ai_conversation_nonce: $('#ai_conversation_nonce').val(),
                text_to_translate: textToTranslate,
                to_language: toLanguage,
            },
            beforeSend: function () {
                textMessageElement.after('<div class="spinner"></div>');
            },
            success: function (response) {
                if(!response.success) {
                    if(response.data['error'] == 'rate_limit_exceeded') {
                        alert(checkOrSaveRateLimit('translate_text_response', response.data['retry_after']));
                        $('.payment-popup-container').css('display', 'flex');
                    }
                    else {
                        if(response.data['error'] == 'user_not_verified') {
                            $('.fast-verification-popup-container').css('display', 'flex');
                        }
                        else {
                            alert(response.data['message'] || "Server Error. Please try again.");
                        }
                    }
                }
                else {
                    if(response.data.result["error"])
                    {
                        alert("Server Error. Please try again.");
                        console.log(response);
                    }
                    else
                    {
                        if(response.data.result['translation']) {
                            var translatedText = `<span class="${toLanguage}-text-message translated-text-message"><br>${toLanguageText}: ` + response.data.result['translation'] + '</span>';
                            textMessageElement.after(translatedText);
                        }
                        else {
                            alert("Cannot translate the text!");
                        }
                    }
                }
            },
            error: function (error) {      
                console.log(error);
                alert("Server Error. Please try again.");
            },
            complete: function () {
                textMessageElement.siblings('.spinner').remove();
            },
        });
    });

    $('#suggest-response-idea-button').on('click', function () {      
        var button = $(this);

        var limitMessage = checkOrSaveRateLimit('suggest_user_response_idea');
        if (limitMessage) {
            alert(limitMessage);
            $('.payment-popup-container').css('display', 'flex');
            return;
        }

        let formData = new FormData();
        formData.append('action', 'suggest_user_response_idea');
        formData.append('ai_conversation_nonce', $('#ai_conversation_nonce').val());
        formData.append('topic', $('#topic').val());
        formData.append('past_context', summarizedContext);
        formData.append('learning_focus', $('#learning-focus-selector').val());
        formData.append('user_role', $('#user_role').val());
        formData.append('ai_role', $('#ai_role').val());
        // FormData has no array convention, so the [] names the server expects are written out.
        userLastMessages.forEach(function (m) { formData.append('user_last_messages[]', m); });
        aiLastMessages.forEach(function (m) { formData.append('ai_last_messages[]', m); });

        button.html('<div class="spinner"></div>');
        button.prop("disabled", true);
        $('.chat-form').find('button[type="submit"').prop("disabled", true);
        setAndResizeTextArea($('#user-message-input'), 'Generating sample response...');

        window.aiWorkerCall({
            ajaxurl: single_ai_conversation_ajax.ajaxurl,
            formData: formData,
            json: true,
        })
            .then(function (json) {
                var userNextResponse = json && json['next_response'];
                if (userNextResponse && typeof userNextResponse !== 'string') {
                    userNextResponse = JSON.stringify(userNextResponse);
                }

                if (!userNextResponse) {
                    alert("Server Error. Please try again.");
                    console.log(json);
                    return;
                }

                setAndResizeTextArea($('#user-message-input'), userNextResponse);
            })
            .fail(function (rejection) {
                var response = rejection && rejection.hardError;

                if (response && response.data) {
                    if (response.data['error'] == 'rate_limit_exceeded') {
                        alert(checkOrSaveRateLimit('suggest_user_response_idea', response.data['retry_after']));
                        $('.payment-popup-container').css('display', 'flex');
                    }
                    else if (response.data['error'] == 'user_not_verified') {
                        $('.fast-verification-popup-container').css('display', 'flex');
                    }
                    else {
                        alert(response.data['message'] || "Server Error. Please try again.");
                    }
                }
                else {
                    alert("Error: Unable to communicate with the server. Please try again.");
                }
            })
            .always(function () {
                button.html('<i class="fa-regular fa-lightbulb"></i>');
                button.prop("disabled", false);
                $('.chat-form').find('button[type="submit"').prop("disabled", false);
            });
    });

    $(document).on('click', '.user-message-improvement-suggestion', function () {
        var button = $(this);
        lastClickedUserImproveSuggestionButton = button;
        var popup = $('.user-message-improvement-suggestion-popup');

        var lastSuggestion = popup.html();
        var suggestion = button.closest('.user-message-wrapper').data('suggestion');
        if(suggestion) {
            popup.html(suggestion);
        }
        else {
            if(popup.find('.spinner').length === 0) { //make sure there is no improvement suggestion running
                var improveUserResponseButton = $('<button class="improve-user-response-button">Improve my response</button>');
                popup.html(improveUserResponseButton);

                //Just call right away for now
                improveUserResponseButton.click();
            }
        }
        var buttonOffset = button.offset();
        popup.css({
            'top': buttonOffset.top + 52,
            'left': buttonOffset.left - popup.outerWidth() + button.outerWidth()
        });

        //just compare the last suggestion with the current one to know if user click the same button as the last time or not
        if (popup.is(':visible') && lastSuggestion === suggestion) {
            popup.fadeOut('fast');
        } else {
            popup.fadeIn('fast');
        }
    });

    $(document).on('click', '.improve-user-response-button', function () {
        if(!lastClickedUserImproveSuggestionButton) return;
        var suggestionPopup = $('.user-message-improvement-suggestion-popup');
        var userLastMessage = lastClickedUserImproveSuggestionButton.closest('.user-message-wrapper').find('.text-message').text();
        var aiLastMessage = lastClickedUserImproveSuggestionButton.closest('.user-message-wrapper').prevAll('.ai-message-wrapper:first').find('.text-message').text();

        var limitMessage = checkOrSaveRateLimit('improve_user_response');
        if (limitMessage) {
            alert(limitMessage);
            $('.payment-popup-container').css('display', 'flex');
            return;
        }

        let formData = new FormData();
        formData.append('action', 'improve_user_response');
        formData.append('ai_conversation_nonce', $('#ai_conversation_nonce').val());
        formData.append('user_role', $('#user_role').val());
        formData.append('ai_role', $('#ai_role').val());
        formData.append('user_last_message', userLastMessage);
        formData.append('ai_last_message', aiLastMessage);

        suggestionPopup.html('<div class="spinner"></div>');
        var startOffset = lastClickedUserImproveSuggestionButton.offset();
        suggestionPopup.css({
            'top': startOffset.top + 52,
            'left': startOffset.left - suggestionPopup.outerWidth() + lastClickedUserImproveSuggestionButton.outerWidth()
        });

        window.aiWorkerCall({
            ajaxurl: single_ai_conversation_ajax.ajaxurl,
            formData: formData,
            json: true,
        })
            .then(function (json) {
                var alternativeResponse = json && json['alternative_response'];
                if (alternativeResponse && typeof alternativeResponse !== 'string') {
                    alternativeResponse = JSON.stringify(alternativeResponse);
                }

                if (!alternativeResponse) {
                    alert("Server Error. Please try again.");
                    suggestionPopup.hide();
                    return;
                }

                var improvedResponse = '<strong>Improvement Suggestion:<br></strong><span class="user-message-audio-button"><i class="fa-solid fa-caret-right"></i></span><span class="text-message">' + alternativeResponse + '</span>';
                suggestionPopup.html(improvedResponse);
                lastClickedUserImproveSuggestionButton.closest('.user-message-wrapper').data('suggestion', improvedResponse);
                lastClickedUserImproveSuggestionButton.html('<i class="fa-solid fa-info"></i>');

                // Do this to force the browser to update the layout. Weird behavior
                suggestionPopup.css({'left': 0});
                // Update position
                var buttonOffset = lastClickedUserImproveSuggestionButton.offset();
                suggestionPopup.css({
                    'top': buttonOffset.top + 52,
                    'left': buttonOffset.left - suggestionPopup.outerWidth() + lastClickedUserImproveSuggestionButton.outerWidth()
                });
                suggestionPopup.fadeIn('fast');
            })
            .fail(function (rejection) {
                var response = rejection && rejection.hardError;

                if (response && response.data) {
                    if (response.data['error'] == 'rate_limit_exceeded') {
                        alert(checkOrSaveRateLimit('improve_user_response', response.data['retry_after']));
                        $('.payment-popup-container').css('display', 'flex');
                    }
                    else if (response.data['error'] == 'user_not_verified') {
                        $('.fast-verification-popup-container').css('display', 'flex');
                    }
                    else {
                        alert(response.data['message'] || "Server Error. Please try again.");
                    }
                }
                else {
                    alert("Error: Unable to communicate with the server. Try again.");
                }
                suggestionPopup.hide();
            })
            .always(function () {
                suggestionPopup.find('.spinner').remove();
            });

    });

    $(document).on('mousedown', function (e) {
        if (!$(e.target).closest('.user-message-improvement-suggestion-popup, .user-message-improvement-suggestion').length) {
            $('.user-message-improvement-suggestion-popup').hide();
        }
    });

    $(document).on('click', '.user-message-check-pronunciation', function () {
        var button = $(this);
        lastClickedCheckPronunciationButton = button;
        var popup = $('.user-message-check-pronunciation-popup');
        popup.find('.pronunciation-result-container').hide();

        var lastPronunciationData = popup.html();
        var pronunciationData = button.closest('.user-message-wrapper').data('pronunciation');
        if(pronunciationData) {
            showSpeechAccuracyResult(pronunciationData);
        }
        else {
            if(popup.find('.spinner').length === 0) { //make sure there is no check pronunciation process running
                var checkPronunciationButton = $('<button class="check-user-pronunciation-button">Check my pronunciation</button>');
                popup.find('.check-user-pronunciation-button').remove();
                popup.append(checkPronunciationButton);

                //Just call right away for now
                checkPronunciationButton.click();
            }
        }

        var buttonOffset = button.offset();
        popup.css({
            'top': buttonOffset.top + 52,
            'left': buttonOffset.left - popup.outerWidth() + button.outerWidth()
        });

        //just compare the last with the current one to know if user click the same button as the last time or not
        if (popup.is(':visible') && lastPronunciationData === pronunciationData) {
            popup.fadeOut('fast');
        } else {
            popup.fadeIn('fast');
        }
    });

    $(document).on('click', '.check-user-pronunciation-button', function () {
        if(!lastClickedCheckPronunciationButton) return;

        var limitMessage = checkOrSaveRateLimit('check_user_pronunciation');
        if (limitMessage) {
            alert(limitMessage);
            $('.payment-popup-container').css('display', 'flex');
            return;
        }

        var pronunciationPopup = $('.user-message-check-pronunciation-popup');
        pronunciationPopup.find('.check-user-pronunciation-button').remove();
        var userAudioSrc = lastClickedCheckPronunciationButton.closest('.user-message-wrapper').find('.user-audio audio').attr('src');

        if(!userAudioSrc) {
            alert('Error fetching audio');
            pronunciationPopup.hide();
            return;
        }

        fetch(userAudioSrc)
        .then(audioResponse => audioResponse.blob())
        .then(audioBlob => {

            let formData = new FormData();
            formData.append('action', 'check_user_pronunciation');
            formData.append('ai_conversation_nonce', $('#ai_conversation_nonce').val());
            formData.append('audio_data', audioBlob);

            $.ajax({
                url: single_ai_conversation_ajax.ajaxurl,
                type: 'POST',
                data: formData,
                processData: false,
                contentType: false,
                beforeSend: function () {
                    pronunciationPopup.append('<div class="spinner"></div>');
                    var buttonOffset = lastClickedCheckPronunciationButton.offset();
                    pronunciationPopup.css({
                        'top': buttonOffset.top + 52,
                        'left': buttonOffset.left - pronunciationPopup.outerWidth() + lastClickedCheckPronunciationButton.outerWidth()
                    });
                },
                success: function (response) {
                    if(!response.success) {
                        if(response.data['error'] == 'rate_limit_exceeded') {
                            alert(checkOrSaveRateLimit('check_user_pronunciation', response.data['retry_after']));
                            $('.payment-popup-container').css('display', 'flex');
                        }
                        else {
                            if(response.data['error'] == 'user_not_verified') {
                                $('.fast-verification-popup-container').css('display', 'flex');
                            }
                            else {
                                alert("Server Error. Please try again.");
                            }
                        }
                        pronunciationPopup.hide();
                    }
                    else {
                        if(response.data.result["error"]) 
                        {
                            alert("Server Error. Please try again.");
                            pronunciationPopup.hide();
                            console.log(response);
                        }
                        else
                        {
                            var result = response.data.result;
                            if (result) {
                                
                                showSpeechAccuracyResult(result);

                                lastClickedCheckPronunciationButton.closest('.user-message-wrapper').data('pronunciation', result);
                                lastClickedCheckPronunciationButton.html('<i class="fa-solid fa-info"></i>');
                                
                                // Do this to force the browser to update the layout. Weird behavior
                                pronunciationPopup.css({'left': 0});
                                // Update position
                                var buttonOffset = lastClickedCheckPronunciationButton.offset();
                                pronunciationPopup.css({
                                    'top': buttonOffset.top + 52,
                                    'left': buttonOffset.left - pronunciationPopup.outerWidth() + lastClickedCheckPronunciationButton.outerWidth()
                                });
                                pronunciationPopup.fadeIn('fast');
                            }
                            else {
                                alert("Server Error. Please try again.");
                                pronunciationPopup.hide();
                            }
                        }
                    }
                },
                error: function (error) {
                    if (error && error['responseJSON']) {
                        console.log(error);
                        alert(error["responseJSON"]["message"]);
                    }
                    else {
                        alert("Error: Unable to communicate with the server. Try again.");
                    }
                    pronunciationPopup.hide();
                },
                complete: function () {
                    pronunciationPopup.find('.spinner').remove();
                },
            });
        })
        .catch(audioError => {
            alert('Error fetching audio');
            pronunciationPopup.hide();
        });
    });

    function showSpeechAccuracyResult(speechAccuracyResult) {
        let pronunciationPopup = $('.user-message-check-pronunciation-popup');

        let words = speechAccuracyResult['words'];

        let overallAccuracyScore = 0;

        let pronunciationWordContainer = pronunciationPopup.find(".pronunciation-transcript");
        pronunciationWordContainer.html('');

        words.forEach(word => {

            let displayWord = word['punctuated_word'];
            let wordAccuracyScore = Math.round(word['accuracy_score']);

            overallAccuracyScore += wordAccuracyScore;

            let pronunciationWordElement = $(`<span class="pronunciation-word"><strong style="color:${getMarkColor(wordAccuracyScore)}">${displayWord}</strong></span>`);
            pronunciationWordElement.data('accuracyInfo', word);

            var pronunciationWordScore = $(`<span class="pronunciation-word-score" style="color:${getMarkColor(wordAccuracyScore)}">${wordAccuracyScore}%</span>`);
            pronunciationWordElement.append(pronunciationWordScore);

            pronunciationWordContainer.append(pronunciationWordElement).append(' ');
        });

        if(words.length > 0) {
            overallAccuracyScore = Math.round(overallAccuracyScore/words.length);
        }

        updateProgressbar(pronunciationPopup.find('.overall-accuracy-score').find('.progress-bar'), getMarkColor(overallAccuracyScore), overallAccuracyScore);

        pronunciationPopup.find('.pronunciation-result-container').show();
    }

    $('.pronunciation-overall-result div').on('click', function() {
        $('.metric-explanation').hide();
        $(this).find('.metric-explanation').show();
    });

    $(document).on('mousedown', function (e) {
        if (!$(e.target).closest('.pronunciation-overall-result div').length) {
            $('.metric-explanation').hide();
        }
    });

    $(document).on('click', '.pronunciation-word', function() {

        let pronunciationDetailPopup = $('.pronunciation-detail-popup');
        let pronunciationDetailContent = $('.pronunciation-detail-popup').find('.pronunciation-detail');
        pronunciationDetailContent.html('');

        let accuracyInfo = $(this).data('accuracyInfo');

        if(accuracyInfo) {
            let accuracyScore = Math.round(accuracyInfo['accuracy_score']);

            let wordAccuracyScoreElement = $(`<div class="word-accuracy-score" style="color:${getMarkColor(accuracyScore)}">Accuracy: ${accuracyScore}%</div>`);
            let feedbackElement = $(`<div class="word-accuracy-feedback">${getMarkFeedback(accuracyScore)}</div>`);

            //TODO: Replace this with actual phonetic IPA
            let syllableWrapper = $('<div class="pronunciation-syllable-wrapper"></div>');
            syllableWrapper.append(`<strong class="pronunciation-syllable" style="color:${getMarkColor(accuracyScore)}">${accuracyInfo['punctuated_word']}</strong>`);
            syllableWrapper.append('<div class="word-audio-buttons"><i class="play-word-fast-audio-button fa-solid fa-volume-high"></i><i class="play-word-slow-audio-button fa-solid fa-volume-low"></i><i class="play-user-word-audio-button fa-solid fa-head-side-cough"></i></div>');
            syllableWrapper.data('word', accuracyInfo['word']);
            syllableWrapper.data('start', accuracyInfo['start']);
            syllableWrapper.data('end', accuracyInfo['end']);

            pronunciationDetailContent.append(wordAccuracyScoreElement, feedbackElement, syllableWrapper);
        }

        pronunciationDetailPopup.show();   
    });

    $(document).on('mousedown', function (e) {
        if (!$(e.target).closest('.pronunciation-detail-popup').length) {
            $('.pronunciation-detail-popup').hide();
        }
    });

    $(document).on('click', '.play-word-fast-audio-button', function() {
        // playTTSAudio cancels whatever is speaking, and tts_audio.js suppresses
        // onEnd for cancelled utterances — so tear the lip sync down here or its
        // handler survives and holds the mouth shut over later playback.
        stopAvatarSpeech();
        window.TTSAudio.playTTSAudio($(this).closest('.pronunciation-syllable-wrapper').data('word'));
    });

    $(document).on('click', '.play-word-slow-audio-button', function() {
        stopAvatarSpeech();
        window.TTSAudio.playTTSAudio($(this).closest('.pronunciation-syllable-wrapper').data('word'), true);
    });

    $(document).on('click', '.play-user-word-audio-button', function() {
        if(!lastClickedCheckPronunciationButton) return;

        let startTime = $(this).closest('.pronunciation-syllable-wrapper').data('start');
        let endTime = $(this).closest('.pronunciation-syllable-wrapper').data('end');
        let playDuration = Math.max((endTime - startTime + 0.1) * 1000, 800);

        let userAudio = lastClickedCheckPronunciationButton.closest('.user-message-wrapper').find('.user-audio audio')[0];
        userAudio.currentTime = startTime - 0.1;
        userAudio.play();

        setTimeout(function() {
            userAudio.pause();
        }, playDuration);
    });

    function updateProgressbar(progressbar, color, percentage) {
        progressbar.text(percentage + '%').css('background', function() {
            return `radial-gradient(closest-side, white 79%, transparent 80% 100%), conic-gradient(${color} ${percentage}%, lightgray 0)`;
        });
    }

    function getMarkColor(mark) {
        let color = 'black';
        if(mark >= 80) {
            color = 'green';
        }
        else {
            if(mark >= 60) {
                color = "darkgoldenrod";
            }
            else {
                color = "maroon";
            }
        }

        return color;
    }

    function getMarkFeedback(mark) {
        let feedback = '';
    
        if (mark >= 80) {
            feedback = 'Your pronunciation for this word is clear.';
        } else if (mark >= 60) {
            feedback = 'Your pronunciation for this word is mostly clear, but could use improvement.';
        } else {
            feedback = 'Your pronunciation for this word requires further practice for clarity.';
        }
    
        return feedback;
    }

    $(document).on('mousedown', function (e) {
        if (!$(e.target).closest('.user-message-check-pronunciation-popup, .user-message-check-pronunciation').length) {
            $('.user-message-check-pronunciation-popup').hide();
        }
    });

    $('.settings-button').on('click', function() {
        if ($('.settings-popup').is(':visible')) {
            $('.settings-popup').hide();
        }
        else {
            $('.settings-popup').css('display', 'flex');
        }
    });

    $(document).on('mousedown', function (e) {
        if (!$(e.target).closest('.settings-popup, .settings-button').length) {
            $('.settings-popup').hide();
        }
    });

    function convertToSafeJsonKey(text) {
        return text.trim().toLowerCase().replace(/ /g, '_');
    }

    function escapeQuoteCharacters(text) {
        return text.replace(/\\(['"])/g, '$1');
    }

    function safelyParseJsonString(dangerousJson, keyArray) {
        let jsonObject = {};
        for (let i = 0; i < keyArray.length; i++) {
            let key = keyArray[i];
            let startKeyIndex = dangerousJson.indexOf('"' + key + '"');
            if (startKeyIndex === -1) {
                continue;
            }
            let startValueIndex = dangerousJson.indexOf(':', startKeyIndex) + 1;
            let endValueIndex;

            j = i + 1;
            while(j < keyArray.length && dangerousJson.indexOf('"' + keyArray[j] + '"') === -1) {
                j++;
            }

            if(j === keyArray.length) {
                endValueIndex = dangerousJson.lastIndexOf('}') - 1;
            }
            else {
                endValueIndex = dangerousJson.indexOf('"' + keyArray[j] + '"') - 1;
            }

            // Skip over leading spaces, commas, and quotes
            while ([' ', ',', '"', '\n'].includes(dangerousJson.charAt(startValueIndex))) {
                startValueIndex++;
            }
            // Skip over trailing spaces, commas, and quotes
            while ([' ', ',', '"', '\n'].includes(dangerousJson.charAt(endValueIndex))) {
                endValueIndex--;
            }
            let value = dangerousJson.slice(startValueIndex, endValueIndex + 1);
            value = escapeQuoteCharacters(value);
            jsonObject[key] = value;
        }
        return jsonObject;
    }

    //---- AUDIO INPUT----//
    window.audioRecorderReusable.setOnDoRecordingEvent('#user-voice-input-recorder', 200, true,
        () => { //onStart
            $('#user-audio-message-wrapper').hide();
            setAndResizeTextArea($('#user-message-input'), 'Recording...');
            $('.chat-form').find('button[type="submit"').prop("disabled", true);
            $('#suggest-response-idea-button').prop("disabled", true);
        },
        (elapsedTime, percentage) => { //onTimerFill
            
        },
        (transcript) => { //onInterimTranscriptUpdate

        },
        (transcript) => { //onFullTranscriptUpdate
            setAndResizeTextArea($('#user-message-input'), transcript);
        },
        () => { //onStop
            setAndResizeTextArea($('#user-message-input'), 'Finalizing input...');
        },
        (audioData, duration, transcript) => { //onFinalized
            setAndResizeTextArea($('#user-message-input'), transcript);
            $('#user-audio-message-wrapper').show();
            $('#user-voice-input-wrapper').children().appendTo('#user-audio-message-wrapper');
            $('.chat-form').find('button[type="submit"').prop("disabled", false);
            $('#suggest-response-idea-button').prop("disabled", false);
        }
    );

    window.audioRecorderReusable.setOnClickStopRecordingEvent('#user-voice-input-recorder', function() {});

    window.audioRecorderReusable.setOnRecordedAudioPlayerCloseEvent('#user-voice-input-recorder', true, function () {
        setAndResizeTextArea($('#user-message-input'), '');
        $('#user-audio-message-wrapper').children().appendTo('#user-voice-input-wrapper');
        $('#user-audio-message-wrapper').hide();
    });

    //--- LOCAL SETTINGS MANAGER ---//
    function loadLocalSettings() {
        var savedVoice = localStorage.getItem('selectedVoice');
        if(!savedVoice) {
            savedVoice = $('#default_voice_id').val();
        }
        // A previously saved voice may no longer exist in the dropdown. Fall back to the
        // default instead of leaving the selector empty, which would send an invalid voice.
        if ($('.voice-dropdown-item[data-value="' + savedVoice + '"]').length === 0) {
            savedVoice = $('#default_voice_id').val();
            localStorage.setItem('selectedVoice', savedVoice);
        }
        var dropdownItem = $('.voice-dropdown-item[data-value="' + savedVoice + '"]');
        if (dropdownItem.length > 0) {
            var voiceName = dropdownItem.find('span').text();
            $('.voice-dropdown-text').text(voiceName);
            $('#voice-selector').data('value', savedVoice);
            dropdownItem.addClass('selected');
        }

        var savedLearningFocus = localStorage.getItem('learningFocus');
        if (savedLearningFocus) {
            $('#learning-focus-selector').val(savedLearningFocus);
        }

        var savedIsAutoPlayAIAudio = localStorage.getItem('isAutoPlayAIAudio');
        if (savedIsAutoPlayAIAudio) {
            $('#auto-play-ai-audio-toggle').prop('checked', savedIsAutoPlayAIAudio == 'true');
        }

        var savedAvatarModel = localStorage.getItem('avatarModel');
        if (savedAvatarModel) {
            $('#avatar-selector').val(savedAvatarModel);
            // initialize the avatar model will be done in the Avatar Manager section
        }

        var savedShowAvatar = localStorage.getItem('showAvatar');
        if (savedShowAvatar) {
            $('#show-avatar').prop('checked', savedShowAvatar == 'true');
            $('.conversation-container').toggleClass('hide-avatar', savedShowAvatar == 'false');
        }
    };

    // Load settings on page load. Make sure this load first before initializing any UI settings.
    loadLocalSettings();

    //--- AVATAR MANAGER ---//
    var avatarModel = null;
    var avatarApp = null;
    var currentAvatarModelUrl = null;
    
    $('#avatar-selector').on('change', function () {
        var avatarModel = $(this).val();
        localStorage.setItem('avatarModel', avatarModel);

        // get the avatar url from the selected option
        avatarUrl = $(this).find('option:selected').data('avatar-url');
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
                document.getElementById('avatar-canvas').style.display = 'none';
                return;
            }

            console.log('Initializing new avatar model...');

            document.getElementById('avatar-canvas').style.display = 'none'; //display later after the model is loaded
            $('.avatar-model-container').find('.avatar-model-error').remove();
            $('.avatar-model-container').append('<div class="avatar-model-loading" style="font-style: italic; font-size: 20px; text-align: center;margin-bottom: 20px;">Loading avatar model...</div>');
            
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
                    view: document.getElementById('avatar-canvas'),
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
                        const fileName = path.slice(path.lastIndexOf('/engovate.github.io/') + 1);
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
            document.getElementById('avatar-canvas').style.display = 'block';

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
            document.getElementById('avatar-canvas').style.display = 'none';
            $('.avatar-model-container').find('.avatar-model-error').remove();
            $('.avatar-model-container').append('<div class="avatar-model-error" style="color: red; font-weight: bold; font-style: italic; font-size: 20px; text-align: center;margin-bottom: 20px;">Failed to load Avatar model!</div>');
        } finally {
            $('.avatar-model-container').removeClass('speaking');
            $('.avatar-model-container').find('.avatar-model-loading').remove();
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
    initializeAvatarModel($('#avatar-selector').find('option:selected').data('avatar-url'));

    // iOS: pixi-live2d-display opens a brand-new AudioContext for every utterance
    // (SoundManager.addContext does `new AudioContext`) and never calls resume() —
    // there is no resume() anywhere in the library. Safari starts a context
    // suspended unless it is created while a user activation is in scope, and a
    // clip routed through createMediaElementSource into a suspended context plays
    // silently: currentTime still advances and onFinish still fires, which is why
    // the avatar animated but made no sound from the second reply onwards. The
    // first reply worked only because the "Start Chatting" tap was still in scope.
    //
    // resume() called later from an AJAX callback is refused on iOS, so instead we
    // create ONE context during a real tap and make the library reuse it. Note the
    // override deliberately does not populate the library's private WeakMap, so
    // dispose() cannot close our shared context — it skips the close when the map
    // has no entry, which is exactly what we want.
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

    // Install the override up front, before anything can call speak(), so every
    // utterance shares one context rather than minting a fresh suspended one.
    if (window.PIXI && window.PIXI.live2d && window.PIXI.live2d.SoundManager) {
        window.PIXI.live2d.SoundManager.addContext = function() {
            return getSharedAudioContext();
        };

        // A streamed reply plays through Apple's player on iPhones, which only starts on an element with
        // AirPlay switched off. The library makes a new element for every utterance, so it is switched
        // off here, as soon as the element exists and before it starts loading.
        var addSound = window.PIXI.live2d.SoundManager.add;
        window.PIXI.live2d.SoundManager.add = function() {
            var audio = addSound.apply(this, arguments);
            audio.disableRemotePlayback = true;
            return audio;
        };
    }

    // Call this from inside a real tap: a context created or resumed while a user
    // activation is in scope starts running and stays running, whereas resume()
    // from an AJAX callback is refused on iOS.
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
            $('.avatar-model-container').addClass('speaking');

            if(!motionCategory || !animationIndex || motionCategory == '' || animationIndex == '') {
                avatarModel.speak(audioUrl, {
                    resetExpression: true,
                    crossOrigin: 'anonymous',
                    onFinish: function() {
                        $('.avatar-model-container').removeClass('speaking');
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
                        $('.avatar-model-container').removeClass('speaking');
                        onFinish();
                    }
                });
            }
        } catch (error) {
            console.warn('Failed to trigger avatar speech:', error);
            $('.avatar-model-container').removeClass('speaking');
        }
    }

    function stopAvatarSpeech() {
        // Anything still in flight for the previous utterance is now superseded.
        // This must NOT live in stopBrowserVoiceLipSync(): start() calls that, which
        // would invalidate the utterance being started before it ever ran.
        browserVoiceUtteranceToken++;

        stopBrowserVoiceLipSync(); // also clears the 'speaking' class
        if(avatarModel) {
            avatarModel.stopMotions();
        }
    }

    // --- SYNTHETIC LIP SYNC FOR THE BROWSER VOICE ---
    // The library drives the mouth from an AnalyserNode:
    //     if (this.lipSync && this.motionManager.currentAudio) { ... mouthSync() ... }
    // The browser voice is SpeechSynthesis, which exposes no audio element and no
    // MediaStream, so there is nothing to analyse and that block never runs — the
    // avatar would animate with a closed mouth. There is no real amplitude to be
    // had, so we approximate one: a fast flutter under a slower envelope, which
    // reads as syllables with gaps between words.
    //
    // The write has to land in one specific slot in the frame — see the hook in
    // startBrowserVoiceLipSync() for why earlier and later both fail.
    var browserVoiceMouthHandler = null;
    var browserVoiceLipSync = null;
    var browserVoiceStartedMotion = false;

    // Identifies the current utterance. SpeechSynthesis fires 'end' for a cancelled
    // utterance too, and that can arrive AFTER the replacement has already started —
    // in which case the old callback would tear down the new utterance's lip sync and
    // the avatar would speak the whole reply with its mouth shut. Every callback
    // captures the token it was created with and ignores itself if superseded.
    var browserVoiceUtteranceToken = 0;

    // No fixed characters-per-second figure can be right: it varies by device,
    // voice and OS. Instead we time each utterance and correct the estimate for
    // the next one, so the mouth converges on this device's real speaking rate
    // within the first few replies of a conversation.
    var browserVoiceTimeScale = 1;

    function setAvatarMouthOpen(value) {
        if (!avatarModel || !avatarModel.internalModel) {
            return;
        }
        var coreModel = avatarModel.internalModel.coreModel;
        if (!coreModel) {
            return;
        }

        // The two Cubism generations name this parameter differently and write it
        // through different APIs:
        //   Cubism 2 (e.g. Shizuku) -> "PARAM_MOUTH_OPEN_Y", setParamFloat(index, v)
        //   Cubism 4 (e.g. Kei)     -> "ParamMouthOpenY",    setParameterValueById(id, v)
        // The model's own motionManager.lipSyncIds already holds the right name, but
        // fall back to trying both if it is missing.
        var mouthIds = avatarModel.internalModel.motionManager.lipSyncIds;
        if (!mouthIds || !mouthIds.length) {
            mouthIds = ['PARAM_MOUTH_OPEN_Y', 'ParamMouthOpenY'];
        }

        // Test the Cubism 2 API FIRST: a Cubism 4 model has no setParamFloat, while a
        // Cubism 2 model can expose a setParameterValueById that quietly ignores
        // Cubism-2-style ids — checking that one first sent Shizuku down the wrong
        // branch and left its mouth shut.
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
                // A model without this parameter simply keeps its mouth shut.
            }
        }
    }

    // Walks the spoken TEXT in step with the estimated speaking rate, so the mouth
    // opens on vowels, moves less on consonants and closes on spaces and
    // punctuation. That makes the movement follow the actual words and pauses
    // instead of buzzing at a fixed rhythm. SpeechSynthesis exposes no audio to
    // analyse, so the position is always an estimate — calibrateBrowserVoiceRate()
    // corrects the pace after each utterance.
    function startBrowserVoiceLipSync(text, charsPerSecond) {
        stopBrowserVoiceLipSync();
        if (!avatarModel || !avatarModel.internalModel || !$('#show-avatar').is(':checked')) {
            return;
        }

        var spokenText = String(text || '');
        var rate = charsPerSecond || 13;

        // Characters are NOT equal in duration, and crucially a pause ADDS time
        // rather than borrowing it from the surrounding letters. An earlier version
        // rescaled the pauses back into text.length/rate, which squeezed the
        // letters to make room — so every sentence was paced slightly too fast and
        // the mouth drifted further ahead with each one. Letters now hold a fixed
        // duration and punctuation simply adds silence on top.
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
                // "7" is spoken "seven" — far longer than one character's worth.
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
            // Past the predicted end of the line, stay shut. Comparing against the
            // predicted duration matters: keying off the last character's start
            // time left the mouth holding that character's shape after the voice
            // had already stopped.
            var index = position >= state.predictedDuration ? state.text.length : state.cursor;

            // Synthetic AMPLITUDE (not a mouth value): roughly what
            // SoundManager.analyze() reports for speech at this volume, so the
            // library's own curve below produces the same look as real audio.
            var amplitude = 0;
            if (index < state.text.length) {
                var character = state.text.charAt(index).toLowerCase();
                if ('aeo'.indexOf(character) !== -1) {
                    amplitude = 0.45; // open vowels carry the most energy
                } else if ('iuy'.indexOf(character) !== -1) {
                    amplitude = 0.35;
                } else if (character >= '0' && character <= '9') {
                    amplitude = 0.30; // digits are spoken as words ("seven"), not silence
                } else if (character.toUpperCase() !== character) {
                    amplitude = 0.22; // any other letter, including accented ones
                }
                // space and punctuation stay at 0 — a real pause
            }

            // Asymmetric easing: rise gently over a few frames (a snap looked
            // twitchy) but fall quickly, the way real speech energy drops away at
            // a word gap. Without the fast release the mouth never reaches zero
            // between words and just hangs at the 0.4 floor for the whole line.
            var smoothing = amplitude > state.amplitude ? 0.18 : 0.5;
            state.amplitude += (amplitude - state.amplitude) * smoothing;

            // From here on this mirrors the library exactly, so the browser voice
            // and real audio move the mouth the same way:
            //   analyze()  quantises to one decimal place
            //   update()   clamp(pow(a, 0.7) * 1.2, a > 0 ? 0.4 : 0, 1)
            var analyzed = parseFloat(state.amplitude.toFixed(1));
            var floorValue = analyzed > 0 ? 0.4 : 0;
            var mouth = Math.pow(analyzed, 0.7) * 1.2;
            setAvatarMouthOpen(Math.min(1, Math.max(floorValue, mouth)));
        };

        // Write on 'beforeModelUpdate'. The frame ends like this:
        //     ... expressions, eyeBlink, focus, natural movements ...
        //     library's own lip-sync write
        //     physics.update(); pose.update();
        //     emit('beforeModelUpdate')
        //     coreModel.update();     <- applies the parameters to the mesh
        //     coreModel.loadParam();  <- restores the saveParam() snapshot
        // So this event is the last moment a parameter still reaches the mesh.
        // 'afterMotionUpdate' was too early (expressions overwrote us), and writing
        // after update() returned was too late: the value read back correctly but
        // landed after coreModel.update() had already applied the frame and
        // loadParam() had discarded it — written, readable, never drawn.
        avatarModel.internalModel.on('beforeModelUpdate', browserVoiceMouthHandler);

        $('.avatar-model-container').addClass('speaking');

        // Play the same speaking motion the real-audio path uses, just without a
        // sound attached — otherwise the browser voice only moved the mouth while
        // the body and expression stayed idle, which is why the avatar behaved
        // differently between the two voice types. Our mouth write still wins: it
        // runs on 'beforeModelUpdate', after this motion's expression is applied.
        var speakingMotionCategory = $('#avatar-selector').find('option:selected').data('speaking-motion-category');
        var speakingMotionIndex = $('#avatar-selector').find('option:selected').data('speaking-motion-index');
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

    // Called when speech finishes naturally: compare how long it actually took
    // with what we predicted and nudge the scale toward the truth. Ignored for
    // interrupted playback (onEnd also fires on cancel), which would otherwise
    // teach it that every line is very short.
    function calibrateBrowserVoiceRate() {
        var state = browserVoiceLipSync;
        if (!state || !state.predictedDuration) {
            return;
        }
        var actual = (Date.now() - state.startedAt) / 1000;
        if (actual < 0.6) {
            return; // too short to be a real utterance
        }

        var correction = actual / state.predictedDuration;

        // Reject wild samples in BOTH directions. Rejecting only short ones used to
        // let the scale lock: the update is a bisection toward the measured rate, so
        // one badly mispredicted line could push the scale to the 2.0 clamp, after
        // which every honest utterance measured correction < 0.6, was discarded as
        // "cancelled", and the scale never came back down for the rest of the page.
        if (correction < 0.6 || correction > 1.8) {
            return; // cancelled, or a line we predicted far too badly to learn from
        }
        // Move only part of the way so one odd utterance cannot skew it.
        browserVoiceTimeScale = Math.min(2, Math.max(0.5, browserVoiceTimeScale * (1 + (correction - 1) * 0.5)));
    }

    function stopBrowserVoiceLipSync() {
        if (browserVoiceMouthHandler && avatarModel && avatarModel.internalModel) {
            avatarModel.internalModel.off('beforeModelUpdate', browserVoiceMouthHandler);
            setAvatarMouthOpen(0); // leave the mouth closed
        }

        // Only stop a motion WE started — the real-audio path couples its motion to
        // the audio itself, and must not be cut short from here.
        if (browserVoiceStartedMotion && avatarModel) {
            avatarModel.stopMotions();
        }
        browserVoiceStartedMotion = false;
        browserVoiceMouthHandler = null;
        browserVoiceLipSync = null;
        $('.avatar-model-container').removeClass('speaking');
    }

    //--- VOICE SELECTION ---//
    var currentlyPlayingVoiceAudio = null;

    $('.voice-dropdown-toggle').on('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        var dropdown = $(this).closest('.voice-dropdown-container');
        var menu = dropdown.find('.voice-dropdown-menu');
        var isOpen = menu.hasClass('show');
        
        // Close all other dropdowns
        $('.voice-dropdown-menu').removeClass('show');
        $('.voice-dropdown-toggle').removeClass('active');
        
        // Toggle this dropdown
        if (!isOpen) {
            menu.addClass('show');
            $(this).addClass('active');
        }
    });

    // Close dropdown when clicking outside
    $(document).on('click', function(e) {
        if (!$(e.target).closest('.voice-dropdown-container').length) {
            $('.voice-dropdown-menu').removeClass('show');
            $('.voice-dropdown-toggle').removeClass('active');
            // Stop any currently playing audio
            if (currentlyPlayingVoiceAudio) {
                currentlyPlayingVoiceAudio.pause();
                currentlyPlayingVoiceAudio = null;
            }
            // Reset all play buttons to play state
            $('.voice-play-button').removeClass('playing').html('<i class="fa-solid fa-play"></i>');         
        }
    });

    // Handle voice selection from dropdown
    $(document).on('click', '.voice-dropdown-item', function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        var item = $(this);
        var value = item.data('value');
        var voiceName = item.find('span').text();
        var dropdown = item.closest('.voice-dropdown-container');
        var toggle = dropdown.find('.voice-dropdown-toggle');
        var menu = dropdown.find('.voice-dropdown-menu');
        
        // Stop any currently playing audio
        if (currentlyPlayingVoiceAudio) {
            currentlyPlayingVoiceAudio.pause();
            currentlyPlayingVoiceAudio = null;
        }
        
        // Reset all play buttons to play state
        $('.voice-play-button').removeClass('playing').html('<i class="fa-solid fa-play"></i>');
        
        // Update dropdown text
        toggle.find('.voice-dropdown-text').text(voiceName || 'Choose a voice...');
        $('#voice-selector').data('value', value);
        
        // Update selection
        $('.voice-dropdown-item').removeClass('selected');
        item.addClass('selected');
        
        // Close dropdown
        menu.removeClass('show');
        toggle.removeClass('active');
        
        // Update selected voice
        if (value) {
            localStorage.setItem('selectedVoice', value);
        } else {
            localStorage.removeItem('selectedVoice');
        }
    });

    // Handle voice play button clicks
    $(document).on('click', '.voice-play-button', function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        var button = $(this);
        var voiceUrl = button.closest('.voice-dropdown-item').data('voice-url');

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
        $('.voice-play-button').removeClass('playing').html('<i class="fa-solid fa-play"></i>');

        // If this button was already playing, just stop and return
        if (isCurrentlyPlaying) {
            return;
        }
        
        // Mark this button as playing
        button.addClass('playing');

        // no voiceUrl is browser voice
        if (!voiceUrl) {
            button.html('<i class="fa-solid fa-pause"></i>');
            window.TTSAudio.playTTSAudio('Hello, how are you?', false, button.closest('.voice-dropdown-item').data('value') == "browser-male", () => {
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

    //--- LEARNING FOCUS SELECTOR ---//
    $('#learning-focus-selector').on('change', function (e) {
        localStorage.setItem('learningFocus', $(this).val());
    });

    //--- TOGGLE BUTTONS ---//
    $('#auto-play-ai-audio-toggle').on('click', function (e) {
        localStorage.setItem('isAutoPlayAIAudio', $(this).prop('checked'));
    });

    $('#show-avatar').on('change', function() {
        var showAvatar = $(this).is(':checked');
        if (!showAvatar) {
            stopBrowserVoiceLipSync(); // stop driving a model nobody can see
        }
        $('.conversation-container').toggleClass('hide-avatar', !showAvatar);
        localStorage.setItem('showAvatar', showAvatar);
        $('#show-avatar').prop('checked', showAvatar);
    });

    //--- SHADOWING CONTROL ---//
    var isInShadowingMode = false;
    var currentShadowingMessageIndex = 0;
    var lastClickedShadowingRecordButton = null;
    $('.enable-shadowing-toggle').on('click', function (e) {
        e.preventDefault();
        const checkbox = $(this).find('input');
        checkbox.prop('checked', !checkbox.prop('checked'));
        isInShadowingMode = checkbox.prop('checked');
        if(checkbox.prop('checked')) {
            $('.chat-container').hide();
            $('.user-task-container').hide();
            $('.shadowing-practice-container').css('display', 'grid');
        }
        else {
            $('.chat-container').show();
            $('.user-task-container').show();
            $('.shadowing-practice-container').hide();
            autoResize($('#user-message-input')[0]); //Sometimes when we toggle back and forth shadowing mode while still recording audio, the auto resize function just cannot correctly calculate the scrollHeight because it was previously hidden.
        }
        if(lastClickedShadowingRecordButton) {
            lastClickedShadowingRecordButton.prop('disabled', false);
            lastClickedShadowingRecordButton.click(); //call this to stop current shadowing record process
        }
    });

    $('#shadowing-next-message-button').on('click', function (e) {
        e.preventDefault();

        var messageElement = $('.message-container').children(`:eq(${currentShadowingMessageIndex})`);

        if(messageElement.length == 0) {
            alert('You have reached the end of your conversation!');
            return;
        }

        var clonedMessageElement = messageElement.clone(true);
        $('.shadowing-message-container').append(clonedMessageElement);

        var textMessageElement = clonedMessageElement.find('.text-message');
        textMessageElement.after('<span class="shadowing-record-audio-button"><i class="fa-solid fa-microphone"></i></span>' +
        '<audio controls class="shadowing-user-audio"> Your browser does not support the audio element.</audio>' +
        '<em class="shadowing-user-text"></em>');

        if(clonedMessageElement.hasClass('user-message-wrapper')) {
            //swap suggestions and message
            var improvementSuggestion = $('<span>' + clonedMessageElement.data('suggestion') + '</span>');
            if(improvementSuggestion.find('.text-message').text()) {
                var userTextMessage = textMessageElement.html();
                textMessageElement.html(improvementSuggestion.find('.text-message').text());
                clonedMessageElement.data('suggestion', '<strong>Your Original Response:<br></strong>' + userTextMessage);
                clonedMessageElement.find('.user-audio').remove();
            }

            if($('#auto-play-ai-audio-toggle').prop('checked')) {
                var audioButton = clonedMessageElement.find('.user-message-audio-button');
                audioButton.attr('playing', 'false');
                playAudioOnButton(audioButton);
            }
        }
        else {
            if($('#auto-play-ai-audio-toggle').prop('checked')) {
                var audioButton = clonedMessageElement.find('.ai-message-audio-button');
                audioButton.attr('playing', 'false');
                playAudioOnButton(audioButton);
            }
        }
        $('.shadowing-practice-text').html('');

        currentShadowingMessageIndex++;
    });

    window.audioRecorderReusable.setOnDoRecordingEvent('#shadowing-user-voice-input-recorder', 200, true,
        () => { //onStart
            if(lastClickedShadowingRecordButton) {
                lastClickedShadowingRecordButton.hide();
                lastClickedShadowingRecordButton.siblings('audio').hide();
                lastClickedShadowingRecordButton.siblings('.shadowing-user-text').hide();
                textToShadow = lastClickedShadowingRecordButton.closest('div').find('.text-message').text();

                $('.shadowing-practice-text').html('<em><strong>Practice: </strong>' + textToShadow + '</em>');
                $('.shadowing-voice-input-form').css('display', 'flex');
                $('.shadowing-record-audio-button').prop('disabled', true);
                $('#shadowing-next-message-button').hide();
                setAndResizeTextArea($('#shadowing-user-message-input'), 'Recording...');
            }
        },
        (elapsedTime, percentage) => { //onTimerFill
            
        },
        (transcript) => { //onInterimTranscriptUpdate

        },
        (transcript) => { //onFullTranscriptUpdate
            setAndResizeTextArea($('#shadowing-user-message-input'), transcript);
        },
        () => { //onStop
            setAndResizeTextArea($('#shadowing-user-message-input'), 'Finalizing input...');
        },
        (audioData, duration, transcript) => { //onFinalized
            if(lastClickedShadowingRecordButton) {
                setAndResizeTextArea($('#shadowing-user-message-input'), transcript);

                var userTextElement = lastClickedShadowingRecordButton.siblings('.shadowing-user-text');
                userTextElement.html("<strong>Your speech: </strong>" + transcript);
                userTextElement.show();

                var audioElement = lastClickedShadowingRecordButton.siblings('audio');
                if (audioElement.attr('src')) {
                    URL.revokeObjectURL(audioElement.attr('src'));
                }
                const audioURL = URL.createObjectURL(audioData);
                audioElement.attr('src', audioURL);
                audioElement.show();
                
                lastClickedShadowingRecordButton.show();
                $('#shadowing-next-message-button').show();
                $('.shadowing-practice-text').html('');
                $('.shadowing-record-audio-button').prop('disabled', false);
                $('.shadowing-voice-input-form').hide();

                var textToShadow = lastClickedShadowingRecordButton.closest('div').find('.text-message').text();

                //Compare the difference between text
                var cleanTextToShadow = cleanText(textToShadow);
                var cleanFullTranscript = cleanText(transcript);

                var similarity = Math.round(checkSimilarity(cleanTextToShadow, cleanFullTranscript) * 100);

                if(similarity >= 90) {
                    userTextElement.append(`<span class="similarity-percentage" style="color: green">${similarity}% accuracy</span>`);
                }
                else {
                    if(similarity >= 80) {
                        userTextElement.append(`<span class="similarity-percentage" style="color: darkmagenta">${similarity}% accuracy</span>`);
                    }
                    else {
                        if(similarity >= 70) {
                            userTextElement.append(`<span class="similarity-percentage" style="color: darkblue">${similarity}% accuracy</span>`);
                        }
                        else {
                            if(similarity >= 60) {
                                userTextElement.append(`<span class="similarity-percentage" style="color: orangered">${similarity}% accuracy</span>`);
                            }
                            else {
                                userTextElement.append(`<span class="similarity-percentage" style="color: maroon">${similarity}% accuracy</span>`);
                            }
                        }
                    }
                }

                lastClickedShadowingRecordButton = null;
            }
        }
    );

    window.audioRecorderReusable.setOnClickStopRecordingEvent('#shadowing-user-voice-input-recorder', function() {});

    window.audioRecorderReusable.setOnRecordedAudioPlayerCloseEvent('#shadowing-user-voice-input-recorder', true, function () {
        
    });

    $(document).on('click', '.shadowing-record-audio-button', function () {
        lastClickedShadowingRecordButton = $(this);
        window.audioRecorderReusable.resetAudioRecorder('#shadowing-user-voice-input-recorder', false);
        window.audioRecorderReusable.triggerRecordingButton('#shadowing-user-voice-input-recorder');
    });

    function cleanText(text) {
        // Remove all special characters, 16 punctuation marks, and double spaces
        var regexPattern = /[^\w\s]|_|\u2013|\u2014|\u2026/g;
        var spacePattern = /\s+/g;
        return text.trim().toLowerCase().replace(regexPattern, '').replace(spacePattern, ' ');
    }

    //the "Longest Common Subsequence" (LCS) algorithm. This algorithm finds the longest subsequence common to both strings, ignoring characters that don't match.
    function lcs(s1, s2) {
        var matrix = [];
        for(var i = 0; i <= s1.length; i++){
            matrix[i] = [0];
            for(var j = 0; j <= s2.length; j++){
            matrix[i][j] = 0;
            }
        }
        
        for(var i = 1; i <= s1.length; i++){
            for(var j = 1; j <= s2.length; j++){
            if(s1[i-1] === s2[j-1]){
                matrix[i][j] = matrix[i-1][j-1] + 1;
            }
            else{
                matrix[i][j] = Math.max(matrix[i-1][j], matrix[i][j-1]);
            }
            }
        }
        
        return matrix[s1.length][s2.length];
    }
    
    function checkSimilarity(s1, s2) {
        var longerLength = Math.max(s1.length, s2.length);
        if (longerLength === 0) {
            return 1.0; // if both are empty strings
        }
        return lcs(s1, s2) / longerLength;
    }

    //--- AUTO RESIZING ---//
    $('#user-message-input').on('input', function () {
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
        autoResize($('#user-message-input')[0]);
    });

    //--- ON SCREEN INSTRUCTION POPUP ---//
    $('body').append(`<div class="onscreen-instruction-popup"><div class="onscreen-instruction-message"></div><div class="onscreen-instruction-control-buttons"><a href="#" class="previous-onscreen-instruction-button"><i class="fa-solid fa-arrow-left"></i> Previous Step</a><a href="#" class="next-onscreen-instruction-button">Next Step <i class="fa-solid fa-arrow-right"></i></a></div><div class="close-onscreen-instruction-button"><a href="#">Close</a> ( <input type="checkbox"><label> Don't show again</label> )</div></div>`);
    
    var onscreenInstructionSteps = [
        {
            'target': '#user-message-input',
            'message': "Start a chat by typing your message here."
        },
        {
            'target': '#user-voice-input-wrapper',
            'message': "Want to speak instead? Just click here."
        },
        {
            'target': '.chat-form button[type="submit"]',
            'message': "Once you're ready, click this button to send your message."
        },
        {
            'target': '.message-translation-button',
            'message': "Need a translation? Click here."
        },
        {
            'target': '#suggest-response-idea-button',
            'message': "Stuck for words? Click here to generate a sample response."
        },
        {
            'target': '.enable-shadowing-toggle',
            'message': "Fancy a change of pace? Click here to switch to shadowing practice mode."
        },
        // {
        //     'target': '.settings-button',
        //     'message': "Want to tweak your settings? Change AI voice, user voice, and more over here."
        // },
        {
            'target': '.chat-tip em',
            'message': "Don't forget, you can use your native language if you're struggling to express an idea in English."
        },
        {
            'target': '.user-message-improvement-suggestion',
            'message': "Click here and let the AI improve your response."
        },
        {
            'target': '.user-message-check-pronunciation',
            'message': "Click here to check your pronuncation."
        },
    ];
    var currentOnScreenInstructionStepIndex = -1;

    $('.close-onscreen-instruction-button a').on('click', function(e) {
        e.preventDefault();
        $('.onscreen-instruction-popup').hide();
        var notShownAgain = $(this).siblings('input').prop('checked');
        localStorage.setItem('not_show_engnovate_ai_conversation_instruction_again', notShownAgain ? 1 : 0);
    });

    $('.previous-onscreen-instruction-button').on('click', function(e) {
        e.preventDefault();

        currentOnScreenInstructionStepIndex--;

        if(currentOnScreenInstructionStepIndex < onscreenInstructionSteps.length - 1) {
            $('.next-onscreen-instruction-button').show();
        }

        if(currentOnScreenInstructionStepIndex == 0) {
            $(this).hide();
        }

        if(currentOnScreenInstructionStepIndex < 0) {
            currentOnScreenInstructionStepIndex = 0;
            return;
        }

        showOnScreenInstructionStep(currentOnScreenInstructionStepIndex);
    });

    $('.next-onscreen-instruction-button').on('click', function(e) {
        e.preventDefault();

        currentOnScreenInstructionStepIndex++;

        if(currentOnScreenInstructionStepIndex >= 1) {
            $('.previous-onscreen-instruction-button').show();
        }

        if(currentOnScreenInstructionStepIndex == onscreenInstructionSteps.length - 1) {
            $(this).hide();
        }

        if(currentOnScreenInstructionStepIndex >= onscreenInstructionSteps.length) {
            currentOnScreenInstructionStepIndex = onscreenInstructionSteps.length - 1;
            return;
        }

        showOnScreenInstructionStep(currentOnScreenInstructionStepIndex);
    });

    function showOnScreenInstructionStep(stepIndex) {
        var currentOnScreenInstructionStep = onscreenInstructionSteps[stepIndex];
        if(currentOnScreenInstructionStep) {
            var popup = $('.onscreen-instruction-popup');
            var targetElement = $(currentOnScreenInstructionStep['target']);
            var instructionMessage = currentOnScreenInstructionStep['message'];

            if(targetElement.length > 0) {
                $('.onscreen-instruction-message').html(instructionMessage);
                var targetElementOffset = targetElement.offset();
                popup.css({
                    'top': targetElementOffset.top + 50,
                    'left': targetElementOffset.left + 10
                });
                // Check if the popup is entirely visible
                var viewportHeight = $(window).height();
                var popupTop = popup.offset().top;
                var popupHeight = popup.outerHeight();

                if ((popupTop + popupHeight) > (viewportHeight + $(window).scrollTop())) {
                    $('html, body').animate({
                        scrollTop: (popupTop + popupHeight) - viewportHeight
                    }, 500);
                }
            }
            else {
                //this element might not exist yet. Just frequently check again
                popup.hide();
                var checkTargetElementInterval = setInterval(() => {
                    if($(currentOnScreenInstructionStep['target']).is(':visible')) {
                        targetElement = $(currentOnScreenInstructionStep['target']);
                        $('.onscreen-instruction-message').html(instructionMessage);
                        var targetElementOffset = targetElement.offset();
                        popup.css({
                            'top': targetElementOffset.top + 50,
                            'left': targetElementOffset.left + 10
                        });
                        popup.show();
                        clearInterval(checkTargetElementInterval);
                    }
                }, 1000);
            }
        }
    }

    function showOnScreenInstructionPopup() {
        if(parseInt(localStorage.getItem('not_show_engnovate_ai_conversation_instruction_again')) != 1) {
            $('.onscreen-instruction-popup').show();
            $('.next-onscreen-instruction-button').click();
        }
    }

    //--- ASK BEFORE LEAVING ---//
    window.addEventListener("beforeunload", (event) => {
        event.preventDefault();
        event.returnValue = ""; // This will trigger the default browser message
    });
});