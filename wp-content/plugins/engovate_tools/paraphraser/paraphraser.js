jQuery(document).ready(function ($) {
    $("#paraphrasing-form").on("submit", function (event) {
        event.preventDefault();

        var limitMessage = checkOrSaveRateLimit('engnovate_paraphrase');
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

        var mode = $("#paraphrasing-mode").val();

        window.contentEditableDiv.setContentEditorPlainText("#paraphrased-text", 'Waiting...');
        $("#submit-button").prop("disabled", true);
        $("#submit-button").text("Paraphrasing...");

        let formData = new FormData();
        formData.append('action', 'engnovate_paraphrase');
        formData.append('engnovate_paraphraser_nonce', $('#engnovate_paraphraser_nonce').val());
        formData.append('paraphrasing_text', input_text);
        formData.append('paraphrasing_mode', mode);

        window.aiWorkerCall({
            ajaxurl: engnovate_paraphraser_ajax.ajaxurl,
            formData: formData,
            json: true,
        })
            .then(function (json) {
                var text = json.result;
                if (!text) {
                    window.contentEditableDiv.setContentEditorPlainText("#paraphrased-text", 'Server Error');
                    console.log(text);
                    return;
                }

                window.contentEditableDiv.setContentEditorPlainText("#paraphrased-text", text);
            })
            // A refusal from either path: the limit is spent, the input is too long, or the account
            // is not verified.
            .fail(function (rejection) {
                var response = rejection && rejection.hardError;

                if (response && response.data) {
                    if (response.data['error'] == 'rate_limit_exceeded') {
                        alert(checkOrSaveRateLimit('engnovate_paraphrase', response.data['retry_after']));
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
                    alert("Server Error: Unable to paraphrase text.");
                }

                window.contentEditableDiv.setContentEditorPlainText("#paraphrased-text", 'Server Error');
            })
            .always(function () {
                $("#submit-button").prop("disabled", false);
                $("#submit-button").text("Paraphrase");
            });
    });
});
