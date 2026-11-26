jQuery(document).ready(function($) {
    
    $('.start-writing-button').on('click', function() {
        $('.writing-improvement-instruction-overlay').hide();
    });

    $('.retry-button').on('click', function() {
        var writingImprovementStepContainer = $(this).closest('.writing-improvement-step');
        writingImprovementStepContainer.find('.writing-improvement-answer').show();
        writingImprovementStepContainer.find('.writing-improvement-result').hide();
    });

    $('.next-step-button').on('click', function() {
        var currentStep = parseInt($(this).closest('.writing-improvement-step').data('step'));
        $(`#writing-improvement-palette-step-${currentStep + 1}`).click();
    });

    $('.writing-improvement-palette-step').on('click', function() {
        var currentStep = parseInt($(this).data('step'));
        $('.writing-improvement-palette-step').removeClass('current');
        $(`#writing-improvement-palette-step-${currentStep}`).addClass('current');
        $('.writing-improvement-step').removeClass('current');
        $(`#writing-improvement-step-${currentStep}`).addClass('current');
    });

    $('.generate-writing-idea-wrapper a').on('click', function(e) {
        e.preventDefault();

        var writingImprovementStepContainer = $(this).closest('.writing-improvement-step');
        var currentStep = writingImprovementStepContainer.data('step');
        var currentAnswerName = '#writing-improvement-answer-' + currentStep;

        var writingTopic = $('.writing-improvement-topic .topic').text();
        var writingPart = writingImprovementStepContainer.find(currentAnswerName).find('label').text().toLowerCase();

        var limitMessage = checkOrSaveRateLimit('generate_writing_ideas');
        if (limitMessage) {
            alert(limitMessage);
            $('.payment-popup-container').css('display', 'flex');
            return;
        }

        $('.spinner-overlay').css('display', 'flex');

        let formData = new FormData();
        formData.append('action', 'generate_writing_ideas');
        formData.append('improve_writing_test_nonce', $('#improve_writing_test_nonce').val());
        formData.append('writing_topic', writingTopic);
        formData.append('writing_part', writingPart);

        window.aiWorkerCall({
            ajaxurl: single_improve_writing_test_ajax.ajaxurl,
            formData: formData,
            json: true,
        })
            .then(function (json) {
                var ideas = json.examples;
                if (!ideas || !ideas.length) {
                    alert("Error: Unable to generate ideas. Please try again or refreshing the page.");
                    console.log(ideas);
                    return;
                }

                var ideasHTML = '';
                for (let index = 0; index < ideas.length; index++) {
                    ideasHTML += '<div class="generated-writing-idea">'+ ideas[index] +'</div>';
                }
                writingImprovementStepContainer.find('.generated-writing-ideas').html(ideasHTML);
            })
            // A refusal from either path: the limit is spent, the input is too long, or the account
            // is not verified.
            .fail(function (rejection) {
                var response = rejection && rejection.hardError;

                if (response && response.data) {
                    if (response.data['error'] == 'rate_limit_exceeded') {
                        alert(checkOrSaveRateLimit('generate_writing_ideas', response.data['retry_after']));
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
                    alert("Error: Unable to generate ideas. Please try again or refreshing the page.");
                }
            })
            .always(function () {
                $('.spinner-overlay').hide();
            });
    });

    $('.writing-improvement-answer').on('submit', function(e) {

        e.preventDefault();

        var writingImprovementStepContainer = $(this).closest('.writing-improvement-step');
        var currentStep = writingImprovementStepContainer.data('step');
        var currentAnswerName = '#writing-improvement-answer-' + currentStep;

        var writingTopic = $('.writing-improvement-topic .topic').text();
        var writingPart = writingImprovementStepContainer.find(currentAnswerName).find('label').text().toLowerCase();

        //Check character count
        var checkResult = window.contentEditableDiv.checkContentEditorCharacterRequirement("The answer", currentAnswerName);
        if(checkResult) {
            alert(checkResult);
            return;
        }

        //just reset the textarea to remove old highlight if any. This will also remove unnecessary line break, white space, etc.
        window.contentEditableDiv.resetContentEditor(currentAnswerName);

        //get answer
        var writingContent = window.contentEditableDiv.getContentEditorPlainText(currentAnswerName);

        let formData = new FormData();
        formData.append('action', 'improve_writing_part');
        formData.append('improve_writing_test_nonce', $('#improve_writing_test_nonce').val());
        formData.append('writing_topic', writingTopic);
        formData.append('writing_content', writingContent);
        formData.append('writing_part', writingPart);

        window.textImproverReusable.loadDiff('#compare-writing-container-' + currentStep,
        formData,
        () => { //beforeSend
            $('.spinner-overlay').css('display', 'flex');
        }, 
        () => { //onSuccess
            writingImprovementStepContainer.find('.writing-improvement-answer').hide();
            writingImprovementStepContainer.find('.writing-improvement-result').show();
        },
        () => { //complete
            $('.spinner-overlay').hide();

            window.textImproverReusable.setDiff(`#compare-writing-review-container-${currentStep}`, window.contentEditableDiv.getContentEditorHTML(`#unenhanced-writing-${currentStep}`), window.contentEditableDiv.getContentEditorHTML(`#enhanced-writing-${currentStep}`));

            //do this so that if users highlight differences, it also reflects in the review container
            window.textImproverReusable.setOnDoneHighlightingDifferencesEvent(`#compare-writing-container-${currentStep}`, () => {
                window.textImproverReusable.setDiff(`#compare-writing-review-container-${currentStep}`, window.contentEditableDiv.getContentEditorHTML(`#unenhanced-writing-${currentStep}`), window.contentEditableDiv.getContentEditorHTML(`#enhanced-writing-${currentStep}`));
            });
        });
    });

    $('.writing-improvement-entire-answer').on('submit', function(e) {
        e.preventDefault();

        var checkResult = window.contentEditableDiv.checkContentEditorCharacterRequirement("The answer", "#writing-entire-answer");
        if(checkResult) {
            alert(checkResult);
            return;
        }

        //just reset the textarea to remove old highlight if any. This will also remove unnecessary line break, white space, etc.
        window.contentEditableDiv.resetContentEditor("#writing-entire-answer");

        //get topic and essay
        var writingTopic = $('.writing-improvement-topic .topic').text();
        var writingContent = window.contentEditableDiv.getContentEditorPlainText("#writing-entire-answer");

        //reset
        window.writingTaskCheckerReusable.resetWritingBandScoreContainer('#writing-band-score-container');

        var limitMessage = checkOrSaveRateLimit('mark_entire_writing');
        if (limitMessage) {
            alert(limitMessage);
            $('.payment-popup-container').css('display', 'flex');
            return;
        }

        var formData = new FormData();
        formData.append('action', 'mark_entire_writing');
        formData.append('improve_writing_test_nonce', $('#improve_writing_test_nonce').val());
        formData.append('writing_topic', writingTopic);
        formData.append('writing_content', writingContent);

        $('.spinner-overlay').css('display', 'flex');

        // Two calls: the grading prompts run on the Worker and their answers come back sealed, so the
        // band score is still worked out on the server.
        window.aiWorkerSealedCall({
            ajaxurl: single_improve_writing_test_ajax.ajaxurl,
            formData: formData
        }).then(function (data) {
            if(!data || !data["content_result"])
            {
                alert("Server Error. Please try again.");
                console.log(data);
            }
            else
            {
                var contentAssessmentResult = data['content_result'];
                window.writingTaskCheckerReusable.displayContentAssessmentResult('#writing-band-score-container', contentAssessmentResult);

                var textStatsResult = data['text_stats'];
                window.writingTaskCheckerReusable.displayTextStatsResult('#writing-band-score-container', textStatsResult);

                window.writingTaskCheckerReusable.displayWordRepetitionResult('#writing-band-score-container', writingContent);

                window.writingTaskCheckerReusable.setOnExportEssayResultButtonClick('#writing-band-score-container', writingTopic, data);

                var grammarAssessmentResult = data['grammar_result'];
                window.writingTaskCheckerReusable.displayGrammarAssessmentResult('#writing-entire-answer', grammarAssessmentResult);

                $('#writing-band-score-container').show();
                $('.mark-writing-answer-button').hide();
                $('.retry-writing-entire-answer-button').show();
            }
        }).catch(function (rejection) {
            // hardError is the server refusing outright - a spent limit, over-length input, an
            // unverified account - which arrives as HTTP 200 with success:false.
            var refused = rejection && rejection.hardError && rejection.hardError.data;
            if (refused) {
                if(refused['error'] == 'rate_limit_exceeded') {
                    alert(checkOrSaveRateLimit('mark_entire_writing', refused['retry_after']));
                    $('.payment-popup-container').css('display', 'flex');
                }
                else {
                    if(refused['error'] == 'user_not_verified') {
                        $('.fast-verification-popup-container').css('display', 'flex');
                    }
                    else {
                        alert(refused['message'] || "Server Error. Please try again.");
                    }
                }
            }
            else if(rejection && rejection['responseJSON'])
            {
                console.log(rejection);
                alert(rejection["responseJSON"]["message"]);
            }
            else
            {
                alert("Error: Unable to mark your writing. Please try again or refreshing the page.");
            }
        }).finally(function () {
            $('.spinner-overlay').hide();
        });

    });

    $('.retry-writing-entire-answer-button').on('click', function(e) {
        e.preventDefault();

        $('.mark-writing-answer-button').show();
        $('.retry-writing-entire-answer-button').hide();
        $('#writing-band-score-container').hide();
        window.elementScroller.scrollTo($('.writing-improvement-entire-answer'));
    });

    $('#writing-improvement-dropdown-button').on('click', function(e) {
        e.preventDefault();
        $('.writing-improvement-dropdown-content').toggle();
    });

    $(document).on('mousedown', function(e) {
        if (!$(e.target).closest('#writing-improvement-dropdown-button, .writing-improvement-dropdown-content').length) {
            $('.writing-improvement-dropdown-content').hide();
        }
    });

    $('.post-locker').on('click', function(e) {
        e.preventDefault();
        $('.payment-popup-container').css('display', 'flex');
    });

    //--- ASK BEFORE LEAVING ---//
    window.addEventListener("beforeunload", (event) => {
        event.preventDefault();
        event.returnValue = ""; // This will trigger the default browser message
    });
});