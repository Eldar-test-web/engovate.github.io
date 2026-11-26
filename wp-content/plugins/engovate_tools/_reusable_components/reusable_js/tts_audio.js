window.TTSAudio = window.TTSAudio || {};

(function(window, document) {
    var easySpeechInitPromise = null;
    var easySpeechReady = false;
    var voicesCache = [];

    function initEasySpeech() {
        if (easySpeechInitPromise) {
            return easySpeechInitPromise;
        }

        if (!window.EasySpeech) {
            easySpeechInitPromise = Promise.reject(new Error('EasySpeech library not loaded'));
            return easySpeechInitPromise;
        }

        try {
            var capabilities = window.EasySpeech.detect();
            if (!capabilities || !capabilities.speechSynthesis || !capabilities.speechSynthesisUtterance) {
                easySpeechInitPromise = Promise.reject(new Error('Speech synthesis not supported in this browser'));
                return easySpeechInitPromise;
            }
        } catch (e) {
            easySpeechInitPromise = Promise.reject(e);
            return easySpeechInitPromise;
        }

        easySpeechInitPromise = window.EasySpeech.init({
            maxTimeout: 5000,
            interval: 250
        }).then(function() {
            easySpeechReady = true;
            if (typeof window.EasySpeech.voices === 'function') {
                voicesCache = window.EasySpeech.voices() || [];
                console.log('EasySpeech initialized and voices loaded:', voicesCache.length);
            }
        }).catch(function(err) {
            console.error('EasySpeech init failed:', err);
            throw err;
        });

        return easySpeechInitPromise;
    }

    function refreshVoices() {
        if (typeof window.EasySpeech !== 'undefined' && typeof window.EasySpeech.voices === 'function') {
            voicesCache = window.EasySpeech.voices() || [];
        }
        return voicesCache;
    }

    function getVoiceByLangPrefix(langPrefix) {
        var voices = voicesCache && voicesCache.length ? voicesCache : refreshVoices();
        if (!voices || !voices.length) {
            return null;
        }
        for (var i = 0; i < voices.length; i++) {
            var v = voices[i];
            if (v && typeof v.lang === 'string' && v.lang.indexOf(langPrefix) === 0) {
                return v;
            }
        }
        return null;
    }

    function selectVoice(maleVoice) {
        var voices = voicesCache && voicesCache.length ? voicesCache : refreshVoices();
        if (!voices || !voices.length) {
            return null;
        }

        // 1) Try explicit Google voices (similar to previous implementation)
        var targetNamePrimary = maleVoice ? 'Google UK English Male' : 'Google US English';
        for (var i = 0; i < voices.length; i++) {
            if (voices[i] && voices[i].name === targetNamePrimary) {
                return voices[i];
            }
        }

        // 2) Fallback to some common named voices
        for (var j = 0; j < voices.length; j++) {
            var voice = voices[j];
            if (!voice) continue;

            if (maleVoice) {
                // Try UK English male-like voice (e.g. Daniel)
                if ((voice.lang === 'en-GB' || voice.lang === 'en_GB') && voice.name && voice.name.indexOf('Daniel') !== -1) {
                    return voice;
                }
            } else {
                // Try US English female-like voice (e.g. Samantha)
                if ((voice.lang === 'en-US' || voice.lang === 'en_US') && voice.name && voice.name.indexOf('Samantha') !== -1) {
                    return voice;
                }
            }
        }

        // 3) Try generic English voice
        var generic = getVoiceByLangPrefix('en');
        if (generic) {
            return generic;
        }

        // 4) As a last resort, use first voice
        return voices[0] || null;
    }

    /**
     * Fallback: use native speechSynthesis when EasySpeech is not available.
     * This roughly mirrors the older tts_audio_2.js behaviour, but simplified.
     */
    function playWithNativeAPI(termToPlay, slow, maleVoice, onEnd, onStart) {
        console.log('EasySpeech not available, using native speechSynthesis instead');

        if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) {
            console.warn('Native speechSynthesis API not available');
            if (typeof onEnd === 'function') {
                onEnd();
            }
            return;
        }

        try {
            var utterance = new window.SpeechSynthesisUtterance(termToPlay);

            var nativeVoices = window.speechSynthesis.getVoices() || [];
            var selectedVoice = null;
            if (nativeVoices && nativeVoices.length) {
                // Re-use the same selection logic wherever possible
                voicesCache = nativeVoices;
                selectedVoice = selectVoice(maleVoice);
            }

            if (selectedVoice) {
                utterance.voice = selectedVoice;
                utterance.lang = selectedVoice.lang;
                utterance.voiceURI = selectedVoice.voiceURI;
            }

            utterance.pitch = 1;
            utterance.volume = 1;

            if (!maleVoice) {
                utterance.rate = 0.9;
            }
            if (slow) {
                utterance.rate = 0.3;
            }

            utterance.onend = function() {
                if (typeof onEnd === 'function') {
                    onEnd();
                }
            };
            // Speech does not begin the instant speak() is called; callers that
            // animate alongside it should start from here, not before.
            utterance.onstart = function() {
                if (typeof onStart === 'function') {
                    onStart();
                }
            };
            utterance.onerror = function(e) {
                // Ignore "interrupted" or "canceled" errors, which are normal when we
                // cancel an utterance to start another one or explicitly stop TTS.
                if (e && (e.error === 'interrupted' || e.error === 'canceled')) {
                    return;
                }
                console.error('Native speechSynthesis error:', e);
                if (typeof onEnd === 'function') {
                    onEnd();
                }
            };

            window.speechSynthesis.cancel();
            window.speechSynthesis.speak(utterance);
        } catch (e) {
            console.error('Native speechSynthesis failed:', e);
            if (typeof onEnd === 'function') {
                onEnd();
            }
        }
    }

    window.TTSAudio.playTTSAudio = function(termToPlay, slow, maleVoice, onEnd, onStart) {
        if (slow === undefined) slow = false;
        if (maleVoice === undefined) maleVoice = true;

        window.TTSAudio.stopTTSAudio();

        if (!termToPlay) {
            if (typeof onEnd === 'function') {
                onEnd();
            }
            return;
        }

        initEasySpeech().then(function() {
            if (!easySpeechReady) {
                // If init did not set ready for some reason, fallback
                playWithNativeAPI(termToPlay, slow, maleVoice, onEnd, onStart);
                return;
            }

            var voice = selectVoice(maleVoice);
            var opts = {
                text: termToPlay,
                pitch: 1,
                rate: 1,
                volume: 1
            };

            if (voice) {
                opts.voice = voice;
                if (voice.lang) {
                    opts.lang = voice.lang;
                }
            }

            if (!maleVoice) {
                opts.rate = 0.9;
            }
            if (slow) {
                opts.rate = 0.3;
            }

            // Attach end / error handlers
            opts.end = function() {
                if (typeof onEnd === 'function') {
                    onEnd();
                }
            };
            opts.start = function() {
                if (typeof onStart === 'function') {
                    onStart();
                }
            };
            opts.error = function(e) {
                // Ignore "interrupted" errors, which happen when we intentionally
                // cancel a speaking utterance to start a new one.
                if (e && (e.error === 'interrupted' || e.type === 'error' && e.target && e.target.error === 'interrupted')) {
                    return;
                }
                console.error('EasySpeech speak error:', e);
                if (typeof onEnd === 'function') {
                    onEnd();
                }
            };

            try {
                var speakPromise = window.EasySpeech.speak(opts);

                // Some EasySpeech builds return a Promise that may reject with
                // a SpeechSynthesisErrorEvent (e.g. "interrupted"). We attach
                // a catch handler to avoid "Uncaught (in promise)" noise.
                if (speakPromise && typeof speakPromise.then === 'function' && typeof speakPromise.catch === 'function') {
                    speakPromise.catch(function(e) {
                        // Ignore "interrupted" rejections (normal when cancelling)
                        if (e && (e.error === 'interrupted' || e.type === 'error' && e.target && e.target.error === 'interrupted')) {
                            return;
                        }
                        console.error('EasySpeech speak promise rejected:', e);
                        if (typeof onEnd === 'function') {
                            onEnd();
                        }
                    });
                }
            } catch (e) {
                console.error('EasySpeech.speak threw an error, falling back to native API:', e);
                playWithNativeAPI(termToPlay, slow, maleVoice, onEnd, onStart);
            }
        }).catch(function(err) {
            console.error('EasySpeech not available, using native speechSynthesis instead:', err);
            playWithNativeAPI(termToPlay, slow, maleVoice, onEnd, onStart);
        });
    };

    window.TTSAudio.stopTTSAudio = function() {
        try {
            // Only call EasySpeech.cancel if EasySpeech has been successfully initialized.
            if (easySpeechReady && window.EasySpeech && typeof window.EasySpeech.cancel === 'function') {
                window.EasySpeech.cancel();
            } else if (window.speechSynthesis) {
                // Fallback to native cancel
                window.speechSynthesis.cancel();
            }
        } catch (e) {
            console.error('Error while stopping TTS:', e);
        }
    };

    // Make the functions non-configurable to mirror previous implementation style
    try {
        Object.defineProperties(window.TTSAudio, {
            playTTSAudio: {
                writable: false,
                configurable: false
            },
            stopTTSAudio: {
                writable: false,
                configurable: false
            }
        });
    } catch (e) {
        // Older browsers might not support defineProperties on window.TTSAudio; ignore.
    }

})(window, document);