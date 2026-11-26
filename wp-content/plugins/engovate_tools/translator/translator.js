jQuery(document).ready(function ($) {
    $("#translating-form").on("submit", function (event) {
        event.preventDefault();

        var limitMessage = checkOrSaveRateLimit('engnovate_translate');
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

        var language = $("#language-picker option:selected").text();

        window.contentEditableDiv.setContentEditorPlainText("#translated-text", 'Waiting...');
        $("#submit-button").prop("disabled", true);
        $("#submit-button").text("Translating...");

        let formData = new FormData();
        formData.append('action', 'engnovate_translate');
        formData.append('engnovate_translator_nonce', $('#engnovate_translator_nonce').val());
        formData.append('translating_text', input_text);
        formData.append('translated_language', language);

        window.aiWorkerCall({
            ajaxurl: engnovate_translator_ajax.ajaxurl,
            formData: formData,
            json: true,
        })
            .then(function (json) {
                var text = json.translated_text;
                if (!text) {
                    window.contentEditableDiv.setContentEditorPlainText("#translated-text", 'Server Error');
                    console.log(text);
                    return;
                }

                window.contentEditableDiv.setContentEditorPlainText("#translated-text", text);
            })
            // A refusal from either path: the limit is spent, the input is too long, or the account
            // is not verified.
            .fail(function (rejection) {
                var response = rejection && rejection.hardError;

                if (response && response.data) {
                    if (response.data['error'] == 'rate_limit_exceeded') {
                        alert(checkOrSaveRateLimit('engnovate_translate', response.data['retry_after']));
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
                    alert("Error: Unable to translate text.");
                }

                window.contentEditableDiv.setContentEditorPlainText("#translated-text", 'Server Error');
            })
            .always(function () {
                $("#submit-button").prop("disabled", false);
                $("#submit-button").text("Translate");
            });
    });

    // Load the Select2 library
    $('#language-picker').select2();
});
