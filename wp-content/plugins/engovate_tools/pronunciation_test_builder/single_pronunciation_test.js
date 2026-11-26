jQuery(document).ready(function ($) {

    var currentPronunciationUnitIndex = 0;
    var isAutoPlayingAudio = true;


    $('.previous-unit-button').on('click', function() {
        changePronunciationUnit(-1);
    });

    $('.next-unit-button').on('click', function() {
        changePronunciationUnit(1);
    });

    function changePronunciationUnit(offset) {

        var pronunciationUnitContainers = $('.pronunciation-unit-container');

        currentPronunciationUnitIndex = currentPronunciationUnitIndex + offset;
        if(currentPronunciationUnitIndex < 0) {
            currentPronunciationUnitIndex = pronunciationUnitContainers.length - 1;
        }
        else {
            if(currentPronunciationUnitIndex >= pronunciationUnitContainers.length) {
                currentPronunciationUnitIndex = 0;
            }
        }

        var pronunciationUnitContainer = $('#pronunciation-unit-container-' + currentPronunciationUnitIndex);
        pronunciationUnitContainers.removeClass('slide-right slide-left current');
        pronunciationUnitContainer.addClass('current');
        pronunciationUnitContainer.addClass(offset > 0 ? 'slide-right' : 'slide-left');

        $('.pronunciation-unit-counter').text((currentPronunciationUnitIndex + 1) + ' / ' + pronunciationUnitContainers.length);
        setTimeout(function() {
            pronunciationUnitContainers.removeClass('slide-right slide-left');
            if(isAutoPlayingAudio) {
                window.TTSAudio.playTTSAudio(pronunciationUnitContainer.find('.pronunciation-unit').text());
            }
        }, 200);
    }

    $('.play-fast-audio-button').on('click', function () {
        window.TTSAudio.playTTSAudio($('#pronunciation-unit-container-' + currentPronunciationUnitIndex).find('.pronunciation-unit').text());
    });

    $('.play-slow-audio-button').on('click', function () {
        window.TTSAudio.playTTSAudio($('#pronunciation-unit-container-' + currentPronunciationUnitIndex).find('.pronunciation-unit').text(), true);
    });

    $('.play-recorded-audio-button').on('click', function () {
        $(this).closest('.pronunciation-unit-container').find('audio')[0].play();
    });

    //---- AUDIO INPUT----//
    const MAX_RECORDING_TIME_IN_SECONDS = 5;
    let stream = null;
    let recorder = null;
    let isRecording = false;

    let recognition = null;
    let isRecognitionStopping = false;
    let recognitionBackoffMs = 0; // grows after transient recognition errors so we don't hammer the backend

    let silenceTimer = null;

    let recordingStartTime;
    let timeIntervalId;

    let fullTranscript = "";

    let isAutoStopRecording = true;

    function doRecording(onStart=null, onTimerFill = null, onInterimTranscriptUpdate = null, onFullTranscriptUpdate = null, onStop = null, onFinalized = null) {
        if (isRecognitionStopping) return;

        if (isRecording) {
            stopRecording(onStop, onFinalized);
        } else {
            navigator.mediaDevices.getUserMedia({ audio: true })
                .then(function (strm) {
                    stream = strm;

                    recorder = RecordRTC(stream, {
                        type: 'audio',
                        mimeType: 'audio/wav',
                        desiredSampRate: 48000,
                        numberOfAudioChannels: 1,
                        recorderType: RecordRTC.StereoAudioRecorder
                    });

                    recorder.startRecording();
                    fullTranscript = "";
                    isRecording = true;
                    if(onStart) onStart();

                    // Start the timer
                    recordingStartTime = new Date();
                    updateRecordingTime();
                    timeIntervalId = setInterval(() => {
                        let timeElapsed = updateRecordingTime();
                        let percentage = timeElapsed * 100.0 / MAX_RECORDING_TIME_IN_SECONDS;
                        if(onTimerFill) onTimerFill(timeElapsed, percentage);
                        if(timeElapsed > MAX_RECORDING_TIME_IN_SECONDS) {
                            stopRecording(onStop, onFinalized);
                        } 
                    }, 1000);

                    //Transcribe user speech to text. Also, detect if user is speaking or not
                    recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition || window.mozSpeechRecognition || window.msSpeechRecognition)();
                    recognition.lang = 'en-US';
                    recognition.interimResults = true;
                    recognition.maxAlternatives = 1;
                    recognition.continuous = true;
                    recognitionBackoffMs = 0;

                    // Restart recognition safely (handles the ~60s session cap and transient drops)
                    // without ever stopping the local RecordRTC capture.
                    var restartRecognition = function () {
                        if (isRecognitionStopping || !recognition) return;
                        setTimeout(function () {
                            if (isRecognitionStopping || !recognition) return;
                            try {
                                recognition.start();
                            } catch (e) {
                                // InvalidStateError ("already started") is expected on a racey restart — ignore.
                                console.warn('Speech recognition restart skipped: ' + e.name);
                            }
                        }, recognitionBackoffMs || 300);
                    };

                    recognition.onresult = function (event) {
                        recognitionBackoffMs = 0; // a result means the service recovered — reset backoff

                        // Get the current transcribed text
                        const currentText = event.results[event.results.length - 1][0].transcript;

                        if(onInterimTranscriptUpdate) onInterimTranscriptUpdate(currentText);

                        // Check if the current result is final
                        if (event.results[event.results.length - 1].isFinal) {
                            // Add the current text to the full transcript
                            fullTranscript += currentText.trim() + ' ';

                            if (!isRecognitionStopping) {
                                if(onFullTranscriptUpdate) onFullTranscriptUpdate(fullTranscript);
                            }
                        }

                        clearTimeout(silenceTimer);
                        silenceTimer = setTimeout(() => {
                            if (isRecording && isAutoStopRecording) {
                                stopRecording(onStop, onFinalized);
                            }
                        }, 3000);
                    };

                    //Recognition naturally ends (no-speech, the ~60s cap, a transient drop) — just restart it,
                    //never touch the recorder, so a transcription hiccup can't kill the recording.
                    recognition.onend = function () {
                        restartRecognition();
                    };

                    recognition.onerror = function (event) {
                        if(isRecognitionStopping) return; //avoid reacting while we're finalizing

                        // Only a genuinely unavailable microphone justifies stopping the recording.
                        if (event.error === 'not-allowed' || event.error === 'audio-capture') {
                            alert('Microphone is unavailable (' + event.error + ').\nPlease allow microphone access and try again.');
                            stopRecording(onStop, onFinalized);
                            return;
                        }

                        // Speech recognition is permanently unavailable in this browser (NOT a transient blip):
                        // retrying forever would just record into a void, so surface a one-time notice and stop.
                        if (event.error === 'service-not-allowed' || event.error === 'language-not-supported') {
                            alert('Speech recognition is not available in this browser.\nPlease use Chrome, Safari, or CocCoc.');
                            stopRecording(onStop, onFinalized);
                            return;
                        }

                        // 'network': transient backend failure. Back off, then let onend restart recognition.
                        // The local RecordRTC capture keeps running, so audio is never lost. If recognition never
                        // recovers, the transcript stays empty and the "wrong words" guard simply skips the
                        // assessment (no server call) — anti-spam protection still holds.
                        if (event.error === 'network') {
                            recognitionBackoffMs = Math.min(recognitionBackoffMs ? recognitionBackoffMs * 2 : 500, 8000);
                            console.warn('Speech recognition "network" (non-fatal) — recording continues; retrying in ' + recognitionBackoffMs + 'ms');
                        }
                        // 'no-speech', 'aborted', etc.: harmless — onend restarts at the default delay.
                    };

                    recognition.start();
                })
                .catch(function (err) {
                    console.log(err);
                    // Handle media access blocked error
                    if (err.name === 'NotAllowedError') {
                        alert('Microphone access is blocked. Please manually allow access to your microphone in your browser settings (usually on the left/right corner of the address bar).');
                    }
                    else {
                        alert('Please check your internet connection, or consider changing your browser to Chrome, Safari, or CocCoc.');
                    }

                    stopRecording(onStop, onFinalized);
                });
        }
    }

    function stopRecording(onStop = null, onFinalized = null) {
        if (recorder) {
            isRecognitionStopping = true; //immediately do this to prevent recognition.onerror call multiple times
            
            recorder.stopRecording(function() {
                let blob = this.getBlob();

                clearTimeout(silenceTimer);
                
                clearInterval(timeIntervalId);

                if (recognition) {
                    // Finalize exactly once, whether or not onend fires. recognition.stop() is a no-op that
                    // does NOT re-fire onend when recognition is already inactive (e.g. it was stopped mid-backoff
                    // while waiting to restart), so we must not depend on onend alone — otherwise isRecognitionStopping
                    // would stay true forever and the record button would stay stuck in 'processing'.
                    var recognitionFinalized = false;
                    var finalizeRecognition = function() {
                        if (recognitionFinalized) return;
                        recognitionFinalized = true;

                        if (recognition) {
                            recognition.onend = null;
                            recognition.onresult = null;
                            recognition.onerror = null;
                            recognition = null;
                        }

                        isRecognitionStopping = false;

                        if(onFinalized) onFinalized(blob, fullTranscript);
                    };

                    recognition.onend = finalizeRecognition;

                    setTimeout(() => {
                        try {
                            if (recognition) recognition.stop(); // fires onend if active; no-op if already inactive
                        } catch (e) { /* stop() on an inactive recognizer can throw — ignore */ }
                        // Guaranteed finalize even if stop() could not fire onend.
                        setTimeout(finalizeRecognition, 700);
                    }, 500);
                } else {
                    isRecognitionStopping = false;

                    if(onFinalized) onFinalized(blob, fullTranscript);
                }

                if (stream) {
                    stream.getTracks().forEach(track => track.stop());
                }

                isRecording = false;

                if(onStop) onStop(blob, fullTranscript);
            });
        }
    }

    function updateRecordingTime() {
        let currentTime = new Date();
        let timeElapsed = Math.floor((currentTime - recordingStartTime) / 1000);
        return timeElapsed;
    }

    $('.record-button').on('click', function () {
        let recordButton = $(this);
        let recordButtonFill = recordButton.find('.button-fill');
        let currentUnitContainer = $('#pronunciation-unit-container-' + currentPronunciationUnitIndex);
        let pronunciationUnitElement = currentUnitContainer.find('.pronunciation-unit');
        let referenceText = pronunciationUnitElement.text();
        let pronunciationOverallResultContainer = currentUnitContainer.find('.pronunciation-overall-result');
        let pronunciationUnitTip = currentUnitContainer.find('.pronunciation-unit-tip');
        let pronunciationUnitNotice = currentUnitContainer.find('.pronunciation-unit-notice');
        let audioElement = currentUnitContainer.find('.user-audio-input').find('audio');
        let recordedAudioButton = currentUnitContainer.find('.play-recorded-audio-button');
        let pronunciationAssessmentWrapper = currentUnitContainer.find('.pronunciation-assessment-wrapper');

        doRecording( 
        () => { //onStart
            recordButton.find('i').replaceWith('<i class="fa-solid fa-wave-square"></i>');
            recordButton.addClass('recording');
            $('.previous-unit-button').hide();
            $('.next-unit-button').hide();
            recordedAudioButton.hide();
            pronunciationAssessmentWrapper.hide();
            pronunciationAssessmentWrapper.html('');
            pronunciationUnitElement.css('display', 'flex');
            pronunciationUnitTip.text('Say the text above to get pronunciation feedback');
            pronunciationUnitNotice.hide();
            pronunciationOverallResultContainer.hide();
        },
        (elapsedTime, percentage) => { //onTimerFill
            recordButtonFill.css('width', `${percentage}%`);
        },
        (transcript) => { //onInterimTranscriptUpdate
            //automatically stop if users have spoken for too long or they have done speaking
            if(transcript.length - referenceText.length > 10 || checkSimilarity(cleanText(referenceText), cleanText(transcript)) >= 0.90) {
                recordButton.trigger('click');
            }
        },
        (transcript) => { //onFullTranscriptUpdate
            //automatically stop if users have spoken for too long or they have done speaking
            if(transcript.length - referenceText.length > 10 || checkSimilarity(cleanText(referenceText), cleanText(transcript)) >= 0.90) {
                recordButton.trigger('click');
            }
        },
        (audioData, transcript) => { //onStop
            recordButton.find('i').replaceWith('<i class="fa-solid fa-paper-plane"></i>');
            recordButton.addClass('processing');
            recordButtonFill.css('width', '0%');
            recordButton.prop("disabled", true);
        },
        (audioData, transcript) => { //onFinalized
            checkPronunciation(audioData, transcript, referenceText,
            () => { //beforeSend
            }, 
            (pronunciationJSONData) => { //success

                if(!pronunciationJSONData) return;

                let overallPronunciationScore = pronunciationJSONData['PronScore'];
                let overallFluencyScore = pronunciationJSONData['FluencyScore'];
                let overallCompletenessScore = pronunciationJSONData['CompletenessScore'];

                let pronunciationWordContainer = $('<div></div>');
                let wordPronunciationInfos = pronunciationJSONData['Words'];
                let currentWordPronunciationInfoIndex = -1;

                let words = referenceText.split(' ');

                let overallAccuracyScore = 0;
                words.forEach(word => {
                    let wordPronunciationInfo;
                    do {
                        currentWordPronunciationInfoIndex++;
                        wordPronunciationInfo = wordPronunciationInfos[currentWordPronunciationInfoIndex];
                    }
                    while(wordPronunciationInfo['ErrorType'] === "Insertion");

                    if(wordPronunciationInfo) {
                        let wordAccuracyScore = 0;
                        if(wordPronunciationInfo['Phonemes'] && wordPronunciationInfo['Phonemes'].length > 0) {
                            wordPronunciationInfo['Phonemes'].forEach(phoneme => {
                                wordAccuracyScore += phoneme['AccuracyScore'];
                            });
                            wordAccuracyScore = Math.round(wordAccuracyScore/wordPronunciationInfo['Phonemes'].length);
                        }
                        else {
                            wordAccuracyScore = wordPronunciationInfo['AccuracyScore'];
                        }

                        overallAccuracyScore += wordAccuracyScore;

                        let pronunciationWordElement = $(`<span class="pronunciation-word"><strong style="color:${getMarkColor(wordAccuracyScore)}">${word}</strong></span>`);
                        pronunciationWordElement.data('pronunciationInfo', wordPronunciationInfo);

                        var pronunciationWordScore = $(`<span class="pronunciation-word-score" style="color:${getMarkColor(wordAccuracyScore)}">${wordAccuracyScore}%</span>`);

                        pronunciationWordElement.append(pronunciationWordScore);
                        pronunciationWordContainer.append(pronunciationWordElement).append(' ');
                    }
                });

                if(words.length > 0) {
                    overallAccuracyScore = Math.round(overallAccuracyScore/words.length);
                }
                else {
                    overallAccuracyScore = pronunciationJSONData['AccuracyScore'];
                }

                pronunciationAssessmentWrapper.append(pronunciationWordContainer);
                updateProgressbar(currentUnitContainer.find('.overall-pronunciation-score').find('.progress-bar'), getMarkColor(overallPronunciationScore), overallPronunciationScore);
                updateProgressbar(currentUnitContainer.find('.overall-fluency-score').find('.progress-bar'), getMarkColor(overallFluencyScore), overallFluencyScore);
                updateProgressbar(currentUnitContainer.find('.overall-completeness-score').find('.progress-bar'), getMarkColor(overallCompletenessScore), overallCompletenessScore);
                updateProgressbar(currentUnitContainer.find('.overall-accuracy-score').find('.progress-bar'), getMarkColor(overallAccuracyScore), overallAccuracyScore);
            },
            () => { //complete
                const audioURL = URL.createObjectURL(audioData);
                audioElement.attr('src', audioURL);
                recordButton.find('i').replaceWith('<i class="fa-solid fa-microphone"></i>');
                recordedAudioButton.css('display', 'flex');
                $('.previous-unit-button').css('display', 'flex');
                $('.next-unit-button').css('display', 'flex');
                recordButton.removeClass('recording processing');
                recordButton.prop("disabled", false);

                if(pronunciationAssessmentWrapper.find('div').length > 0) {
                    pronunciationAssessmentWrapper.css('display', 'flex');
                    pronunciationUnitElement.hide();
                    pronunciationUnitTip.text(' Click on each word to see detailed feedback');
                    pronunciationOverallResultContainer.css('display', 'flex');                               
                }
                else {
                    pronunciationUnitNotice.show();
                }
            });
        });
    });

    $(document).on('click', '.pronunciation-word', function() {

        let pronunciationInfo = $(this).data('pronunciationInfo');

        let pronunciationDetailPopup = $('.pronunciation-detail-popup');
        let pronunciationDetailContent = $('.pronunciation-detail-popup').find('.pronunciation-detail');
        pronunciationDetailContent.html('');
        if(pronunciationInfo['Syllables']) {
            var syllableWrapper = $('<div class="pronunciation-syllable-wrapper"></div>');
            pronunciationInfo['Syllables'].forEach(syllable => {
                syllableWrapper.append(`<strong class="pronunciation-syllable" style="color:${getMarkColor(syllable['AccuracyScore'])}">/${syllable['Syllable']}/</strong>`).append(' ');
            });
            syllableWrapper.append('<div class="word-audio-buttons"><i class="play-word-fast-audio-button fa-solid fa-volume-high"></i><i class="play-word-slow-audio-button fa-solid fa-volume-low"></i></div>');
            syllableWrapper.data('word', pronunciationInfo['Word']);

            var pronunciationDetailTable = $('<table class="pronunciation-detail-table"><tr><th>Sound</th><th>You Said</th><th>Accuracy</th></tr></table>');
            pronunciationInfo['Phonemes'].forEach(phoneme => {

                let nBestPhoneme = phoneme['NBestPhonemes'].reduce((prev, current) => {
                    if((prev['Score'] === current['Score'])) {
                        if(prev['Phoneme'] === phoneme['Phoneme']) {
                            return prev;
                        }
                        else {
                            return current;
                        }
                    }
                    else {
                        return (prev['Score'] > current['Score']) ? prev : current;
                    }
                });

                //If phoneme['AccuracyScore'] >= 80, we always display phoneme['Phoneme'] (prevent a weird behavior of Assessment when the AccuracyScore = 100 for the sound like /d/, the sound like /b/ still has a higher confident score than the correct phoneme itself)
                pronunciationDetailTable.append(`<tr><td>/${phoneme['Phoneme']}/</td><td style="color:${getMarkColor(phoneme['AccuracyScore'])}">/${phoneme['AccuracyScore'] < 80 ? nBestPhoneme['Phoneme'] : phoneme['Phoneme']}/</td><td style="color:${getMarkColor(phoneme['AccuracyScore'])}">${phoneme['AccuracyScore']}%</td></tr>`);
            });

            pronunciationDetailContent.append(syllableWrapper, pronunciationDetailTable);
        }
        else {
            pronunciationDetailContent.append(`<span style="color:maroon">Your pronunciation for this word is not clear.</span>`);
        }

        pronunciationDetailPopup.show();   
    });

    $(document).on('mousedown', function (e) {
        if (!$(e.target).closest('.pronunciation-detail-popup').length) {
            $('.pronunciation-detail-popup').hide();
        }
    });

    $('.pronunciation-detail-popup-close-button').on('click', function() {
        $('.pronunciation-detail-popup').hide();
    });

    $(document).on('click', '.play-word-fast-audio-button', function() {
        window.TTSAudio.playTTSAudio($(this).closest('.pronunciation-syllable-wrapper').data('word'));
    });

    $(document).on('click', '.play-word-slow-audio-button', function() {
        window.TTSAudio.playTTSAudio($(this).closest('.pronunciation-syllable-wrapper').data('word'), true);
    });

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

    function updateProgressbar(progressbar, color, percentage) {
        progressbar.text(percentage + '%').css('background', function() {
            return `radial-gradient(closest-side, white 79%, transparent 80% 100%), conic-gradient(${color} ${percentage}%, lightgray 0)`;
        });
    }

    //--- CHECK  PRONUNCIATION ---//
    function checkPronunciation(audioData, transcript, referenceText, beforeSend, success, complete) {

        if(referenceText.length > 5) { //don't check short text since sometimes SpeechRecognition cannot finalize short text
            //if the two texts are not quite similar, just return
            if(transcript.length - referenceText.length > 10 || checkSimilarity(cleanText(referenceText), cleanText(transcript)) < 0.4) {
                beforeSend();
                success(null);
                complete();
                return;
            }
        }

        let formData = new FormData();
    
        formData.append('action', 'assess_pronunciation');
        formData.append('pronunciation_test_nonce', $('#pronunciation_test_nonce').val());
        formData.append('audio_data', audioData);
        formData.append('reference_text', referenceText);
    
        var limitMessage = checkOrSaveRateLimit('assess_pronunciation');
        if (limitMessage) {
            alert(limitMessage);
            $('.payment-popup-container').css('display', 'flex');
            return;
        }

        $.ajax({
            type: 'POST',
            url: single_pronunciation_test_ajax.ajaxurl,
            data: formData,
            processData: false,
            contentType: false,
            beforeSend: function () {
                beforeSend();
            },
            success: function (response) {
                if(!response.success) {
                    if(response.data['error'] == 'rate_limit_exceeded') {
                        alert(checkOrSaveRateLimit('assess_pronunciation', response.data['retry_after']));
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
                    try {
                        var pronunciationData = JSON.parse(response.data.result);
                        if(pronunciationData['RecognitionStatus'] == 'Success') {
                            success(pronunciationData['NBest'][0]);
                        }
                        else {
                            success(null);
                        }
                    }
                    catch {
                        console.log(response.data);
                        alert('Something went wrong! Please check your internet connection and try again!');
                    }
                }
            },
            error: function (error) {
                console.log(error);
                alert('Something went wrong! Please try again!');
            },
            complete: function () {
                complete();
            },
        });
    }

    //--- CHECK TEXT SIMILARITY ---//
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

    $('.post-locker').on('click', function(e) {
        e.preventDefault();
        $('.payment-popup-container').css('display', 'flex');
    });
});