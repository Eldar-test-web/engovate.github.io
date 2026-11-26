jQuery(document).ready(function($) {

    let currentPart = 1;
    let learnerResults = null;
    let testSubmitting = false; // true while a test submission AJAX is in flight

    $('#ielts-writing-test-form').on('submit', function(e) {
        e.preventDefault();

        // Locked test: the learner can take it, but submitting opens the upgrade popup instead
        if ($('#ielts-writing-test-submit-button').hasClass('locked')) {
            $('.payment-popup-container').css('display', 'flex');
            return;
        }

        var isNotMetRequirement = false;
        $('.ielts-writing-answer-section').each(function(index, answerSection) {
            var checkResult = window.contentEditableDiv.checkContentEditorCharacterRequirement("Part " + (index + 1) + " answer", "#ielts-writing-answer-" + (index + 1));
            if(checkResult) {
                displayCurrentPart(index + 1);
                alert(checkResult);
                isNotMetRequirement = true;
                return false;
            }
        });

        if(isNotMetRequirement) {
            return;
        }

        var limitMessage = checkOrSaveRateLimit('process_ielts_writing_test');
        if (limitMessage) {
            alert(limitMessage);
            $('.payment-popup-container').css('display', 'flex');
            return;
        }

        submitButton = $('#ielts-writing-test-submit-button');

        if (confirm('Are you sure you want to submit your answers?')) {
            const formData = new FormData();

            formData.append('post_id', $('#post_id').val());
            formData.append('action', 'process_ielts_writing_test');
            formData.append('ielts_writing_test_nonce', $('#ielts_writing_test_nonce').val());
            // The grader saves the progress record in the same request now, so it needs the fields
            // that record is keyed on.
            formData.append('save_learner_progress', 1);
            formData.append('category_type', $('#category_type').val());
            formData.append('custom_label', $('input[name="custom_label"]').val() || '');
            // Read here rather than after grading, so it measures the time spent writing and not the
            // 20-40s the AI takes to mark it (the old separate save was sent after that wait).
            formData.append('time_taken_seconds', getCurrentTimerInSeconds());
            // Single-task practice identity (present only on a part-practice page) so the grader scores the one task.
            formData.append('is_section_test', $('input[name="is_section_test"]').val() || 0);
            formData.append('src_test', $('input[name="src_test"]').val() || 0);
            formData.append('section', $('input[name="section"]').val() || 0);
            // Assembled custom test (present only on a p_tests page) so the grader rebuilds Task 1 + Task 2,
            formData.append('is_custom_test', $('input[name="is_custom_test"]').val() || 0);
            for (var ci = 1; ci <= 2; ci++) {
                formData.append('p' + ci + '_test', $('input[name="p' + ci + '_test"]').val() || 0);
                formData.append('p' + ci + '_part', $('input[name="p' + ci + '_part"]').val() || 0);
            }

            $('.ielts-writing-answer-section').each(function(index, answerSection) {
                //just reset the textarea to remove old highlight if any. This will also remove unnecessary line break, white space, etc.
                var answerElementWrapperName = "#ielts-writing-answer-" + (index + 1);
                window.contentEditableDiv.resetContentEditor(answerElementWrapperName);

                var writingAnswer = window.contentEditableDiv.getContentEditorPlainText(answerElementWrapperName);
                formData.append('ielts-writing-answer-' + (index + 1), writingAnswer);
            });

            testSubmitting = true;
            $(".spinner-overlay").css('display', 'flex');
            submitButton.prop('disabled', true).text('Submitting...');

            // Two calls: every marking prompt for the test runs on the Worker and the answers come
            // back sealed, so the band scores are still worked out on the server.
            window.aiWorkerSealedCall({
                ajaxurl: single_ielts_writing_test_ajax.ajaxurl,
                formData: formData
            }).then(function (data) {
                learnerResults = data;

                // Populate the table with the results
                const results = data.results;

                for (let i = 0; i < results.length; i++) {
                    const result = results[i];

                    if(result.samples) {
                        $(`#ielts-writing-samples-${i+1} .samples-holder`).html(result.samples);
                        $(`#ielts-writing-samples-${i+1} .word-count`).html(window.contentEditableDiv.countWords(result.samples));
                        $(`#ielts-writing-samples-${i+1}`).show();
                    }

                    if(result.link) {
                        $(`#ielts-writing-related-link-${i+1} .link-holder`).html(`<a href="${result.link}">${result.link}</a>`);
                        $(`#ielts-writing-related-link-${i+1}`).show();
                    }

                    $(`#band-score-container-${i+1}`).show();
                    if(result.feedback && result.feedback['content_result']) {

                        var contentAssessmentResult = result.feedback['content_result'];
                        window.writingTaskCheckerReusable.displayContentAssessmentResult(`#band-score-container-${i+1}`, contentAssessmentResult);

                        var textStatsResult = result.feedback['text_stats'];
                        window.writingTaskCheckerReusable.displayTextStatsResult(`#band-score-container-${i+1}`, textStatsResult);
                        
                        window.writingTaskCheckerReusable.displayWordRepetitionResult(`#band-score-container-${i+1}`, window.contentEditableDiv.getContentEditorPlainText(`#ielts-writing-answer-${i+1}`));

                        window.writingTaskCheckerReusable.setOnExportEssayResultButtonClick(`#band-score-container-${i+1}`, $('#ielts-writing-question-section-' + (i+1)).find('.ielts-writing-question').text(), result.feedback);

                        var grammarAssessmentResult = result.feedback['grammar_result'];
                        window.writingTaskCheckerReusable.displayGrammarAssessmentResult(`#ielts-writing-answer-${i+1}`, grammarAssessmentResult);

                        if(result.feedback['image_description']) {
                            $(`#ielts-writing-answer-section-${i+1} .image-description span`).text(result.feedback['image_description']);
                            $(`#ielts-writing-answer-section-${i+1} .image-description`).show();
                        }
                        else {
                            $(`#ielts-writing-answer-section-${i+1} .image-description span`).text(''); //set this to empty so that we know if we're checking academic or general
                            $(`#ielts-writing-answer-section-${i+1} .image-description`).hide();
                        }
                    }
                    else {
                        $(`#band-score-container-${i+1}`).html('Something went wrong when evaluating this essay!');
                    }
                }

                //display the first part
                displayCurrentPart(1);
                scrollTo($('.ielts-writing-samples .samples-holder'), $('.ielts-writing-test-questions'), true);

                //This will always run for now since we check all parts at once (unlike speaking where we check each part one by one)
                displayOverallTestBandScoreIfAllDone();

                $('.ielts-writing-improve-button-wrapper').css('display', 'flex');

                submitButton.prop('disabled', false).text('Retake Test');
                submitButton.off('click'); //remove current onclick events
                submitButton.on('click', function(e) {
                    e.preventDefault();
                    if (confirm('Are you sure you want to retake this test?')) {
                        location.reload();
                    }
                });
            }).catch(function (rejection) {
                // hardError is the server refusing outright - a spent limit, an over-length answer,
                // an unverified account, a task it could not mark - which arrives as HTTP 200 with
                // success:false. Anything else is the request itself failing.
                var refused = rejection && rejection.hardError && rejection.hardError.data;
                if (refused) {
                    if(refused['error'] == 'rate_limit_exceeded') {
                        alert(checkOrSaveRateLimit('process_ielts_writing_test', refused['retry_after']));
                        $('.payment-popup-container').css('display', 'flex');
                    }
                    else {
                        if(refused['error'] == 'user_not_verified') {
                            $('.fast-verification-popup-container').css('display', 'flex');
                        }
                        else {
                            alert((typeof refused === 'string' && refused) || refused['message'] || "Server Error. Please try again.");
                        }
                    }
                    console.log(rejection.hardError);
                }
                else {
                    // Handle errors if any
                    console.log(rejection);
                    alert('There was an error processing the test. Please try again.');
                }
            }).finally(function () {
                $(".spinner-overlay").css('display', 'none');

                //if still disabled, it means the callback failed
                if(submitButton.prop('disabled')) {
                    // Submission did not succeed; allow the 60-minute reminder again.
                    testSubmitting = false;
                    submitButton.prop('disabled', false).html('Submit <i class="fa-solid fa-paper-plane"></i>');
                }
            });
        }
    });

    $(".ielts-writing-enhance-natural-button").on("click", function (event) {
        if(!learnerResults) {
            alert('Please submit the test first');
            return;
        }

        var answerSection = $(this).closest('.ielts-writing-answer-section');
        var sectionNumber = answerSection.data('sectionNumber');
        var questionType = answerSection.data('questionType');

        //get essay and topic and image description
        var topic = $('#ielts-writing-question-section-' + sectionNumber).find('.ielts-writing-question').text();
        var essay = window.contentEditableDiv.getContentEditorPlainText("#ielts-writing-answer-" + sectionNumber);
        var imageDescription = $('#ielts-writing-answer-section-' + sectionNumber).find('.image-description span').text();

        var checkResult = window.contentEditableDiv.checkContentEditorCharacterRequirement("Part " + sectionNumber + " answer", "#ielts-writing-answer-" + sectionNumber);
        if(checkResult) {
            alert(checkResult);
            return;
        }

        //reset
        window.contentEditableDiv.setContentEditorPlainText('#unimproved-essay-' + sectionNumber, '');
        window.contentEditableDiv.setContentEditorPlainText('#improved-essay-' + sectionNumber, '');
        answerSection.find('.compare-natural-container').hide();

        let formData = new FormData();
        formData.append('action', 'enhance_natural_ielts_writing_test');
        formData.append('ielts_writing_test_nonce', $('#ielts_writing_test_nonce').val());
        formData.append('question_type', questionType);
        formData.append('topic', topic);
        formData.append('essay', essay);
        formData.append('image_description', imageDescription);

        window.textImproverReusable.loadDiff('#compare-natural-form-' + sectionNumber,
        formData,
        () => { //beforeSend
            answerSection.find(".ielts-writing-enhance-natural-button").prop("disabled", true);
            answerSection.find(".ielts-writing-improve-button").prop("disabled", true);
            answerSection.find(".ielts-writing-enhance-natural-button").text("Improving...");
            $(".spinner-overlay").css('display', 'flex');
        }, 
        () => { //onSuccess
            answerSection.find('.compare-natural-container').show();
        },
        () => { //complete
            answerSection.find(".ielts-writing-enhance-natural-button").prop("disabled", false);
            answerSection.find(".ielts-writing-improve-button").prop("disabled", false);
            answerSection.find(".ielts-writing-enhance-natural-button").text("Improve Naturalness");
            $(".spinner-overlay").css('display', 'none');
        });
    });

    $(".ielts-writing-improve-button").on("click", function (event) {
        if(!learnerResults) {
            alert('Please submit the test first');
            return;
        }

        var answerSection = $(this).closest('.ielts-writing-answer-section');
        var sectionNumber = answerSection.data('sectionNumber');
        var questionType = answerSection.data('questionType');

        //get essay and topic and image description
        var topic = $('#ielts-writing-question-section-' + sectionNumber).find('.ielts-writing-question').text();
        var essay = window.contentEditableDiv.getContentEditorPlainText("#ielts-writing-answer-" + sectionNumber);
        var imageDescription = $('#ielts-writing-answer-section-' + sectionNumber).find('.image-description span').text();

        var checkResult = window.contentEditableDiv.checkContentEditorCharacterRequirement("Part " + sectionNumber + " answer", "#ielts-writing-answer-" + sectionNumber);
        if(checkResult) {
            alert(checkResult);
            return;
        }

        //reset
        window.contentEditableDiv.setContentEditorPlainText('#unenhanced-essay-' + sectionNumber, '');
        window.contentEditableDiv.setContentEditorPlainText('#enhanced-essay-' + sectionNumber, '');
        answerSection.find('.compare-enhance-container').hide();

        let formData = new FormData();
        formData.append('action', 'improve_ielts_writing_test');
        formData.append('ielts_writing_test_nonce', $('#ielts_writing_test_nonce').val());
        formData.append('question_type', questionType);
        formData.append('topic', topic);
        formData.append('essay', essay);
        formData.append('image_description', imageDescription);
        
        window.textImproverReusable.loadDiff('#compare-enhance-form-' + sectionNumber,
        formData,
        () => { //beforeSend
            answerSection.find(".ielts-writing-enhance-natural-button").prop("disabled", true);
            answerSection.find(".ielts-writing-improve-button").prop("disabled", true);
            answerSection.find(".ielts-writing-improve-button").text("Enhancing...");
            $(".spinner-overlay").css('display', 'flex');
        }, 
        () => { //onSuccess
            answerSection.find('.compare-enhance-container').show();
        },
        () => { //complete
            answerSection.find(".ielts-writing-enhance-natural-button").prop("disabled", false);
            answerSection.find(".ielts-writing-improve-button").prop("disabled", false);
            answerSection.find(".ielts-writing-improve-button").text("Enhance Answer");
            $(".spinner-overlay").css('display', 'none');
        });
    });

    function displayOverallTestBandScoreIfAllDone() {
        //display overall band score when all questions are checked
        var isAllAnswerChecked = true;

        var totalTestBandScore = 0;
        var totalWeight = 0;

        // Read scores from the result data
        var results = (learnerResults && learnerResults.results) ? learnerResults.results : [];
        for (var i = 0; i < results.length; i++) {
            var contentResult = results[i].feedback && results[i].feedback['content_result'];
            // "Done" = the task was graded (has a content_result). A genuine score of 0 (e.g. gibberish)
            // still counts as done — only a missing result means it hasn't been checked yet.
            if (!contentResult) {
                isAllAnswerChecked = false;
                break;
            }

            var writingBandScore = parseFloat(contentResult['overall_band_score']) || 0;
            var weight = (results[i].type === 'task_two') ? 2 : 1;
            totalTestBandScore += writingBandScore * weight;
            totalWeight += weight;
        }

        if(isAllAnswerChecked && totalWeight > 0) {
            stopTimer();

            var roundedTestWritingScore =  Math.round((totalTestBandScore / totalWeight) * 2) / 2.0;
            $('.ielts-writing-band-score').text('Band Score: ' + roundedTestWritingScore);

            if(roundedTestWritingScore >= 8)
            {
                $('.ielts-writing-band-score').css('color','darkgreen');
            }
            else
            {
                if(roundedTestWritingScore >= 7)
                {
                    $('.ielts-writing-band-score').css('color','orangered');
                }
                else {
                    if(roundedTestWritingScore >= 6)
                    {
                        $('.ielts-writing-band-score').css('color','darkorange');
                    }
                    else
                    {
                        if(roundedTestWritingScore >= 5)
                        {
                            $('.ielts-writing-band-score').css('color','mediumblue');
                        }
                        else
                        {
                            $('.ielts-writing-band-score').css('color','darkred');
                        }              
                    }
                }
            }

            // The progress record is saved by the grader itself now, in the same request.
        }
    }

    function scrollTo(targetElement, container, highlightTarget = true)
    {
        if(!targetElement || targetElement.length == 0 || !container || container.length == 0) return;

        const topMargin = 120;
    
        // Calculate the relative position to the container using getBoundingClientRect()
        const targetRect = targetElement[0].getBoundingClientRect();
        const containerRect = container[0].getBoundingClientRect();
        let scrollTopPosition = container.scrollTop() + targetRect.top - containerRect.top - topMargin;
        // //a hacky way to signify that if it's near the top, scroll all the way up
        // if(scrollTopPosition < 200) scrollTopPosition = 0;
        
        container.animate(
            {
                scrollTop: scrollTopPosition,
            },
            500 // Animation duration in milliseconds
        );
        
        if(highlightTarget)
        {
            // Highlight the question number
            targetElement.css('transition', 'background-color 0.5s ease-in-out, transform 0.5s ease-in-out')
            .css('background-color', 'lightcyan')
            .css('transform', 'scale(1.01)');
        
            // Remove the highlight effect after a short delay
            setTimeout(function () {
                targetElement.css('background-color', '');
                targetElement.css('transform', 'scale(1)');
            }, 1000); // Delay in milliseconds
        }
    }

    $('#ielts-writing-dropdown-button').on('click', function(e) {
        e.preventDefault();
        $('.ielts-writing-dropdown-content').toggle();
    });

    $(document).on('mousedown', function(e) {
        if (!$(e.target).closest('#ielts-writing-dropdown-button, .ielts-writing-dropdown-content').length) {
            $('.ielts-writing-dropdown-content').hide();
        }
    });

    $('#ielts-writing-test-submit-button').on('click', function(e) {
        e.preventDefault();
        $('#ielts-writing-test-form').submit();
    });
    
    $('#ielts-writing-next-question-button').on('click', function(e) {
        e.preventDefault();
        displayCurrentPart(parseInt(currentPart) + 1);
    });

    $('#ielts-writing-previous-question-button').on('click', function(e) {
        e.preventDefault();
        displayCurrentPart(parseInt(currentPart) - 1);
    });

    function displayCurrentPart(part)
    {
        if($('#ielts-writing-question-section-' + part).length == 0)
        {
            console.log('not exist');
            return;
        }

        currentPart = part;
        $('.ielts-writing-question-section').removeClass('current');
        $('#ielts-writing-question-section-'+ currentPart).addClass('current');

        $('.ielts-writing-answer-section').removeClass('current');
        $('#ielts-writing-answer-section-'+ currentPart).addClass('current');

        $('.ielts-writing-part-announcement').removeClass('current');
        $('#ielts-writing-part-announcement-'+ currentPart).addClass('current');

        $('.ielts-writing-palette-section').removeClass('current');
        $('#ielts-writing-palette-section-'+ currentPart).addClass('current');

        if($('#ielts-writing-palette-section-'+ (currentPart - 1)).length == 0) {
            $('#ielts-writing-previous-question-button').prop('disabled', true);
        }
        else {
            $('#ielts-writing-previous-question-button').prop('disabled', false);
        }

        if($('#ielts-writing-palette-section-'+ (currentPart + 1)).length == 0) {
            $('#ielts-writing-next-question-button').prop('disabled', true);
        }
        else {
            $('#ielts-writing-next-question-button').prop('disabled', false);
        }

    }

    let isResizing = false;
    let resizeHandleStartX;
    let originalArticleWidth;

    function getResizeClientX(e) {
        if (e.type.startsWith('touch')) {
            var touches = e.originalEvent.touches.length ? e.originalEvent.touches : e.originalEvent.changedTouches;
            return touches[0].clientX;
        }
        return e.clientX;
    }

    $('.ielts-writing-resize-handle').on('mousedown touchstart', function (e) {
        e.preventDefault();
        isResizing = true;
        resizeHandleStartX = getResizeClientX(e);
        originalArticleWidth = $('.ielts-writing-test-questions').outerWidth();
    });

    $(window).on('mousemove touchmove', function (e) {
        if (!isResizing) return;
        const delta = getResizeClientX(e) - resizeHandleStartX;
        const newWidth = originalArticleWidth + delta;
        const maxWidth = 0.99 * $(window).width(); // Calculate 99% of the viewport width
        const limitedNewWidth = Math.min(newWidth, maxWidth); // Limit the new width to the maximum allowed width
        $('.ielts-writing-page-content').css('grid-template-columns', `${limitedNewWidth}px 10px auto`);
    });

    $(window).on('mouseup touchend touchcancel', function () {
        isResizing = false;
    });

    $('.ielts-writing-palette-section').on('click', function (e) {
        e.preventDefault();
        displayCurrentPart($(this).data('partNumber'));
    });

    //---- TIMER ----//
    let seconds = 0;
    let minutes = 0;
    let hours = 0;
    let timerInterval;
    let submitReminderShown = false;
    let ieltswritingTimer = $(".ielts-writing-timer strong");

    // Show a one-time reminder when the clock reaches 60 minutes. Users can
    // submit right away or dismiss it and keep working.
    function showSubmitReminderPopup() {
        submitReminderShown = true;
        if ($('.ielts-submit-reminder-overlay').length) return;
        // Pause the clock while the reminder is on screen.
        stopTimer();
        var popup = $(
            '<div class="ielts-submit-reminder-overlay">' +
                '<div class="ielts-submit-reminder-popup">' +
                    '<div class="ielts-submit-reminder-message">You\'ve reached the 60-minute mark. Submit now?</div>' +
                    '<div class="ielts-submit-reminder-actions">' +
                        '<button type="button" class="ielts-submit-reminder-continue">Not yet <i class="fa-solid fa-clock"></i></button>' +
                        '<button type="button" class="ielts-submit-reminder-submit">Submit now <i class="fa-solid fa-paper-plane"></i></button>' +
                    '</div>' +
                '</div>' +
            '</div>'
        );
        $('body').append(popup);
        popup.on('click', '.ielts-submit-reminder-continue', function () {
            popup.remove();
            // Resume the clock where it left off.
            startTimer();
        });
        popup.on('click', '.ielts-submit-reminder-submit', function () {
            popup.remove();
            // Resume the clock and submit: if the user cancels the submit
            // confirmation the test keeps running, and the submit success
            // handler stops the timer when submission actually goes through.
            startTimer();
            $('#ielts-writing-test-submit-button').click();
        });
    }

    function displayTime() {
        let secondsText = seconds < 10 ? '0' + seconds : seconds;
        let minutesText = minutes < 10 ? '0' + minutes : minutes;
        let hoursText = hours < 10 ? '0' + hours : hours;

        ieltswritingTimer.text(`${hoursText}:${minutesText}:${secondsText}`);
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

            if (!submitReminderShown && !testSubmitting && getCurrentTimerInSeconds() >= 3600) {
                showSubmitReminderPopup();
            }
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

    //--- FOCUS MODE ---//
    let focusState = 'normal'; // 'normal', 'focus', or 'fullscreen'

    // Handle focus mode toggle
    $('#ielts-writing-focus-mode-button').on('click', function() {
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
        $(".ielts-writing-test-container").addClass('ielts-writing-focus-mode');
        $("#ielts-writing-focus-mode-button").html('<i class="fa-solid fa-maximize"></i> Fullscreen');
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
        $(".ielts-writing-test-container").addClass('ielts-writing-focus-mode');
        $("#ielts-writing-focus-mode-button").html('<i class="fa-solid fa-compress"></i> Exit');
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
        $(".ielts-writing-test-container").removeClass('ielts-writing-focus-mode');
        $("#ielts-writing-focus-mode-button").html('<i class="fa-solid fa-expand"></i> Focus');
    }

    // Handle fullscreen and focus mode
    $(document).on('keydown', function(e) {
        // Check for F11 (Windows/Linux) or Mac fullscreen shortcuts (Ctrl+Cmd+F)
        if (e.key === 'F11' || (e.key === 'f' && e.ctrlKey && e.metaKey)) {
            e.preventDefault(); // Prevent default browser behavior
            
            $('#ielts-writing-focus-mode-button').click();
        }
        // Handle Escape key for focus mode
        else if (e.key === 'Escape') {
            exitFocusMode();
        }
    });

    //--- EXPORT PDF ---//
    $('.ielts-writing-export-pdf-link').on('click', function(e) {
        e.preventDefault();
        window.print();
    });

    window.onbeforeprint = function() {
        var submitted = learnerResults !== null;

        var $printContainer = $('<div class="ielts-writing-print-container"></div>');

        if (submitted) {
            var bandScore = $('.ielts-writing-band-score').first().text();
            var timeText = $('.ielts-writing-timer').first().text().trim();
            var bandColor = $('.ielts-writing-band-score').first().css('color');
            var $summary = $('<div class="ielts-print-result-summary"></div>');
            if (bandScore) {
                $summary.append('<span class="ielts-print-band-score" style="color:' + bandColor + '">' + bandScore + '</span>');
            }
            if (timeText) {
                $summary.append('<span class="ielts-print-time-taken">' + timeText + '</span>');
            }
            $printContainer.append($summary);
        }

        var partCount = $('.ielts-writing-question-section').length;
        for (var i = 1; i <= partCount; i++) {
            var $part = $('<div class="ielts-writing-print-part"></div>');
            $part.append('<div class="print-part-label">Part ' + i + '</div>');

            var $question = $('#ielts-writing-question-section-' + i).find('.ielts-writing-question').clone();
            $part.append($question);

            var $img = $('#ielts-writing-question-section-' + i).find('.ielts-writing-image');
            if ($img.length) {
                $part.append($img.clone());
            }

            if (submitted) {
                var $answerDiv = $('#ielts-writing-answer-' + i).find('.content-editable-div').clone();
                $answerDiv.attr('contenteditable', 'false');
                $part.append('<div class="ielts-writing-print-answer-label">Answer</div>');
                $part.append($('<div class="ielts-writing-print-answer"></div>').append($answerDiv));

                var polishedText = window.contentEditableDiv.getContentEditorPlainText('#polished-ielts-writing-answer-' + i);
                if (polishedText.trim()) {
                    var $polishedDiv = $('#polished-ielts-writing-answer-' + i).find('.content-editable-div').clone();
                    $polishedDiv.attr('contenteditable', 'false');
                    $part.append('<div class="ielts-writing-print-answer-label">Polished Writing</div>');
                    $part.append($('<div class="ielts-writing-print-answer ielts-writing-print-polished"></div>').append($polishedDiv));
                }

                var $bandScore = $('#band-score-container-' + i).clone();
                $bandScore.css('display', 'block');
                $part.append($bandScore);
            }

            $printContainer.append($part);
        }

        $('.ielts-writing-test-container').addClass('ielts-writing-print-hidden');
        $('body').children().not('.ielts-writing-print-container, #page').addClass('ielts-writing-print-hidden');
        $('.ielts-writing-page-header').after($printContainer);
    };

    window.onafterprint = function() {
        $('.ielts-writing-print-container').remove();
        $('.ielts-writing-print-hidden').removeClass('ielts-writing-print-hidden');
    };

    //--- ASK BEFORE LEAVING ---//
    window.addEventListener("beforeunload", (event) => {
        event.preventDefault();
        event.returnValue = ""; // This will trigger the default browser message
    });
});