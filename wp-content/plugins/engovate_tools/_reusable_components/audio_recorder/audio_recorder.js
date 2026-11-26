window.audioRecorderReusable = window.audioRecorderReusable || {};

jQuery(document).ready(function ($) {
    let microphone = null;
    let recorder = null;
    let isRecording = false;

    let recognition = null;
    let isRecognitionStopping = false;
    let recognitionBackoffMs = 0; // grows after transient recognition errors so we don't hammer the backend

    let silenceTimer = null;

    let recordingStartTime;
    let timeIntervalId;

    let fullTranscript = "";

    let isAutoStopRecording = false;

    let isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    let isEdge = navigator.userAgent.indexOf('Edge') !== -1 && (!!navigator.msSaveOrOpenBlob || !!navigator.msSaveBlob);

    window.audioRecorderReusable.doRecording = function(audioWrapperName, maxRecordingTimeInSeconds, useSpeechRecognition = false, onStart = null, onTimerFill = null, onInterimTranscriptUpdate = null, onFullTranscriptUpdate = null, onStop = null, onFinalized = null) {
        if (isRecognitionStopping) return;

        maxRecordingTimeInSeconds = parseInt(maxRecordingTimeInSeconds);

        var targetAudioPlayer = $(audioWrapperName).find('.recorded-audio-player');
        var doRecordButton = $(audioWrapperName).find('.do-audio-record-button');
        var stopRecordButton = $(audioWrapperName).find('.stop-audio-record-button');
        var recordButtonFill = $(audioWrapperName).find('.audio-record-button-fill');

        if (isRecording) {
            window.audioRecorderReusable.stopRecording(audioWrapperName, onStop, onFinalized);
        } else {
            // Runs synchronously inside the record-button tap — see
            // primeRecordingAudioContext() for why that timing matters on Safari.
            primeRecordingAudioContext();

            captureMicrophone(function (mic) {
                microphone = mic;

                var options = {
                    type: 'audio',
                    numberOfAudioChannels: isEdge ? 1 : 2,
                    checkForInactiveTracks: true,
                    bufferSize: 16384
                };
            
                if(isSafari || isEdge) {
                    options.recorderType = RecordRTC.StereoAudioRecorder;
                }
            
                if(isSafari) {
                    options.sampleRate = 44100;
                    options.bufferSize = 4096;
                    options.numberOfAudioChannels = 2;
                }
            
                if(recorder) {
                    recorder.destroy();
                    recorder = null;
                }

                recorder = RecordRTC(microphone, options);

                // recorder = RecordRTC(microphone, {
                //     type: 'audio',
                //     mimeType: 'audio/wav',
                //     desiredSampRate: 48000,
                //     numberOfAudioChannels: 1,
                //     recorderType: RecordRTC.StereoAudioRecorder
                // });
    
                recorder.startRecording();
                fullTranscript = "";

                doRecordButton.find('i').replaceWith('<i class="fa-solid fa-wave-square"></i>');
                doRecordButton.addClass('recording');
                doRecordButton.show();
                stopRecordButton.show();
                targetAudioPlayer.hide();

                isRecording = true;

                if(onStart) onStart();
    
                // Start the timer
                recordingStartTime = new Date();
                updateRecordingTime();
                timeIntervalId = setInterval(() => {
                    let timeElapsed =  updateRecordingTime();
                    let percentage = timeElapsed * 100.0 / maxRecordingTimeInSeconds;
                    if(onTimerFill && !isRecognitionStopping) {
                        recordButtonFill.css('width', `${percentage}%`);
                        onTimerFill(timeElapsed, percentage);
                    }
                    if(timeElapsed > maxRecordingTimeInSeconds && !isRecognitionStopping) {
                        window.audioRecorderReusable.stopRecording(audioWrapperName, onStop, onFinalized);
                    } 
                }, 1000);

                if(useSpeechRecognition) {
                    //Transcribe user speech to text. Also, detect if user is speaking or not
                    recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition || window.mozSpeechRecognition || window.msSpeechRecognition)();
                    recognition.lang = 'en-US';
                    recognition.interimResults = true;
                    recognition.maxAlternatives = 1;
                    recognition.continuous = true;
                    recognitionBackoffMs = 0;

                    // Restart recognition safely (handles Chrome's ~60s session cap and transient drops)
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

                        if(onInterimTranscriptUpdate && !isRecognitionStopping) onInterimTranscriptUpdate(currentText);

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
                                window.audioRecorderReusable.stopRecording(audioWrapperName, onStop, onFinalized);
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
                            window.audioRecorderReusable.stopRecording(audioWrapperName, onStop, onFinalized);
                            return;
                        }

                        // Speech recognition is permanently unavailable in this browser (NOT a transient blip):
                        // retrying forever would just record into a void, so surface a one-time notice and stop.
                        if (event.error === 'service-not-allowed' || event.error === 'language-not-supported') {
                            alert('Speech recognition is not available in this browser.\nPlease use Chrome, Safari, or CocCoc.');
                            window.audioRecorderReusable.stopRecording(audioWrapperName, onStop, onFinalized);
                            return;
                        }

                        // 'network': transient backend failure. Back off, then let onend restart recognition.
                        // The local RecordRTC capture keeps running, so audio is never lost.
                        if (event.error === 'network') {
                            recognitionBackoffMs = Math.min(recognitionBackoffMs ? recognitionBackoffMs * 2 : 500, 8000);
                            console.warn('Speech recognition "network" (non-fatal) — recording continues; retrying in ' + recognitionBackoffMs + 'ms');
                        }
                        // 'no-speech', 'aborted', etc.: harmless — onend restarts at the default delay.
                    };

                    recognition.start();
                }
            }, function() {
                window.audioRecorderReusable.stopRecording(audioWrapperName, onStop, onFinalized);
            });
        }
    }

    window.audioRecorderReusable.stopRecording = function(audioWrapperName, onStop = null, onFinalized = null) {
        if (recorder) {
            isRecognitionStopping = true; //immediately do this to prevent recognition.onerror call multiple times

            var doRecordButton = $(audioWrapperName).find('.do-audio-record-button');
            var stopRecordButton = $(audioWrapperName).find('.stop-audio-record-button');
            var recordButtonFill = $(audioWrapperName).find('.audio-record-button-fill');

            doRecordButton.find('i').replaceWith('<i class="fa-solid fa-paper-plane"></i>');
            doRecordButton.addClass('processing');
            recordButtonFill.css('width', '0%');
            doRecordButton.prop("disabled", true);
            stopRecordButton.hide();

            if(onStop) onStop();
            
            //wait for 1 second to make sure we capture everything user said
            setTimeout(() => {
                recorder.stopRecording(function() {
                    // let blob = this.getBlob();
    
                    clearTimeout(silenceTimer);
                    
                    clearInterval(timeIntervalId);
    
                    if (recognition) {
                        // Finalize exactly once, whether or not onend fires. recognition.stop() is a no-op
                        // that does NOT re-fire onend when recognition is already inactive (e.g. it was stopped
                        // mid-backoff while waiting to restart), so we must not depend on onend alone — otherwise
                        // isRecognitionStopping would stay true forever and brick the recorder for the page session.
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

                            finalizeAudio(audioWrapperName, onFinalized);
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

                        finalizeAudio(audioWrapperName, onFinalized);
                    }
    
                    if (microphone) {
                        microphone.getTracks().forEach(track => track.stop());
                        microphone = null;
                    }
    
                    isRecording = false;
                });
            }, 1000);
        }
    }

    function updateRecordingTime() {
        let currentTime = new Date();
        let timeElapsed = Math.floor((currentTime - recordingStartTime) / 1000);
        return timeElapsed;
    }

    function finalizeAudio(audioWrapperName, onFinalized = null) {
        var blob = recorder.getBlob();

        var targetAudio = $(audioWrapperName).find('audio');
        var targetAudioPlayer = $(audioWrapperName).find('.recorded-audio-player');
        var doRecordButton = $(audioWrapperName).find('.do-audio-record-button');

        //set the audio src
        if (targetAudio.attr('src')) {
            URL.revokeObjectURL(targetAudio.attr('src'));
        }
        const audioURL = URL.createObjectURL(blob);
        targetAudio.attr('src', audioURL);

        //finalize the audio
        var duration = updateRecordingTime();
        recorder.getDataURL(function(dataURL) {
            fetch(dataURL)
                .then(res => res.blob())
                .then(resBlob => {
                    if(onFinalized) onFinalized(resBlob, duration, fullTranscript);     
                })
                .catch(error => {
                    console.error('Error fetching blob:', error);
                    alert('Error finalizing recording. Please try again.');
                });
        });

        targetAudioPlayer.show();
        doRecordButton.find('i').replaceWith('<i class="fa-solid fa-microphone"></i>');
        doRecordButton.removeClass('recording processing');
        doRecordButton.prop("disabled", false);
        doRecordButton.hide();
    }

    // Safari: RecordRTC's StereoAudioRecorder captures through a SHARED AudioContext
    // held at RecordRTC.Storage.AudioContextConstructor, and only replaces it when
    // its state is 'closed' — never when it is 'suspended'. The library contains no
    // AudioContext.resume() call at all (the 11 resume() calls in it are recorder
    // pause/resume methods). Safari starts a context suspended unless it is created
    // while a user activation is in scope, and a suspended context never fires the
    // ScriptProcessor, so the capture comes out completely silent.
    //
    // Creating/resuming it here — synchronously inside the record-button tap, before
    // the async getUserMedia — leaves a running context for RecordRTC to reuse.
    function primeRecordingAudioContext() {
        if (typeof RecordRTC === 'undefined' || !RecordRTC.Storage) {
            return;
        }

        var AudioContextConstructor = RecordRTC.Storage.AudioContext || window.AudioContext || window.webkitAudioContext;
        if (!AudioContextConstructor) {
            return;
        }

        var context = RecordRTC.Storage.AudioContextConstructor;
        if (!context || context.state === 'closed') {
            context = new AudioContextConstructor();
            RecordRTC.Storage.AudioContextConstructor = context;
        }

        if (context.state === 'suspended' && context.resume) {
            context.resume().catch(function() {});
        }
    }

    function captureMicrophone(successCallback, failedCallback) {
        if (microphone) {
            successCallback(microphone);
            return;
        }

        if (typeof navigator.mediaDevices === 'undefined' || !navigator.mediaDevices.getUserMedia) {
            alert('This browser does not supports WebRTC getUserMedia API.');

            if (!!navigator.getUserMedia) {
                alert('This browser seems supporting deprecated getUserMedia API.');
            }
        }

        navigator.mediaDevices.getUserMedia({
            // Safari applies automatic gain control as part of its input processing
            // chain, and switching echoCancellation off disables that whole chain —
            // which is why recordings came back barely audible. Ask for the
            // processed input explicitly there; other browsers keep the previous
            // behaviour of raw, un-cancelled audio.
            audio: isEdge ? true : (isSafari ? {
                echoCancellation: true,
                autoGainControl: true,
                noiseSuppression: true
            } : {
                echoCancellation: false
            })
        }).then(function (mic) {
            successCallback(mic);
        }).catch(function (err) {
            console.log(err);
            // Handle media access blocked error
            if (err.name === 'NotAllowedError') {
                alert('Microphone access is blocked. Please manually allow access to your microphone in your browser settings.');
            }
            else {
                alert(err.toString());
            }

            failedCallback();
        });
    }

    window.audioRecorderReusable.getAudio = function(audioWrapperName) {
        return $(audioWrapperName).find('audio');
    }

    window.audioRecorderReusable.setOnDoRecordingEvent = function(audioWrapperName, maxRecordingTimeInSeconds, useSpeechRecognition = false, onStart = null, onTimerFill = null, onInterimTranscriptUpdate = null, onFullTranscriptUpdate = null, onStop = null, onFinalized = null) {
        $(`${audioWrapperName} .do-audio-record-button`).on('click', function() {
            window.audioRecorderReusable.doRecording(audioWrapperName, maxRecordingTimeInSeconds, useSpeechRecognition, onStart, onTimerFill, onInterimTranscriptUpdate, onFullTranscriptUpdate, onStop, onFinalized);
        });
    }

    window.audioRecorderReusable.setOnClickStopRecordingEvent = function(audioWrapperName, onStop = null) {
        $(`${audioWrapperName} .stop-audio-record-button`).on('click', function() {
            $(this).closest('.audio-record-container').find('.do-audio-record-button').click();

            if(onStop) onStop();
        });
    }

    window.audioRecorderReusable.setOnRecordedAudioPlayerCloseEvent = function(audioWrapperName, revokeAudioData = true, onClose = null) {
        $(`${audioWrapperName} .recorded-audio-player-close-button`).on('click', function () {

            if (!window.confirm('Do you want to delete this recording?')) {
                return;
            }

            window.audioRecorderReusable.resetAudioRecorder(audioWrapperName, revokeAudioData);

            if(onClose) onClose();
        });
    }

    window.audioRecorderReusable.resetAudioRecorder = function(audioWrapperName, revokeAudioData) {
        var audioRecordContainer = $(audioWrapperName);
        audioRecordContainer.find('audio')[0].pause();
        audioRecordContainer.find('audio')[0].currentTime = 0;
        audioRecordContainer.find('.recorded-audio-player').hide();
        audioRecordContainer.find('.do-audio-record-button').show();
        if (audioRecordContainer.find('audio').attr('src') && revokeAudioData) {
            URL.revokeObjectURL(audioRecordContainer.find('audio').attr('src'));
        }
        audioRecordContainer.find('audio').attr('src', null);
    }

    window.audioRecorderReusable.triggerRecordingButton = function(audioWrapperName) {
        $(`${audioWrapperName} .do-audio-record-button`).trigger('click');
    }
});