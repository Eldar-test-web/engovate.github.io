jQuery(document).ready(function($) {

    // Explanations already cached server-side arrive with the grading response, keyed by answer-input
    // id, so "Explain more" can open without its own request. Filled in the results loop below.
    var bundledExplanations = {};
    var bundledTraps = {};

    // Locked "Practice this section only" (premium feature, not a free-taster test): open the upgrade popup.
    $('.ielts-reading-practice-section-button.locked').on('click', function(e) {
        e.preventDefault();
        $('.payment-popup-container').css('display', 'flex');
    });

    let currentPart = 1;
    let currentQuestion = 1;
    let learnerResults = null;
    let testSubmitting = false; // true while a test submission AJAX is in flight

    $('#ielts-reading-test-form').on('submit', function(e) {
        e.preventDefault();

        // Locked test: the learner can take it, but submitting opens the upgrade popup instead
        if ($('#ielts-reading-test-submit-button').hasClass('locked')) {
            $('.payment-popup-container').css('display', 'flex');
            return;
        }

        var limitMessage = checkOrSaveRateLimit('process_ielts_reading_test');
        if (limitMessage) {
            alert(limitMessage);
            $('.payment-popup-container').css('display', 'flex');
            return;
        }

        if (loadLearnerServerProgress || confirm('Are you sure you want to submit your answers?')) {
            const formData = new FormData(this);

            formData.append('action', 'process_ielts_reading_test');
            formData.append('time_taken_seconds', getCurrentTimerInSeconds());
            formData.append('save_learner_progress', loadLearnerServerProgress ? 0 : 1);

            $.ajax({
                type: 'POST',
                url: single_ielts_reading_test_ajax.ajaxurl,
                data: formData,
                processData: false,
                contentType: false,
                beforeSend: function () {
                    testSubmitting = true;
                    $(".spinner-overlay").css('display', 'flex');
                    $('#ielts-reading-test-result').html('');
                    $('#ielts-reading-test-submit-button').prop('disabled', true).text('Submitting...');
                },
                success: function (response) {
                    if(!response.success) {
                        if(response.data && response.data['error'] == 'rate_limit_exceeded') {
                            alert(checkOrSaveRateLimit('process_ielts_reading_test', response.data['retry_after']));
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

                    stopTimer();
                    stopSkimming();

                    // Populate the table with the results
                    const results = response.data.results;

                    // Calculate band score
                    const proportionCorrect = response.data.correct_answer_count / results.length * 1.0;
                    const rawScore = proportionCorrect * 40;
                    const roundedIeltsScore = convertRawScoreToBandScore(rawScore, $('#category_type').val());
                    // const ieltsScore = proportionCorrect * 9.0;
                    // const roundedIeltsScore = Math.round(ieltsScore * 2) / 2;
                    $('.ielts-reading-band-score').text('Band Score: ' + roundedIeltsScore);

                    if(roundedIeltsScore >= 8)
                    {
                        $('.ielts-reading-band-score').css('color','darkgreen');
                    }
                    else
                    {
                        if(roundedIeltsScore >= 7)
                        {
                            $('.ielts-reading-band-score').css('color','orangered');
                        }
                        else {
                            if(roundedIeltsScore >= 6)
                            {
                                $('.ielts-reading-band-score').css('color','darkorange');
                            }
                            else
                            {
                                if(roundedIeltsScore >= 5)
                                {
                                    $('.ielts-reading-band-score').css('color','mediumblue');
                                }
                                else
                                {
                                    $('.ielts-reading-band-score').css('color','darkred');
                                }              
                            }
                        }
                    }

                    // Set result for overlay
                    $('.ielts-reading-result-info').append($('.ielts-reading-band-score').clone());
                    $('.ielts-reading-result-info').append('<h3>'+ response.data.correct_answer_count + '/engovate.github.io/' + results.length + '</h3>');
                    $('.ielts-reading-result-info').append($('.ielts-reading-timer').clone());

                    // Get transcript elements to show explanations on
                    const transcriptElements = $('.ielts-reading-transcript').toArray();
                    $('.ielts-reading-transcript').addClass('current'); //temporary show all transcripts so we can get the child rect positions
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
                        const rowClass = result.is_correct ? 'correct-ielts-reading-answer' : 'incorrect-ielts-reading-answer';
                        tableRows += `<tr class="${rowClass}">`;
                        tableRows += '<td>' + (i + 1) + '</td>';
                        tableRows += '<td>' + result.your_answer + '</td>';
                        tableRows += '<td>' + result.correct_answer + '</td>';
                        tableRows += '</tr>';

                        //display a correct/incorrect mark besides each question number
                        let readingQuestionNumberElement = $('#ielts-reading-question-number-' + (i+1));
                        if (result.detailed_explanation) {
                            const bundledAnswerEl = readingQuestionNumberElement.closest('.ielts-reading-question-item').find('[id^="ielts_reading_answer_"]')[0];
                            if (bundledAnswerEl) bundledExplanations[bundledAnswerEl.id] = result.detailed_explanation;
                        }
                        if (result.traps) {
                            const bundledTrapEl = readingQuestionNumberElement.closest('.ielts-reading-question-item').find('[id^="ielts_reading_answer_"]')[0];
                            if (bundledTrapEl) bundledTraps[bundledTrapEl.id] = result.traps;
                        }
                        readingQuestionNumberElement.removeClass('correct');
                        readingQuestionNumberElement.removeClass('incorrect');
                        if(result.is_correct)
                        {
                            readingQuestionNumberElement.addClass('correct');
                            readingQuestionNumberElement.after('<span style="color: green"> <i class="fa-solid fa-check"></i></span>');
                            $('.ielts-reading-question-palette .ielts-reading-palette-item[data-question-number="' + (i+1) + '"] a').addClass('correct');
                        }
                        else
                        {
                            readingQuestionNumberElement.addClass('incorrect');
                            readingQuestionNumberElement.after('<span style="color: darkred"> <i class="fa-solid fa-xmark"></i></span>');
                            $('.ielts-reading-question-palette .ielts-reading-palette-item[data-question-number="' + (i+1) + '"] a').addClass('incorrect');
                        }

                        //display the correct answer besides each question input or question number
                        // "What's the trap?" — the learner's answer + correctness are read from the DOM at
                        // click time (getUserAnswers handles every input type, incl. all "choose N" picks;
                        // correctness comes from this question's correct/incorrect mark), so nothing is baked here.
                        const correctAnswerInfo = '<span class="correct-answer-info"> Answer: '+result.correct_answer+' <span class="explain-answer-button">Explain more <i class="fa-solid fa-caret-right"></i></span> <span class="trap-answer-button">What&#39;s the trap? <i class="fa-solid fa-lightbulb"></i></span></span>';
                        
                        if(readingQuestionNumberElement.siblings('input').length > 0)
                        {
                            //for input type text like sentence_completion, table_completion
                            readingQuestionNumberElement.siblings('input').after(correctAnswerInfo);
                        }
                        else
                        {
                            let selectAnswerElements = readingQuestionNumberElement.closest('.ielts-reading-question-item').find('select, input[type="text"]');
                            if(selectAnswerElements.length > 0)
                            {
                                selectAnswerElements.after(correctAnswerInfo);
                            }
                            else
                            {
                                //check to see if this is not the first question-number of multiple questions (since we only display answer once for multiple questions)
                                if(readingQuestionNumberElement.siblings('#ielts-reading-question-number-'+(i+2)).length == 0)
                                {
                                    //for other types
                                    readingQuestionNumberElement.siblings('span:last').after(correctAnswerInfo);
                                }
                            }
                        }

                        //display explanations on the transcripts
                        const explanations = result.explanation.split("\n");
                        // Only trigger marking on the last question of a group (two_choices/three_choices/four_choices/five_choices).
                        // If the next question number is a sibling of the current one, they share the same group container — skip until the last.
                        const isLastInGroup = readingQuestionNumberElement.siblings('#ielts-reading-question-number-' + (i + 2)).length === 0;
                        if (isLastInGroup) {
                            // Count how many questions are in this group by checking how many
                            // previous question numbers are siblings of the current one
                            let groupSize = 1;
                            while (readingQuestionNumberElement.siblings('#ielts-reading-question-number-' + (i + 1 - groupSize)).length > 0) {
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
                                                        explanationNumberElement.id = 'ielts-reading-explanation-number-' + (i + 1 - z) + '-' + k;
                                                        explanationNumberElement.className = 'ielts-reading-explanation-number';
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

                    $('.ielts-reading-result-table-body').html(tableRows);
                    $('.ielts-reading-result-overlay').addClass('completed');

                    // "Explain more" and "What's the trap?" are premium features: non-premium learners get them
                    // on the first 4 answers only; grey out the rest so clicking them prompts an upgrade.
                    if ($('#is_premium').val() !== '1') {
                        // This lock is off for now, so these buttons open on every answer for everyone. To turn it back on, uncomment the lines below:
                        // $('.explain-answer-button').slice(4).addClass('locked')
                        //     .find('.fa-caret-right').removeClass('fa-caret-right').addClass('fa-lock');
                        // $('.trap-answer-button').slice(4).addClass('locked')
                        //     .find('.fa-lightbulb').removeClass('fa-lightbulb').addClass('fa-lock');

                        var readingWrongCount = results.length - response.data.correct_answer_count;
                        if (roundedIeltsScore >= 9) {
                            $('.ielts-reading-premium-cta-headline').text('Unlock your full analysis with Premium');
                        } else {
                            $('.ielts-reading-premium-cta-headline').text('You missed ' + readingWrongCount + ' question' + (readingWrongCount === 1 ? '' : 's') + ' — Improve faster with Premium');
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
                        let submitButton = $('#ielts-reading-test-submit-button');
                        submitButton.prop('disabled', false).text('Retake Test');
                        submitButton.off('click'); //remove current onclick events
                        submitButton.on('click', function(e) {
                            e.preventDefault();
                            if (confirm('Are you sure you want to retake this test?')) {
                                location.reload();
                            }
                        });

                        let reviewButtons = $('#ielts-reading-test-review-button');
                        reviewButtons.prop('disabled', false).html('<i class="fa-solid fa-list-check"></i>');
                        reviewButtons.off('click'); //remove current onclick events
                        reviewButtons.on('click', function(e) {
                            e.preventDefault();
                            $('.ielts-reading-result-overlay').addClass('completed');
                        });
                    }
                    else {
                        // Submission did not succeed; allow the 60-minute reminder again.
                        testSubmitting = false;
                        $('#ielts-reading-test-submit-button').prop('disabled', false).text('Submit');
                    }
                },
            });
        }
    });

    function convertRawScoreToBandScore(rawScore, testType) {
        if(testType.includes('academic')) {
            if (rawScore >= 39) return 9;
            else if (rawScore >= 37) return 8.5;
            else if (rawScore >= 35) return 8;
            else if (rawScore >= 33) return 7.5;
            else if (rawScore >= 30) return 7;
            else if (rawScore >= 27) return 6.5;
            else if (rawScore >= 23) return 6;
            else if (rawScore >= 19) return 5.5;
            else if (rawScore >= 15) return 5;
            else if (rawScore >= 13) return 4.5;
            else if (rawScore >= 10) return 4;
            else if (rawScore >= 8) return 3.5;
            else if (rawScore >= 6) return 3;
            else if (rawScore >= 4) return 2.5;
            else if (rawScore >= 2) return 2;
            else return 1;
        }
        else {
            if (rawScore >= 40) return 9;
            else if (rawScore >= 39) return 8.5;
            else if (rawScore >= 37) return 8;
            else if (rawScore >= 36) return 7.5;
            else if (rawScore >= 34) return 7;
            else if (rawScore >= 32) return 6.5;
            else if (rawScore >= 30) return 6;
            else if (rawScore >= 27) return 5.5;
            else if (rawScore >= 23) return 5;
            else if (rawScore >= 19) return 4.5;
            else if (rawScore >= 15) return 4;
            else if (rawScore >= 12) return 3.5;
            else if (rawScore >= 9) return 3;
            else if (rawScore >= 7) return 2.5;
            else if (rawScore >= 5) return 2;
            else if (rawScore >= 3) return 1.5;
            else return 1;
        }
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
            var bundledAnswerId = explainButton.closest('.ielts-reading-question-item').find('[id^="ielts_reading_answer_"]')[0];
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

        var answerId = explainButton.closest('.ielts-reading-question-item').find('[id^="ielts_reading_answer_"]')[0].id;
        var sectionAndQuestionid = answerId.replace('ielts_reading_answer_', '').split('_');
        var sectionId = sectionAndQuestionid[0];
        var questionId = sectionAndQuestionid[1];

        var section = explainButton.closest('.ielts-reading-question-section');
        var partNumber = parseInt(section.data('part-number'));
        // Fallback for drop zones which live in the transcript, not in a question section
        if (isNaN(partNumber)) {
            partNumber = parseInt(explainButton.closest('[id^="ielts-reading-transcript-"]').data('part-number')) || 1;
            // Use the corresponding question section for custom test src attributes
            section = $('#ielts-reading-question-section-' + partNumber);
        }
        var testId = section.data('src-test-id') || $('#post_id').val();
        var srcPart = section.data('src-part') || partNumber;

        var popup = $('.answer-detailed-explanation-popup');

        if(!detailedExplanation) {
            const formData = new FormData();
            formData.append('action', 'explain_ielts_reading_answer');
            formData.append('ielts_reading_test_nonce', $('#ielts_reading_test_nonce').val());
            formData.append('section_id', sectionId);
            formData.append('question_number_in_section', questionId);
            formData.append('test_id', testId);
            formData.append('part_number', srcPart);

            var limitMessage = checkOrSaveRateLimit('explain_ielts_reading_answer');
            if (limitMessage) {
                alert(limitMessage);
                $('.payment-popup-container').css('display', 'flex');
                return;
            }

            $.ajax({
                type: 'POST',
                url: single_ielts_reading_test_ajax.ajaxurl,
                data: formData,
                processData: false,
                contentType: false,
                beforeSend: function () {
                    explainButton.prop('disabled', true).text('Loading...');
                },
                success: function (response) {
                    if(!response.success) {
                        if(response.data['error'] == 'rate_limit_exceeded') {
                            alert(checkOrSaveRateLimit('explain_ielts_reading_answer', response.data['retry_after']));
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
        var $item = trapButton.closest('.ielts-reading-question-item');
        var $answerInput = $item.find('[id^="ielts_reading_answer_"]').first();
        var yourAnswer = getUserAnswers($answerInput).join(', ');
        var $questionNumbers = $item.find('.ielts-reading-question-number');
        var isCorrect = $questionNumbers.length > 0 && $questionNumbers.filter('.correct').length === $questionNumbers.length;

        var answerId = $answerInput[0].id;
        var sectionAndQuestionid = answerId.replace('ielts_reading_answer_', '').split('_');
        var sectionId = sectionAndQuestionid[0];
        var questionId = sectionAndQuestionid[1];

        var section = trapButton.closest('.ielts-reading-question-section');
        var partNumber = parseInt(section.data('part-number'));
        // Fallback for drop zones which live in the transcript, not in a question section
        if (isNaN(partNumber)) {
            partNumber = parseInt(trapButton.closest('[id^="ielts-reading-transcript-"]').data('part-number')) || 1;
            section = $('#ielts-reading-question-section-' + partNumber);
        }
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
            formData.append('action', 'diagnose_ielts_reading_trap');
            formData.append('ielts_reading_test_nonce', $('#ielts_reading_test_nonce').val());
            formData.append('section_id', sectionId);
            formData.append('question_number_in_section', questionId);
            formData.append('test_id', testId);
            formData.append('part_number', srcPart);
            formData.append('your_answer', yourAnswer);
            formData.append('is_correct', isCorrect ? '1' : '0');

            var limitMessage = checkOrSaveRateLimit('diagnose_ielts_reading_trap');
            if (limitMessage) {
                alert(limitMessage);
                $('.payment-popup-container').css('display', 'flex');
                return;
            }

            $.ajax({
                type: 'POST',
                url: single_ielts_reading_test_ajax.ajaxurl,
                data: formData,
                processData: false,
                contentType: false,
                beforeSend: function () {
                    trapButton.prop('disabled', true).html('Loading...');
                },
                success: function (response) {
                    if(!response.success) {
                        if(response.data && response.data['error'] == 'rate_limit_exceeded') {
                            alert(checkOrSaveRateLimit('diagnose_ielts_reading_trap', response.data['retry_after']));
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

    $('#ielts-reading-dropdown-button').on('click', function(e) {
        e.preventDefault();
        $('.ielts-reading-dropdown-content').toggle();
    });

    $(document).on('mousedown', function(e) {
        if (!$(e.target).closest('#ielts-reading-dropdown-button, .ielts-reading-dropdown-content').length) {
            $('.ielts-reading-dropdown-content').hide();
        }
    });

    $('#ielts-reading-test-submit-button').on('click', function(e) {
        e.preventDefault();
        $('#ielts-reading-test-form').submit();
    });
    
    $('#ielts-reading-next-question-button').on('click', function(e) {
        e.preventDefault();
        const nextPart = currentPart + 1;
        $('#ielts-reading-palette-section-'+ nextPart).click();
    });

    $('#ielts-reading-previous-question-button').on('click', function(e) {
        e.preventDefault();
        const previousPart = currentPart - 1;
        $('#ielts-reading-palette-section-'+ previousPart).click();
    });

    function getPartNumberFromQuestionNumber(questionNumber)
    {
        var $el = $('#ielts-reading-question-number-' + questionNumber);
        var part = parseInt($el.closest('.ielts-reading-question-section').data('part-number'));
        if (isNaN(part)) {
            // Element may be in a transcript (e.g. heading drop zone) — read from data attribute
            part = parseInt($el.closest('[id^="ielts-reading-transcript-"]').data('part-number'));
        }
        return part;
    }

    function displayCurrentPart(questionNumber)
    {
        if($('#ielts-reading-question-number-' + questionNumber).length == 0)
        {
            console.log('not exist');
            return;
        }

        currentQuestion = parseInt(questionNumber);

        let oldPart = currentPart;
        currentPart = getPartNumberFromQuestionNumber(currentQuestion);

        $('.ielts-reading-transcript').removeClass('current');
        $('#ielts-reading-transcript-'+ currentPart).addClass('current');

        $('.ielts-reading-question-section').removeClass('current');
        $('#ielts-reading-question-section-'+ currentPart).addClass('current');

        $('.ielts-reading-part-announcement').removeClass('current');
        $('#ielts-reading-part-announcement-'+ currentPart).addClass('current');

        $('.ielts-reading-palette-section').removeClass('current');
        $('#ielts-reading-palette-section-'+ currentPart).addClass('current');

        if($('#ielts-reading-palette-section-'+ (currentPart - 1)).length == 0) {
            $('#ielts-reading-previous-question-button').prop('disabled', true);
        }
        else {
            $('#ielts-reading-previous-question-button').prop('disabled', false);
        }

        if($('#ielts-reading-palette-section-'+ (currentPart + 1)).length == 0) {
            $('#ielts-reading-next-question-button').prop('disabled', true);
        }
        else {
            $('#ielts-reading-next-question-button').prop('disabled', false);
        }

        if(oldPart != currentPart)
        {
            $('.ielts-reading-test-transcripts').scrollTop(0);
            $('.ielts-reading-question-container').scrollTop(0);
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

    $('.ielts-reading-resize-handle').on('mousedown touchstart', function (e) {
        e.preventDefault();
        isResizing = true;
        resizeHandleStartX = getResizeClientX(e);
        originalArticleWidth = $('.ielts-reading-test-transcripts').outerWidth();
    });

    $(window).on('mousemove touchmove', function (e) {
        if (!isResizing) return;
        const delta = getResizeClientX(e) - resizeHandleStartX;
        const newWidth = originalArticleWidth + delta;
        const maxWidth = 0.99 * $(window).width(); // Calculate 99% of the viewport width
        const limitedNewWidth = Math.min(newWidth, maxWidth); // Limit the new width to the maximum allowed width
        $('.ielts-reading-page-content').css('grid-template-columns', `${limitedNewWidth}px 10px auto`);
    });

    $(window).on('mouseup touchend touchcancel', function () {
        isResizing = false;
    });

    $('#ielts-reading-test-review-button').on('click', function(e) {
        e.preventDefault();
        $('.ielts-reading-preview-overlay').addClass('completed');
    });

    $('#ielts-reading-result-close-button').on('click', function(e) {
        e.preventDefault();
        $('.ielts-reading-result-overlay').removeClass('completed');
    });

    $('#ielts-reading-preview-close-button').on('click', function(e) {
        e.preventDefault();
        $('.ielts-reading-preview-overlay').removeClass('completed');
    });

    $('.ielts-reading-premium-cta-close').on('click', function(e) {
        e.preventDefault();
        $(this).closest('.ielts-reading-premium-cta, .ielts-reading-premium-cta-promo').hide();
    });

    // Listen for changes to the user answer inputs
    $('input[name^="ielts_reading_answer_"], select[name^="ielts_reading_answer_"]').on('change', function() {
        //this is for input type like form_completion, sentence_completion
        let questionNumbers = [$(this).siblings('.ielts-reading-question-number').text()];

        //this is for other types like checkboxes, radio buttons
        if(!questionNumbers[0])
        {
            questionNumbers = $(this).closest('.ielts-reading-question-item').find('.ielts-reading-question-number').map(function() {
                return $(this).text();
            }).get();
        }

        let userAnswers = getUserAnswers($(this));

        for (let i = 0; i < questionNumbers.length; i++)
        {
            let questionNumber = questionNumbers[i];
            let userAnswer = userAnswers[i];
            // Update the user answer in the Question Palette
            //$('.ielts-reading-question-palette .ielts-reading-palette-item[data-question-number="' + questionNumber + '"] .ielts-reading-user-answer').text(userAnswer);
            if (userAnswer !== '' && userAnswer !== undefined) {
                $('.ielts-reading-question-palette .ielts-reading-palette-item[data-question-number="' + questionNumber + '"] a').addClass('completed');
            } else {
                $('.ielts-reading-question-palette .ielts-reading-palette-item[data-question-number="' + questionNumber + '"] a').removeClass('completed');
            }

            //Update user answer in preview. We also need it for easy access to user progress for local storage
            $('.ielts-reading-preview-table-body .ielts-reading-preview-item[data-question-number="' + questionNumber + '"] .ielts-reading-user-answer').text(userAnswer !== undefined?userAnswer:'');
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
            let parent = answerElement.closest('.ielts-reading-question-item');
            userAnswers = parent.find('input[type="radio"]:checked').map(function() {
                return $(this).val();
            }).get();
        } else if (answerElement.is('input[type="checkbox"]')) {
            let parent = answerElement.closest('.ielts-reading-question-item');
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

    $('.ielts-reading-palette-section').on('click', function (e) {
        const questionNumber = $(this).find('.ielts-reading-palette-item a:first').text().trim();
        displayCurrentPart(questionNumber);
    });

    $('.ielts-reading-palette-item a, .ielts-reading-question-number').on('click', function (e) {
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
        scrollTo($('#ielts-reading-question-number-' + currentQuestion), $('.ielts-reading-question-container'));

        // Find the first question in the group so all questions in a two_choices/three_choices/four_choices/five_choices
        // group share the same cycle state and excerpt elements
        const currentEl = $('#ielts-reading-question-number-' + currentQuestion);
        let groupStartQuestion = parseInt(currentQuestion);
        while (currentEl.siblings('#ielts-reading-question-number-' + (groupStartQuestion - 1)).length > 0) {
            groupStartQuestion--;
        }

        // Collect all excerpt elements using the group's first question number
        const excerptElements = $(`[id^="ielts-reading-explanation-number-${groupStartQuestion}-"]`).toArray().map(el => $(el));

        if (excerptElements.length === 0) return;

        // Cycle through excerpts on repeated clicks, shared across all questions in the group
        const currentIndex = explanationExcerptIndexMap[groupStartQuestion] || 0;
        const scrollTarget = $(`#ielts-reading-explanation-number-${currentQuestion}-${currentIndex}`).length > 0
            ? $(`#ielts-reading-explanation-number-${currentQuestion}-${currentIndex}`)
            : excerptElements[currentIndex];
        scrollTo(scrollTarget, $('.ielts-reading-test-transcripts'));
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
    let ieltsreadingTimer = $(".ielts-reading-timer strong");

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
            $('#ielts-reading-test-submit-button').click();
        });
    }

    function displayTime() {
        let secondsText = seconds < 10 ? '0' + seconds : seconds;
        let minutesText = minutes < 10 ? '0' + minutes : minutes;
        let hoursText = hours < 10 ? '0' + hours : hours;

        ieltsreadingTimer.text(`${hoursText}:${minutesText}:${secondsText}`);
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
    const highlightPopup = $('#ielts-reading-highlight-popup');
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
            const parentNode = getParentNodeOfRange(range, '.ielts-reading-transcript, .ielts-reading-question-section');

            if (parentNode && !isSkimming) {
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

    $('#ielts-reading-highlight-button').on('click', function() {
        if (selectedRange) {
            highlight(selectedRange);
            hideHighlightPopup();
        }
    });

    $('#ielts-reading-dehighlight-button').on('click', function() {
        if (selectedRange) {
            dehighlight(selectedRange);
            hideHighlightPopup();
        }
    });

    // --- NOTE ---//
    $('#ielts-reading-note-button').on('click', function () {
        if (selectedRange) {
            // Add a note button on top of the selected text
            const noteButton = addNoteButton(selectedRange);

            if(!noteButton) return;

            // Create a note element
            const noteElem = document.createElement('div');
            noteElem.className = 'ielts-reading-small-note-section';

            // Create a container for the note content
            const noteContent = document.createElement('div');
            noteContent.contentEditable = true;
            noteContent.className = 'ielts-reading-small-note-content';
            noteElem.appendChild(noteContent);

            // Add a delete button to the note element
            const deleteButton = document.createElement('button');
            deleteButton.type = 'button';
            deleteButton.innerHTML = 'Delete';
            deleteButton.className = 'ielts-reading-delete-note-button';
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
            closeButton.className = 'ielts-reading-close-note-button';
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
                if (!event.target.closest('.ielts-reading-small-note-content')) {
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
                if (!event.target.closest('.ielts-reading-small-note-content')) {
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
                if (!event.target.closest('.ielts-reading-small-note-section')) {
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
    ['#ielts-reading-highlight-button', '#ielts-reading-dehighlight-button', '#ielts-reading-note-button'].forEach(function(selector) {
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

            let noteButtonParent = getParentNodeOfRange(range, '.ielts-reading-transcript, .ielts-reading-question-section');

            if(!noteButtonParent) {
                noteButtonParent = document.body;
            }

            const buttonPosition = getRangePosition(range, noteButtonParent);

            const noteButton = document.createElement('button');
            noteButton.type = 'button';
            noteButton.className = 'ielts-reading-small-note-button';
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

    // --- SINGLE-SECTION PRACTICE: passage trim toggle ---
    // The server collapses passage paragraphs that don't hold this section's
    // evidence (class `ielts-reading-passage-collapsed`). Surface the toggle
    // only when something was actually collapsed.
    if ($('.ielts-reading-passage-collapsed').length) {
        $('.ielts-reading-section-practice-bar').show();
    }
    $(document).on('click', '.ielts-reading-show-full-passage-button', function () {
        const showAll = $(this).attr('data-state') !== 'full';
        $('.ielts-reading-transcript').toggleClass('show-full-passage', showAll);
        $(this).attr('data-state', showAll ? 'full' : 'relevant')
               .text(showAll ? 'Show relevant only' : 'Show full passage');
    });

    //-- SKIMMING --//
    //save original transcript content to skim on
    const skimmingTimeoutIds = [];
    const currentTranscriptContents = {};
    const originalTranscriptContents = [];
    let skimmingSpeed = 1;
    let isSkimming = false;
    $('.ielts-reading-transcript').each(function() {
        const contentElement = $(this);
        originalTranscriptContents.push(contentElement.html());
    });

    function wrapTextNodesWithSkimmingSpan(element) {
        element.contents().each(function () {
            if (this.nodeType === 3) { // Text node
                // Split on any whitespace run and drop empties, so whitespace-only nodes (newlines/indentation
                // between elements) and double spaces don't become empty .skimming-word spans that the skim
                // "fades" first — the delay before the real first word.
                const words = this.textContent.split(/\s+/).filter(function (w) { return w.length > 0; });
                if (words.length === 0) return; // whitespace-only node — leave it as-is to preserve spacing
                const wrappedWords = words.map(word => `<span class="skimming-word">${word} </span>`);
                $(this).replaceWith(wrappedWords.join(''));
            } else if (this.nodeType === 1) { // Element node
                wrapTextNodesWithSkimmingSpan($(this));
            }
        });
    }
    
    $('.ielts-reading-skimming-button').on('click', function(e) {
        e.preventDefault();

        const transcriptElement = $('#ielts-reading-transcript-' + $(this).data('part'));
        const index = $(this).data('part') - 1;

        if($(this).data('skimming'))
        {
            stopSkimming();
        }
        else
        {
            currentTranscriptContents[index] = transcriptElement.html();
            
            stopSkimming(); //Stop all other skimming processes
            hideHighlightPopup(); //just to avoid unexpected behaviours
            scrollTo($(`[id^="ielts-reading-transcript-${currentPart}"]`), $('.ielts-reading-test-transcripts'), false);

            transcriptElement.html(originalTranscriptContents[index]);

            wrapTextNodesWithSkimmingSpan(transcriptElement);
            
            //Skimming — only visible words, so in section practice (non-relevant blocks are display:none)
            //it starts at the relevant section instead of fading hidden text above it first.
            const words = transcriptElement.find('.skimming-word').filter(':visible');
            let delay = 0;
            words.each(function() {
                const word = $(this);
                const timeoutIds = setTimeout(() => {
                    word.animate({opacity: 0}, 500);
                }, delay);
                skimmingTimeoutIds.push(timeoutIds);
                delay += 300.0/ skimmingSpeed;
            });
        
            // Restore content automatically after all words have been hidden
            const timeoutIds = setTimeout(() => {
                stopSkimming();
            }, delay + 1000); // Add the duration of the last word's animation
            skimmingTimeoutIds.push(timeoutIds);

            // Update the button state
            $(this).data('skimming', true);
            $(this).text('Stop Skimming');
            isSkimming = true;
        }
    });

    $('.ielts-reading-skimming-speed-up-button').on('click', function(e) {
        e.preventDefault();
        skimmingSpeed += 0.2;
        skimmingSpeed = parseFloat(skimmingSpeed.toFixed(1));
        $('.ielts-reading-skimming-button').each(function() {
            if(!$(this).data('skimming'))
            {
                $(this).text(`Practice Skimming (${skimmingSpeed}x)`);
            }
        });
    });

    $('.ielts-reading-skimming-speed-down-button').on('click', function(e) {
        e.preventDefault();
        skimmingSpeed -= 0.2;
        skimmingSpeed = parseFloat(skimmingSpeed.toFixed(1));
        if(skimmingSpeed <= 0) skimmingSpeed = 0.2;
        $('.ielts-reading-skimming-button').each(function() {
            if(!$(this).data('skimming'))
            {
                $(this).text(`Practice Skimming (${skimmingSpeed}x)`);
            }
        });
    });

    function stopSkimming()
    {
        // Clear all timeouts
        skimmingTimeoutIds.forEach(timeoutId => clearTimeout(timeoutId));
        skimmingTimeoutIds.length = 0; // Empty the timeoutIds array
        isSkimming = false;

        $('.ielts-reading-skimming-button').each(function() {
            if($(this).data('skimming'))
            {
                const transcriptElement = $('#ielts-reading-transcript-' + $(this).data('part'));
                const index = $(this).data('part') - 1;
                
                if(currentTranscriptContents[index]) {
                    transcriptElement.html(currentTranscriptContents[index]);
                }

                // Update the button state
                $(this).data('skimming', false);
                $(this).text(`Practice Skimming (${skimmingSpeed}x)`);
            }
        });
    }

    //--- LEARNER SERVER PROGRESS ---//
    var loadLearnerServerProgress = false;
    loadLearnerServerProgress = new URLSearchParams(window.location.search).get('load-learner-progress');
    if(loadLearnerServerProgress) {
        //A review is a stripped-down view of the test, whether it is embedded or opened in its own
        //tab: no site chrome, and no live-test controls since nothing is being timed.
        $('.announcement-bar').hide();
        $('.site-footer').hide();
        $('.ielts-reading-site-header').hide();
        $('.ielts-reading-skimming-button-container').hide();
        $('.ielts-reading-timer').hide();
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
        var reviewTestTitle = $('.ielts-reading-page-header h1').first()
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
                          '<a href="#" class="ielts-reading-export-pdf-link ielts-reading-export-pdf-header-btn"><i class="fa-solid fa-file-pdf"></i> Export as PDF</a>' +
                      '</div>'))
            .append($('<a class="ielts-review-mode-exit"></a>')
                .attr('href', exitReviewUrl.toString())
                .text('Exit review mode and take this test again'));

        $('.ielts-reading-test-container').prepend($reviewBanner);

        //Focus mode strips the page down to the test itself, which is what a review wants. It has
        //to run on the next tick: focusState is declared with `let` further down this file, so
        //reaching it now would hit the temporal dead zone, and the button's own click handler is
        //not bound yet either. Going through the button keeps focusState in sync, so Escape still exits.
        setTimeout(function () { $('#ielts-reading-focus-mode-button').click(); }, 0);

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

            var questionItem = $('#ielts-reading-question-number-' + questionNumber).closest('.ielts-reading-question-item');
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
        $('input[name^="ielts_reading_answer_"], select[name^="ielts_reading_answer_"]').trigger('change');
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
                            'p1_test', 'p2_test', 'p3_test', 'p1_part', 'p2_part', 'p3_part'];
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
        $('.ielts-reading-preview-table-body .ielts-reading-preview-item').each(function() {
            var userAnswer = $(this).find('.ielts-reading-user-answer').text();
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
    $('#ielts-reading-focus-mode-button').on('click', function() {
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
        $(".ielts-reading-test-container").addClass('ielts-reading-focus-mode');
        $("#ielts-reading-focus-mode-button").html('<i class="fa-solid fa-maximize"></i> Fullscreen');
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
        $(".ielts-reading-test-container").addClass('ielts-reading-focus-mode');
        $("#ielts-reading-focus-mode-button").html('<i class="fa-solid fa-compress"></i> Exit');
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
        $(".ielts-reading-test-container").removeClass('ielts-reading-focus-mode');
        $("#ielts-reading-focus-mode-button").html('<i class="fa-solid fa-expand"></i> Focus');
    }

    // Handle fullscreen and focus mode
    $(document).on('keydown', function(e) {
        // Check for F11 (Windows/Linux) or Mac fullscreen shortcuts (Ctrl+Cmd+F)
        if (e.key === 'F11' || (e.key === 'f' && e.ctrlKey && e.metaKey)) {
            e.preventDefault(); // Prevent default browser behavior
            
            $('#ielts-reading-focus-mode-button').click();
        }
        // Handle Escape key for focus mode
        else if (e.key === 'Escape') {
            exitFocusMode();
        }
    });

    //--- EXPORT PDF ---//
    var answerKeyData = null;

    function buildAnswerKeySection(answerKey) {
        var $section = $('<div class="ielts-reading-print-answer-key"></div>');
        $section.append('<h2>Answer Key</h2>');

        var $table = $('<table class="ielts-reading-answer-key-table"><thead><tr><th>#</th><th>Answer</th><th>Explanation</th></tr></thead></table>');
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

    $('.ielts-reading-export-pdf-link').on('click', function(e) {
        e.preventDefault();

        var limitMessage = checkOrSaveRateLimit('get_ielts_reading_test_answer_key');
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
            action:                    'get_ielts_reading_test_answer_key',
            ielts_reading_test_nonce:  $('[name="ielts_reading_test_nonce"]').val(),
            post_id:                   $('#post_id').val(),
            is_section_test:           $('[name="is_section_test"]').val() || '',
            src_test:                  $('[name="src_test"]').val() || '',
            section:                   $('[name="section"]').val() || '',
            is_custom_test:            $('[name="is_custom_test"]').val() || '',
            p1_test:                   $('[name="p1_test"]').val() || '',
            p1_part:                   $('[name="p1_part"]').val() || '',
            p2_test:                   $('[name="p2_test"]').val() || '',
            p2_part:                   $('[name="p2_part"]').val() || '',
            p3_test:                   $('[name="p3_test"]').val() || '',
            p3_part:                   $('[name="p3_part"]').val() || '',
        };

        $.post(single_ielts_reading_test_ajax.ajaxurl, formData, function(response) {
            $('.spinner-overlay').hide();
            $spinnerText.text(originalSpinnerText);

            if (response.success) {
                answerKeyData = response.data.answer_key;
                window.print();
            } else if (response.data && response.data['error'] == 'rate_limit_exceeded') {
                alert(checkOrSaveRateLimit('get_ielts_reading_test_answer_key', response.data['retry_after']));
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

        // Build interleaved print container: Passage 1 → Questions 1 → Passage 2 → Questions 2 ...
        var $printContainer = $('<div class="ielts-reading-print-container' + (submitted ? ' ielts-reading-print-submitted' : '') + '"></div>');

        if (submitted) {
            var bandScore = $('.ielts-reading-band-score').first().text();
            var timeText = $('.ielts-reading-timer').first().text().trim();
            var bandColor = $('.ielts-reading-band-score').first().css('color');
            var $summary = $('<div class="ielts-print-result-summary"></div>');
            if (bandScore) {
                $summary.append('<span class="ielts-print-band-score" style="color:' + bandColor + '">' + bandScore + '</span>');
            }
            if (timeText) {
                $summary.append('<span class="ielts-print-time-taken">' + timeText + '</span>');
            }
            $printContainer.append($summary);
        }

        var partCount = $('.ielts-reading-transcript').length;
        for (var i = 1; i <= partCount; i++) {
            var $transcript = $('#ielts-reading-transcript-' + i).clone();
            $transcript.prepend('<div class="print-passage-label">Passage ' + i + '</div>');
            $printContainer.append($transcript);

            var $section = $('#ielts-reading-question-section-' + i).clone();
            $section.prepend('<div class="print-part-label">Part ' + i + ' — Questions</div>');
            $printContainer.append($section);
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

        // Append answer key if available
        if (answerKeyData && answerKeyData.length > 0) {
            $printContainer.append(buildAnswerKeySection(answerKeyData));
        }

        $('.ielts-reading-test-container').addClass('ielts-reading-print-hidden');
        $('body').children().not('.ielts-reading-print-container, #page').addClass('ielts-reading-print-hidden');
        $('.ielts-reading-page-header').after($printContainer);
    };

    window.onafterprint = function() {
        $('.ielts-reading-print-container').remove();
        $('.ielts-reading-print-hidden').removeClass('ielts-reading-print-hidden');
        answerKeyData = null;
    };

    //--- DRAG AND DROP QUESTION ITEMS ---//
    // Each panel/zone is tagged with data-dnd-group="<section_id>" so multiple
    // DnD sections on one page (which may share label values like A, B, C) stay isolated.
    function getZonePanel($zone) {
        var group = $zone.attr('data-dnd-group');
        if (group) return $('.dnd-panel[data-dnd-group="' + group + '"]');
        // Fallback for any zone without a group (defensive)
        return $zone.closest('.ielts-reading-question-section').find('.dnd-panel').first();
    }

    function assignToZone($zone, value) {
        var oldValue = $zone.find('input[type="hidden"]').val();
        var $panel = getZonePanel($zone);
        if (oldValue) freeCard($panel, oldValue);

        var $card = $panel.find('.dnd-card[data-value="' + value + '"]');
        var allowDuplicates = $panel.data('allow-duplicates') === true;
        var isZoneToZone = $dragSourceZone && $dragSourceZone[0] !== $zone[0];

        if (!allowDuplicates) {
            // Find peer zones in same group only (no cross-section interference)
            var group = $zone.attr('data-dnd-group');
            var $peerZones = group
                ? $('.dnd-zone[data-dnd-group="' + group + '"]').not($zone)
                : $zone.closest('.ielts-reading-question-section').find('.dnd-zone').not($zone);
            $peerZones.each(function() {
                if ($(this).find('input[type="hidden"]').val() === value) {
                    removeFromZone($(this), false);
                }
            });
        } else if (isZoneToZone) {
            // Even in allow-duplicates mode, zone-to-zone drag should move (clear source)
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
    // HTML5 DnD doesn't fire on touch devices, so we implement a parallel touch flow
    // that ends up calling the same assignToZone / removeFromZone functions.
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

        // Hide ghost briefly so elementFromPoint sees what's beneath
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
});