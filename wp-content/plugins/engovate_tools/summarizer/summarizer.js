jQuery(document).ready(function ($) {
    $("#summarizing-form").on("submit", function (event) {
        event.preventDefault();

        var limitMessage = checkOrSaveRateLimit('engnovate_summarize');
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

        window.contentEditableDiv.setContentEditorPlainText("#summarized-text", 'Waiting...');
        $("#submit-button").prop("disabled", true);
        $("#submit-button").text("Summarizing...");

        let formData = new FormData();
        formData.append('action', 'engnovate_summarize');
        formData.append('engnovate_summarizer_nonce', $('#engnovate_summarizer_nonce').val());
        formData.append('summarizing_text', input_text);

        window.aiWorkerCall({
            ajaxurl: engnovate_summarizer_ajax.ajaxurl,
            formData: formData,
            json: true,
        })
            .then(function (json) {
                var text = json.summarized_text;
                if (!text) {
                    window.contentEditableDiv.setContentEditorPlainText("#summarized-text", 'Sever Error');
                    console.log(text);
                    return;
                }

                window.contentEditableDiv.setContentEditorPlainText("#summarized-text", text);
            })
            // A refusal from either path: the limit is spent, the input is too long, or the account
            // is not verified.
            .fail(function (rejection) {
                var response = rejection && rejection.hardError;

                if (response && response.data) {
                    if (response.data['error'] == 'rate_limit_exceeded') {
                        alert(checkOrSaveRateLimit('engnovate_summarize', response.data['retry_after']));
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
                    alert("Error: Unable to summarize text.");
                }

                window.contentEditableDiv.setContentEditorPlainText("#summarized-text", 'Sever Error');
            })
            .always(function () {
                $("#submit-button").prop("disabled", false);
                $("#submit-button").text("Summarize");
            });
    });
});
