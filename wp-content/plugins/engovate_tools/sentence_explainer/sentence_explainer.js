jQuery(document).ready(function ($) {
    $("#sentence-explaining-form").on("submit", function (event) {
        event.preventDefault();

        var limitMessage = checkOrSaveRateLimit('engnovate_sentence_explain');
        if (limitMessage) {
            alert(limitMessage);
            $('.payment-popup-container').css('display', 'flex');
            return;
        }

        //Check character count
        var checkResult = window.contentEditableDiv.checkContentEditorCharacterRequirement("The original text", "#original-text");
        if(checkResult) {
            alert(checkResult);
            return;
        }

        //just reset the textarea to remove old highlight if any. This will also remove unnecessary line break, white space, etc.
        window.contentEditableDiv.resetContentEditor("#original-text");

        //get input
        var input_text = window.contentEditableDiv.getContentEditorPlainText("#original-text");

        window.contentEditableDiv.setContentEditorPlainText("#explanation-text", 'Waiting...');
        $("#submit-button").prop("disabled", true);
        $("#submit-button").text("Processing...");

        let formData = new FormData();
        formData.append('action', 'engnovate_sentence_explain');
        formData.append('engnovate_sentence_explainer_nonce', $('#engnovate_sentence_explainer_nonce').val());
        formData.append('sentence_explaining_text', input_text);

        window.aiWorkerCall({
            ajaxurl: engnovate_sentence_explainer_ajax.ajaxurl,
            formData: formData,
        })
            .then(function (text) {
                if (!text) {
                    window.contentEditableDiv.setContentEditorPlainText("#explanation-text", 'Server Error');
                    console.log(text);
                    return;
                }

                var message = text;
                while ((message.startsWith('"') && message.endsWith('"')) || (message.startsWith('“') && message.endsWith('”'))) {
                    message = message.slice(1, -1);
                }
                window.contentEditableDiv.setContentEditorPlainText("#explanation-text", message);
            })
            // A refusal from either path: the limit is spent, the input is too long, or the account
            // is not verified.
            .fail(function (rejection) {
                var response = rejection && rejection.hardError;

                if (response && response.data) {
                    if (response.data['error'] == 'rate_limit_exceeded') {
                        alert(checkOrSaveRateLimit('engnovate_sentence_explain', response.data['retry_after']));
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
                    alert("Error: Unable to explain text.");
                }

                window.contentEditableDiv.setContentEditorPlainText("#explanation-text", 'Server Error');
            })
            .always(function () {
                $("#submit-button").prop("disabled", false);
                $("#submit-button").text("Break down & Explain");
            });
    });
});
