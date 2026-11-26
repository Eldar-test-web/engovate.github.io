jQuery(document).ready(function ($) {

    let currentPart = 1;
    let currentQuestion = 1;
    let learnerResults = [];

    //call this to set disabled/enabled button state for next question/next section button
    displayCurrentPart(1);

    $('.ielts-speaking-submit-button').on('click', async function (e) {
        e.preventDefault();

        // Locked test: the learner can record answers, but submitting opens the upgrade popup instead
        if ($(this).hasClass('locked')) {
            $('.payment-popup-container').css('display', 'flex');
            return;
        }

        var submitButton = $(this);
        var questionContainer = submitButton.closest('.ielts-speaking-question');
        var questionNumber = questionContainer.data('questionNumber');
        var questionType = questionContainer.data('questionType');
        var minRecordingTime = parseFloat(questionContainer.data('minRecordingTime'));
        var question = questionContainer.find('.question-text').text();
        var recorderId = '#' + questionContainer.find('[id^="ielts-speaking-answer-recorder-"]')[0].id;
        var bandScoreContainerId = '#' + questionContainer.find('[id^="band-score-container-"]')[0].id;
        var pronunciationResultContainerId = '#' + questionContainer.find('[id^="pronunciation-result-container-"]')[0].id;

        var userAudioData = window.speakingPartCheckerReusable.getAudioRecorderData(recorderId);
        if(!userAudioData) {
            alert('Please record your answer!');
            return;
        }

        if(window.speakingPartCheckerReusable.getAudioRecorderRecordingTime(recorderId) < minRecordingTime) {
            alert('Please record your answer for at least ' + minRecordingTime + ' seconds!');
            return;
        }

        try {
            // 16 kHz mono, as MP3 when the encoder loads and WAV otherwise
            userAudioData = await convertAudioFileForUpload(userAudioData);

            const formData = new FormData();
            var limitMessage = checkOrSaveRateLimit('process_ielts_speaking_test');
            if (limitMessage) {
                alert(limitMessage);
                $('.payment-popup-container').css('display', 'flex');
                return;
            }

            formData.append('action', 'process_ielts_speaking_test');
            formData.append('post_id', $('#post_id').val());
            formData.append('question_number', questionNumber);
            formData.append('question_type', questionType);
            formData.append('question', question);
            formData.append('audio_data', userAudioData);
            formData.append('ielts_speaking_test_nonce', $('#ielts_speaking_test_nonce').val());
            // Banks this answer in the same request. The whole-TEST record is unaffected - it still
            // goes out on its own once every part is scored.
            formData.append('save_learner_progress', 1);

            // Show loading state
            $(".spinner-overlay").css('display', 'flex');
            submitButton.prop('disabled', true).html('Submitting... <i class="fa-solid fa-spinner fa-spin"></i>');
            
            // Two calls, and one Worker request between them doing the whole chain: transcribe the
            // recording, refine what came back, then mark the refined text. The answers come back
            // sealed, so the band scores are still worked out on the server, which also banks them.
            //
            // workerAudio is what lets the Worker do the SPEECH step - it carries the recording
            // straight there, so PHP never reads it. The second call drops the upload, unless the
            // Worker could not transcribe, in which case it is kept so the server can do that step.
            let data;
            try {
                data = await window.aiWorkerSealedCall({
                    ajaxurl: single_ielts_speaking_test_ajax.ajaxurl,
                    formData: formData,
                    workerAudio: userAudioData
                });
            }
            catch (rejection) {
                // hardError is the server refusing outright - a spent allowance, a question that is
                // too long, an unverified account - which arrives as HTTP 200 with success:false.
                // Anything else is the request itself failing.
                var refused = rejection && rejection.hardError && rejection.hardError.data;
                if (refused && refused['error'] == 'rate_limit_exceeded') {
                    alert(checkOrSaveRateLimit('process_ielts_speaking_test', refused['retry_after']));
                    $('.payment-popup-container').css('display', 'flex');
                }
                else if (refused && refused['error'] == 'user_not_verified') {
                    $('.fast-verification-popup-container').css('display', 'flex');
                }
                else {
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

            learnerResults.push({
                'topic': question,
                'question_number': questionNumber,
                'type': questionType,
                'assessment_result': data
            });

            var bandScoreJSON = data['content_result'];
            var pronunciationJSON = data['pronunciation_result'];
            var textStatsResult = data['text_stats'];
            var wordRepetitions = data['word_repetitions'];

            window.speakingPartCheckerReusable.displayContentAssessmentResult(bandScoreContainerId, bandScoreJSON);
            window.speakingPartCheckerReusable.displayTextStatsResult(bandScoreContainerId, textStatsResult);
            window.speakingPartCheckerReusable.displayWordRepetitionResult(bandScoreContainerId, wordRepetitions);
            // The word buttons play the file that was marked. The recorder's own player is empty when
            // the answer was uploaded instead of recorded, and nothing would play.
            window.speakingPartCheckerReusable.displaySpeechAccuracyResult(pronunciationResultContainerId, pronunciationJSON, new Audio(URL.createObjectURL(userAudioData)));
            window.speakingPartCheckerReusable.setOnExportAnswerResultButtonClick(bandScoreContainerId, question, data);
            window.speakingPartCheckerReusable.setAudioRecorderScriptText(recorderId, pronunciationJSON['refined_transcript']);

            $(bandScoreContainerId).show();
            $(pronunciationResultContainerId).show();

            submitButton.hide();
            questionContainer.find('.ielts-speaking-improve-button-wrapper').css('display', 'flex');

            displayOverallTestBandScoreIfAllDone();

            // This answer was banked by the grader itself, in the same request.
        }
        catch(error) {
            console.error(error);
            alert("Error processing speech. There might be a problem with your browser. Please try again or switch to a different browser, preferably Google Chrome, for better compatibility.");
        }
        finally {
            // Clean up loading state
            $(".spinner-overlay").css('display', 'none');
            submitButton.prop('disabled', false).html('Submit Answer <i class="fa-solid fa-paper-plane"></i>');
        }
    });

    $('.ielts-speaking-enhance-natural-button').on('click', function (e) {
        e.preventDefault();

        var questionContainer = $(this).closest('.ielts-speaking-question');
        var questionNumber = questionContainer.data('questionNumber');
        var questionType = questionContainer.data('questionType');

        //find the learnerResult with the same question number
        var learnerResult = learnerResults.find(result => result.question_number == questionNumber);
        if(!learnerResult) {
            alert('Please check your speech first!');
            return;
        }

        //get question and answer
        var question = questionContainer.find('.question-text').text();
        var answer = learnerResult['assessment_result']['pronunciation_result']['refined_transcript'];

        if (answer && answer.trim().length == 0) {
            alert('Please check your speech first!');
            return;
        }

        //reset
        window.contentEditableDiv.setContentEditorPlainText('#unimproved-speech-' + questionNumber, '');
        window.contentEditableDiv.setContentEditorPlainText('#improved-speech-' + questionNumber, '');
        questionContainer.find('.compare-natural-container').hide();

        let formData = new FormData();
        formData.append('action', 'enhance_natural_ielts_speaking_test');
        formData.append('ielts_speaking_test_nonce', $('#ielts_speaking_test_nonce').val());
        formData.append('topic', question);
        formData.append('answer', answer);
        formData.append('question_type', questionType);

        window.textImproverReusable.loadDiff('#compare-natural-form-' + questionNumber,
            formData,
            () => { //beforeSend
                questionContainer.find('.ielts-speaking-improve-button').prop("disabled", true);
                questionContainer.find('.ielts-speaking-enhance-natural-button').prop("disabled", true);
                questionContainer.find('.ielts-speaking-submit-button').prop("disabled", true);
                questionContainer.find('.ielts-speaking-enhance-natural-button').text("Improving...");
                $(".spinner-overlay").css('display', 'flex');
            },
            () => { //onSuccess
                questionContainer.find('.compare-natural-container').show();
            },
            () => { //complete
                questionContainer.find('.ielts-speaking-improve-button').prop("disabled", false);
                questionContainer.find('.ielts-speaking-enhance-natural-button').prop("disabled", false);
                questionContainer.find('.ielts-speaking-submit-button').prop("disabled", false);
                questionContainer.find('.ielts-speaking-enhance-natural-button').text("Improve Naturalness");
                $(".spinner-overlay").css('display', 'none');
            });
    });

    $('.ielts-speaking-improve-button').on('click', function (e) {
        e.preventDefault();

        var questionContainer = $(this).closest('.ielts-speaking-question');
        var questionNumber = questionContainer.data('questionNumber');
        var questionType = questionContainer.data('questionType');

        //find the learnerResult with the same question number
        var learnerResult = learnerResults.find(result => result.question_number == questionNumber);
        if(!learnerResult) {
            alert('Please check your speech first!');
            return;
        }

        //get question and answer
        var question = questionContainer.find('.question-text').text();
        var answer = learnerResult['assessment_result']['pronunciation_result']['refined_transcript'];

        if (answer && answer.trim().length == 0) {
            alert('Please check your speech first!');
            return;
        }

        //reset
        window.contentEditableDiv.setContentEditorPlainText('#unenhanced-speech-' + questionNumber, '');
        window.contentEditableDiv.setContentEditorPlainText('#enhanced-speech-' + questionNumber, '');
        questionContainer.find('.compare-enhance-container').hide();

        let formData = new FormData();
        formData.append('action', 'improve_ielts_speaking_test');
        formData.append('ielts_speaking_test_nonce', $('#ielts_speaking_test_nonce').val());
        formData.append('topic', question);
        formData.append('answer', answer);
        formData.append('question_type', questionType);

        window.textImproverReusable.loadDiff('#compare-enhance-form-' + questionNumber,
            formData,
            () => { //beforeSend
                questionContainer.find('.ielts-speaking-improve-button').prop("disabled", true);
                questionContainer.find('.ielts-speaking-enhance-natural-button').prop("disabled", true);
                questionContainer.find('.ielts-speaking-submit-button').prop("disabled", true);
                questionContainer.find('.ielts-speaking-improve-button').text("Enhancing...");
                $(".spinner-overlay").css('display', 'flex');
            },
            () => { //onSuccess
                questionContainer.find('.compare-enhance-container').show();
            },
            () => { //complete
                questionContainer.find('.ielts-speaking-improve-button').prop("disabled", false);
                questionContainer.find('.ielts-speaking-enhance-natural-button').prop("disabled", false);
                questionContainer.find('.ielts-speaking-submit-button').prop("disabled", false);
                questionContainer.find('.ielts-speaking-improve-button').text("Enhance Speech");
                $(".spinner-overlay").css('display', 'none');
            });
    });

    //---- PLAY TTS AUDIO ---//
    // Only one thing speaks at a time, and stopping speech does not call its end callback, so every
    // speak button on the page is put back to its resting icon here.
    function stopAllSpeech() {
        $(".male-audio-button, .female-audio-button, .ielts-speaking-question-speak-button").attr('playing', 'false').find('i').replaceWith('<i class="fa-solid fa-volume-high"></i>');
        window.TTSAudio.stopTTSAudio();
    }

    // Reads the question aloud with the browser's own voice.
    $('.ielts-speaking-question-speak-button').on('click', function () {
        let speakButton = $(this);
        let wasPlaying = speakButton.attr('playing') == 'true';

        stopAllSpeech();
        if (wasPlaying) return;

        // A Part 2 cue card puts each prompt on its own line with no full stop, and a voice can read
        // straight across a bare line break, so each such line gets a full stop to pause on.
        let question = speakButton.closest('.ielts-speaking-question').find('.question-text')[0].innerText
            .replace(/([^.?!:;,\s])\s*\n\s*/g, '$1.\n');

        window.TTSAudio.playTTSAudio(question, false, true, () => {
            speakButton.find('i').replaceWith('<i class="fa-solid fa-volume-high"></i>');
            speakButton.attr('playing', 'false');
        });

        speakButton.find('i').replaceWith('<i class="fa-solid fa-pause"></i>');
        speakButton.attr('playing', 'true');
    });

    $(".male-audio-button, .female-audio-button").on("click", function (e) {
        let audioButton = $(this);
        let isThisPlaying = audioButton.attr('playing');

        stopAllSpeech();

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

    function displayOverallTestBandScoreIfAllDone() {
        //display overall band score when all questions are checked
        var totalQuestionCount = 0;
        var gradedQuestionCount = 0;

        var totalTestBandScore = 0;
        var totalWeight = 0;

        $('.ielts-speaking-question').each(function(index) {
            var questionType = $(this).data('questionType');
            var questionNumber = $(this).data('questionNumber');
            totalQuestionCount++;

            // Read the score from the result data
            var learnerResult = learnerResults.find(function(r) { return r.question_number == questionNumber; });
            var contentResult = learnerResult && learnerResult.assessment_result && learnerResult.assessment_result['content_result'];
            // "Done" = this question was graded (has a content_result). A genuine 0 (e.g. gibberish) still counts.
            // Carry on past an ungraded one rather than stopping: the palette marks and the "remaining"
            // count below both need to see EVERY question, not just the ones before the first gap.
            if (!contentResult) {
                return;
            }
            gradedQuestionCount++;
            // Mark it in the palette, so a learner who is one answer short can see WHICH one.
            $('.ielts-speaking-question-palette .ielts-speaking-palette-item[data-question-number="' + questionNumber + '"] a').addClass('completed');

            var speakingBandScore = parseFloat(contentResult['overall_band_score']) || 0;

            var weight = 1;
            switch(questionType) {
                case 'part_one': {
                    weight = 1;
                    break;
                }
                case 'part_two': {
                    weight = 2;
                    break;
                }
                case 'part_three': {
                    weight = 2;
                    break;
                }
            }

            totalTestBandScore += speakingBandScore * weight;
            totalWeight += weight;
        });

        // Nothing at all used to be rendered until every question was graded, so one missed answer - or
        // one whose submission failed, which leaves a question looking exactly like an unanswered one -
        // read as a broken page. Say what is still outstanding instead.
        if(gradedQuestionCount < totalQuestionCount || totalWeight <= 0) {
            $('.ielts-speaking-band-score')
                .addClass('pending')
                .css('color', '')
                .text('Overall Band Score: available once all ' + totalQuestionCount + ' answers are graded (' + (totalQuestionCount - gradedQuestionCount) + ' remaining)');
            return;
        }

        stopTimer();

        var roundedTestSpeakingScore =  Math.round((totalTestBandScore / totalWeight) * 2) / 2.0;
        $('.ielts-speaking-band-score').removeClass('pending').text('Band Score: ' + roundedTestSpeakingScore);

        if(roundedTestSpeakingScore >= 8)
        {
            $('.ielts-speaking-band-score').css('color','darkgreen');
        }
        else
        {
            if(roundedTestSpeakingScore >= 7)
            {
                $('.ielts-speaking-band-score').css('color','orangered');
            }
            else {
                if(roundedTestSpeakingScore >= 6)
                {
                    $('.ielts-speaking-band-score').css('color','darkorange');
                }
                else
                {
                    if(roundedTestSpeakingScore >= 5)
                    {
                        $('.ielts-speaking-band-score').css('color','mediumblue');
                    }
                    else
                    {
                        $('.ielts-speaking-band-score').css('color','darkred');
                    }              
                }
            }
        }

        saveAllLearnerProgress();
    }

    function saveAllLearnerProgress() {
        if ($('#is_premium').val() !== '1') {
            return;
        }

        const formData = new FormData();
        formData.append('action', 'save_learner_ielts_speaking_test_progress');
        formData.append('post_id', $('#post_id').val());
        formData.append('category_type', $('#category_type').val());
        formData.append('total_time_taken', getCurrentTimerInSeconds());
        formData.append('save_learner_progress', 1); //always save learner progress if this is called. This variable is only meaningful on the reading/speaking tests so that we can decide when to load the learner progress
        formData.append('learner_results', JSON.stringify(learnerResults));
        formData.append('ielts_speaking_test_nonce', $('#ielts_speaking_test_nonce').val());
        // Assembled custom test: carry its composition so the server can record a whole-test result for it,
        // plus the label the page was opened with (a forecast card passes ?cl=) so it is named, not dated.
        formData.append('is_custom_test', $('input[name="is_custom_test"]').val() || 0);
        formData.append('custom_label', $('input[name="custom_label"]').val() || '');
        for (var ci = 1; ci <= 3; ci++) {
            formData.append('p' + ci + '_test', $('input[name="p' + ci + '_test"]').val() || 0);
            formData.append('p' + ci + '_part', $('input[name="p' + ci + '_part"]').val() || 0);
        }
     
        $.ajax({
            type: 'POST',
            url: single_ielts_speaking_test_ajax.ajaxurl,
            data: formData,
            processData: false,
            contentType: false,
            success: function (response) {
                if(!response.success) {
                    if (response.data && response.data['error'] == 'text_too_long') alert(response.data['message']);
                    console.log(response);
                }
                else {
                    console.log('learner progress saved');
                }
            },
            error: function (error) {
                console.log(error);
            },
        });
    }

    $('#ielts-speaking-dropdown-button').on('click', function (e) {
        e.preventDefault();
        $('.ielts-speaking-dropdown-content').toggle();
    });

    $(document).on('mousedown', function (e) {
        if (!$(e.target).closest('#ielts-speaking-dropdown-button, .ielts-speaking-dropdown-content').length) {
            $('.ielts-speaking-dropdown-content').hide();
        }
    });

    $('#ielts-speaking-next-section-button').on('click', function (e) {
        e.preventDefault();
        const nextPart = currentPart + 1;
        $('#ielts-speaking-palette-section-'+ nextPart).click();
    });

    $('#ielts-speaking-previous-section-button').on('click', function (e) {
        e.preventDefault();
        const previousPart = currentPart - 1;
        $('#ielts-speaking-palette-section-'+ previousPart).click();
    });

    $('.next-question-button').on('click', function (e) {
        e.preventDefault();
        displayCurrentPart(currentQuestion + 1);
    });

    $('.previous-question-button').on('click', function (e) {
        e.preventDefault();
        displayCurrentPart(currentQuestion - 1);
    });

    function displayCurrentPart(questionNumber) {
        if ($('#ielts-speaking-question-' + questionNumber).length == 0) {
            console.log('not exist:' + questionNumber);
            return;
        }

        // A question still being read aloud would otherwise carry on over the next one.
        stopAllSpeech();

        currentQuestion = parseInt(questionNumber);
        currentPart =parseInt($(`.ielts-speaking-palette-item[data-question-number="${currentQuestion}"]`).closest('.ielts-speaking-palette-section').data('part-number'));

        $('.ielts-speaking-sample').removeClass('current');
        $('#ielts-speaking-sample-' + currentQuestion).addClass('current');

        $('.ielts-speaking-question').removeClass('current');
        $('#ielts-speaking-question-' + currentQuestion).addClass('current');
        // Animate the current question
        $('#ielts-speaking-question-' + currentQuestion).hide();
        $('#ielts-speaking-question-' + currentQuestion).fadeIn('fast');

        $('.ielts-speaking-part-announcement').removeClass('current');
        $('#ielts-speaking-part-announcement-' + currentPart).addClass('current');

        $('.ielts-speaking-palette-section').removeClass('current');
        $('#ielts-speaking-palette-section-'+ currentPart).addClass('current');

        //on off next/previous section button
        if($('#ielts-speaking-palette-section-'+ (currentPart - 1)).length == 0) {
            $('#ielts-speaking-previous-section-button').prop('disabled', true);
        }
        else {
            $('#ielts-speaking-previous-section-button').prop('disabled', false);
        }

        if($('#ielts-speaking-palette-section-'+ (currentPart + 1)).length == 0) {
            $('#ielts-speaking-next-section-button').prop('disabled', true);
        }
        else {
            $('#ielts-speaking-next-section-button').prop('disabled', false);
        }

        //on off next/previous question button
        if($('#ielts-speaking-question-'+ (currentQuestion - 1)).length == 0) {
            $('.previous-question-button').prop('disabled', true);
        }
        else {
            $('.previous-question-button').prop('disabled', false);
        }

        if($('#ielts-speaking-question-'+ (currentQuestion + 1)).length == 0) {
            $('.next-question-button').prop('disabled', true);
        }
        else {
            $('.next-question-button').prop('disabled', false);
        }
    }

    let isResizing = false;
    let resizeHandleStartX;
    let originalArticleWidth;

    $('.ielts-speaking-resize-handle').on('mousedown', function (e) {
        e.preventDefault();
        isResizing = true;
        resizeHandleStartX = e.clientX;
        originalArticleWidth = $('.ielts-speaking-test-samples').outerWidth();
    });

    $(window).on('mousemove', (e) => {
        if (!isResizing) return;
        const delta = e.clientX - resizeHandleStartX;
        const newWidth = originalArticleWidth + delta;
        const maxWidth = 0.99 * $(window).width(); // Calculate 99% of the viewport width
        const limitedNewWidth = Math.min(newWidth, maxWidth); // Limit the new width to the maximum allowed width
        $('.ielts-speaking-page-content').css('grid-template-columns', `${limitedNewWidth}px 10px auto`);
    });

    $(window).on('mouseup', () => {
        isResizing = false;
    });

    $('.ielts-speaking-palette-section').on('click', function (e) {
        const questionNumber = $(this).find('.ielts-speaking-palette-item a:first').text().trim();
        displayCurrentPart(questionNumber);
    });

    $('.ielts-speaking-palette-item a').on('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        // Get question number from the anchor tag's text
        const questionNumber = $(this).text().trim();
        displayCurrentPart(questionNumber);
    });

    //---- AUDIO INPUT----//
    $('[id^="ielts-speaking-answer-recorder-"]').each(function(index) {
        var recorderId = '#' + this.id;
        var questionContainer = $(this).closest('.ielts-speaking-question');
        var maxRecordingTime = parseFloat(questionContainer.data('maxRecordingTime'));

        window.speakingPartCheckerReusable.setUpAudioRecorder(recorderId, maxRecordingTime,
        () => { //onStart
            // The microphone would pick up the question being read aloud, so it stops and stays off while recording.
            stopAllSpeech();
            questionContainer.find('.ielts-speaking-question-speak-button').prop('disabled', true);
            questionContainer.find('.ielts-speaking-submit-button').prop('disabled', true);
            questionContainer.find('.ielts-speaking-enhance-natural-button').prop('disabled', true);
            questionContainer.find('.ielts-speaking-improve-button').prop('disabled', true);
            $('.ielts-speaking-question-control-buttons').addClass('disabled');
            $('.ielts-speaking-bottom-panel').addClass('disabled');
        },
        () => { //onFinalized
            questionContainer.find('.ielts-speaking-question-speak-button').prop('disabled', false);
            questionContainer.find('.ielts-speaking-submit-button').prop('disabled', false);
            questionContainer.find('.ielts-speaking-enhance-natural-button').prop('disabled', false);
            questionContainer.find('.ielts-speaking-improve-button').prop('disabled', false);
            $('.ielts-speaking-question-control-buttons').removeClass('disabled');
            $('.ielts-speaking-bottom-panel').removeClass('disabled');
        });
    });

    //---- TIMER ----//
    let seconds = 0;
    let minutes = 0;
    let hours = 0;
    let timerInterval;
    let ieltsspeakingTimer = $(".ielts-speaking-timer strong");

    function displayTime() {
        let secondsText = seconds < 10 ? '0' + seconds : seconds;
        let minutesText = minutes < 10 ? '0' + minutes : minutes;
        let hoursText = hours < 10 ? '0' + hours : hours;

        ieltsspeakingTimer.text(`${hoursText}:${minutesText}:${secondsText}`);
    }

    function startTimer() {
        timerInterval = setInterval(() => {
            seconds++;

            if (seconds >= 60) {
                seconds = 0;
                minutes++;
            }

            if (minutes >= 60) {
                minutes = 0;
                hours++;
            }

            displayTime();
        }, 1000);
    }

    function stopTimer() {
        clearInterval(timerInterval);
    }

    function resetTimer() {
        stopTimer();
        seconds = 0;
        minutes = 0;
        hours = 0;
        displayTime();
    }

    function getCurrentTimerInSeconds()
    {
        return hours * 3600 + minutes * 60 + seconds;
    }

    //start timer right way
    startTimer();

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

    //--- FOCUS MODE ---//
    let focusState = 'normal'; // 'normal', 'focus', or 'fullscreen'

    // Handle focus mode toggle
    $('#ielts-speaking-focus-mode-button').on('click', function() {
        if (focusState === 'normal') {
            enterFocusMode();
        } else if (focusState === 'focus') {
            enterFullscreenMode();
        } else {
            exitFocusMode();
        }
    });

    function enterFocusMode() {
        focusState = 'focus';
        // Add CSS to hide scrollbars
        document.documentElement.style.overflow = 'hidden';
        document.body.style.overflow = 'hidden';
        $(".ielts-speaking-test-container").addClass('ielts-speaking-focus-mode');
        $("#ielts-speaking-focus-mode-button").html('<i class="fa-solid fa-maximize"></i> Fullscreen');
    }

    function enterFullscreenMode() {
        focusState = 'fullscreen';        
        // Add CSS to hide scrollbars
        document.documentElement.style.overflow = 'hidden';
        document.body.style.overflow = 'hidden';
        if (document.documentElement.requestFullscreen) {
            document.documentElement.requestFullscreen();
        } else if (document.documentElement.webkitRequestFullscreen) {
            document.documentElement.webkitRequestFullscreen();
        } else if (document.documentElement.mozRequestFullScreen) {
            document.documentElement.mozRequestFullScreen();
        } else if (document.documentElement.msRequestFullscreen) {
            document.documentElement.msRequestFullscreen();
        }
        $(".ielts-speaking-test-container").addClass('ielts-speaking-focus-mode');
        $("#ielts-speaking-focus-mode-button").html('<i class="fa-solid fa-compress"></i> Exit');
    }

    function exitFocusMode() {
        focusState = 'normal';
        // Restore scrollbars
        document.documentElement.style.overflow = '';
        document.body.style.overflow = '';
        
        if(document.fullscreenElement) {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            } else if (document.mozCancelFullScreen) {
                document.mozCancelFullScreen();
            } else if (document.msExitFullscreen) {
                document.msExitFullscreen();
            }
        }
        $(".ielts-speaking-test-container").removeClass('ielts-speaking-focus-mode');
        $("#ielts-speaking-focus-mode-button").html('<i class="fa-solid fa-expand"></i> Focus');
    }

    // Handle fullscreen and focus mode
    $(document).on('keydown', function(e) {
        // Check for F11 (Windows/Linux) or Mac fullscreen shortcuts (Ctrl+Cmd+F)
        if (e.key === 'F11' || (e.key === 'f' && e.ctrlKey && e.metaKey)) {
            e.preventDefault(); // Prevent default browser behavior
            
            $('#ielts-speaking-focus-mode-button').click();
        }
        // Handle Escape key for focus mode
        else if (e.key === 'Escape') {
            exitFocusMode();
        }
    });

    //--- EXPORT PDF ---//
    $('.ielts-speaking-export-pdf-link').on('click', function(e) {
        e.preventDefault();
        window.print();
    });

    window.onbeforeprint = function() {
        var anySubmitted = learnerResults.length > 0;

        var $printContainer = $('<div class="ielts-speaking-print-container"></div>');

        if (anySubmitted) {
            // Skip it while it still holds the "n remaining" notice - that belongs on screen, not in a PDF.
            var $bandScoreElement = $('.ielts-speaking-band-score').first();
            var bandScore = $bandScoreElement.hasClass('pending') ? '' : $bandScoreElement.text();
            var timeText = $('.ielts-speaking-timer').first().text().trim();
            var bandColor = $bandScoreElement.css('color');
            var $summary = $('<div class="ielts-print-result-summary"></div>');
            if (bandScore) {
                $summary.append('<span class="ielts-print-band-score" style="color:' + bandColor + '">' + bandScore + '</span>');
            }
            if (timeText) {
                $summary.append('<span class="ielts-print-time-taken">' + timeText + '</span>');
            }
            $printContainer.append($summary);
        }

        var currentType = null;
        $('.ielts-speaking-question').each(function() {
            var $q = $(this);
            var questionNumber = parseInt($q.data('questionNumber'));
            var questionType = $q.data('questionType');

            if (questionType !== currentType) {
                currentType = questionType;
                var partMap = { 'part_one': 'Part 1', 'part_two': 'Part 2', 'part_three': 'Part 3' };
                var partLabel = partMap[questionType] || questionType;
                $printContainer.append('<div class="ielts-speaking-print-part-label">' + partLabel + '</div>');
            }

            var $block = $('<div class="ielts-speaking-print-question-block"></div>');
            $block.append('<div class="ielts-speaking-print-question-number">Question ' + questionNumber + '</div>');
            $block.append($q.find('.question-text').clone());

            var result = learnerResults.find(function(r) { return r.question_number == questionNumber; });
            if (result) {
                var $pronunciation = $('#pronunciation-result-container-' + questionNumber).clone();
                $pronunciation.css('display', 'block');
                $block.append($pronunciation);
                var $bandScore = $('#band-score-container-' + questionNumber).clone();
                $bandScore.css('display', 'block');
                $block.append($bandScore);
            }

            $printContainer.append($block);
        });

        $('.ielts-speaking-test-container').addClass('ielts-speaking-print-hidden');
        $('body').children().not('.ielts-speaking-print-container, #page').addClass('ielts-speaking-print-hidden');
        $('.ielts-speaking-page-header').after($printContainer);
    };

    window.onafterprint = function() {
        $('.ielts-speaking-print-container').remove();
        $('.ielts-speaking-print-hidden').removeClass('ielts-speaking-print-hidden');
    };

    //--- ASK BEFORE LEAVING ---//
    window.addEventListener("beforeunload", (event) => {
        event.preventDefault();
        event.returnValue = ""; // This will trigger the default browser message
    });
});