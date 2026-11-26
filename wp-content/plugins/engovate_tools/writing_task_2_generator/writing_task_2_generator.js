jQuery(document).ready(function ($) {

    $(".writing-task-2-generator-form").on("submit", function (e) {
        e.preventDefault();

        var limitMessage = checkOrSaveRateLimit('writing_task_2_generate');
        if (limitMessage) {
            alert(limitMessage);
            $('.payment-popup-container').css('display', 'flex');
            return;
        }

        //Check word count
        var checkResult = window.contentEditableDiv.checkContentEditorCharacterRequirement("The topic", "#writing-task-2-topic");
        if(checkResult) {
            alert(checkResult);
            return;
        }

        //Check word count
        var checkResult = window.contentEditableDiv.checkContentEditorCharacterRequirement("The idea", "#writing-task-2-idea");
        if(checkResult) {
            alert(checkResult);
            return;
        }

        //just reset the textarea to remove old highlight if any. This will also remove unnecessary line break, white space, etc.
        window.contentEditableDiv.resetContentEditor("#writing-task-2-topic");
        window.contentEditableDiv.resetContentEditor("#writing-task-2-idea");

        var topic = window.contentEditableDiv.getContentEditorPlainText("#writing-task-2-topic");
        var idea = window.contentEditableDiv.getContentEditorPlainText("#writing-task-2-idea");
        var bodyCount = $('.writing-task-2-body-count select').val();

        $('.writing-task-2-generator-form button[type="submit"]').prop("disabled", true);
        $('.writing-task-2-generator-form button[type="submit"]').text("Generating...");
        $(".writing-task-2-generator-form").after('<div class="spinner"></div>');
        window.contentEditableDiv.setContentEditorReadOnly("#writing-task-2-topic", true);
        window.contentEditableDiv.setContentEditorReadOnly("#writing-task-2-idea", true);
        $('.writing-task-2-generator-result').hide();

        let formData = new FormData();
        formData.append('action', 'writing_task_2_generate');
        formData.append('writing_task_2_generator_nonce', $('#writing_task_2_generator_nonce').val());
        formData.append('topic', topic);
        formData.append('idea', idea);
        formData.append('body_paragraph_count', bodyCount);

        window.aiWorkerCall({
            ajaxurl: writing_task_2_generator_ajax.ajaxurl,
            formData: formData,
            json: true,
        })
            .then(function (json) {
                // The five parts of the essay, in order. A missing one becomes a blank line, which
                // convertPlainTextToHTML() then drops.
                var text = ['introduction', 'body_1', 'body_2', 'body_3', 'conclusion']
                    .map(function (f) { return json[f] ?? ''; })
                    .join('\n');
                if (!text) {
                    alert("Server Error. Please try again.");
                    console.log(text);
                    return;
                }

                $('.writing-task-2-generator-result').show();
                window.contentEditableDiv.setContentEditorPlainText('#writing-task-2-generated-essay', text);
            })
            // A refusal from either path: the limit is spent, the input is too long, or the account
            // is not verified.
            .fail(function (rejection) {
                var response = rejection && rejection.hardError;

                if (response && response.data) {
                    if (response.data['error'] == 'rate_limit_exceeded') {
                        alert(checkOrSaveRateLimit('writing_task_2_generate', response.data['retry_after']));
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
                $('.writing-task-2-generator-form button[type="submit"]').prop("disabled", false);
                $('.writing-task-2-generator-form button[type="submit"]').text("Generate Essay");
                $(".writing-task-2-generator-form").siblings('.spinner').remove();
                window.contentEditableDiv.setContentEditorReadOnly("#writing-task-2-topic", false);
                window.contentEditableDiv.setContentEditorReadOnly("#writing-task-2-idea", false);
            });
    });
});
