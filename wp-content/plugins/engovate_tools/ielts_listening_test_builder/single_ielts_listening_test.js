jQuery(document).ready(function($) {

    // Explanations already cached server-side arrive with the grading response, keyed by answer-input
    // id, so "Explain more" can open without its own request. Filled in the results loop below.
    var bundledExplanations = {};
    var bundledTraps = {};

    // Locked "Practice this section only" (premium feature, not a free-taster test): open the upgrade popup.
    $('.ielts-listening-practice-section-button.locked').on('click', function(e) {
        e.preventDefault();
        $('.payment-popup-container').css('display', 'flex');
    });

    let currentPart = 1;
    let currentQuestion = 1;
    let learnerResults = null;
    let testSubmitting = false; // true while a test submission AJAX is in flight

    $('#ielts-listening-test-form').on('submit', function(e) {
        e.preventDefault();

        // Locked test: the learner can take it, but submitting opens the upgrade popup instead
        if ($('#ielts-listening-test-submit-button').hasClass('locked')) {
            $('.payment-popup-container').css('display', 'flex');
            return;
        }

        var limitMessage = checkOrSaveRateLimit('process_ielts_listening_test');
        if (limitMessage) {
            alert(limitMessage);
            $('.payment-popup-container').css('display', 'flex');
            return;
        }

        if (loadLearnerServerProgress || confirm('Are you sure you want to submit your answers?')) {
            const formData = new FormData(this);

            formData.append('action', 'process_ielts_listening_test');
            formData.append('time_taken_seconds', getCurrentTimerInSeconds());
            formData.append('save_learner_progress', loadLearnerServerProgress ? 0 : 1);

            $.ajax({
                type: 'POST',
                url: single_ielts_listening_test_ajax.ajaxurl,
                data: formData,
                processData: false,
                contentType: false,
                beforeSend: function () {
                    testSubmitting = true;
                    $(".spinner-overlay").css('display', 'flex');
                    $('#ielts-listening-test-result').html('');
                    $('#ielts-listening-test-submit-button').prop('disabled', true).text('Submitting...');
                },
                success: function (response) {
                    if(!response.success) {
                        if(response.data && response.data['error'] == 'rate_limit_exceeded') {
                            alert(checkOrSaveRateLimit('process_ielts_listening_test', response.data['retry_after']));
                            $('.payment-popup-container').css('display', 'flex');
                        }
                        else if(response.data && response.data['error'] == 'user_not_verified') {
                            $('.fast-verification-popup-container').css('display', 'flex');
                        }
                        else {
                            alert((typeof response.data === 'string' && response.data) || (response.data && response.data['message']) || 'There was an error processing the test. Please try again.');
                        }
                        return;
                    }

                    learnerResults = response.data;

                    // Handle the response from the server
                    stopTimer();

                    // Populate the table with the results
                    const results = response.data.results;

                    // Calculate band score
                    const proportionCorrect = response.data.correct_answer_count / results.length * 1.0;
                    const rawScore = proportionCorrect * 40;
                    const roundedIeltsScore = convertRawScoreToBandScore(rawScore);
                    // const ieltsScore = proportionCorrect * 9.0;
                    // const roundedIeltsScore = Math.round(ieltsScore * 2) / 2;
                    $('.ielts-listening-band-score').text('Band Score: ' + roundedIeltsScore);

                    if(roundedIeltsScore >= 8)
                    {
                        $('.ielts-listening-band-score').css('color','darkgreen');
                    }
                    else
                    {
                        if(roundedIeltsScore >= 7)
                        {
                            $('.ielts-listening-band-score').css('color','orangered');
                        }
                        else {
                            if(roundedIeltsScore >= 6)
                            {
                                $('.ielts-listening-band-score').css('color','darkorange');
                            }
                            else
                            {
                                if(roundedIeltsScore >= 5)
                                {
                                    $('.ielts-listening-band-score').css('color','mediumblue');
                                }
                                else
                                {
                                    $('.ielts-listening-band-score').css('color','darkred');
                                }              
                            }
                        }
                    }

                    // Set result for overlay
                    $('.ielts-listening-result-info').append($('.ielts-listening-band-score').clone());
                    $('.ielts-listening-result-info').append('<h3>'+ response.data.correct_answer_count + '/engovate.github.io/' + results.length + '</h3>');
                    $('.ielts-listening-result-info').append($('.ielts-listening-timer').clone());

                    // Get transcript elements to show explanations on
                    const transcriptElements = $('.ielts-listening-transcript').toArray();
                    $('.ielts-listening-transcript').addClass('current'); //temporary show all transcripts so we can get the child rect positions                
                    const explanationIgnoredPunctuation = [
                        // Single quote variants
                        "'", "\u2018", "\u2019", "\u201A", "\u201B", "\u2032", "\u0060",
                        // Double quote variants
                        '"', "\u201C", "\u201D", "\u201E", "\u201F", "\u2033",
                        // Dash variants
                        "-", "\u2013", "\u2014", "\u2012", "\u2010",
                        // Sentence punctuation
                        ".", ",", ":", ";", "!", "?", "\u2026",
                        // Brackets
                        "(", ")", "[", "]", "{", "}",
                        // Misc
                        "_", "+", "=", "/engovate.github.io/", "\\", "*", " ", "$", "^", "|",
                        // Whitespace
                        "\n", "\r", "\t", "\u00A0", "\u200B", "\u200C", "\u200D", "\u2028", "\u2029"
                    ];
                    const explanationIgnoredPunctuationRegex = new RegExp('[' + explanationIgnoredPunctuation.map(c => c.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')).join('') + ']', 'g');

                    //create markInstances to start marking text inside each transcript
                    let markInstances = [];
                    if(typeof Mark !== 'undefined') {
                        transcriptElements.forEach(transcriptElement => {
                            markInstances.push(new Mark(transcriptElement));
                        });
                    }
                    //save explanationNumberElement (We cannot do it directly inside the loop since it would mess up the html structure, which would mess up the Mark process)
                    let explanationNumberElements = [];
                    bundledExplanations = {};
                    bundledTraps = {};

                    //Init table
                    let tableRows = '';

                    for (let i = 0; i < results.length; i++) {
                        const result = results[i];

                        //populate table rows
                        const rowClass = result.is_correct ? 'correct-ielts-listening-answer' : 'incorrect-ielts-listening-answer';
                        tableRows += `<tr class="${rowClass}">`;
                        tableRows += '<td>' + (i + 1) + '</td>';
                        tableRows += '<td>' + result.your_answer + '</td>';
                        tableRows += '<td>' + result.correct_answer + '</td>';
                        tableRows += '</tr>';

                        //display a correct/incorrect mark besides each question number
                        let listeningQuestionNumberElement = $('#ielts-listening-question-number-' + (i+1));
                        if (result.detailed_explanation) {
                            const bundledAnswerEl = listeningQuestionNumberElement.closest('.ielts-listening-question-item').find('[id^="ielts_listening_answer_"]')[0];
                            if (bundledAnswerEl) bundledExplanations[bundledAnswerEl.id] = result.detailed_explanation;
                        }
                        if (result.traps) {
                            const bundledTrapEl = listeningQuestionNumberElement.closest('.ielts-listening-question-item').find('[id^="ielts_listening_answer_"]')[0];
                            if (bundledTrapEl) bundledTraps[bundledTrapEl.id] = result.traps;
                        }
                        listeningQuestionNumberElement.removeClass('correct');
                        listeningQuestionNumberElement.removeClass('incorrect');
                        if(result.is_correct)
                        {
                            listeningQuestionNumberElement.addClass('correct');
                            listeningQuestionNumberElement.after('<span style="color: green"> <i class="fa-solid fa-check"></i></span>');
                            $('.ielts-listening-question-palette .ielts-listening-palette-item[data-question-number="' + (i+1) + '"] a').addClass('correct');
                        }
                        else
                        {
                            listeningQuestionNumberElement.addClass('incorrect');
                            listeningQuestionNumberElement.after('<span style="color: darkred"> <i class="fa-solid fa-xmark"></i></span>');
                            $('.ielts-listening-question-palette .ielts-listening-palette-item[data-question-number="' + (i+1) + '"] a').addClass('incorrect');
                        }

                        //display the correct answer besides each question input or question number
                        const correctAnswerInfo = '<span class="correct-answer-info"> Answer: '+result.correct_answer+' <span class="explain-answer-button">Explain more <i class="fa-solid fa-caret-right"></i></span> <span class="trap-answer-button">What&#39;s the trap? <i class="fa-solid fa-lightbulb"></i></span></span>';
                        
                        if(listeningQuestionNumberElement.siblings('input').length > 0)
                        {
                            //for input type text like sentence_completion, table_completion
                            listeningQuestionNumberElement.siblings('input').after(correctAnswerInfo);
                        }
                        else
                        {
                            let selectAnswerElements = listeningQuestionNumberElement.closest('.ielts-listening-question-item').find('select, input[type="text"]');
                            if(selectAnswerElements.length > 0)
                            {
                                selectAnswerElements.after(correctAnswerInfo);
                            }
                            else
                            {
                                //check to see if this is not the first question-number of multiple questions (since we only display answer once for multiple questions)
                                if(listeningQuestionNumberElement.siblings('#ielts-listening-question-number-'+(i+2)).length == 0)
                                {
                                    //for other types
                                    listeningQuestionNumberElement.siblings('span:last').after(correctAnswerInfo);
                                }
                            }
                        }

                        //display explanations on the transcripts
                        const explanations = result.explanation.split("\n");
                        // Only trigger marking on the last question of a group (two_choices/three_choices/four_choices/five_choices).
                        // If the next question number is a sibling of the current one, they share the same group container — skip until the last.
                        const isLastInGroup = listeningQuestionNumberElement.siblings('#ielts-listening-question-number-' + (i + 2)).length === 0;
                        if (isLastInGroup) {
                            // Count how many questions are in this group by checking how many
                            // previous question numbers are siblings of the current one
                            let groupSize = 1;
                            while (listeningQuestionNumberElement.siblings('#ielts-listening-question-number-' + (i + 1 - groupSize)).length > 0) {
                                groupSize++;
                            }

                            if(markInstances.length > 0) {
                                let j = getPartNumberFromQuestionNumber(i + 1) - 1;
                                // let transcriptElement = transcriptElements[j];
                                let markInstance = markInstances[j];
                                // let isFound = false;
                                for (let k = 0; k < explanations.length; k++) {
                                    let explanation = explanations[k].trim();
                                    // Pre-strip punctuation from the search term so ignorePunctuation
                                    // can handle mismatches on the passage side (e.g. ' vs ")
                                    let strippedExplanation = explanation
                                        .replace(explanationIgnoredPunctuationRegex, '')
                                        .trim();

                                    // Only highlight explanation that is longer than 3 charaters to avoid highlighting multiple instances of short words like Umh, Uh, etc.
                                    if (strippedExplanation.length > 3 && markInstance) {
                                        let lastMarkElement = null;
                                        markInstance.mark(strippedExplanation, {
                                            className: 'explanation-highlight',
                                            separateWordSearch: false,
                                            acrossElements: true,
                                            diacritics: true,
                                            ignorePunctuation: explanationIgnoredPunctuation,
                                            each: function(markElement) {
                                                lastMarkElement = markElement;
                                            },
                                            done: function(numberOfMarks) {
                                                if (lastMarkElement) {
                                                    for (let z = 0; z < groupSize; z++) {
                                                        const explanationNumberElement = document.createElement('span');
                                                        explanationNumberElement.id = 'ielts-listening-explanation-number-' + (i + 1 - z) + '-' + k;
                                                        explanationNumberElement.className = 'ielts-listening-explanation-number';
                                                        explanationNumberElement.innerText = i + 1 - z;

                                                        explanationNumberElements.push({markElement: lastMarkElement, explanationNumberElement: explanationNumberElement});
                                                   }
                                                }

                                                // if(numberOfMarks > 0)
                                                // {
                                                //     isFound = true;
                                                // }
                                            }
                                        });

                                        // isFound = true;
                                    }
                                }

                                // if(isFound) break;
                            }
                        }
                    }

                    explanationNumberElements.forEach(element => {
                        element.markElement.parentElement.insertBefore(element.explanationNumberElement, element.markElement.nextSibling);
                    });

                    $('.ielts-listening-result-table-body').html(tableRows);
                    $('.ielts-listening-result-overlay').addClass('completed');
                    $('.ielts-listening-page-content, .ielts-listening-test-transcripts, .ielts-listening-resize-handle').removeClass('question-only');

                    // "Explain more" and "What's the trap?" are premium features: non-premium learners get them
                    // on the first 4 answers only; grey out the rest so clicking them prompts an upgrade.
                    if ($('#is_premium').val() !== '1') {
                        // This lock is off for now, so these buttons open on every answer for everyone. To turn it back on, uncomment the lines below:
                        // $('.explain-answer-button').slice(4).addClass('locked')
                        //     .find('.fa-caret-right').removeClass('fa-caret-right').addClass('fa-lock');
                        // $('.trap-answer-button').slice(4).addClass('locked')
                        //     .find('.fa-lightbulb').removeClass('fa-lightbulb').addClass('fa-lock');

                        var listeningWrongCount = results.length - response.data.correct_answer_count;
                        if (roundedIeltsScore >= 9) {
                            $('.ielts-listening-premium-cta-headline').text('Unlock your full analysis with Premium');
                        } else {
                            $('.ielts-listening-premium-cta-headline').text('You missed ' + listeningWrongCount + ' question' + (listeningWrongCount === 1 ? '' : 's') + ' — Improve faster with Premium');
                        }
                    }

                    //display the first part
                    displayCurrentPart(1);

                    // The progress record is saved by the grader itself now, in the same request.
                },
                error: function (error) {
                    // Handle errors if any
                    console.log(error);
                    alert('There was an error processing the test. Please try again.');
                },
                complete: function () {
                    $(".spinner-overlay").css('display', 'none');
                    
                    //only show the retake test button if the submit action is successful
                    if(learnerResults) {
                        let submitButton = $('#ielts-listening-test-submit-button');
                        submitButton.prop('disabled', false).text('Retake Test');
                        submitButton.off('click'); //remove current onclick events
                        submitButton.on('click', function(e) {
                            e.preventDefault();
                            if (confirm('Are you sure you want to retake this test?')) {
                                location.reload();
                            }
                        });

                        let reviewButtons = $('#ielts-listening-test-review-button');
                        reviewButtons.prop('disabled', false).html('<i class="fa-solid fa-list-check"></i>');
                        reviewButtons.off('click'); //remove current onclick events
                        reviewButtons.on('click', function(e) {
                            e.preventDefault();
                            $('.ielts-listening-result-overlay').addClass('completed');
                        });
                    }
                    else {
                        // Submission did not succeed; allow the 60-minute reminder again.
                        testSubmitting = false;
                        $('#ielts-listening-test-submit-button').prop('disabled', false).text('Submit');
                    }
                },
            });
        }
    });

    function convertRawScoreToBandScore(rawScore) {
        if (rawScore >= 39) return 9;
        else if (rawScore >= 37) return 8.5;
        else if (rawScore >= 35) return 8;
        else if (rawScore >= 32) return 7.5;
        else if (rawScore >= 30) return 7;
        else if (rawScore >= 26) return 6.5;
        else if (rawScore >= 23) return 6;
        else if (rawScore >= 18) return 5.5;
        else if (rawScore >= 16) return 5;
        else if (rawScore >= 13) return 4.5;
        else if (rawScore >= 11) return 4;
        else if (rawScore >= 9) return 3.5;
        else if (rawScore >= 7) return 3;
        else if (rawScore >= 5) return 2.5;
        else if (rawScore >= 3) return 2;
        else return 1;
    }

    $('body').append('<div class="answer-detailed-explanation-popup"><div class="notice">Note: The following explanation is auto-generated and might not be entirely accurate.</div><div class="detailed-explanation"></div></div>');

    $('body').append('<div class="answer-trap-popup"><div class="notice">Note: The following is auto-generated and might not be entirely accurate.</div><div class="trap-content"></div></div>');

    $(document).on('click', '.explain-answer-button', function(e) {
        e.preventDefault();

        var explainButton = $(this);

        // Locked (premium feature, beyond the first 4 free answers): open the upgrade popup instead.
        if (explainButton.hasClass('locked')) {
            $('.payment-popup-container').css('display', 'flex');
            return;
        }

        var detailedExplanation = explainButton.data('detailedExplanation');

        // The bundled text (from the grading response) needs the same label-bolding the AJAX path applies.
        if (!detailedExplanation) {
            var bundledAnswerId = explainButton.closest('.ielts-listening-question-item').find('[id^="ielts_listening_answer_"]')[0];
            if (bundledAnswerId && bundledExplanations[bundledAnswerId.id]) {
                var bundledParagraphs = bundledExplanations[bundledAnswerId.id].split("\n");
                bundledParagraphs[0] = "<strong>" + bundledParagraphs[0] + "</strong>";
                bundledParagraphs[2] = "<strong>" + bundledParagraphs[2] + "</strong>";
                bundledParagraphs[4] = "<strong>" + bundledParagraphs[4] + "</strong>";

                detailedExplanation = bundledParagraphs.join("\n");
                explainButton.data('detailedExplanation', detailedExplanation);
            }
        }
        var originalExplainLabel = explainButton.html();

        var answerId = explainButton.closest('.ielts-listening-question-item').find('[id^="ielts_listening_answer_"]')[0].id;
        var sectionAndQuestionid = answerId.replace('ielts_listening_answer_', '').split('_');
        var sectionId = sectionAndQuestionid[0];
        var questionId = sectionAndQuestionid[1];

        var section = explainButton.closest('.ielts-listening-question-section');
        var partNumber = section.data('part-number');
        var testId = section.data('src-test-id') || $('#post_id').val();
        var srcPart = section.data('src-part') || partNumber;

        var popup = $('.answer-detailed-explanation-popup');

        if(!detailedExplanation) {
            const formData = new FormData();
            formData.append('action', 'explain_ielts_listening_answer');
            formData.append('ielts_listening_test_nonce', $('#ielts_listening_test_nonce').val());
            formData.append('section_id', sectionId);
            formData.append('question_number_in_section', questionId);
            formData.append('test_id', testId);
            formData.append('part_number', srcPart);

            var limitMessage = checkOrSaveRateLimit('explain_ielts_listening_answer');
            if (limitMessage) {
                alert(limitMessage);
                $('.payment-popup-container').css('display', 'flex');
                return;
            }

            $.ajax({
                type: 'POST',
                url: single_ielts_listening_test_ajax.ajaxurl,
                data: formData,
                processData: false,
                contentType: false,
                beforeSend: function () {
                    explainButton.prop('disabled', true).text('Loading...');
                },
                success: function (response) {
                    if(!response.success) {
                        if(response.data['error'] == 'rate_limit_exceeded') {
                            alert(checkOrSaveRateLimit('explain_ielts_listening_answer', response.data['retry_after']));
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
                        if(!response.data)
                        {
                            alert("Server Error. Please try again.");
                            console.log(response);
                        }
                        else
                        {
                            var explanationParagraphs = response.data.split("\n");
                            explanationParagraphs[0] = "<strong>" + explanationParagraphs[0] + "</strong>";
                            explanationParagraphs[2] = "<strong>" + explanationParagraphs[2] + "</strong>";
                            explanationParagraphs[4] = "<strong>" + explanationParagraphs[4] + "</strong>";

                            detailedExplanation = explanationParagraphs.join("\n");

                            explainButton.data('detailedExplanation', detailedExplanation);

                            popup.data('lastClickedExplainButton', answerId);

                            //show the popup
                            popup.find('.detailed-explanation').html(detailedExplanation);
                            //set the position
                            var elementOffset = explainButton.offset();
                            popup.css({
                                'top': elementOffset.top + 30,
                            });
                            popup.show();
                        }
                    }
                },
                error: function (error) {
                    console.log(error);
                    alert('There was an error processing your request. Please try again.');
                },
                complete: function () {
                    explainButton.prop('disabled', false).html(originalExplainLabel);
                },
            });
        }
        else {
            if(popup.is(":visible") && popup.data('lastClickedExplainButton') == answerId) {
                popup.hide();
            }
            else {
                popup.data('lastClickedExplainButton', answerId);
                
                // Show the popup
                popup.find('.detailed-explanation').html(detailedExplanation);
                //set the position
                var elementOffset = explainButton.offset();
                popup.css({
                    'top': elementOffset.top + 30,
                });
                popup.show();
            }
        }
    });

    $(document).on('mousedown', function (e) {
        if (!$(e.target).closest('.answer-detailed-explanation-popup, .explain-answer-button').length) {
            $('.answer-detailed-explanation-popup').hide();
        }
    });

    // "What's the trap?" — sibling of "Explain more": sends the learner's own answer to the
    // server, which diagnoses the trap (why their answer was wrong, or the trap they dodged),
    // then shows it in a floating popup under the button.
    $(document).on('click', '.trap-answer-button', function(e) {
        e.preventDefault();

        var trapButton = $(this);

        // Locked (premium feature, beyond the first 4 free answers): open the upgrade popup instead.
        if (trapButton.hasClass('locked')) {
            $('.payment-popup-container').css('display', 'flex');
            return;
        }

        var trapContent = trapButton.data('trapContent');
        var originalLabel = trapButton.html();

        // Read the learner's answer + correctness from the DOM. getUserAnswers() handles every input
        // type (for "choose N" checkboxes it returns ALL the picks); correctness comes from the
        // correct/incorrect mark(s) already placed on this question's number(s) at grading time.
        var $item = trapButton.closest('.ielts-listening-question-item');
        var $answerInput = $item.find('[id^="ielts_listening_answer_"]').first();
        var yourAnswer = getUserAnswers($answerInput).join(', ');
        var $questionNumbers = $item.find('.ielts-listening-question-number');
        var isCorrect = $questionNumbers.length > 0 && $questionNumbers.filter('.correct').length === $questionNumbers.length;

        var answerId = $answerInput[0].id;
        var sectionAndQuestionid = answerId.replace('ielts_listening_answer_', '').split('_');
        var sectionId = sectionAndQuestionid[0];
        var questionId = sectionAndQuestionid[1];

        var section = trapButton.closest('.ielts-listening-question-section');
        var partNumber = section.data('part-number');
        var testId = section.data('src-test-id') || $('#post_id').val();
        var srcPart = section.data('src-part') || partNumber;

        // Resolve the trap from the map that came back with the grading response
        if (!trapContent && bundledTraps[answerId]) {
            var questionTraps = bundledTraps[answerId];
            var trapKeyAnswer = yourAnswer.toLowerCase().replace(/\s+/g, '');
            var trapVariants = Object.keys(questionTraps).filter(function (k) { return k !== '__general__'; }).length;
            var trapKey = trapKeyAnswer + '::' + (isCorrect ? '1' : '0');
            var bundledTrapText = questionTraps[trapKey];
            if (!bundledTrapText && (trapKeyAnswer === '' || trapVariants >= 15)) {
                bundledTrapText = questionTraps['__general__'];
            }
            if (bundledTrapText) {
                var bundledTrapParagraphs = bundledTrapText.split("\n");
                if (bundledTrapParagraphs[0] !== undefined) bundledTrapParagraphs[0] = "<strong>" + bundledTrapParagraphs[0] + "</strong>";
                if (bundledTrapParagraphs[2] !== undefined) bundledTrapParagraphs[2] = "<strong>" + bundledTrapParagraphs[2] + "</strong>";
                trapContent = bundledTrapParagraphs.join("\n");
                trapButton.data('trapContent', trapContent);
            }
        }

        var popup = $('.answer-trap-popup');

        if(!trapContent) {
            const formData = new FormData();
            formData.append('action', 'diagnose_ielts_listening_trap');
            formData.append('ielts_listening_test_nonce', $('#ielts_listening_test_nonce').val());
            formData.append('section_id', sectionId);
            formData.append('question_number_in_section', questionId);
            formData.append('test_id', testId);
            formData.append('part_number', srcPart);
            formData.append('your_answer', yourAnswer);
            formData.append('is_correct', isCorrect ? '1' : '0');

            var limitMessage = checkOrSaveRateLimit('diagnose_ielts_listening_trap');
            if (limitMessage) {
                alert(limitMessage);
                $('.payment-popup-container').css('display', 'flex');
                return;
            }

            $.ajax({
                type: 'POST',
                url: single_ielts_listening_test_ajax.ajaxurl,
                data: formData,
                processData: false,
                contentType: false,
                beforeSend: function () {
                    trapButton.prop('disabled', true).html('Loading...');
                },
                success: function (response) {
                    if(!response.success) {
                        if(response.data && response.data['error'] == 'rate_limit_exceeded') {
                            alert(checkOrSaveRateLimit('diagnose_ielts_listening_trap', response.data['retry_after']));
                            $('.payment-popup-container').css('display', 'flex');
                        }
                        else if(response.data && response.data['error'] == 'user_not_verified') {
                            $('.fast-verification-popup-container').css('display', 'flex');
                        }
                        else {
                            alert((typeof response.data === 'string' && response.data) || "Server Error. Please try again.");
                        }
                    }
                    else {
                        if(!response.data) {
                            alert("Server Error. Please try again.");
                            console.log(response);
                        }
                        else {
                            // Bold the "The Trap:" / "The Fix:" label lines (indices 0 and 2),
                            // exactly like "Explain more" bolds its labelled sections.
                            var trapParagraphs = response.data.split("\n");
                            if (trapParagraphs[0] !== undefined) trapParagraphs[0] = "<strong>" + trapParagraphs[0] + "</strong>";
                            if (trapParagraphs[2] !== undefined) trapParagraphs[2] = "<strong>" + trapParagraphs[2] + "</strong>";
                            trapContent = trapParagraphs.join("\n");

                            trapButton.data('trapContent', trapContent);

                            popup.data('lastClickedTrapButton', answerId);

                            //show the popup
                            popup.find('.trap-content').html(trapContent);
                            //set the position
                            var elementOffset = trapButton.offset();
                            popup.css({
                                'top': elementOffset.top + 30,
                            });
                            popup.show();
                        }
                    }
                },
                error: function (error) {
                    console.log(error);
                    alert('There was an error processing your request. Please try again.');
                },
                complete: function () {
                    trapButton.prop('disabled', false).html(originalLabel);
                },
            });
        }
        else {
            if(popup.is(":visible") && popup.data('lastClickedTrapButton') == answerId) {
                popup.hide();
            }
            else {
                popup.data('lastClickedTrapButton', answerId);

                // Show the popup
                popup.find('.trap-content').html(trapContent);
                //set the position
                var elementOffset = trapButton.offset();
                popup.css({
                    'top': elementOffset.top + 30,
                });
                popup.show();
            }
        }
    });

    $(document).on('mousedown', function (e) {
        if (!$(e.target).closest('.answer-trap-popup, .trap-answer-button').length) {
            $('.answer-trap-popup').hide();
        }
    });

    $('#ielts-listening-dropdown-button').on('click', function(e) {
        e.preventDefault();
        $('.ielts-listening-dropdown-content').toggle();
    });

    $(document).on('mousedown', function(e) {
        if (!$(e.target).closest('#ielts-listening-dropdown-button, .ielts-listening-dropdown-content').length) {
            $('.ielts-listening-dropdown-content').hide();
        }
    });

    $('#ielts-listening-test-submit-button').on('click', function(e) {
        e.preventDefault();
        $('#ielts-listening-test-form').submit();
    });

    $('#ielts-listening-next-question-button').on('click', function(e) {
        e.preventDefault();
        const nextPart = currentPart + 1;
        $('#ielts-listening-palette-section-'+ nextPart).click();
    });

    $('#ielts-listening-previous-question-button').on('click', function(e) {
        e.preventDefault();
        const previousPart = currentPart - 1;
        $('#ielts-listening-palette-section-'+ previousPart).click();
    });

    function getPartNumberFromQuestionNumber(questionNumber)
    {
        return parseInt($('#ielts-listening-question-number-' + questionNumber).closest('.ielts-listening-question-section').data('part-number'));
    }

    function displayCurrentPart(questionNumber)
    {
        if($('#ielts-listening-question-number-' + questionNumber).length == 0)
        {
            console.log('not exist');
            return;
        }

        currentQuestion = parseInt(questionNumber);

        let oldPart = currentPart;
        currentPart = parseInt($('#ielts-listening-question-number-' + currentQuestion).closest('.ielts-listening-question-section').data('part-number'));

        $('.ielts-listening-transcript').removeClass('current');
        $('#ielts-listening-transcript-'+ currentPart).addClass('current');

        $('.ielts-listening-question-section').removeClass('current');
        $('#ielts-listening-question-section-'+ currentPart).addClass('current');

        $('.ielts-listening-part-announcement').removeClass('current');
        $('#ielts-listening-part-announcement-'+ currentPart).addClass('current');

        $('.ielts-listening-palette-section').removeClass('current');
        $('#ielts-listening-palette-section-'+ currentPart).addClass('current');

        if($('#ielts-listening-palette-section-'+ (currentPart - 1)).length == 0) {
            $('#ielts-listening-previous-question-button').prop('disabled', true);
        }
        else {
            $('#ielts-listening-previous-question-button').prop('disabled', false);
        }

        if($('#ielts-listening-palette-section-'+ (currentPart + 1)).length == 0) {
            $('#ielts-listening-next-question-button').prop('disabled', true);
        }
        else {
            $('#ielts-listening-next-question-button').prop('disabled', false);
        }

        if(oldPart != currentPart)
        {
            $('.ielts-listening-test-transcripts').scrollTop(0);
            $('.ielts-listening-question-container').scrollTop(0);

            // Moving on while a part's audio plays carries on into this part's audio if it hasn't
            // been played yet (the play handler below pauses the other one). A part already played
            // is left alone, and so is whatever is playing: the learner may only be looking back.
            // The click that moved here lets the browser play; if it still refuses, the hint stays.
            const $waiting = $('#ielts-listening-part-announcement-' + currentPart + '.is-waiting');
            const isPlaying = $('audio[id^="ielts-listening-test-audio-"]').filter(function() { return !this.paused && !this.ended; }).length > 0;
            if ($waiting.length && isPlaying) {
                const playing = $waiting.find('audio').get(0).play();
                if (playing) playing.catch(function() {});
            }
        }

        hideHighlightPopup();
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

    $('.ielts-listening-resize-handle').on('mousedown touchstart', function (e) {
        e.preventDefault();
        isResizing = true;
        resizeHandleStartX = getResizeClientX(e);
        originalArticleWidth = $('.ielts-listening-test-transcripts').outerWidth();
    });

    $(window).on('mousemove touchmove', function (e) {
        if (!isResizing) return;
        const delta = getResizeClientX(e) - resizeHandleStartX;
        const newWidth = originalArticleWidth + delta;
        const maxWidth = 0.99 * $(window).width(); // Calculate 99% of the viewport width
        const limitedNewWidth = Math.min(newWidth, maxWidth); // Limit the new width to the maximum allowed width
        $('.ielts-listening-page-content').css('grid-template-columns', `${limitedNewWidth}px 10px auto`);
    });

    $(window).on('mouseup touchend touchcancel', function () {
        isResizing = false;
    });

    $('#ielts-listening-test-review-button').on('click', function(e) {
        e.preventDefault();
        $('.ielts-listening-preview-overlay').addClass('completed');
    });

    $('#ielts-listening-result-close-button').on('click', function(e) {
        e.preventDefault();
        $('.ielts-listening-result-overlay').removeClass('completed');
    });

    $('#ielts-listening-preview-close-button').on('click', function(e) {
        e.preventDefault();
        $('.ielts-listening-preview-overlay').removeClass('completed');
    });

    $('.ielts-listening-premium-cta-close').on('click', function(e) {
        e.preventDefault();
        $(this).closest('.ielts-listening-premium-cta, .ielts-listening-premium-cta-promo').hide();
    });

    // Listen for changes to the user answer inputs
    $('input[name^="ielts_listening_answer_"], select[name^="ielts_listening_answer_"]').on('change', function() {
        //this is for input type like form_completion, sentence_completion
        let questionNumbers = [$(this).siblings('.ielts-listening-question-number').text()];

        //this is for other types like checkboxes, radio buttons
        if(!questionNumbers[0])
        {
            questionNumbers = $(this).closest('.ielts-listening-question-item').find('.ielts-listening-question-number').map(function() {
                return $(this).text();
            }).get();
        }

        let userAnswers = getUserAnswers($(this));

        for (let i = 0; i < questionNumbers.length; i++)
        {
            let questionNumber = questionNumbers[i];
            let userAnswer = userAnswers[i];
            // Update the user answer in the Question Palette
            //$('.ielts-listening-question-palette .ielts-listening-palette-item[data-question-number="' + questionNumber + '"] .ielts-listening-user-answer').text(userAnswer);
            if (userAnswer !== '' && userAnswer !== undefined) {
                $('.ielts-listening-question-palette .ielts-listening-palette-item[data-question-number="' + questionNumber + '"] a').addClass('completed');
            } else {
                $('.ielts-listening-question-palette .ielts-listening-palette-item[data-question-number="' + questionNumber + '"] a').removeClass('completed');
            }

            //Update user answer in preview. We also need it for easy access to user progress for local storage
            $('.ielts-listening-preview-table-body .ielts-listening-preview-item[data-question-number="' + questionNumber + '"] .ielts-listening-user-answer').text(userAnswer !== undefined?userAnswer:'');
        }

        //only save if we are not loading server progress and if the user has not finished the test
        if(!loadLearnerServerProgress && !learnerResults) {
            debouncedSaveLearnerLocalProgress();
        }
    });

    function getUserAnswers(answerElement)
    {
        let userAnswers = [];
        if (answerElement.is('input[type="radio"]')) {
            let parent = answerElement.closest('.ielts-listening-question-item');
            userAnswers = parent.find('input[type="radio"]:checked').map(function() {
                return $(this).val();
            }).get();
        } else if (answerElement.is('input[type="checkbox"]')) {
            let parent = answerElement.closest('.ielts-listening-question-item');
            userAnswers = parent.find('input[type="checkbox"]:checked').map(function() {
                return $(this).val();
            }).get();
        } else if (answerElement.is('select')) {
            userAnswers = [answerElement.find('option:selected').val()];
        } else { // input[type="text"]
            userAnswers = [answerElement.val()];
        }

        return userAnswers;
    }

    // Set up event listeners for checkboxes with data-limit attribute
    $('input[type="checkbox"][data-limit]').on('change', function() {
        // Get the limit value and the name attribute of the clicked checkbox
        var limit = parseInt($(this).data('limit'));
        var name = $(this).attr('name');

        // Find all checked checkboxes with the same name attribute
        var checkedCheckboxes = $('input[name="' + name + '"]:checked');

        // Find all unchecked checkboxes with the same name attribute
        var uncheckedCheckboxes = $('input[name="' + name + '"]:not(:checked)');

        // If the number of checked checkboxes reaches the limit, disable all unchecked checkboxes
        if (checkedCheckboxes.length >= limit) {
            uncheckedCheckboxes.prop('disabled', true);
        } else {
            // Enable all unchecked checkboxes if the limit hasn't been reached
            uncheckedCheckboxes.prop('disabled', false);
        }
    });

    $('.ielts-listening-palette-section').on('click', function (e) {
        const questionNumber = $(this).find('.ielts-listening-palette-item a:first').text().trim();
        displayCurrentPart(questionNumber);
    });

    $('.ielts-listening-palette-item a, .ielts-listening-question-number').on('click', function (e) {
        e.preventDefault();
        e.stopPropagation();

        //display currentPart first
        // Get question number from the anchor tag's text
        const questionNumber = $(this).text().trim();
        displayCurrentPart(questionNumber);

        scrollToCurrentQuestionAndHighlight();
    });

    const explanationExcerptIndexMap = {};

    function scrollToCurrentQuestionAndHighlight()
    {
        scrollTo($('#ielts-listening-question-number-' + currentQuestion), $('.ielts-listening-question-container'));

        // Find the first question in the group so all questions in a two_choices/three_choices/four_choices/five_choices
        // group share the same cycle state and excerpt elements
        const currentEl = $('#ielts-listening-question-number-' + currentQuestion);
        let groupStartQuestion = parseInt(currentQuestion);
        while (currentEl.siblings('#ielts-listening-question-number-' + (groupStartQuestion - 1)).length > 0) {
            groupStartQuestion--;
        }

        // Collect all excerpt elements using the group's first question number
        const excerptElements = $(`[id^="ielts-listening-explanation-number-${groupStartQuestion}-"]`).toArray().map(el => $(el));

        if (excerptElements.length === 0) return;

        // Cycle through excerpts on repeated clicks, shared across all questions in the group
        const currentIndex = explanationExcerptIndexMap[groupStartQuestion] || 0;
        const scrollTarget = $(`#ielts-listening-explanation-number-${currentQuestion}-${currentIndex}`).length > 0
            ? $(`#ielts-listening-explanation-number-${currentQuestion}-${currentIndex}`)
            : excerptElements[currentIndex];
        scrollTo(scrollTarget, $('.ielts-listening-test-transcripts'));
        explanationExcerptIndexMap[groupStartQuestion] = (currentIndex + 1) % excerptElements.length;
    }

    function scrollTo(targetElement, container, highlightTarget = true)
    {
        if(!targetElement || targetElement.length == 0 || !container || container.length == 0) return;

        const topMargin = 100;
    
        // Calculate the relative position to the container using getBoundingClientRect()
        const targetRect = targetElement[0].getBoundingClientRect();
        const containerRect = container[0].getBoundingClientRect();
        let scrollTopPosition = container.scrollTop() + targetRect.top - containerRect.top - topMargin;
        //a hacky way to signify that if it's near the top, scroll all the way up
        if(scrollTopPosition < 50) scrollTopPosition = 0;
        
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
            .css('background-color', 'darkorange')
            .css('transform', 'scale(1.2)');
        
            // Remove the highlight effect after a short delay
            setTimeout(function () {
                targetElement.css('background-color', '');
                targetElement.css('transform', 'scale(1)');
            }, 1000); // Delay in milliseconds
        }
    }


    //---- TIMER ----//
    let seconds = 0;
    let minutes = 0;
    let hours = 0;
    let timerInterval;
    let submitReminderShown = false;
    let ieltslisteningTimer = $(".ielts-listening-timer strong");

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
            $('#ielts-listening-test-submit-button').click();
        });
    }

    function displayTime() {
        let secondsText = seconds < 10 ? '0' + seconds : seconds;
        let minutesText = minutes < 10 ? '0' + minutes : minutes;
        let hoursText = hours < 10 ? '0' + hours : hours;

        ieltslisteningTimer.text(`${hoursText}:${minutesText}:${secondsText}`);
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

    // For scheduled exams the server records the start while rendering the page and prints how many
    // seconds have already gone, so the clock can start immediately - see the note beside the hidden
    // input in the template. This used to be an admin-ajax round trip the timer waited on, which left
    // the clock frozen at the start of a timed exam. No value means no logged-in learner, so start at 0.
    var $scheduledExam = $('input[name="scheduled_exam_id"]');
    var scheduledElapsed = parseInt($scheduledExam.attr('data-elapsed'), 10);

    if ($scheduledExam.length && scheduledElapsed > 0) {
        hours   = Math.floor(scheduledElapsed / 3600);
        minutes = Math.floor((scheduledElapsed % 3600) / 60);
        seconds = scheduledElapsed % 60;
        displayTime();
    }

    startTimer();


    //--- HIGHLIGHT POPUP ----//
    const noteHighlightClass = 'note-highlight';
    const highlightPopup = $('#ielts-listening-highlight-popup');
    let selectedRange;
    let selectionDebounceTimer = null;
    // Touch devices (iPad/iPhone/Android) don't fire a usable mouseup for text selection, so detect them and use the selectionchange event instead.
    const isTouchHighlightDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    // Tracks whether the latest interaction was a finger (true) or a mouse (false), so behavior follows how the user is actually selecting rather than just what the device supports (matters on touch laptops / 2-in-1s used with a mouse).
    let lastPointerWasTouch = false;

    function showPopup(left, top) {
        highlightPopup.get(0).style.left = `${left}px`;
        highlightPopup.get(0).style.top = `${top}px`;
        highlightPopup.show();
    }

    function hideHighlightPopup() {
        if (selectionDebounceTimer) {
            clearTimeout(selectionDebounceTimer);
            selectionDebounceTimer = null;
        }
        highlightPopup.hide();
        window.getSelection().removeAllRanges();
        selectedRange = null;
    }

    function getTextNodesInRange(range) {
        const textNodes = [];
        const nodeIterator = document.createNodeIterator(range.commonAncestorContainer, NodeFilter.SHOW_TEXT);
        let currentNode = nodeIterator.nextNode();
    
        while (currentNode) {
            if (range.intersectsNode(currentNode) && currentNode.textContent.trim() != '') {
                textNodes.push(currentNode);
            }
            currentNode = nodeIterator.nextNode();
        }
    
        return textNodes;
    }
    
    //Should just use the mark.js library (I write this function before knowing about the library)
    function highlight(range) {
        const span = document.createElement('span');
        span.className = noteHighlightClass;
    
        const textNodes = getTextNodesInRange(range);

        for (let i = 0; i < textNodes.length; i++) {
            const currentNode = textNodes[i];
            const nodeRange = document.createRange();
    
            if (currentNode === range.startContainer && currentNode === range.endContainer) {
                nodeRange.setStart(currentNode, range.startOffset);
                nodeRange.setEnd(currentNode, range.endOffset);
            } else if (currentNode === range.startContainer) {
                nodeRange.setStart(currentNode, range.startOffset);
                nodeRange.setEnd(currentNode, currentNode.length);
            } else if (currentNode === range.endContainer) {
                nodeRange.setStart(currentNode, 0);
                nodeRange.setEnd(currentNode, range.endOffset);
            } else {
                nodeRange.selectNodeContents(currentNode);
            }
    
            // If the current node is already highlighted, move on to the next node
            if (currentNode.parentElement.className === noteHighlightClass) {
                continue;
            }
    
            const newNode = nodeRange.extractContents();
            let highlightNode = span.cloneNode();
            highlightNode.appendChild(newNode);
            nodeRange.insertNode(highlightNode);
        }
    }

    function dehighlight(range) {
        const textNodes = getTextNodesInRange(range);
        const highlightedNodes = textNodes.filter(node => node.parentElement.className === noteHighlightClass);

        highlightedNodes.forEach((highlightedNode) => {
            const highlightedParentElement = highlightedNode.parentElement;

            //since we manipulate dom elements inside this foreach, there are cases where the current highlight element with the same <span highlight> parent as the previous element is already processed in the previous loop.
            //Therefore, recheck to make sure the current highlightedNode is indead in a <span highlight> node
            if(highlightedParentElement.className !== noteHighlightClass)
            {
                return;
            }

            const highlightedParentRange = document.createRange();
            highlightedParentRange.selectNodeContents(highlightedParentElement);

            // Create range that covers the intersection of the selected range and the highlighted node
            const intersectionRange = document.createRange();

            const compareStartPoints = range.compareBoundaryPoints(Range.START_TO_START, highlightedParentRange);
            intersectionRange.setStart(compareStartPoints > 0 ? range.startContainer : highlightedParentRange.startContainer, compareStartPoints > 0 ? range.startOffset : highlightedParentRange.startOffset);

            const compareEndPoints = range.compareBoundaryPoints(Range.END_TO_END, highlightedParentRange);
            intersectionRange.setEnd(compareEndPoints < 0 ? range.endContainer : highlightedParentRange.endContainer, compareEndPoints < 0 ? range.endOffset : highlightedParentRange.endOffset);
    
            // Create the part before the intersection
            const beforeRange = document.createRange();
            beforeRange.setStart(highlightedParentRange.startContainer, highlightedParentRange.startOffset);
            beforeRange.setEnd(intersectionRange.startContainer, intersectionRange.startOffset);
            const beforeFragment = beforeRange.extractContents();
            const beforeSpan = document.createElement('span');
            beforeSpan.className = noteHighlightClass;
            beforeSpan.appendChild(beforeFragment);
    
            // Create the part after the intersection
            const afterRange = document.createRange();
            afterRange.setStart(intersectionRange.endContainer, intersectionRange.endOffset);
            afterRange.setEnd(highlightedParentRange.endContainer, highlightedParentRange.endOffset);
            const afterFragment = afterRange.extractContents();
            const afterSpan = document.createElement('span');
            afterSpan.className = noteHighlightClass;
            afterSpan.appendChild(afterFragment);
    
            // Insert the new parts before the original parent element
            if (beforeSpan.textContent.length > 0) {
                highlightedParentElement.parentNode.insertBefore(beforeSpan, highlightedParentElement);
            }

            // Insert the content of the intersection
            highlightedParentElement.parentNode.insertBefore(intersectionRange.extractContents(), highlightedParentElement);

            // Insert the new parts after the original parent element
            if (afterSpan.textContent.length > 0) {
                highlightedParentElement.parentNode.insertBefore(afterSpan, highlightedParentElement);
            }   
    
            // Remove the original parent <span> element
            highlightedParentElement.parentNode.removeChild(highlightedParentElement);
        });
    }

    function handleSelection() {
        const selection = window.getSelection();
        if (selection.rangeCount > 0 && !selection.isCollapsed) {
            const range = selection.getRangeAt(0);
            const parentNode = getParentNodeOfRange(range, '.ielts-listening-transcript, .ielts-listening-question-section');

            if (parentNode) {
                // Clone the range so it survives the selection being collapsed (which happens on touch when tapping the popup buttons).
                selectedRange = range.cloneRange();
                positionHighlightPopup(selectedRange);
            } else {
                highlightPopup.hide();
                selectedRange = null;
            }
        } else {
            highlightPopup.hide();
            selectedRange = null;
        }
    }

    function positionHighlightPopup(range) {
        if (lastPointerWasTouch) {
            // Anchor just below the selection, pushed down far enough to clear the native selection menu, which sits at the selection and is ~40-50px tall when it appears below (near the top of the screen).
            const bound = range.getBoundingClientRect();
            const parentRect = document.body.getBoundingClientRect();
            showPopup(bound.left - parentRect.left, (bound.bottom - parentRect.top) + 50);
        } else {
            const rangePosition = getRangePosition(range, document.body);
            showPopup(rangePosition.left, rangePosition.top - 45);
        }
    }

    // Track the input modality of the latest interaction (finger vs mouse).
    document.addEventListener('touchstart', function() { lastPointerWasTouch = true; }, { passive: true });
    document.addEventListener('mousedown', function() { lastPointerWasTouch = false; }, { passive: true });

    // Desktop / mouse: mouseup marks the end of a mouse selection.
    $(document).on('mouseup', handleSelection);

    // Touch (iPad/iPhone/Android): there is no reliable mouseup, and dragging the native selection handles doesn't fire DOM touch events, so listen to selectionchange (debounced until the user stops adjusting the selection). Bail while a mouse drag is in progress so the popup never pops mid-drag for mouse users on touch-capable laptops.
    if (isTouchHighlightDevice) {
        document.addEventListener('selectionchange', function() {
            if (!lastPointerWasTouch) return;
            if (selectionDebounceTimer) clearTimeout(selectionDebounceTimer);
            selectionDebounceTimer = setTimeout(handleSelection, 250);
        });
    }

    function getParentNodeOfRange(range, classNames) {
        let parentNode = null;
        const selectedNode = range.commonAncestorContainer;
        const parentNodes = $(selectedNode).closest(classNames);
        if (parentNodes.length > 0) parentNode = parentNodes.get(0);
        return parentNode;
    }

    $('#ielts-listening-highlight-button').on('click', function() {
        if (selectedRange) {
            highlight(selectedRange);
            hideHighlightPopup();
        }
    });

    $('#ielts-listening-dehighlight-button').on('click', function() {
        if (selectedRange) {
            dehighlight(selectedRange);
            hideHighlightPopup();
        }
    });

    // --- NOTE ---//
    $('#ielts-listening-note-button').on('click', function () {
        if (selectedRange) {
            // Add a note button on top of the selected text
            const noteButton = addNoteButton(selectedRange);

            if(!noteButton) return;

            // Create a note element
            const noteElem = document.createElement('div');
            noteElem.className = 'ielts-listening-small-note-section';

            // Create a container for the note content
            const noteContent = document.createElement('div');
            noteContent.contentEditable = true;
            noteContent.className = 'ielts-listening-small-note-content';
            noteElem.appendChild(noteContent);

            // Add a delete button to the note element
            const deleteButton = document.createElement('button');
            deleteButton.type = 'button';
            deleteButton.innerHTML = 'Delete';
            deleteButton.className = 'ielts-listening-delete-note-button';
            deleteButton.addEventListener('click', (event) => {
                event.stopPropagation();
                document.body.removeChild(noteElem);
                noteButton.parentElement.removeChild(noteButton);
            });
            noteElem.appendChild(deleteButton);

            // Add a close button to the note element
            const closeButton = document.createElement('button');
            closeButton.type = 'button';
            closeButton.innerHTML = 'x';
            closeButton.className = 'ielts-listening-close-note-button';
            closeButton.addEventListener('click', (event) => {
                event.stopPropagation();
                noteElem.style.display = 'none';
            });
            noteElem.appendChild(closeButton);

            // Attach the note element to the body
            document.body.appendChild(noteElem);

            // Make the noteElem draggable
            noteElem.addEventListener('mousedown', (event) => {
                // Check if the click target is not the contentEditable element or its children
                if (!event.target.closest('.ielts-listening-small-note-content')) {
                    event.preventDefault();
            
                    const initialX = event.clientX - noteElem.offsetLeft;
                    const initialY = event.clientY - noteElem.offsetTop;
            
                    const onMouseMove = (event) => {
                        noteElem.style.left = (event.clientX - initialX) + 'px';
                        noteElem.style.top = (event.clientY - initialY) + 'px';
                    };
            
                    const onMouseUp = () => {
                        document.removeEventListener('mousemove', onMouseMove);
                        document.removeEventListener('mouseup', onMouseUp);
                    };
            
                    document.addEventListener('mousemove', onMouseMove);
                    document.addEventListener('mouseup', onMouseUp);
                }
            });

            // Make the noteElem draggable on touch devices (iPad/iPhone/Android)
            noteElem.addEventListener('touchstart', (event) => {
                if (!event.target.closest('.ielts-listening-small-note-content')) {
                    const touch = event.touches[0];
                    const initialX = touch.clientX - noteElem.offsetLeft;
                    const initialY = touch.clientY - noteElem.offsetTop;

                    const onTouchMove = (e) => {
                        e.preventDefault();
                        const t = e.touches[0];
                        noteElem.style.left = (t.clientX - initialX) + 'px';
                        noteElem.style.top = (t.clientY - initialY) + 'px';
                    };

                    const onTouchEnd = () => {
                        document.removeEventListener('touchmove', onTouchMove);
                        document.removeEventListener('touchend', onTouchEnd);
                        document.removeEventListener('touchcancel', onTouchEnd);
                    };

                    document.addEventListener('touchmove', onTouchMove, { passive: false });
                    document.addEventListener('touchend', onTouchEnd);
                    document.addEventListener('touchcancel', onTouchEnd);
                }
            }, { passive: true });

            // Show the note when the note button is clicked
            noteButton.addEventListener('click', (event) => {
                event.stopPropagation();
                noteElem.style.display = noteElem.style.display === 'none' ? 'block' : 'none';

                // Update the note's position to be below the note button
                const buttonRect = noteButton.getBoundingClientRect();
                noteElem.style.left = buttonRect.left + 'px';
                noteElem.style.top = (buttonRect.bottom + 5) + 'px';
            });

            // Hide the note when clicking outside
            document.addEventListener('click', (event) => {
                //check to prevent the case when we click on the note itself, the note doesn't disappear
                if (!event.target.closest('.ielts-listening-small-note-section')) {
                    noteElem.style.display = 'none';
                }
            });

            //display the note right away
            // Use setTimeout to ensure the layout is fully loaded
            setTimeout(() => {
                noteButton.click();
            }, 0);

            //highlight
            highlight(selectedRange);
            hideHighlightPopup();
        }
    });

    // Route taps on the highlight popup buttons to their click handlers. touchstart + preventDefault keeps the text selection alive (so selectedRange stays valid) and prevents the duplicate "ghost" click that touch would otherwise generate.
    ['#ielts-listening-highlight-button', '#ielts-listening-dehighlight-button', '#ielts-listening-note-button'].forEach(function(selector) {
        const button = document.querySelector(selector);
        if (button) {
            button.addEventListener('touchstart', function(e) {
                e.preventDefault();
                // Re-capture the selection synchronously so the action uses the latest range, not a possibly-stale debounced snapshot (e.g. if the user nudged a selection handle just before tapping).
                handleSelection();
                this.click();
            }, { passive: false });
        }
    });

    function getRangePosition(range, parent) {
        const rects = range.getClientRects();
        const rangeRect = rects[0];

        const parentRect = parent.getBoundingClientRect();

        if(!rangeRect || !parentRect) {
            return { left: 0, top: 0 };
        }
    
        const left = rangeRect.left - parentRect.left;
        const top = rangeRect.top - parentRect.top;

        return { left: left, top: top };
    }
    
    function addNoteButton(range) {
        if (range) {

            let noteButtonParent = getParentNodeOfRange(range, '.ielts-listening-transcript, .ielts-listening-question-section');

            if(!noteButtonParent) {
                noteButtonParent = document.body;
            }

            const buttonPosition = getRangePosition(range, noteButtonParent);

            const noteButton = document.createElement('button');
            noteButton.type = 'button';
            noteButton.className = 'ielts-listening-small-note-button';
            noteButton.innerHTML = '<i class="fa-solid fa-note-sticky"></i>';
    
            noteButton.style.left = `${buttonPosition.left + 20}px`; //for some reasons, getBoundingClientRect of getRangePosition doesn't take into account padding of the parent of the parent element. Temporary hard code like this.
            noteButton.style.top = `${buttonPosition.top}px`;
            
            noteButtonParent.appendChild(noteButton);
    
            return noteButton;
        } else {
            console.error('No selection found');
            return null;
        }
    }

    //--- SECTION START TIME BUTTON ---//
    $('.ielts-listening-section-start-time-button').on('click', function(e) {
        e.preventDefault();
        const startTime = timeToSeconds($(this).data('start-time'));
        if(startTime >= 0)
        {
            const audioElement = $('#ielts-listening-test-audio-'+currentPart).get(0);
            audioElement.currentTime = startTime;
            audioElement.play();
        }
    });

    //--- SECTION PRACTICE: clamp audio to just this section's window ---//
    // Reuses the click-to-play alignment: the section's evidence = the transcript
    // sentences that SURVIVE the trim (not inside a collapsed paragraph), and
    // their data-start/data-end give the window. The clamp stays live in review
    // too (not just during the test) — a section practice should keep the audio
    // on its section; the "Play full part" button is the escape hatch when the
    // learner wants to hear (and click-to-play) the rest of the part. Built by
    // the deferred load hook OR on first play (whichever comes first) so playing
    // immediately still jumps to the window.
    let sectionClampReady = false;
    // Module-level so the section-practice bar toggle (bound below, independently
    // of the audio clamp) can drive the clamp — and so the transcript reveal still
    // works when the clamp can't be built (a part with no timestamped transcript).
    let sectionClampedByToggle = true;   // true = clamped to just this section
    let sectionClampSeekToStart = null;  // set to the seek fn once the clamp is built
    function setupSectionAudioClamp() {
        if (sectionClampReady) return;
        if (!$('.ielts-listening-transcript-collapsed').length) return; // not a trimmed section
        // The user may press play before the deferred alignment ran — align now.
        if (!$('.ielts-listening-transcript .ielts-listening-sentence[data-start]').length) {
            alignAndWrapTranscriptSentences();
        }
        const $audio = $('audio[id^="ielts-listening-test-audio-"]').first();
        if (!$audio.length) return;
        const audio = $audio.get(0);

        let lo = Infinity, hi = -Infinity;
        $('.ielts-listening-transcript .ielts-listening-sentence[data-start]').each(function () {
            if ($(this).closest('.ielts-listening-transcript-collapsed').length) return; // skip collapsed
            const s = parseFloat(this.dataset.start), e = parseFloat(this.dataset.end);
            if (!isNaN(s)) lo = Math.min(lo, s);
            if (!isNaN(e)) hi = Math.max(hi, e);
        });
        if (lo === Infinity || hi <= lo) return; // alignment not ready yet -> retry on next play

        sectionClampReady = true;
        const winStart = Math.max(0, lo - 4);
        const winEnd   = hi + 2;
        // Live whenever the section clamp hasn't been toggled off via "Play full
        // part" — during the test AND in review (kept clamped by user preference).
        const active = function () { return sectionClampedByToggle; };

        function seekToStart() { try { if (audio.currentTime < winStart - 0.3 || audio.currentTime >= winEnd) audio.currentTime = winStart; } catch (e) {} }
        // Keep playback inside the window. Starting or seeking BEFORE it -> jump
        // to the start (into the section); going PAST the end -> stop at the end
        // (more intuitive than rewinding to the start). Used by BOTH 'play' and
        // 'seeked' so the outcome is identical no matter which fires first — in
        // this player a scrubber click also fires 'play', so if 'play' still
        // treated "past the end" as "restart" it would override the seek and
        // rewind to the start. The +/- guards make our own corrective seeks land
        // back inside the window so this never re-fires on itself.
        function clampToWindow() {
            try {
                if (audio.currentTime < winStart - 0.3) { audio.currentTime = winStart; }
                else if (audio.currentTime > winEnd + 0.1) { audio.currentTime = winEnd; audio.pause(); }
            } catch (e) {}
        }
        audio.addEventListener('play', function () { if (active()) clampToWindow(); });
        audio.addEventListener('timeupdate', function () { if (active() && audio.currentTime >= winEnd) audio.pause(); });
        audio.addEventListener('seeked', function () { if (active()) clampToWindow(); });

        // Expose the seek so the bar toggle (bound independently below) can jump
        // back to the section's start when the learner returns to section mode.
        sectionClampSeekToStart = seekToStart;

        // If we were built mid-playback (play pressed before the window existed),
        // seek now — the play listener above won't fire for that in-flight event.
        if (active()) seekToStart();
    }

    // Build the clamp on the very first play too, so playing immediately (before
    // the ~0.5s deferred alignment) still jumps to the section's window.
    $('audio[id^="ielts-listening-test-audio-"]').each(function () {
        this.addEventListener('play', function () { if (!sectionClampReady) setupSectionAudioClamp(); });
    });

    //--- SECTION PRACTICE: the "Play full part" bar + toggle ---//
    // Bound to the TRANSCRIPT collapse (not the audio clamp), so the transcript is
    // always revealable in review even when the audio window can't be derived
    // (e.g. a part with no timestamped transcript). Mirrors reading's unconditional
    // "Show full passage" bar. The single toggle flips BOTH the transcript reveal
    // and — when the clamp exists — the audio clamp (they're one concept: focus on
    // this section vs. the whole part). Replaces the old separate transcript button.
    if ($('.ielts-listening-transcript-collapsed').length) {
        $('.ielts-listening-section-practice-bar').show();
        $(document).on('click', '.ielts-listening-play-full-part-button', function () {
            const $btn = $(this);
            const toFull = $btn.attr('data-state') === 'section';
            $btn.attr('data-state', toFull ? 'full' : 'section')
                .text(toFull ? 'Play this section only' : 'Play full part');
            $('.ielts-listening-transcript').toggleClass('show-full-transcript', toFull);
            sectionClampedByToggle = !toFull;
            if (!toFull && sectionClampSeekToStart) sectionClampSeekToStart();
        });
    }

    function timeToSeconds(timeString) {
        if(!timeString) return -1;
        var timeParts = timeString.split(":");
        var hours = parseInt(timeParts[0], 10) || 0;
        var minutes = parseInt(timeParts[1], 10) || 0;
        var seconds = parseInt(timeParts[2], 10) || 0;
        return hours * 3600 + minutes * 60 + seconds;
    }

    //--- PRESS-PLAY HINT: a part's audio starts stopped, so its hint shows until it first plays ---//
    $('audio[id^="ielts-listening-test-audio-"]').on('play', function() {
        $(this).closest('.ielts-listening-part-announcement').removeClass('is-waiting');
    });

    //--- STOP OTHER AUDIO WHEN AN AUDIO IS PLAYED ---//
    $('audio[id^="ielts-listening-test-audio-"]').on('play', function() {
        $('audio[id^="ielts-listening-test-audio-"]').not(this).each(function() {
            this.pause();
        });
    });

    //--- LEARNER SERVER PROGRESS ---//
    var loadLearnerServerProgress = false;
    loadLearnerServerProgress = new URLSearchParams(window.location.search).get('load-learner-progress');
    if(loadLearnerServerProgress) {
        //A review is a stripped-down view of the test, whether it is embedded or opened in its own
        //tab: no site chrome, and no live-test controls since nothing is being timed.
        $('.announcement-bar').hide();
        $('.site-footer').hide();
        $('.ielts-listening-site-header').hide();
        $('.ielts-listening-skimming-button-container').hide();
        $('.ielts-listening-timer').hide();
        //the submit button stays VISIBLE here on purpose: the review only restores the learner's
        //answers, and marking them is now an explicit click rather than an automatic re-grade

        //tell the learner where they are - the page otherwise looks exactly like a fresh attempt.
        //The exit link is this same URL minus the progress param, so a custom test keeps the parts
        //that define it and simply reopens unanswered. Built with .attr() rather than string
        //concatenation so a custom title in the query string cannot break out of the href.
        var exitReviewUrl = new URL(window.location.href);
        exitReviewUrl.searchParams.delete('load-learner-progress');
        //Focus mode covers the page header, so carry the test title into the banner - otherwise
        //the learner cannot tell which test they are looking at. Drop the "(Online Test)" tag and
        //set it with .text() so the title is never treated as markup.
        var reviewTestTitle = $('.ielts-listening-page-header h1').first()
            .clone().find('.ielts-online-test-tag').remove().end().text().trim();

        var $reviewBanner = $('<div class="ielts-review-mode-banner"></div>');
        if (reviewTestTitle !== '') {
            $reviewBanner.append($('<div class="ielts-review-mode-title"></div>').text(reviewTestTitle));
        }
        $reviewBanner
            .append($('<div>' +
                          '<strong>Review mode</strong> &mdash; your previous answers are shown below. ' +
                          'Submit to view your marked results. ' +
                          'Your saved result will not be affected.' +
                      '</div>'))
            //Review mode hides the menu and the header that hold the other Export buttons, so the
            //banner carries its own. It uses the same class, so the export handler further down binds to it.
            .append($('<div class="ielts-review-mode-export">' +
                          '<a href="#" class="ielts-listening-export-pdf-link ielts-listening-export-pdf-header-btn"><i class="fa-solid fa-file-pdf"></i> Export as PDF</a>' +
                      '</div>'))
            .append($('<a class="ielts-review-mode-exit"></a>')
                .attr('href', exitReviewUrl.toString())
                .text('Exit review mode and take this test again'));

        $('.ielts-listening-test-container').prepend($reviewBanner);

        //Focus mode strips the page down to the test itself, which is what a review wants. It has
        //to run on the next tick: focusState is declared with `let` further down this file, so
        //reaching it now would hit the temporal dead zone, and the button's own click handler is
        //not bound yet either. Going through the button keeps focusState in sync, so Escape still exits.
        setTimeout(function () { $('#ielts-listening-focus-mode-button').click(); }, 0);

        try {
            var learnerAnswers = JSON.parse(loadLearnerServerProgress);
            populateLearnerProgress(learnerAnswers);
        } catch (error) {
            console.error("Error loading learner server progress:", error);
            alert('Error loading your results!');
        }
    }

    function populateLearnerProgress(learnerAnswers){
        //set learner answers to the questions
        for(var i = 0; i < learnerAnswers.length; i++) {
            var learnerAnswer = learnerAnswers[i];
            var questionNumber = i + 1;

            var questionItem = $('#ielts-listening-question-number-' + questionNumber).closest('.ielts-listening-question-item');
            if(questionItem.length > 0) {
                var $zone = questionItem.find('.dnd-zone').first();
                if ($zone.length) {
                    if (learnerAnswer) assignToZone($zone, learnerAnswer);
                }
                else if(questionItem.find('input[type="radio"]').length > 0) {
                    questionItem.find('input[type="radio"][value="' + learnerAnswer + '"]').prop('checked', true);
                }
                else if(questionItem.find('input[type="checkbox"]').length > 0) {
                    questionItem.find('input[type="checkbox"][value="' + learnerAnswer + '"]').prop('checked', true);
                }
                else if(questionItem.find('select').length > 0) {
                    questionItem.find('select').val(learnerAnswer);
                }
                else {
                    questionItem.find('input[type="text"]').val(learnerAnswer);
                }
            }
        }

        //trigger the change event for all the input fields so that it updates the preview table and question palette. It also helps with some formatting issues
        $('input[name^="ielts_listening_answer_"], select[name^="ielts_listening_answer_"]').trigger('change');
    }

    //--- LEARNER LOCAL PROGRESS ---//
    function debounce(fn, delay) {
        let timeoutID = null;
        return function () {
            clearTimeout(timeoutID);
            var args = arguments;
            var that = this;
            timeoutID = setTimeout(function () {
                fn.apply(that, args);
            }, delay);
        };
    }
    // Local-draft storage key: path + ONLY the params that identify which test/section is being practiced.
    // Section/custom practice all runs on the same 'custom' sentinel path, so its identity lives in the query
    // (?src_test=&section= / ?p_tests=). Whitelisting these keeps a full test's draft intact when unrelated
    // params (utm_*, fbclid, …) get appended, while still isolating each section/custom practice.
    function getUniqueTestKey() {
        var params = new URLSearchParams(window.location.search);
        var identityKeys = ['type', 'scheduled_exam_id', 'src_test', 'section', 'p_tests',
                            'p1_test', 'p2_test', 'p3_test', 'p4_test', 'p1_part', 'p2_part', 'p3_part', 'p4_part'];
        var idParts = [];
        identityKeys.forEach(function(k) {
            if (params.has(k)) idParts.push(k + '=' + params.get(k));
        });
        return window.location.pathname + (idParts.length ? '?' + idParts.join('&') : '');
    }
    function saveLearnerLocalProgress() {
        var uniqueTestKey = getUniqueTestKey();

        //build an array of local learner answers. loop through the answers from the preview table
        var learnerLocalProgress = [];
        $('.ielts-listening-preview-table-body .ielts-listening-preview-item').each(function() {
            var userAnswer = $(this).find('.ielts-listening-user-answer').text();
            learnerLocalProgress.push(userAnswer);
        });

        localStorage.setItem(uniqueTestKey, JSON.stringify(learnerLocalProgress));
    }
    var debouncedSaveLearnerLocalProgress = debounce(saveLearnerLocalProgress, 1000);

    function loadLearnerLocalProgressIfExists() {
        var uniqueTestKey = getUniqueTestKey();
        var learnerLocalProgress = localStorage.getItem(uniqueTestKey);
        if(learnerLocalProgress) {
            var $popup = $('<div></div>').css({
                position: 'fixed',
                bottom: '10px',
                left: '10px',
                backgroundColor: 'white',
                border: '1px solid black',
                padding: '10px',
                zIndex: 99999,
                boxShadow: '0px 8px 16px 0px rgba(0,0,0,0.2)',
                borderRadius: '5px',
                fontSize: '18px',
                lineHeight: '1.6',
            }).html("Would you like to restore your answers?");

            var $yesButton = $('<button>Yes</button>').css({
                fontSize: '20px',
                padding: '5px 15px',
                backgroundColor: 'green',
                marginLeft: '10px'
            });

            var $noButton = $('<button>No, delete them</button>').css({
                fontSize: '12px',
                padding: '5px 10px',
                backgroundColor: 'red',
                marginLeft: '10px'
            });

            var $closeButton = $('<button>X</button>').css({
                fontSize: '12px',
                padding: '0px',
                width: '20px',
                height: '20px',
                backgroundColor: 'white',
                color: 'black',
                border: '1px solid black',
                borderRadius: '50%',
                cursor: 'pointer',
                position: 'absolute',
                top: '-10px',
                right: '-10px',
            });

            $popup.append($yesButton, $noButton, $closeButton);

            $popup.addClass('restore-progress-popup');
            $('body').append($popup);

            $yesButton.click(function() {
                try {
                    learnerLocalProgress = JSON.parse(learnerLocalProgress);
                    populateLearnerProgress(learnerLocalProgress);
                    $popup.hide();
                } catch (error) {
                    console.error("Error loading local learner progress:", error);
                    alert('Error loading local learner progress!');
                }
            });

            $noButton.click(function() {
                localStorage.removeItem(uniqueTestKey);
                $popup.hide();
            });

            $closeButton.click(function() {
                $popup.hide();
            });

            $popup.show();
        }
    }

    //only call this function on load if we don't currently load server progress
    if(!loadLearnerServerProgress) {
        loadLearnerLocalProgressIfExists();
    }

    //--- FOCUS MODE ---//
    let focusState = 'normal'; // 'normal', 'focus', or 'fullscreen'

    // Handle focus mode toggle
    $('#ielts-listening-focus-mode-button').on('click', function() {
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
        $(".ielts-listening-test-container").addClass('ielts-listening-focus-mode');
        $("#ielts-listening-focus-mode-button").html('<i class="fa-solid fa-maximize"></i> Fullscreen');
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
        $(".ielts-listening-test-container").addClass('ielts-listening-focus-mode');
        $("#ielts-listening-focus-mode-button").html('<i class="fa-solid fa-compress"></i> Exit');
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
        $(".ielts-listening-test-container").removeClass('ielts-listening-focus-mode');
        $("#ielts-listening-focus-mode-button").html('<i class="fa-solid fa-expand"></i> Focus');
    }

    // Handle fullscreen and focus mode
    $(document).on('keydown', function(e) {
        // Check for F11 (Windows/Linux) or Mac fullscreen shortcuts (Ctrl+Cmd+F)
        if (e.key === 'F11' || (e.key === 'f' && e.ctrlKey && e.metaKey)) {
            e.preventDefault(); // Prevent default browser behavior
            
            $('#ielts-listening-focus-mode-button').click();
        }
        // Handle Escape key for focus mode
        else if (e.key === 'Escape') {
            exitFocusMode();
        }
    });

    //--- EXPORT PDF ---//
    var answerKeyData = null;

    function buildAnswerKeySection(answerKey) {
        var $section = $('<div class="ielts-listening-print-answer-key"></div>');
        $section.append('<h2>Answer Key</h2>');
        var $table = $('<table class="ielts-listening-answer-key-table"><thead><tr><th>#</th><th>Answer</th><th>Explanation</th></tr></thead></table>');
        var $tbody = $('<tbody></tbody>');
        $.each(answerKey, function(_, item) {
            var $row = $('<tr></tr>');
            $row.append('<td>' + item.number + '</td>');
            $row.append('<td>' + (item.answer || '—') + '</td>');
            $row.append('<td>' + (item.explanation || '') + '</td>');
            $tbody.append($row);
        });
        $table.append($tbody);
        $section.append($table);
        return $section;
    }

    $('.ielts-listening-export-pdf-link').on('click', function(e) {
        e.preventDefault();

        var limitMessage = checkOrSaveRateLimit('get_ielts_listening_test_answer_key');
        if (limitMessage) {
            alert(limitMessage);
            $('.payment-popup-container').css('display', 'flex');
            return;
        }

        var $spinnerText = $('.spinner-overlay strong');
        var originalSpinnerText = $spinnerText.text();
        $spinnerText.text('Preparing PDF...');
        $('.spinner-overlay').css('display', 'flex');

        var formData = {
            action:                      'get_ielts_listening_test_answer_key',
            ielts_listening_test_nonce:  $('[name="ielts_listening_test_nonce"]').val(),
            post_id:                     $('#post_id').val(),
            is_section_test:             $('[name="is_section_test"]').val() || '',
            src_test:                    $('[name="src_test"]').val() || '',
            section:                     $('[name="section"]').val() || '',
            is_custom_test:              $('[name="is_custom_test"]').val() || '',
            p1_test:                     $('[name="p1_test"]').val() || '',
            p1_part:                     $('[name="p1_part"]').val() || '',
            p2_test:                     $('[name="p2_test"]').val() || '',
            p2_part:                     $('[name="p2_part"]').val() || '',
            p3_test:                     $('[name="p3_test"]').val() || '',
            p3_part:                     $('[name="p3_part"]').val() || '',
            p4_test:                     $('[name="p4_test"]').val() || '',
            p4_part:                     $('[name="p4_part"]').val() || '',
        };

        $.post(single_ielts_listening_test_ajax.ajaxurl, formData, function(response) {
            $('.spinner-overlay').hide();
            $spinnerText.text(originalSpinnerText);

            if (response.success) {
                answerKeyData = response.data.answer_key;
                window.print();
            } else if (response.data && response.data['error'] == 'rate_limit_exceeded') {
                alert(checkOrSaveRateLimit('get_ielts_listening_test_answer_key', response.data['retry_after']));
                $('.payment-popup-container').css('display', 'flex');
            } else if (response.data && response.data['error'] == 'user_not_verified') {
                $('.fast-verification-popup-container').css('display', 'flex');
            } else {
                alert('Could not load answer key. Please try again.');
            }
        }).fail(function() {
            $('.spinner-overlay').hide();
            $spinnerText.text(originalSpinnerText);
            alert('Something went wrong. Please try again.');
        });
    });

    window.onbeforeprint = function() {
        var submitted = learnerResults !== null;

        // Collect select values from originals before cloning (clone doesn't reliably copy selectedIndex)
        var selectValues = {};
        $('select').each(function() {
            if (this.name) {
                selectValues[this.name] = this.selectedIndex > 0 ? this.options[this.selectedIndex].text : '';
            }
        });

        var $printContainer = $('<div class="ielts-listening-print-container"></div>');

        if (submitted) {
            var bandScore = $('.ielts-listening-band-score').first().text();
            var timeText = $('.ielts-listening-timer').first().text().trim();
            var bandColor = $('.ielts-listening-band-score').first().css('color');
            var $summary = $('<div class="ielts-print-result-summary"></div>');
            if (bandScore) {
                $summary.append('<span class="ielts-print-band-score" style="color:' + bandColor + '">' + bandScore + '</span>');
            }
            if (timeText) {
                $summary.append('<span class="ielts-print-time-taken">' + timeText + '</span>');
            }
            $printContainer.append($summary);
        }

        // Question sections — add part label + audio link dynamically at the top of each
        var partCount = $('.ielts-listening-question-section').length;
        for (var i = 1; i <= partCount; i++) {
            var $section = $('#ielts-listening-question-section-' + i).clone();
            var $label = $('<div class="print-part-label">Part ' + i + ' — Questions</div>');
            var audioSrc = $('#ielts-listening-test-audio-' + i + ' source').attr('src');
            if (audioSrc) {
                $label.after($('<div class="ielts-listening-print-audio-link"><i class="fa-solid fa-headphones"></i> Part ' + i + ' Audio: <a href="' + audioSrc + '">' + audioSrc + '</a></div>'));
                $section.prepend($label.next()).prepend($label);
            } else {
                $section.prepend($label);
            }
            $printContainer.append($section);
        }

        // Transcripts section before answer key
        var $transcripts = $('.ielts-listening-transcript');
        if ($transcripts.length > 0) {
            var $transcriptSection = $('<div class="ielts-listening-print-transcripts"></div>');
            $transcriptSection.append('<h2 class="ielts-listening-print-section-heading">Transcripts</h2>');
            $transcripts.each(function(index) {
                var $t = $(this).clone();
                $transcriptSection.append('<h3 class="ielts-listening-print-transcript-heading">Part ' + (index + 1) + '</h3>');
                $transcriptSection.append($t);
            });
            $printContainer.append($transcriptSection);
        }

        // Clear inputs on clones for not-submitted case (never touch originals)
        if (!submitted) {
            $printContainer.find('input[type="text"]').val('');
            $printContainer.find('input[type="radio"], input[type="checkbox"]').prop('checked', false);
            $printContainer.find('.dnd-zone').each(function() {
                $(this).find('input[type="hidden"]').val('');
                $(this).find('.dnd-drop-value').hide();
                $(this).removeClass('dnd-drop-zone-filled').removeAttr('draggable');
            });
        }

        // Replace select elements with text spans in the print container
        $printContainer.find('select').each(function() {
            var selectedText = this.name ? (selectValues[this.name] || '') : '';
            if (submitted && selectedText) {
                $(this).replaceWith('<span class="ielts-print-select-value">' + selectedText + '</span>');
            } else {
                $(this).replaceWith('<span class="ielts-print-select-empty"></span>');
            }
        });

        if (answerKeyData && answerKeyData.length > 0) {
            $printContainer.append(buildAnswerKeySection(answerKeyData));
        }

        $('.ielts-listening-test-container').addClass('ielts-listening-print-hidden');
        $('body').children().not('.ielts-listening-print-container, #page').addClass('ielts-listening-print-hidden');
        $('.ielts-listening-page-header').after($printContainer);
    };

    window.onafterprint = function() {
        $('.ielts-listening-print-container').remove();
        $('.ielts-listening-print-hidden').removeClass('ielts-listening-print-hidden');
        answerKeyData = null;
    };

    //--- DRAG AND DROP QUESTION ITEMS ---//
    // Each panel/zone is tagged with data-dnd-group="<section_id>" so multiple
    // DnD sections on one page (which may share label values like A, B, C) stay isolated.
    function getZonePanel($zone) {
        var group = $zone.attr('data-dnd-group');
        if (group) return $('.dnd-panel[data-dnd-group="' + group + '"]');
        return $zone.closest('.ielts-listening-question-section').find('.dnd-panel').first();
    }

    function assignToZone($zone, value) {
        var oldValue = $zone.find('input[type="hidden"]').val();
        var $panel = getZonePanel($zone);
        if (oldValue) freeCard($panel, oldValue);

        var $card = $panel.find('.dnd-card[data-value="' + value + '"]');
        var allowDuplicates = $panel.data('allow-duplicates') === true;
        var isZoneToZone = $dragSourceZone && $dragSourceZone[0] !== $zone[0];

        if (!allowDuplicates) {
            var group = $zone.attr('data-dnd-group');
            var $peerZones = group
                ? $('.dnd-zone[data-dnd-group="' + group + '"]').not($zone)
                : $zone.closest('.ielts-listening-question-section').find('.dnd-zone').not($zone);
            $peerZones.each(function() {
                if ($(this).find('input[type="hidden"]').val() === value) {
                    removeFromZone($(this), false);
                }
            });
        } else if (isZoneToZone) {
            removeFromZone($dragSourceZone, false);
        }

        var displayText = $card.data('text') || value;

        $zone.find('input[type="hidden"]').val(value);
        $zone.find('.dnd-drop-placeholder').hide();
        $zone.find('.dnd-drop-value').text(displayText).show();
        $zone.addClass('dnd-drop-zone-filled').attr('draggable', 'true');
        if (!allowDuplicates) $card.addClass('dnd-card-used');
        $zone.find('input[type="hidden"]').trigger('change');
    }

    function removeFromZone($zone, triggerChange) {
        var value = $zone.find('input[type="hidden"]').val();
        if (!value) return;
        var $panel = getZonePanel($zone);
        $zone.find('input[type="hidden"]').val('');
        $zone.find('.dnd-drop-placeholder').show();
        $zone.find('.dnd-drop-value').text('').hide();
        $zone.removeClass('dnd-drop-zone-filled').removeAttr('draggable');
        freeCard($panel, value);
        if (triggerChange !== false) $zone.find('input[type="hidden"]').trigger('change');
    }

    function freeCard($panel, value) {
        $panel.find('.dnd-card[data-value="' + value + '"]').removeClass('dnd-card-used');
    }

    var $dragSourceZone = null;

    $(document).on('dragstart', '.dnd-card', function(e) {
        e.originalEvent.dataTransfer.setData('text/plain', $(this).data('value'));
        $(this).addClass('dnd-card-dragging');
        $dragSourceZone = null;
    });

    $(document).on('dragend', '.dnd-card', function() {
        $(this).removeClass('dnd-card-dragging');
        $('.dnd-zone').removeClass('dnd-drop-zone-over');
    });

    $(document).on('dragstart', '.dnd-zone', function(e) {
        var value = $(this).find('input[type="hidden"]').val();
        if (!value) { e.preventDefault(); return; }
        e.originalEvent.dataTransfer.setData('text/plain', value);
        $dragSourceZone = $(this);
    });

    $(document).on('dragend', '.dnd-zone', function() {
        $dragSourceZone = null;
        $('.dnd-zone').removeClass('dnd-drop-zone-over');
    });

    $(document).on('dragover', '.dnd-zone', function(e) {
        e.preventDefault();
        $(this).addClass('dnd-drop-zone-over');
    });

    $(document).on('dragleave', '.dnd-zone', function() {
        $(this).removeClass('dnd-drop-zone-over');
    });

    $(document).on('drop', '.dnd-zone', function(e) {
        e.preventDefault();
        $(this).removeClass('dnd-drop-zone-over');
        var value = e.originalEvent.dataTransfer.getData('text/plain');
        if (value) assignToZone($(this), value);
        $dragSourceZone = null;
    });

    $(document).on('dragover', '.dnd-panel', function(e) {
        if ($dragSourceZone) e.preventDefault();
    });

    $(document).on('drop', '.dnd-panel', function(e) {
        e.preventDefault();
        if ($dragSourceZone) {
            removeFromZone($dragSourceZone);
            $dragSourceZone = null;
        }
    });

    // Touch / click-to-select-then-assign for mobile
    var $selectedCard = null;

    $(document).on('click', '.dnd-card', function() {
        if ($selectedCard && $selectedCard[0] === this) {
            $selectedCard.removeClass('dnd-card-selected');
            $selectedCard = null;
            return;
        }
        if ($selectedCard) $selectedCard.removeClass('dnd-card-selected');
        $selectedCard = $(this);
        $selectedCard.addClass('dnd-card-selected');
    });

    $(document).on('click', '.dnd-zone', function() {
        if (!$selectedCard || !$selectedCard.closest('.dnd-panel').length) return;
        assignToZone($(this), $selectedCard.data('value'));
        $selectedCard.removeClass('dnd-card-selected');
        $selectedCard = null;
    });

    $(document).on('dblclick', '.dnd-zone', function() {
        if ($selectedCard) return;
        removeFromZone($(this));
    });

    //--- TOUCH DRAG-AND-DROP (mobile / iPad) ---//
    var touchValue = null;
    var $touchSourceZone = null;
    var $touchGhost = null;
    var $touchOverZone = null;

    function startTouchGhost($el, x, y) {
        var rect = $el[0].getBoundingClientRect();
        $touchGhost = $('<div></div>')
            .html($el.html())
            .css({
                position: 'fixed',
                left: rect.left + 'px',
                top: rect.top + 'px',
                width: rect.width + 'px',
                padding: '8px 12px',
                border: '1px solid #4285f4',
                borderRadius: '4px',
                backgroundColor: '#fff',
                opacity: 0.85,
                pointerEvents: 'none',
                zIndex: 100000,
                boxShadow: '0 2px 6px rgba(0,0,0,0.2)'
            })
            .appendTo('body');
        moveTouchGhost(x, y);
    }

    function moveTouchGhost(x, y) {
        if (!$touchGhost) return;
        $touchGhost.css({
            left: (x - $touchGhost.outerWidth() / 2) + 'px',
            top: (y - 20) + 'px'
        });
    }

    function endTouchDrag() {
        if ($touchGhost) { $touchGhost.remove(); $touchGhost = null; }
        if ($touchOverZone) { $touchOverZone.removeClass('dnd-drop-zone-over'); $touchOverZone = null; }
        $('.dnd-card-dragging').removeClass('dnd-card-dragging');
        touchValue = null;
        $touchSourceZone = null;
        $dragSourceZone = null;
    }

    $(document).on('touchstart', '.dnd-card', function(e) {
        if ($(this).hasClass('dnd-card-used')) return;
        var t = e.originalEvent.touches[0];
        touchValue = $(this).data('value');
        $touchSourceZone = null;
        $(this).addClass('dnd-card-dragging');
        startTouchGhost($(this), t.clientX, t.clientY);
    });

    $(document).on('touchstart', '.dnd-zone[draggable="true"]', function(e) {
        var value = $(this).find('input[type="hidden"]').val();
        if (!value) return;
        var t = e.originalEvent.touches[0];
        touchValue = value;
        $touchSourceZone = $(this);
        $dragSourceZone = $(this);
        startTouchGhost($(this), t.clientX, t.clientY);
    });

    // Native (not jQuery) so we can pass {passive: false} — required for
    // e.preventDefault() to actually stop the page from scrolling during drag.
    // jQuery's .on() doesn't accept event-listener options, and passing them
    // there silently breaks the handler.
    document.addEventListener('touchmove', function(e) {
        if (touchValue === null) return;
        e.preventDefault();
        var t = e.touches[0];
        moveTouchGhost(t.clientX, t.clientY);

        $touchGhost.css('display', 'none');
        var el = document.elementFromPoint(t.clientX, t.clientY);
        $touchGhost.css('display', '');

        var $zone = el ? $(el).closest('.dnd-zone') : $();
        if ($touchOverZone && (!$zone.length || $touchOverZone[0] !== $zone[0])) {
            $touchOverZone.removeClass('dnd-drop-zone-over');
            $touchOverZone = null;
        }
        if ($zone.length && (!$touchOverZone || $touchOverZone[0] !== $zone[0])) {
            $zone.addClass('dnd-drop-zone-over');
            $touchOverZone = $zone;
        }
    }, { passive: false });

    $(document).on('touchend touchcancel', function(e) {
        if (touchValue === null) return;
        var t = e.originalEvent.changedTouches[0];

        $touchGhost.css('display', 'none');
        var el = document.elementFromPoint(t.clientX, t.clientY);
        var $zone = el ? $(el).closest('.dnd-zone') : $();
        var $panel = el ? $(el).closest('.dnd-panel') : $();

        if ($zone.length) {
            assignToZone($zone, touchValue);
        } else if ($panel.length && $touchSourceZone) {
            removeFromZone($touchSourceZone);
        }
        endTouchDrag();
    });

    //--- ASK BEFORE LEAVING ---//
    window.addEventListener("beforeunload", (event) => {
        if(!loadLearnerServerProgress) {
            event.preventDefault();
            event.returnValue = ""; // This will trigger the default browser message
        }
    });

    // =================================================================
    // CLICK-TO-PLAY: makes each sentence in the transcript clickable so
    // the user can replay audio from that point. The timing data lives in
    // window.ieltsListeningTimestamps (array per part of {w,s,e} word
    // objects). Wrapping happens after submit so the data isn't exposed
    // mid-test, and the original transcript text is never altered — only
    // wrapped in spans — so the existing mark.js highlight pipeline keeps
    // working untouched.
    // =================================================================

    // Sentence-boundary regex. Matches either:
    //   - . ! ? optionally followed by closing quotes/brackets, then required
    //     whitespace — the standard sentence end; OR
    //   - one or more newlines (with optional trailing whitespace) — catches
    //     paragraph breaks where the author trailed off without punctuation
    //     ("…faulty or –" then a new <p>). After PHP processing every <br>
    //     and paragraph break renders as </p>\n<p>, so the only place \n
    //     appears in the cumulative text is between paragraphs.
    // The end of the text buffer is also treated as a boundary.
    const SENT_END = /([.!?]+["')\]]*)\s+|\n+\s*/g;

    // Wrap transcript sentences for click-to-play eagerly on page load
    // Use setTimeout to avoid blocking the first paint. Section practice then
    // derives its audio clamp from the resulting sentence timings.
    setTimeout(function () {
        alignAndWrapTranscriptSentences();
        setupSectionAudioClamp();
    }, 500);

    function splitIntoSentencesWithPositions(text) {
        const parts = [];
        let last = 0, m;
        SENT_END.lastIndex = 0;
        while ((m = SENT_END.exec(text)) !== null) {
            const endIdx = m.index + m[0].length;
            // Ellipsis suppression. An ellipsis — written as "..." or, as this
            // author does, spaced ". . ." — is a trailing-off pause, NOT a
            // sentence end. Splitting on it shreds one spoken utterance into
            // tiny fragments ("TREVOR: No .", ".", ".", "not this time round
            // .", …) that each mis-anchor onto neighbouring speakers' audio.
            // m[1] is the punctuation group (undefined when the \n+ branch
            // matched — newlines are always real boundaries).
            const delim = m[1];
            // A newline anywhere in this match's trailing whitespace is a
            // paragraph/speaker break — ALWAYS a real boundary, even when the
            // line trails off in an ellipsis ("…covering . . .\nJULIE: …").
            // The regex's \s+ greedily swallows the break after the dots, so
            // without this guard the ellipsis suppression below would skip
            // past the newline and weld two speakers' lines into one chunk.
            const hasNewline = /\n/.test(m[0]);
            if (delim && !hasNewline) {
                const core = delim.replace(/["')\]]+$/, '');   // strip closing quotes
                const isDotsOnly = /^\.+$/.test(core);
                if (isDotsOnly) {
                    const spaceBefore = m.index === 0 || /\s/.test(text[m.index - 1]);
                    const nextIsDot = text[endIdx] === '.';
                    const threePlusDots = core.length >= 3;
                    // Spaced ellipsis: " ." has whitespace before the dot.
                    // Consecutive ellipsis: 3+ dots, or more dots right after.
                    // A normal sentence period is attached to its word (no
                    // space before) and stands alone, so it's unaffected.
                    if (spaceBefore || nextIsDot || threePlusDots) continue;
                }
            }
            parts.push({ text: text.slice(last, endIdx), start: last, end: endIdx });
            last = endIdx;
        }
        if (last < text.length) parts.push({ text: text.slice(last), start: last, end: text.length });
        return parts;
    }

    function normalizeWord(w) {
        return (w || '').toString().toLowerCase().replace(/[^a-z0-9]/g, '');
    }

    // Ultra-frequent function words that carry no positional information —
    // they appear in nearly every audio second, so a single-token match on
    // one is meaningless as a sentence anchor. Used to veto stopword-only
    // anchors (and stopword corroboration) in the fuzzy fallback. Discourse
    // markers that genuinely start utterances ("now", "well", "here",
    // "no", "yes", "oh", "right") are deliberately EXCLUDED so dialogue
    // openers stay anchorable.
    const ANCHOR_STOPWORDS = new Set([
        'the','a','an','and','of','to','in','it','is','as','at','on','or',
        'be','by','we','you','that','this','was','are','were','our','your',
        'for','with','but','so','from','they','them','their','he','she',
        'his','her','its','i','me','my','if','than','then','there','been',
        'have','has','had','do','does','did','about','into','over'
    ]);

    function levenshtein(a, b) {
        if (a === b) return 0;
        const al = a.length, bl = b.length;
        if (!al) return bl;
        if (!bl) return al;
        let prev = new Array(bl + 1);
        let curr = new Array(bl + 1);
        for (let j = 0; j <= bl; j++) prev[j] = j;
        for (let i = 1; i <= al; i++) {
            curr[0] = i;
            for (let j = 1; j <= bl; j++) {
                const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
                curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
            }
            [prev, curr] = [curr, prev];
        }
        return prev[bl];
    }

    // Verify a candidate single-token anchor by checking whether another
    // sentence token also appears in the audio within a short window after
    // the anchor. This is the safety net for the fuzzy fallback: when no
    // n-gram matched and we're relying on a single-token fuzzy hit, we want
    // independent evidence the sentence really is here — not just that one
    // edit-distance-1 word coincidentally appeared.
    //
    // anchorTokenIdx is the position in `tokens` of the token used for the
    // anchor itself; we don't want to "corroborate" it against itself.
    function hasCorroboration(words, anchorIdx, tokens, anchorTokenIdx) {
        const winEnd = Math.min(words.length, anchorIdx + 1 + 12);
        for (let j = anchorIdx + 1; j < winEnd; j++) {
            const candidate = normalizeWord(words[j].w);
            for (let s = 0; s < tokens.length; s++) {
                if (s === anchorTokenIdx) continue;
                const tok = tokens[s];
                if (!tok || tok.length < 3) continue;
                // A stopword appearing nearby is not real corroboration —
                // "the"/engovate.github.io/"of"/engovate.github.io/"are" turn up within 12 words of almost any
                // position. Require a content word to confirm the anchor.
                if (ANCHOR_STOPWORDS.has(tok)) continue;
                if (candidate === tok) return true;
                if (tok.length < 4) continue;
                const maxDist = Math.max(1, Math.floor(tok.length / 3));
                if (levenshtein(candidate, tok) <= maxDist) return true;
            }
        }
        return false;
    }

    // Find the closest matching word in `words[startIdx..startIdx+window]`.
    // Exact match wins immediately; otherwise Levenshtein within a length-
    // proportional threshold. Returns the index, or null if nothing acceptable.
    function findClosestWord(words, target, startIdx, windowSize) {
        if (!target) return null;
        const endIdx = Math.min(words.length - 1, Math.max(0, startIdx) + windowSize);
        const maxDist = Math.max(1, Math.floor(target.length / 3));
        let bestIdx = null, bestDist = Infinity;
        for (let i = Math.max(0, startIdx); i <= endIdx; i++) {
            const candidate = normalizeWord(words[i].w);
            if (candidate === target) return i;
            const d = levenshtein(candidate, target);
            if (d < bestDist && d <= maxDist) { bestDist = d; bestIdx = i; }
        }
        return bestIdx;
    }

    // Anchor a sentence to an audio position. Prefers the LONGEST exact
    // n-gram match available — that's what disambiguates the IELTS preamble
    // (audio "you will hear a number…") from the real transcript start
    // (audio "you will hear two teachers…"), since only the latter matches
    // a 5-gram. Up to 3 leading transcript tokens can be skipped so speaker
    // labels ("Andrew:"), section headers ("SECTION 1"), and question
    // markers ("Q1") — none of which are spoken — don't block the match.
    // Returns { audioIdx, tokenSkip, ngramLen } or null.
    function findSentenceAnchor(words, tokens, cursor, lookAhead) {
        if (!tokens.length) return null;
        const winEnd = Math.min(words.length, Math.max(0, cursor) + lookAhead);
        const start = Math.max(0, cursor);
        const maxNgram = Math.min(5, tokens.length);
        // Allow up to 4 leading tokens to be skipped — handles common
        // speaker-label patterns plus longer parentheticals like
        // "Lecturer (paraphrased):" that expand to 4+ unspoken tokens.
        const maxSkip  = Math.min(5, tokens.length);
        // Window cap for weaker phases (n=2 exact, joined-form 2-gram).
        // Long n-grams (n ≥ 3) keep the wide window since they're
        // self-disambiguating; common 2-grams like "yeah i" or "same here"
        // appear everywhere and need a cap to avoid distant false matches.
        const shortPhaseEnd = Math.min(winEnd, start + 50);

        function ngramMatch(skip, n, i) {
            if (i + n > words.length) return false;
            for (let k = 0; k < n; k++) {
                if (normalizeWord(words[i + k].w) !== tokens[skip + k]) return false;
            }
            return true;
        }

        // Position-outer scan: at each audio position, try (long n-gram →
        // joined-form 2-gram → exact 2-gram) and return on the first match.
        // This makes the EARLIEST matching audio position win, regardless
        // of match strength — which is what we want for click-to-play
        // (sentence's recorded start time should land at its natural
        // beginning, not at a strong-but-late 5-gram match deep inside it).
        //
        // Concrete case this fixes: "Woman: All right. Now, apart from
        // damage to the house itself…" Old phase-outer order matched the
        // 5-gram "now apart from damage to" at skip=3 first and never
        // gave the joined-form pass a chance to find "all right"→"alright"
        // at the actual sentence start. Result: clicking the merged
        // sentence played from "Now…" instead of "All right…".
        for (let i = start; i < winEnd; i++) {
            // Phase 1: long n-gram (n ≥ 3), no window cap. Lower skip
            // preferred at each n so speaker-label tokens are skipped only
            // if needed.
            for (let n = maxNgram; n >= 3; n--) {
                for (let skip = 0; skip < maxSkip && skip + n <= tokens.length; skip++) {
                    if (ngramMatch(skip, n, i)) {
                        return { audioIdx: i, tokenSkip: skip, ngramLen: n };
                    }
                }
            }
            if (i >= shortPhaseEnd) continue;

            // Phase 2: joined-form 2-gram — concatenate adjacent transcript
            // tokens and match against single audio words. Catches audio
            // contractions where two transcript words map to one
            // transcribed word ("all right" → "alright", "good bye" →
            // "goodbye"). Both tokens must be length ≥ 3 so we don't fire
            // on noise pairs like "we are" → "wear".
            //
            // Fuzzy tolerance is capped at a SINGLE edit. Real concatenations
            // are exact or off by one dropped letter ("allright" vs
            // "alright"). A looser threshold lets a speaker-label token glue
            // onto the next word and shadow a real plural: "student" + "yes"
            // = "studentyes" is edit-distance 2 from the audio word
            // "students" (they share the "student" stem), which wrongly
            // anchored "STUDENT: Yes, that's fine." onto "...postgraduate
            // students...". Distance 1 rejects that while keeping true
            // contractions. (The legitimate match for that sentence —
            // "thats"/engovate.github.io/"fine" exact — is found by the fuzzy fallback below.)
            const candidate = normalizeWord(words[i].w);
            if (candidate.length >= 4) {
                for (let skip = 0; skip < maxSkip && skip + 1 < tokens.length; skip++) {
                    const a = tokens[skip], b = tokens[skip + 1];
                    if (!a || !b || a.length < 3 || b.length < 3) continue;
                    const joined = a + b;
                    if (candidate === joined) {
                        return { audioIdx: i, tokenSkip: skip, ngramLen: 2 };
                    }
                    if (levenshtein(candidate, joined) <= 1) {
                        return { audioIdx: i, tokenSkip: skip, ngramLen: 2 };
                    }
                }
            }

            // Phase 3: exact n=2 (capped window). Skip restricted to ≤ 1
            // (just the optional speaker-label token) — a bare 2-word match
            // after skipping 2+ leading tokens is weak evidence and risks
            // anchoring on a coincidental "the boy" / "is it" / "and then"
            // pair earlier in the audio than where the sentence actually
            // begins. Higher-skip cases (e.g. "Mr Smith: Hello there." with
            // only "hello there" present in audio) fall through to the
            // fuzzy single-token fallback below, which has its own
            // corroboration guard.
            for (let skip = 0; skip < 2 && skip + 2 <= tokens.length; skip++) {
                if (ngramMatch(skip, 2, i)) {
                    return { audioIdx: i, tokenSkip: skip, ngramLen: 2 };
                }
            }
        }

        // Fallback for sentences with no multi-word n-gram match.
        // Single forward scan: the FIRST position with any matching leading
        // token wins (exact or fuzzy within Levenshtein threshold). At a
        // given position, exact beats fuzzy and lower skip beats higher.
        //
        // The two cases this has to get right simultaneously:
        //   1. "Tutor: Yes." — skip=0 "tutor" fuzzy-matches "tutors" several
        //      words ahead, skip=1 "yes" is exact AT the cursor. The exact
        //      at the earlier position wins.
        //   2. "That is why it has always been so important…" — the audio
        //      contracts "That is" → "That's" and "it has" → "it's", so
        //      none of the leading tokens match exactly at the right
        //      position. skip=0 "that" fuzzy-matches "thats" at the cursor,
        //      while a stray "that" exact appears ~28 words later inside
        //      the next sentence. The fuzzy at the earlier position wins.
        //
        // An old two-pass scheme (Pass 1 exact across skips → Pass 2 fuzzy)
        // got case 1 right but broke case 2, because it would return the
        // distant exact immediately and never reach the fuzzy phase.
        //
        // Window capped so neither variant bridges to a distant false
        // match; tokens ≤2 chars skipped since Levenshtein is too
        // forgiving for tiny strings.
        const fuzzyEnd = Math.min(winEnd, start + 50);
        for (let i = start; i < fuzzyEnd; i++) {
            const candidate = normalizeWord(words[i].w);
            let posBest = null; // { tokenSkip, isExact }
            for (let skip = 0; skip < maxSkip; skip++) {
                const tok = tokens[skip];
                if (!tok || tok.length < 3) continue;
                // Never anchor a multi-word sentence on a bare stopword. A
                // lone "the"/engovate.github.io/"of"/engovate.github.io/"are" match carries no positional evidence
                // and, near the cursor, slips past the corroboration guard
                // via the isAtCursor exemption — which is how "Here's the
                // entrance…" wrongly anchored on a "the" inside a garbled
                // (mis-transcribed) stretch of audio. Skipping stopwords
                // forces the anchor onto a content word ("entrance",
                // "corner") or, if none is present, lets the sentence
                // interpolate instead of false-anchoring.
                if (ANCHOR_STOPWORDS.has(tok)) continue;
                if (candidate === tok) {
                    posBest = { tokenSkip: skip, isExact: true };
                    break; // exact at the lowest skip wins this position
                }
                if (posBest !== null) continue; // already have a fuzzy candidate
                // Fuzzy requires length 4+. A 3-char token's edit-distance-1
                // neighborhood is huge — "man" matches "can"/engovate.github.io/"and"/engovate.github.io/"men"/engovate.github.io/"mat"
                // etc., all common audio words, which led to "MAN: OK."
                // wrongly anchoring at "can" inside "I can see…". 3-char
                // tokens still match exact above; they just can't fuzzy.
                if (tok.length < 4) continue;
                const maxDist = Math.max(1, Math.floor(tok.length / 3));
                if (levenshtein(candidate, tok) <= maxDist) {
                    posBest = { tokenSkip: skip, isExact: false };
                }
            }
            if (!posBest) continue;
            // Corroboration: when the anchor's evidence is weak, require
            // another sentence token to appear nearby in the audio.
            //
            // "Weak" means any of:
            //   - Fuzzy match (always — even a 1-edit hit on a long word
            //     could be a coincidence).
            //   - Exact match on a short token (≤4 chars). Short common
            //     words like "and", "the", "for", "yes" appear all over
            //     the audio; an exact "and" hit by itself is no stronger
            //     evidence than a fuzzy hit on a longer word.
            //
            // Exemptions (skip corroboration even when "weak"):
            //   - Sentence has only 1 effective token (after speaker-label
            //     skip). E.g. "Right." or "WOMAN: Yeah." — there's no
            //     other token to corroborate with, and rejecting them
            //     would mean every short sentence interpolates.
            //   - Anchor is at cursor's immediate vicinity (≤20 audio
            //     words past cursor). That's the natural sentence-to-
            //     sentence transition where the anchor's position is
            //     itself strong evidence.
            const tok = tokens[posBest.tokenSkip];
            const spokenCount = tokens.length - posBest.tokenSkip;
            const isWeak = !posBest.isExact || tok.length <= 4;
            const isAtCursor = (i - start) <= 20;
            // Single-token anchors can't be corroborated (no other token),
            // so the spokenCount>1 corroboration below never fires for them.
            // But a FUZZY single-token match far from the cursor is exactly
            // the unreliable case: e.g. "[20 seconds]" → token "seconds"
            // fuzzy-matching "second" 48 words ahead inside "the second half
            // of the year". Require single-token anchors to be either an
            // exact match or close to the cursor; otherwise interpolate.
            if (spokenCount === 1 && !posBest.isExact && !isAtCursor) continue;
            if (isWeak && spokenCount > 1 && !isAtCursor) {
                if (!hasCorroboration(words, i, tokens, posBest.tokenSkip)) continue;
            }
            return { audioIdx: i, tokenSkip: posBest.tokenSkip, ngramLen: 1 };
        }
        return null;
    }

    // Forward-only alignment. Each sentence claims a slice of audio words
    // starting from the previous sentence's end, so playback is always
    // monotonic. Sentences that can't anchor (e.g. text not present in the
    // recording, like "SECTION 1") get interpolated below.
    //
    // Lookahead is wide on purpose: IELTS audios begin with ~25 s of
    // standard instructions that aren't in the transcript, and may replay a
    // section before continuing — both jumps can be much larger than a
    // local window.
    function alignSentences(sentences, words) {
        const results = sentences.map(() => ({ start: null, end: null }));
        let cursor = 0;
        const LOOK_AHEAD = 300;
        // Audio's last word end is the hard upper bound for any timestamp.
        // The interpolation cascade below can otherwise drift past the end
        // of the audio if many trailing sentences can't anchor (each one
        // adds +1 s to prev.end), producing nonsense values like 484 s
        // for a 454 s audio.
        const audioEnd = words.length > 0 ? words[words.length - 1].e : 0;
        const clampToAudio = v => Math.max(0, Math.min(audioEnd, v));

        // Pre-tokenize sentences once — the look-ahead validation below
        // re-uses the next sentence's tokens, and we'd otherwise recompute
        // them on every pass.
        const tokensList = sentences.map(s =>
            s.text.trim().split(/\s+/).map(normalizeWord).filter(t => t.length > 0)
        );

        for (let i = 0; i < sentences.length; i++) {
            const tokens = tokensList[i];
            if (!tokens.length) continue;

            // Stage directions / silence markers — "[20 seconds]", "(pause)",
            // "[Recording plays]" — are not spoken. If everything outside the
            // brackets is non-alphanumeric, never anchor: leave the sentence
            // for interpolation so it lands in the silent gap between real
            // utterances instead of fuzzy-matching a stray audio word.
            //
            // Length-gated to ≤4 tokens: real stage directions are short
            // ("[20 seconds]", "[pause]", "[bell rings]"). A longer
            // fully-bracketed sentence is left to anchor normally — if it's
            // real (if unusual) content it'll match, and if it's a long
            // stage direction it simply won't find an n-gram in the audio
            // and will interpolate anyway. This avoids silently dropping a
            // longer bracketed sentence's click-to-play anchor.
            const debracketed = sentences[i].text.replace(/[\[(][^\])]*[\])]/g, '');
            const isStageDirection = tokens.length <= 4 &&
                /[\[(]/.test(sentences[i].text) && !/[a-z0-9]/i.test(debracketed);
            if (isStageDirection) continue;

            const anchor = findSentenceAnchor(words, tokens, cursor, LOOK_AHEAD);
            if (!anchor) continue;

            const startIdx = anchor.audioIdx;

            // Look-ahead validation: if the proposed anchor sits a long way
            // past the cursor, peek at the next sentence. If the next
            // sentence has its own n-gram match BETWEEN cursor and startIdx,
            // then the current anchor is "skipping over" content the next
            // sentence needs — that means the current sentence is probably
            // a transcript-side repeat with no audio counterpart here
            // (IELTS audio often truncates the "example" dialog while the
            // transcript shows the full version). Skip the anchor and let
            // interpolation place this sentence between its neighbors.
            //
            // Guards against false rejection:
            //   - For STRONG anchors (n-gram match) only triggered for jumps
            //     > 50 audio words (~15 s). Smaller forward jumps are normal
            //     cross-paragraph/speaker-turn transitions and never wrong.
            //   - For WEAK anchors (single-token fallback, ngramLen 1) the bar
            //     is much lower (jump > 5): a lone common word like "yes" /
            //     "no" can chance-match the OPENING of a later sentence and
            //     greedily steal it, jumping over sentences that really are in
            //     the audio between here and there. Example: "W: Yes." whose
            //     real audio was mis-transcribed ("You") grabbed the "Yes" of
            //     a later "Yes, it's P-R-E-S-C-O-T-T" 12 words ahead, shoving
            //     "What name is it? / I'm Mary Prescott / Can you spell that?"
            //     (all present in the audio) out of alignment.
            //   - The backward match must be a real n-gram (≥3 consecutive
            //     words), not a single-token fallback. A 1-token "yes" or
            //     "I" could chance-match anywhere; a 3-word phrase is rare
            //     enough that finding it backward is reliable evidence the
            //     next sentence really belongs there.
            const jump = startIdx - cursor;
            const validateJump = anchor.ngramLen >= 2 ? jump > 50 : jump > 5;
            if (i + 1 < sentences.length && validateJump) {
                const nextTokens = tokensList[i + 1];
                if (nextTokens.length) {
                    const backCheck = findSentenceAnchor(words, nextTokens, cursor, jump);
                    if (backCheck !== null && backCheck.ngramLen >= 3) continue;
                }
            }
            // Skipped leading tokens (speaker labels, etc.) don't have audio
            // words, so subtract them from the expected end position.
            const spokenCount = tokens.length - anchor.tokenSkip;
            const expectedEnd = Math.min(words.length - 1, startIdx + spokenCount - 1);

            // Pick a "lastTok" that's actually distinctive — short tokens
            // like "am", "10", "to" can't be reliably matched at the end
            // because they appear everywhere AND get reshaped by the audio
            // tokenizer ("10 am" → "10AM."). Walk backwards from the end
            // until we find a token of length ≥ 3.
            let lastTokIdx = tokens.length - 1;
            while (lastTokIdx > anchor.tokenSkip && tokens[lastTokIdx].length < 3) lastTokIdx--;
            const lastTok = tokens[lastTokIdx];
            const tailOffset = tokens.length - 1 - lastTokIdx;
            const expectedLastIdx = Math.max(startIdx, expectedEnd - tailOffset);
            const lastIdx = (lastTok && lastTok.length >= 3)
                ? findClosestWord(words, lastTok, Math.max(startIdx, expectedLastIdx - 5), 12)
                : null;

            results[i].start = words[startIdx].s;
            if (lastIdx !== null && lastIdx >= startIdx) {
                // Extend the end past lastIdx by the trailing-token offset so
                // short tail words (like "am" after "arrive at 10 am") still
                // get visually highlighted while audio plays through them.
                const endIdx = Math.min(words.length - 1, lastIdx + tailOffset);
                results[i].end = words[endIdx].e;
                cursor = endIdx + 1;
            } else {
                // End anchor failed — don't trust expectedEnd as the cursor.
                // Audio word count can differ from transcript token count
                // (number/time collapse), so over-advancing here is what
                // pushes later sentences into "fuzzy fallback finds a
                // distant 'Andrew'" territory. Advance only by what we
                // actually matched.
                results[i].end = words[expectedEnd].e;
                cursor = startIdx + anchor.ngramLen;
            }
        }

        // Interpolate missing entries from confidently-aligned neighbors.
        for (let i = 0; i < results.length; i++) {
            if (results[i].start !== null) continue;

            let prev = null, prevPos = -1, next = null, nextPos = -1;
            for (let j = i - 1; j >= 0; j--) {
                if (results[j].start !== null) { prev = results[j]; prevPos = j; break; }
            }
            for (let j = i + 1; j < results.length; j++) {
                if (results[j].start !== null) { next = results[j]; nextPos = j; break; }
            }

            if (prev && next) {
                const span = next.start - prev.end;
                const frac = (i - prevPos) / (nextPos - prevPos);
                results[i].start = clampToAudio(prev.end + span * frac);
                results[i].end   = clampToAudio(results[i].start + Math.max(0.3, span / (nextPos - prevPos)));
            } else if (prev) {
                results[i].start = clampToAudio(prev.end + 0.1);
                results[i].end   = clampToAudio(prev.end + 1.0);
            } else if (next) {
                results[i].start = clampToAudio(next.start - 1.0);
                results[i].end   = clampToAudio(next.start - 0.1);
            } else {
                results[i].start = 0;
                results[i].end   = clampToAudio(0.5);
            }
        }

        // Monotonic-order guard: clip any out-of-order timestamp to the
        // previous sentence's end. Prevents "click sentence 7 → audio plays
        // before sentence 6" weirdness.
        for (let i = 1; i < results.length; i++) {
            if (results[i].start < results[i - 1].start) {
                results[i].start = results[i - 1].start;
                if (results[i].end < results[i].start) results[i].end = results[i].start + 0.3;
            }
        }
        return results;
    }

    // Walk the transcript once and collect every text node along with its
    // offset in the concatenated text. The cumulative text is what
    // sentence-splitting and alignment operate on — that way a sentence
    // that crosses a <mark> (or any other inline element) stays a single
    // logical sentence, even though it lives in multiple text nodes.
    function gatherTextNodes(root) {
        const ranges = [];
        // cumText positions where the enclosing <p> changes. Used by the
        // short-sentence merge step so we only merge sentences that share
        // a paragraph (i.e. same speaker / same dialogue line). Without
        // this we could glue together two speakers' utterances.
        const paragraphBoundaries = [];
        let cumText = '';
        let lastP = null;
        function walk(node) {
            if (node.nodeType === 3) {
                const parent = node.parentElement;
                // Don't re-process already-wrapped sentence spans.
                if (parent && parent.classList && parent.classList.contains('ielts-listening-sentence')) return;
                const pAncestor = parent ? parent.closest('p') : null;
                if (lastP !== null && pAncestor !== lastP) {
                    paragraphBoundaries.push(cumText.length);
                }
                lastP = pAncestor;
                ranges.push({ node, start: cumText.length, end: cumText.length + node.nodeValue.length });
                cumText += node.nodeValue;
            } else if (node.nodeType === 1) {
                for (const child of node.childNodes) walk(child);
            }
        }
        walk(root);
        return { ranges, cumText, paragraphBoundaries };
    }

    // Short sentences (≤3 words) have too few tokens to anchor reliably
    // on their own — common-word false anchors and contractions wreck
    // single-token matching. Merging them with an adjacent sentence in
    // the same paragraph gives the n-gram phase a long, unique span to
    // anchor on, then both original sentences share one timestamp. The
    // tradeoff (clicking a longer span to seek) is acceptable for short
    // utterances like "Woman: All right." or "Woman: Oh dear."
    function mergeShortSentences(sentences, paragraphBoundaries) {
        if (sentences.length < 2) return sentences;
        // Paragraph index of a cumText position. Comparing by START position
        // is what matters: SENT_END consumes the paragraph-break "\n" into
        // the previous sentence's text, so that sentence's `end` lies past
        // the boundary and a range-overlap check would misclassify it as
        // crossing back into the next paragraph.
        function paraIndexOf(pos) {
            let idx = 0;
            for (const b of paragraphBoundaries) {
                if (b <= pos) idx++; else break;
            }
            return idx;
        }
        function samePara(a, b) { return paraIndexOf(a.start) === paraIndexOf(b.start); }
        function wc(s) { return s.trim().split(/\s+/).filter(Boolean).length; }

        // Forward pass: a short sentence absorbs the next sentence (in
        // the same paragraph). Cascades across multiple short sentences
        // in a row ("Wow. Cool. Amazing." → one merged span).
        const out = [];
        let i = 0;
        while (i < sentences.length) {
            let cur = sentences[i];
            while (
                i + 1 < sentences.length &&
                wc(cur.text) <= 3 &&
                samePara(cur, sentences[i + 1])
            ) {
                const next = sentences[i + 1];
                cur = { text: cur.text + next.text, start: cur.start, end: next.end };
                i++;
            }
            out.push(cur);
            i++;
        }

        // Backward pass: a short sentence stranded at the end of a
        // paragraph (no next sibling to absorb) merges into the previous
        // sentence in the same paragraph instead. Without this, a final
        // "Sure." or "Yeah." at the end of a long response stays a
        // 1-token unit and still misanchors.
        for (let j = out.length - 1; j > 0; j--) {
            if (wc(out[j].text) <= 3 && samePara(out[j - 1], out[j])) {
                out[j - 1] = {
                    text: out[j - 1].text + out[j].text,
                    start: out[j - 1].start,
                    end: out[j].end,
                };
                out.splice(j, 1);
            }
        }
        return out;
    }

    // Wrap every text-node fragment that falls inside a sentence's
    // cumulative-text range. Sentences that cross inline markup end up as
    // multiple sibling spans, each carrying the same data-sentence-id and
    // start/end times — the now-playing tracker re-groups them so the
    // whole sentence highlights together.
    function wrapSentences(ranges, sentences, aligned) {
        const opsByNode = new Map();

        sentences.forEach((sent, idx) => {
            if (!sent.text.trim().length) return;
            const info = aligned[idx];
            if (!info || info.start === null) return;
            const sentId = 'sid-' + idx;
            const startStr = info.start.toFixed(2);
            const endStr   = (info.end !== null ? info.end : info.start + 1).toFixed(2);

            for (const r of ranges) {
                if (r.end <= sent.start || r.start >= sent.end) continue;
                const startInNode = Math.max(0, sent.start - r.start);
                const endInNode   = Math.min(r.end - r.start, sent.end - r.start);
                if (endInNode <= startInNode) continue;
                const fragText = r.node.nodeValue.slice(startInNode, endInNode);
                if (!fragText.trim()) continue; // skip pure-whitespace fragments

                if (!opsByNode.has(r.node)) opsByNode.set(r.node, []);
                opsByNode.get(r.node).push({ startInNode, endInNode, sentId, startStr, endStr });
            }
        });

        for (const [node, ops] of opsByNode) {
            // Process from rightmost to leftmost within each node so each
            // splitText doesn't invalidate the offsets we haven't touched yet.
            ops.sort((a, b) => b.startInNode - a.startInNode);
            for (const op of ops) wrapFragment(node, op);
        }
    }

    function wrapFragment(textNode, op) {
        if (op.startInNode >= textNode.nodeValue.length) return;
        let middle = textNode;
        if (op.startInNode > 0) {
            middle = textNode.splitText(op.startInNode);
        }
        const middleLen = op.endInNode - op.startInNode;
        if (middleLen < middle.nodeValue.length) {
            middle.splitText(middleLen);
        }
        const span = document.createElement('span');
        span.className = 'ielts-listening-sentence';
        span.dataset.start      = op.startStr;
        span.dataset.end        = op.endStr;
        span.dataset.sentenceId = op.sentId;
        span.title = 'Click to play from here';
        middle.parentNode.insertBefore(span, middle);
        span.appendChild(middle);
    }

    // The page ships the word timings packed: one string per part, entries joined by "|", each entry
    // "word start duration" with the times in whole centiseconds. This turns them back into the
    // {w, s, e} objects the rest of this file expects. A part that is already an array is passed
    // through untouched, so a cached page rendered before the change still works.
    function readTimestamps() {
        const packed = window.ieltsListeningTimestamps;
        if (!packed || !packed.length) return [];

        return packed.map(function (part) {
            if (typeof part !== 'string') return part || [];
            if (!part) return [];

            return part.split('|').map(function (entry) {
                // Split from the RIGHT, so a word that normalised to empty still parses.
                const durAt = entry.lastIndexOf(' ');
                const startAt = entry.lastIndexOf(' ', durAt - 1);
                const start = parseInt(entry.slice(startAt + 1, durAt), 10) || 0;
                const dur = parseInt(entry.slice(durAt + 1), 10) || 0;
                return { w: entry.slice(0, startAt), s: start / 100, e: (start + dur) / 100 };
            });
        });
    }

    function alignAndWrapTranscriptSentences() {
        const data = readTimestamps();
        if (!data || !data.length) return;

        // PHP echoes one .ielts-listening-transcript per part in order, so
        // the iteration index is the part number minus one.
        $('.ielts-listening-transcript').each(function(i) {
            const $container = $(this);
            const words = data[i];
            if (!words || !words.length) return;
            // Skip if already wrapped — alignment should run once per submit,
            // but a future review-mode toggle could call this again.
            if ($container.find('.ielts-listening-sentence').length > 0) return;

            const { ranges, cumText, paragraphBoundaries } = gatherTextNodes(this);
            if (!cumText.trim().length) return;

            const rawSentences = splitIntoSentencesWithPositions(cumText);
            if (!rawSentences.length) return;

            const sentences = mergeShortSentences(rawSentences, paragraphBoundaries);
            const aligned = alignSentences(sentences, words);
            wrapSentences(ranges, sentences, aligned);
        });

        attachSentenceClickHandlers();
        attachNowPlayingTracker();
    }

    function attachSentenceClickHandlers() {
        // mouseup (not click) so we can detect when the user produced a
        // selection — if they did, treat it as text-selection intent and
        // don't trigger playback.
        $(document).off('mouseup.ieltsSentencePlay').on('mouseup.ieltsSentencePlay',
            '.ielts-listening-sentence[data-start]', function() {
                const sel = window.getSelection && window.getSelection();
                if (sel && sel.toString().length > 0) return;
                const start = parseFloat(this.dataset.start);
                if (isNaN(start)) return;
                const $tr = $(this).closest('.ielts-listening-transcript');
                // Part number lives in the transcript id (ielts-listening-transcript-N),
                // and the matching audio uses the same N suffix.
                const m = ($tr.attr('id') || '').match(/-(\d+)$/);
                if (!m) return;
                const audio = document.getElementById('ielts-listening-test-audio-' + m[1]);
                if (!audio) return;
                // Lock the highlight to THIS sentence for the duration of the
                // lead-in. Without this, the timeupdate handler would briefly
                // highlight the previous sentence (because we're playing inside
                // its range during the lead-in) and flicker before catching up.
                const sid = this.dataset.sentenceId;
                if (sid) {
                    audio.dataset.lockedSid   = sid;
                    audio.dataset.lockedUntil = String(start);
                }
                // Seek a bit before the marked start — transcription word boundaries
                // are slightly tight, so playback can clip the leading syllable.
                // The extra lead-in covers that without being noticeable.
                audio.currentTime = Math.max(0, start - 0.5);
                audio.play();
            }
        );
    }

    // Highlight the currently-playing sentence as audio progresses. Each
    // sentence may be wrapped in multiple sibling spans (when it crosses
    // <mark> or other inline markup), so we group spans by sentence id and
    // toggle the .playing class on the entire group.
    function attachNowPlayingTracker() {
        $('audio[id^="ielts-listening-test-audio-"]').each(function() {
            const audio = this;
            const partNumber = audio.id.replace('ielts-listening-test-audio-', '');
            const $transcript = $('#ielts-listening-transcript-' + partNumber);
            if (!$transcript.length) return;
            if (audio.dataset.nowPlayingBound === '1') return;
            audio.dataset.nowPlayingBound = '1';

            // groups[i] = { sentId, start, end, els: [span, span, ...] }
            let groups = [];
            let cursor = 0;
            let activeSid = null;

            function refreshGroups() {
                const byId = new Map();
                $transcript.find('.ielts-listening-sentence[data-start]').each(function() {
                    const sid = this.dataset.sentenceId || ('s-' + this.dataset.start);
                    const start = parseFloat(this.dataset.start);
                    const end   = parseFloat(this.dataset.end);
                    if (isNaN(start) || isNaN(end)) return;
                    let g = byId.get(sid);
                    if (!g) {
                        g = { sentId: sid, start, end, els: [] };
                        byId.set(sid, g);
                    } else {
                        g.start = Math.min(g.start, start);
                        g.end   = Math.max(g.end, end);
                    }
                    g.els.push(this);
                });
                groups = Array.from(byId.values()).sort((a, b) => a.start - b.start);
                cursor = 0;
                clearActive();
            }

            function clearActive() {
                if (activeSid === null) return;
                $transcript.find('.ielts-listening-sentence.playing').removeClass('playing');
                activeSid = null;
            }

            function setActive(group) {
                if (activeSid === group.sentId) return;
                clearActive();
                group.els.forEach(el => el.classList.add('playing'));
                activeSid = group.sentId;
            }

            audio.addEventListener('play', refreshGroups);

            audio.addEventListener('timeupdate', function() {
                if (!groups.length) return;
                const t = audio.currentTime;

                // Click-lead-in lock: when the user clicks a sentence, the
                // click handler stores its sid + actual start time on the
                // audio element. Until playback reaches that start, keep the
                // clicked sentence highlighted — don't let the cursor briefly
                // light up the sentence we're playing the lead-in inside.
                const lockedSid   = audio.dataset.lockedSid;
                const lockedUntil = parseFloat(audio.dataset.lockedUntil || 'NaN');
                if (lockedSid && !isNaN(lockedUntil)) {
                    if (t < lockedUntil) {
                        const target = groups.find(g => g.sentId === lockedSid);
                        if (target) {
                            setActive(target);
                            cursor = groups.indexOf(target);
                        }
                        return;
                    }
                    // Release exactly when t reaches lockedUntil (= the locked
                    // sentence's start). Any earlier and the normal tracker
                    // below would briefly clear the highlight before t crosses
                    // the start on the next tick — that's the "blink twice"
                    // you'd see right as audio caught up.
                    delete audio.dataset.lockedSid;
                    delete audio.dataset.lockedUntil;
                }

                // Reset cursor if it's out of bounds (audio played past all
                // groups on a previous tick and left cursor at groups.length)
                // or if the user scrubbed backward to before the current group.
                if (cursor >= groups.length || (cursor > 0 && t < groups[cursor].start - 0.5)) cursor = 0;
                while (cursor < groups.length && t > groups[cursor].end) cursor++;
                if (cursor >= groups.length) { clearActive(); return; }
                const g = groups[cursor];
                if (t >= g.start && t <= g.end) setActive(g);
                else clearActive();
            });

            // Intentionally NOT clearing on `pause` — the user usually
            // pauses to read or refer back to the highlighted sentence, so
            // keeping it lit is the right behavior. `ended` still clears
            // because at that point the playhead has moved past all
            // sentences and there's nothing meaningful to highlight.
            // `seeking` resets the cursor so scrubbing finds the right
            // group on the next timeupdate; the click-lead-in lock
            // suppresses both side-effects during a sentence click's
            // seek-and-play sequence.
            audio.addEventListener('ended',   function() { if (!audio.dataset.lockedSid) clearActive(); });
            audio.addEventListener('seeking', function() { if (!audio.dataset.lockedSid) cursor = 0; });
        });
    }
});