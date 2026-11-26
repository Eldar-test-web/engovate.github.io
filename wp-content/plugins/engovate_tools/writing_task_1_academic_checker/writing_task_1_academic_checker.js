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

        //get image data
        var imageData = $('#writing-task-1-image input')[0].files[0];
        var imageHash = '';
        if(!imageData) {
            imageHash = $('#writing-task-1-image input').data('imageHash');
            if(!imageHash) {
                alert('Please upload an image!');
                return;
            }
        }

        //reset
        window.writingTaskCheckerReusable.resetWritingBandScoreContainer('#writing-task-1-band-score-container');

        let formData = new FormData();
        formData.append('action', 'writing_task_1_academic_check');
        formData.append('writing_task_1_academic_checker_nonce', $('#writing_task_1_academic_checker_nonce').val());
        formData.append('topic', writing_task_1_topic);
        formData.append('essay', writing_task_1_essay);
        formData.append('image_data', imageData);
        formData.append('image_hash', imageHash);
        formData.append('attempt_ugc_save', ugcSaveUsedThisPageLoad ? 0 : 1);

        var limitMessage = checkOrSaveRateLimit('writing_task_1_academic_check');
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
        $('#writing-task-1-image-description').hide();
        window.contentEditableDiv.setContentEditorReadOnly("#writing-task-1-topic", true);
        window.contentEditableDiv.setContentEditorReadOnly("#writing-task-1-essay", true);

        // Two calls: the grading prompts run on the Worker and their answers come back sealed, so the
        // server is still the only place a band score is decided or saved. The picture is NOT sent to
        // the Worker - the server works out what it shows on the first call, and the second call does
        // not need the file again, so it is left out of that post.
        window.aiWorkerSealedCall({
            ajaxurl: writing_task_1_academic_checker_ajax.ajaxurl,
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

                $('#writing-task-1-image-description .content-editable-div span').text(data['image_description']);
                $('#writing-task-1-image-description').show();

                // Allow the server to publish only on the first check of this page load.
                ugcSaveUsedThisPageLoad = true;
            }
        }).catch(function (rejection) {
            // hardError is the server refusing outright - a spent limit, over-length input, an
            // unverified account, an unreadable picture - which arrives as HTTP 200 with success:false.
            var refused = rejection && rejection.hardError && rejection.hardError.data;
            if (refused) {
                if(refused['error'] == 'rate_limit_exceeded') {
                    alert(checkOrSaveRateLimit('writing_task_1_academic_check', refused['retry_after']));
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
            $("#submit-button").text("Check Report");
            window.contentEditableDiv.setContentEditorReadOnly("#writing-task-1-topic", false);
            window.contentEditableDiv.setContentEditorReadOnly("#writing-task-1-essay", false);
        });
    });

    $('#writing-task-1-image input').on('change', function(event){
        var file = event.target.files[0];
        if (file) {
            // Check the file type
            var validTypes = ['image/jpeg', 'image/png', 'image/webp'];
            if (!validTypes.includes(file.type)) {
                $('#writing-task-1-image-remove-button').click();
                alert('Please select an image with a file type of PNG, JPEG, or WEBP.');
            }
            else {
                var reader = new FileReader();
                reader.onload = function(e) {
                    var image = new Image();
                    image.onload = function() {
                        // Check the dimensions
                        if (image.width < 150 || image.height < 150) {
                            $('#writing-task-1-image-remove-button').click();
                            alert('Please select an image with dimensions of at least 150x150 pixels.');
                        }
                        else {       
                            // If dimensions are sufficient, proceed
                            $('#writing-task-1-image input').removeClass('should-display');
                            $('.writing-task-1-image-wrapper').addClass('should-display');
                            $('#writing-task-1-image img').attr('src', e.target.result);
                        }
                    };
        
                    image.onerror = function() {
                        $('#writing-task-1-image-remove-button').click();
                        alert('There was an error processing your image.');
                    };
        
                    // Set the src of the image to trigger the load
                    image.src = e.target.result;
                };
                reader.readAsDataURL(file);
            }
        }
        else {
            $('#writing-task-1-image-remove-button').click();
        }
    });

    $('#writing-task-1-image-remove-button').on('click', function(event){
        event.preventDefault();
        $('#writing-task-1-image input').data('imageHash', '');
        $('#writing-task-1-image input').val('');
        $('#writing-task-1-image input').addClass('should-display');
        $('.writing-task-1-image-wrapper').removeClass('should-display');
    });

    $(".generate-random-topic-button").on("click", function (event) {
        // if(!confirm('This will reload the page and generate a new topic. Are you sure you want to continue?')) {
        //     return;
        // }

        window.contentEditableDiv.setContentEditorPlainText('#writing-task-1-topic', '');

        let formData = new FormData();
        formData.append('action', 'writing_task_1_academic_generate_random_topic');
        formData.append('writing_task_1_academic_checker_nonce', $('#writing_task_1_academic_checker_nonce').val());

        var limitMessage = checkOrSaveRateLimit('writing_task_1_academic_generate_random_topic');
        if (limitMessage) {
            alert(limitMessage);
            $('.payment-popup-container').css('display', 'flex');
            return;
        }

        $.ajax({
            url: writing_task_1_academic_checker_ajax.ajaxurl,
            type: 'POST',
            data: formData,
            processData: false,
            contentType: false,
            beforeSend: function () {
                $(".generate-random-topic-button").prop("disabled", true);
                $(".generate-random-topic-button").html("Randomizing... <i class='fa-solid fa-spinner fa-spin'></i>");
            },
            success: function (response) {
                if (!response.success) {
                    if (response.data['error'] == 'rate_limit_exceeded') {
                        alert(checkOrSaveRateLimit('writing_task_1_academic_generate_random_topic', response.data['retry_after']));
                        $('.payment-popup-container').css('display', 'flex');
                    }
                    else {
                        if (response.data['error'] == 'user_not_verified') {
                            $('.fast-verification-popup-container').css('display', 'flex');
                        }
                        else {
                            alert("Error generating random topic. Please try again.");
                        }
                    }
                    console.log(response);
                }
                else {
                    if (!response.data || !response.data['topic']) {
                        alert("Error generating random topic. Please try again.");
                    }
                    else {
                        var topic = response.data['topic'];
                        var imageHash = response.data['image_hash'];

                        //set the params for the url and reload the page
                        var url = new URL(window.location.href);
                        url.searchParams.set('topic', topic);
                        url.searchParams.set('image', imageHash);
                        window.location.href = url.toString();
                    }
                }
            },
            error: function (error) {
                alert("Error: Unable to generate random topic. Please try again.");
            },
            complete: function () {
                $(".generate-random-topic-button").prop("disabled", false);
                $(".generate-random-topic-button").html("Randomize <i class='fa-solid fa-shuffle'></i>");
            }
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
        formData.append('action', 'writing_task_1_academic_enhance_natural');
        formData.append('writing_task_1_academic_checker_nonce', $('#writing_task_1_academic_checker_nonce').val());
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

        //get image data
        var imageData = $('#writing-task-1-image input')[0].files[0];
        var imageHash = '';
        if(!imageData) {
            imageHash = $('#writing-task-1-image input').data('imageHash');
        }

        //reset
        $('#original-writing-task-1-essay').html('');
        $('#enhanced-writing-task-1-essay').html('');
        $('.compare-enhance-container').hide();

        let formData = new FormData();
        formData.append('action', 'writing_task_1_academic_improve');
        formData.append('writing_task_1_academic_checker_nonce', $('#writing_task_1_academic_checker_nonce').val());
        formData.append('topic', writing_task_1_topic);
        formData.append('essay', writing_task_1_essay);
        formData.append('image_data', imageData);
        formData.append('image_hash', imageHash);

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
            $("#improve-button").text("Enhance Report");
            $("#writing-task-1-input-form").siblings('.spinner').remove();
        });
    });
});