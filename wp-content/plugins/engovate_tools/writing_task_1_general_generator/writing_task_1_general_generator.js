jQuery(document).ready(function ($) {
    $(".writing-task-1-general-generator-form").on("submit", function (e) {
        e.preventDefault();

        var limitMessage = checkOrSaveRateLimit('writing_task_1_general_generate');
        if (limitMessage) {
            alert(limitMessage);
            $('.payment-popup-container').css('display', 'flex');
            return;
        }

        //Check word count
        var checkResult = window.contentEditableDiv.checkContentEditorCharacterRequirement("The topic", "#writing-task-1-topic");
        if(checkResult) {
            alert(checkResult);
            return;
        }

        //Check word count
        var checkResult = window.contentEditableDiv.checkContentEditorCharacterRequirement("The idea", "#writing-task-1-idea");
        if(checkResult) {
            alert(checkResult);
            return;
        }

        //just reset the textarea to remove old highlight if any. This will also remove unnecessary line break, white space, etc.
        window.contentEditableDiv.resetContentEditor("#writing-task-1-topic");
        window.contentEditableDiv.resetContentEditor("#writing-task-1-idea");

        var topic = window.contentEditableDiv.getContentEditorPlainText("#writing-task-1-topic");
        var idea = window.contentEditableDiv.getContentEditorPlainText("#writing-task-1-idea");

        $('.writing-task-1-general-generator-form button[type="submit"]').prop("disabled", true);
        $('.writing-task-1-general-generator-form button[type="submit"]').text("Generating...");
        $(".writing-task-1-general-generator-form").after('<div class="spinner"></div>');
        window.contentEditableDiv.setContentEditorReadOnly("#writing-task-1-topic", true);
        window.contentEditableDiv.setContentEditorReadOnly("#writing-task-1-idea", true);
        $('.writing-task-1-general-generator-result').hide();

        let formData = new FormData();
        formData.append('action', 'writing_task_1_general_generate');
        formData.append('writing_task_1_general_generator_nonce', $('#writing_task_1_general_generator_nonce').val());
        formData.append('topic', topic);
        formData.append('idea', idea);

        window.aiWorkerCall({
            ajaxurl: writing_task_1_general_generator_ajax.ajaxurl,
            formData: formData,
            json: true,
        })
            .then(function (json) {
                // The model returns the letter as an array of paragraphs.
                var text = Array.isArray(json.letter) ? json.letter.join('\n') : '';
                if (!text) {
                    alert("Server Error. Please try again.");
                    console.log(text);
                    return;
                }

                $('.writing-task-1-general-generator-result').show();
                window.contentEditableDiv.setContentEditorPlainText('#writing-task-1-generated-essay', text);
            })
            // A refusal from either path: the limit is spent, the input is too long, or the account
            // is not verified.
            .fail(function (rejection) {
                var response = rejection && rejection.hardError;

                if (response && response.data) {
                    if (response.data['error'] == 'rate_limit_exceeded') {
                        alert(checkOrSaveRateLimit('writing_task_1_general_generate', response.data['retry_after']));
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
                    alert("Error: Unable to generate your essay. Please try again.");
                }
            })
            .always(function () {
                $('.writing-task-1-general-generator-form button[type="submit"]').prop("disabled", false);
                $('.writing-task-1-general-generator-form button[type="submit"]').text("Generate Sample");
                $(".writing-task-1-general-generator-form").siblings('.spinner').remove();
                window.contentEditableDiv.setContentEditorReadOnly("#writing-task-1-topic", false);
                window.contentEditableDiv.setContentEditorReadOnly("#writing-task-1-idea", false);
            });
    });
});
