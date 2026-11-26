jQuery(document).ready(function ($) {
    $("#submit-button").on("click", function (event) {
        event.preventDefault();

        var checkResult = window.contentEditableDiv.checkContentEditorCharacterRequirement('The original text', '#original-text');
        if(checkResult) {
            alert(checkResult);
            return;
        }

        window.contentEditableDiv.resetContentEditor('#original-text');
        var inputText = window.contentEditableDiv.getContentEditorPlainText('#original-text');

        let formData = new FormData();
        formData.append('action', 'engnovate_grammar_correct');
        formData.append('engnovate_grammar_corrector_nonce', $('#engnovate_grammar_corrector_nonce').val());
        formData.append('original_text', inputText);

        window.grammarCorrectorReusable.loadDiff('#grammar-corrector-form',
        formData,
        () => { //beforeSend
            window.contentEditableDiv.setContentEditorPlainText('#corrected-text', 'Waiting...');
            $("#submit-button").prop("disabled", true);
            $("#submit-button").text("Correcting...");
        }, 
        () => {}, //onSuccess
        () => { //complete
            $("#submit-button").prop("disabled", false);
            $("#submit-button").text("Correct Grammar");
        });
    });
});