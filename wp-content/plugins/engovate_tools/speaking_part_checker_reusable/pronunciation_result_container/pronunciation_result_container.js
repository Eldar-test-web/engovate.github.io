window.speakingPartCheckerReusable = window.speakingPartCheckerReusable || {};

jQuery(document).ready(function ($) {

    var userAudios = {};

    window.speakingPartCheckerReusable.displaySpeechAccuracyResult = function(containerName, speechAccuracyResult, userAudio) {
        userAudios[containerName] = userAudio;

        let words = speechAccuracyResult['words'];

        let overallAccuracyScore = speechAccuracyResult['overall_accuracy_score'];

        let refinedTranscriptContainer = $(`${containerName} .refined-pronunciation-transcript`);
        refinedTranscriptContainer.html(speechAccuracyResult['refined_transcript']);

        let pronunciationWordContainer = $(`${containerName} .pronunciation-transcript`);
        pronunciationWordContainer.html('');

        words.forEach(word => {

            let displayWord = word['punctuated_word'];
            let wordAccuracyScore = Math.round(word['accuracy_score']);

            let pronunciationWordElement = $(`<span class="pronunciation-word"><strong style="color:${window.speakingPartCheckerReusable.getMarkColor(wordAccuracyScore)}">${displayWord}</strong></span>`);
            pronunciationWordElement.data('accuracyInfo', word);

            var pronunciationWordScore = $(`<span class="pronunciation-word-score" style="color:${window.speakingPartCheckerReusable.getMarkColor(wordAccuracyScore)}">${wordAccuracyScore}%</span>`);
            pronunciationWordElement.append(pronunciationWordScore);

            pronunciationWordContainer.append(pronunciationWordElement).append(' ');
        });

        window.speakingPartCheckerReusable.updateProgressbar($(`${containerName} .overall-accuracy-score`).find('.progress-bar'), window.speakingPartCheckerReusable.getMarkColor(overallAccuracyScore), overallAccuracyScore);
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

    $('.metric-explanation-close-button').on('click', function(e) {
        e.stopPropagation();
        $(this).closest('.metric-explanation').hide();
    });

    $('body').append('<div class="pronunciation-detail-popup"><div class="pronunciation-detail"></div><button type="button" class="pronunciation-detail-popup-close-button" aria-label="close popup">x</button></div>');

    $(document).on('click', '.pronunciation-word', function() {
        let containerName = "#" + $(this).closest('.pronunciation-result-container')[0].id;

        let pronunciationDetailPopup = $('.pronunciation-detail-popup');
        let pronunciationDetailContent = $('.pronunciation-detail-popup').find('.pronunciation-detail');
        pronunciationDetailContent.html('');

        pronunciationDetailPopup.attr('lastClickedContainer', containerName);

        let accuracyInfo = $(this).data('accuracyInfo');

        if(accuracyInfo) {
            let accuracyScore = Math.round(accuracyInfo['accuracy_score']);

            let wordAccuracyScoreElement = $(`<div class="word-accuracy-score" style="color:${window.speakingPartCheckerReusable.getMarkColor(accuracyScore)}">Accuracy: ${accuracyScore}%</div>`);
            let feedbackElement = $(`<div class="word-accuracy-feedback">${window.speakingPartCheckerReusable.getMarkFeedback(accuracyScore)}</div>`);

            //TODO: Replace this with actual phonetic IPA
            let syllableWrapper = $('<div class="pronunciation-syllable-wrapper"></div>');
            syllableWrapper.append(`<strong class="pronunciation-syllable" style="color:${window.speakingPartCheckerReusable.getMarkColor(accuracyScore)}">${accuracyInfo['punctuated_word']}</strong>`);
            syllableWrapper.append('<div class="word-audio-buttons"><i class="play-word-fast-audio-button fa-solid fa-volume-high"></i><i class="play-word-slow-audio-button fa-solid fa-volume-low"></i><i class="play-user-word-audio-button fa-solid fa-head-side-cough"></i></div>');
            syllableWrapper.data('word', accuracyInfo['word']);
            syllableWrapper.data('start', accuracyInfo['start']);
            syllableWrapper.data('end', accuracyInfo['end']);

            pronunciationDetailContent.append(wordAccuracyScoreElement, feedbackElement, syllableWrapper);
        }
        else {
            let errorInfo = $(this).data('errorInfo');
            if(errorInfo) {
                pronunciationDetailContent.append('<strong>' + errorInfo + '</strong>');
            }
            else {
                let pronunciationInfo = $(this).data('pronunciationInfo');

                if(pronunciationInfo['Syllables']) {
                    var syllableWrapper = $('<div class="pronunciation-syllable-wrapper"></div>');
                    pronunciationInfo['Syllables'].forEach(syllable => {
                        syllableWrapper.append(`<strong class="pronunciation-syllable" style="color:${window.speakingPartCheckerReusable.getMarkColor(syllable['PronunciationAssessment']['AccuracyScore'])}">/${syllable['Syllable']}/</strong>`).append(' ');
                    });
                    syllableWrapper.append('<div class="word-audio-buttons"><i class="play-word-fast-audio-button fa-solid fa-volume-high"></i><i class="play-word-slow-audio-button fa-solid fa-volume-low"></i></div>');
                    syllableWrapper.data('word', pronunciationInfo['Word']);
        
                    var pronunciationDetailTable = $('<table class="pronunciation-detail-table"><tr><th>Sound</th><th>You Said</th><th>Accuracy</th></tr></table>');
                    pronunciationInfo['Phonemes'].forEach(phoneme => {
        
                        let nBestPhonemes = phoneme['PronunciationAssessment']['NBestPhonemes'].reduce((acc, current) => {
                            if (!acc.largest || current['Score'] > acc.largest['Score']) {
                                // If the current is larger than the largest, update the second largest to be the old largest
                                acc.secondLargest = acc.largest;
                                acc.largest = current;
                            } else if (!acc.secondLargest || current['Score'] > acc.secondLargest['Score']) {
                                // If the current is not larger than the largest, but is larger than the second largest, update the second largest
                                acc.secondLargest = current;
                            }
                            return acc;
                        }, { largest: null, secondLargest: null });
        
                        //If phoneme['AccuracyScore'] >= 80, we always display phoneme['Phoneme'] (prevent a weird behavior of Assessment when the AccuracyScore = 100 for the sound like /d/, the sound like /b/ still has a higher confident score than the correct phoneme itself)
                        //Otherwise, display the second best that is not the phoneme['Phoneme']
                        let accuracyScore = phoneme['PronunciationAssessment']['AccuracyScore'];
                        let userPhoneme = accuracyScore < 80 ? ((nBestPhonemes.largest['Phoneme'] == phoneme['Phoneme']) ? nBestPhonemes.secondLargest['Phoneme'] : nBestPhonemes.largest['Phoneme']) : phoneme['Phoneme'];
                        pronunciationDetailTable.append(`<tr><td>/${phoneme['Phoneme']}/</td><td style="color:${window.speakingPartCheckerReusable.getMarkColor(accuracyScore)}">/${userPhoneme}/</td><td style="color:${window.speakingPartCheckerReusable.getMarkColor(accuracyScore)}">${accuracyScore}%</td></tr>`);
                    });
        
                    pronunciationDetailContent.append(syllableWrapper, pronunciationDetailTable);
                }
                else {
                    pronunciationDetailContent.append(`<span style="color:maroon">Your pronunciation for this word is not clear.</span>`);
                }
            }
        }

        pronunciationDetailPopup.show();

        //position the popup in the middle of containerName
        var $container = $(containerName);
        var containerOffset = $container.offset();
        var containerWidth = $container.outerWidth();
        var wordElementOffset = $(this).offset();
        var popupHeight = pronunciationDetailPopup.outerHeight();
        pronunciationDetailPopup.css({
            'top': wordElementOffset.top - (popupHeight),
            'left': containerOffset.left + (containerWidth / 2)
        });
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

    $(document).on('click', '.play-user-word-audio-button', function() {
        var containerName = $('.pronunciation-detail-popup').attr('lastClickedContainer');
        let userAudio = userAudios[containerName];

        if(userAudio) {
            let startTime = $(this).closest('.pronunciation-syllable-wrapper').data('start');
            let endTime = $(this).closest('.pronunciation-syllable-wrapper').data('end');
            let playDuration = Math.max((endTime - startTime + 0.1) * 1000, 800);
            
            userAudio.currentTime = startTime - 0.1;
            userAudio.play();

            setTimeout(function() {
                userAudio.pause();
            }, playDuration);
        }
    });
    
    window.speakingPartCheckerReusable.getMarkColor = function(mark) {
        let color = '#000000'; // black
        if(mark >= 80) {
            color = '#008000'; // green
        }
        else {
            if(mark >= 60) {
                color = "#B8860B"; // darkgoldenrod
            }
            else {
                color = "#800000"; // maroon
            }
        }

        return color;
    }

    window.speakingPartCheckerReusable.getMarkFeedback = function(mark) {
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

    window.speakingPartCheckerReusable.updateProgressbar = function(progressbar, color, percentage) {
        progressbar.text(percentage + '%').css('background', function() {
            return `radial-gradient(closest-side, white 79%, transparent 80% 100%), conic-gradient(${color} ${percentage}%, lightgray 0)`;
        });
    }

    //---- PLAY TTS AUDIO ---//
    $(".refined-pronunciation-transcript-male-speak, .refined-pronunciation-transcript-female-speak").on("click", function (e) {
        let audioButton = $(this);
        let isThisPlaying = audioButton.attr('playing');

        //no matter which button, just reset all
        $(".refined-pronunciation-transcript-male-speak, .refined-pronunciation-transcript-female-speak").find('i').replaceWith('<i class="fa-solid fa-volume-high"></i>');
        $(".refined-pronunciation-transcript-male-speak, .refined-pronunciation-transcript-female-speak").attr('playing', 'false');
        window.TTSAudio.stopTTSAudio();

        if (!isThisPlaying || isThisPlaying == 'false') {
            window.TTSAudio.playTTSAudio($(this).closest('.pronunciation-result-container').find('.refined-pronunciation-transcript').text(), false, audioButton.text().includes('Male'), () => {
                audioButton.find('i').replaceWith('<i class="fa-solid fa-volume-high"></i>');
                audioButton.attr('playing', 'false');
            });

            audioButton.find('i').replaceWith('<i class="fa-solid fa-pause"></i>');
            audioButton.attr('playing', 'true');
        }
    });
});