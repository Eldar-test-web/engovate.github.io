jQuery(document).ready(function ($) {
    $("#grammar-connectness-checker-form").on("submit", function (event) {
        event.preventDefault();

        var limitMessage = checkOrSaveRateLimit('engnovate_grammar_correctness_check');
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

        window.contentEditableDiv.setContentEditorPlainText("#assessment-text", 'Waiting...');
        $("#submit-button").prop("disabled", true);
        $("#submit-button").text("Checking...");

        let formData = new FormData();
        formData.append('action', 'engnovate_grammar_correctness_check');
        formData.append('engnovate_grammar_correctness_checker_nonce', $('#engnovate_grammar_correctness_checker_nonce').val());
        formData.append('grammar_checking_text', input_text);

        window.aiWorkerCall({
            ajaxurl: engnovate_grammar_correctness_checker_ajax.ajaxurl,
            formData: formData,
            json: true,
        })
            .then(function (json) {
                var text = json.explanation;
                if (!text) {
                    window.contentEditableDiv.setContentEditorPlainText("#assessment-text", 'Server Error');
                    console.log(text);
                    return;
                }

                window.contentEditableDiv.setContentEditorPlainText("#assessment-text", text);
            })
            // A refusal from either path: the limit is spent, the input is too long, or the account
            // is not verified.
            .fail(function (rejection) {
                var response = rejection && rejection.hardError;

                if (response && response.data) {
                    if (response.data['error'] == 'rate_limit_exceeded') {
                        alert(checkOrSaveRateLimit('engnovate_grammar_correctness_check', response.data['retry_after']));
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
                    alert("Error: Unable to check text.");
                }

                window.contentEditableDiv.setContentEditorPlainText("#assessment-text", 'Server Error');
            })
            .always(function () {
                $("#submit-button").prop("disabled", false);
                $("#submit-button").text("Check");
            });
    });
});
