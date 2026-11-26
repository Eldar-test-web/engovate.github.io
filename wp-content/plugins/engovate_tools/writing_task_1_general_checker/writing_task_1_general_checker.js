jQuery(document).ready(function ($) {

    // Publish at most one essay to the public UGC library per page load. Sent with the check request so
    // the server only attempts the publish on the first check.
    var ugcSaveUsedThisPageLoad = false;

    $("#writing-task-1-input-form").on("submit", function (event) {
        event.preventDefault();
        
        //Check character count
        var checkResult = window.contentEditableDiv.checkContentEditorCharacterRequirement("The topic", "#writing-task-1-topic");
        if(checkResult) {
            alert(checkResult);
            return;
        }
        var checkResult = window.contentEditableDiv.checkContentEditorCharacterRequirement("The essay", "#writing-task-1-essay");
        if(checkResult) {
            alert(checkResult);
            return;
        }

        //just reset the textarea to remove old highlight if any. This will also remove unnecessary line break, white space, etc.
        window.contentEditableDiv.resetContentEditor("#writing-task-1-topic");
        window.contentEditableDiv.resetContentEditor("#writing-task-1-essay");

        //get topic and essay
        var writing_task_1_topic = window.contentEditableDiv.getContentEditorPlainText("#writing-task-1-topic");
        var writing_task_1_essay = window.contentEditableDiv.getContentEditorPlainText("#writing-task-1-essay");
        
        //reset
        window.writingTaskCheckerReusable.resetWritingBandScoreContainer('#writing-task-1-band-score-container');

        let formData = new FormData();
        formData.append('action', 'writing_task_1_general_check');
        formData.append('writing_task_1_general_checker_nonce', $('#writing_task_1_general_checker_nonce').val());
        formData.append('topic', writing_task_1_topic);
        formData.append('essay', writing_task_1_essay);
        formData.append('attempt_ugc_save', ugcSaveUsedThisPageLoad ? 0 : 1);

        var limitMessage = checkOrSaveRateLimit('writing_task_1_general_check');
        if (limitMessage) {
            alert(limitMessage);
            $('.payment-popup-container').css('display', 'flex');
            return;
        }

        $("#submit-button").prop("disabled", true);
        $("#enhance-natural-button").prop("disabled", true);
        $(".polish-button").hide();
        $("#improve-button").prop("disabled", true);
        $("#submit-button").text("Evaluating...");
        $("#writing-task-1-input-form").after('<div class="spinner"></div>');
        window.contentEditableDiv.setContentEditorReadOnly("#writing-task-1-topic", true);
        window.contentEditableDiv.setContentEditorReadOnly("#writing-task-1-essay", true);

        // Two calls: the grading prompts run on the Worker and their answers come back sealed, so the
        // server is still the only place a band score is decided or saved.
        window.aiWorkerSealedCall({
            ajaxurl: writing_task_1_general_checker_ajax.ajaxurl,
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
                window.writingTaskCheckerReusable.displayContentAssessmentResult('#writing-task-1-band-score-container', contentAssessmentResult);

                var textStatsResult = data['text_stats'];
                window.writingTaskCheckerReusable.displayTextStatsResult('#writing-task-1-band-score-container', textStatsResult);

                window.writingTaskCheckerReusable.displayWordRepetitionResult('#writing-task-1-band-score-container', writing_task_1_essay);

                window.writingTaskCheckerReusable.setOnExportEssayResultButtonClick('#writing-task-1-band-score-container', writing_task_1_topic, data);

                var grammarAssessmentResult = data['grammar_result'];
                window.writingTaskCheckerReusable.displayGrammarAssessmentResult('#writing-task-1-essay', grammarAssessmentResult);

                // Allow the server to publish only on the first check of this page load.
                ugcSaveUsedThisPageLoad = true;
            }
        }).catch(function (rejection) {
            // hardError is the server refusing outright - a spent limit, over-length input, an
            // unverified account - which arrives as HTTP 200 with success:false.
            var refused = rejection && rejection.hardError && rejection.hardError.data;
            if (refused) {
                if(refused['error'] == 'rate_limit_exceeded') {
                    alert(checkOrSaveRateLimit('writing_task_1_general_check', refused['retry_after']));
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
                alert("Error: Unable to evaluate your essay. Please try again.");
            }
        }).finally(function () {
            $("#writing-task-1-input-form").siblings('.spinner').remove();

            $("#submit-button").prop("disabled", false);
            $("#improve-button").prop("disabled", false);
            $("#enhance-natural-button").prop("disabled", false);
            $("#submit-button").text("Check Letter");
            window.contentEditableDiv.setContentEditorReadOnly("#writing-task-1-topic", false);
            window.contentEditableDiv.setContentEditorReadOnly("#writing-task-1-essay", false);
        });
    });

    $(".generate-random-topic-button").on("click", function (event) {
        // if(!confirm('This will remove your current topic and generate a new one. Are you sure you want to continue?')) {
        //     return;
        // }

        window.contentEditableDiv.setContentEditorPlainText('#writing-task-1-topic', '');

        let formData = new FormData();
        formData.append('action', 'writing_task_1_general_generate_random_topic');
        formData.append('writing_task_1_general_checker_nonce', $('#writing_task_1_general_checker_nonce').val());

        var limitMessage = checkOrSaveRateLimit('writing_task_1_general_generate_random_topic');
        if (limitMessage) {
            alert(limitMessage);
            $('.payment-popup-container').css('display', 'flex');
            return;
        }

        $(".generate-random-topic-button").prop("disabled", true);
        $(".generate-random-topic-button").html("Randomizing... <i class='fa-solid fa-spinner fa-spin'></i>");

        window.aiWorkerCall({
            ajaxurl: writing_task_1_general_checker_ajax.ajaxurl,
            formData: formData,
            json: true,
        })
            .then(function (json) {
                // Three come back; choosing one is this tool's job, on either path.
                var topics = json && json['topics'];
                if (!Array.isArray(topics) || !topics.length) {
                    alert("Error generating random topic. Please try again.");
                    console.log(json);
                    return;
                }

                var topic = window.contentEditableDiv.deepCleanText(topics[Math.floor(Math.random() * topics.length)]);
                window.contentEditableDiv.setContentEditorPlainText('#writing-task-1-topic', topic);

                //set timeout to make this run after the complete callback of the ajax call
                setTimeout(function() {
                    if(topic.length > 20) {
                        $('.generate-random-topic-button').html('<i class="fa-solid fa-shuffle"></i>');
                    }
                    else {
                        $('.generate-random-topic-button').html('Randomize <i class="fa-solid fa-shuffle"></i>');
                    }
                }, 100);
            })
            .fail(function (rejection) {
                var response = rejection && rejection.hardError;

                if (response && response.data) {
                    if (response.data['error'] == 'rate_limit_exceeded') {
                        alert(checkOrSaveRateLimit('writing_task_1_general_generate_random_topic', response.data['retry_after']));
                        $('.payment-popup-container').css('display', 'flex');
                    }
                    else if (response.data['error'] == 'user_not_verified') {
                        $('.fast-verification-popup-container').css('display', 'flex');
                    }
                    else {
                        alert("Error generating random topic. Please try again.");
                    }
                }
                else {
                    alert("Error: Unable to generate random topic. Please try again.");
                }
                console.log(response);
            })
            .always(function () {
                $(".generate-random-topic-button").prop("disabled", false);
                $(".generate-random-topic-button").html("Randomize <i class='fa-solid fa-shuffle'></i>");
            });
    });

    $(document).on('input paste keyup change', '#writing-task-1-topic .content-editable-div', function(e) {
        //make the generate random question button less visible if the input is long. Prevent users from accidentally overwriting the text.
        if($(this).text().length > 20) {
            $('.generate-random-topic-button').html('<i class="fa-solid fa-shuffle"></i>');
        }
        else {
            $('.generate-random-topic-button').html('Randomize <i class="fa-solid fa-shuffle"></i>');
        }
    });

    $(".polish-button").on("click", function (event) {
        //has to set timeout because the $('.compare-polish-container') visible status is triggered after the button click (see the writing_task_essay_editable.js)
        setTimeout(() => {
            if($('.compare-polish-container').is(':visible')) {
                $('.button-wrapper').hide();
            }
            else {
                $('.button-wrapper').show();
            }
        }, 0);
    });

    $("#enhance-natural-button").on("click", function (event) {
        //Check character count
        var checkResult = window.contentEditableDiv.checkContentEditorCharacterRequirement("The topic", "#writing-task-1-topic");
        if(checkResult) {
            alert(checkResult);
            return;
        }
        var checkResult = window.contentEditableDiv.checkContentEditorCharacterRequirement("The essay", "#writing-task-1-essay");
        if(checkResult) {
            alert(checkResult);
            return;
        }

        //get essay and topic
        var writing_task_1_topic = window.contentEditableDiv.getContentEditorPlainText("#writing-task-1-topic");
        var writing_task_1_essay = window.contentEditableDiv.getContentEditorPlainText("#writing-task-1-essay");

        //reset
        window.contentEditableDiv.setContentEditorPlainText('#unimproved-essay', '');
        window.contentEditableDiv.setContentEditorPlainText('#improved-essay', '');
        $('.compare-natural-container').hide();

        let formData = new FormData();
        formData.append('action', 'writing_task_1_general_enhance_natural');
        formData.append('writing_task_1_general_checker_nonce', $('#writing_task_1_general_checker_nonce').val());
        formData.append('topic', writing_task_1_topic);
        formData.append('essay', writing_task_1_essay);

        window.textImproverReusable.loadDiff('#compare-natural-form',
        formData,
        () => { //beforeSend
            $("#improve-button").prop("disabled", true);
            $("#enhance-natural-button").prop("disabled", true);
            $("#submit-button").prop("disabled", true);
            $("#enhance-natural-button").text("Improving...");
            $("#writing-task-1-input-form").after('<div class="spinner"></div>');
        }, 
        () => { //onSuccess
            $('.compare-natural-container').show();
        },
        () => { //complete
            $("#improve-button").prop("disabled", false);
            $("#enhance-natural-button").prop("disabled", false);
            $("#submit-button").prop("disabled", false);
            $("#enhance-natural-button").text("Improve Naturalness");
            $("#writing-task-1-input-form").siblings('.spinner').remove();
        });
    });

    $("#improve-button").on("click", function (event) {
        //Check character count
        var checkResult = window.contentEditableDiv.checkContentEditorCharacterRequirement("The topic", "#writing-task-1-topic");
        if(checkResult) {
            alert(checkResult);
            return;
        }
        var checkResult = window.contentEditableDiv.checkContentEditorCharacterRequirement("The essay", "#writing-task-1-essay");
        if(checkResult) {
            alert(checkResult);
            return;
        }

        //get essay and topic
        var writing_task_1_topic = window.contentEditableDiv.getContentEditorPlainText("#writing-task-1-topic");
        var writing_task_1_essay = window.contentEditableDiv.getContentEditorPlainText("#writing-task-1-essay");

        //reset
        window.contentEditableDiv.setContentEditorPlainText('#unenhanced-essay', '');
        window.contentEditableDiv.setContentEditorPlainText('#enhanced-essay', '');
        $('.compare-enhance-container').hide();

        let formData = new FormData();
        formData.append('action', 'writing_task_1_general_improve');
        formData.append('writing_task_1_general_checker_nonce', $('#writing_task_1_general_checker_nonce').val());
        formData.append('topic', writing_task_1_topic);
        formData.append('essay', writing_task_1_essay);

        window.textImproverReusable.loadDiff('#compare-enhance-form',
        formData,
        () => { //beforeSend
            $("#submit-button").prop("disabled", true);
            $("#improve-button").prop("disabled", true);
            $("#enhance-natural-button").prop("disabled", true);
            $("#improve-button").text("Enhancing...");
            $("#writing-task-1-input-form").after('<div class="spinner"></div>');
        }, 
        () => { //onSuccess
            $('.compare-enhance-container').show();
        },
        () => { //complete
            $("#submit-button").prop("disabled", false);
            $("#improve-button").prop("disabled", false);
            $("#enhance-natural-button").prop("disabled", false);
            $("#improve-button").text("Enhance Letter");
            $("#writing-task-1-input-form").siblings('.spinner').remove();
        });
    });
});