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
        formData.append('action', 'engnovate_text_improve');
        formData.append('engnovate_text_improver_nonce', $('#engnovate_text_improver_nonce').val());
        formData.append('original_text', inputText);

        window.textImproverReusable.loadDiff('#text-improver-form',
        formData,
        () => { //beforeSend
            window.contentEditableDiv.setContentEditorPlainText('#improved-text', 'Waiting...');
            $("#submit-button").prop("disabled", true);
            $("#submit-button").text("Improving...");
        }, 
        () => {}, //onSuccess
        () => { //complete
            $("#submit-button").prop("disabled", false);
            $("#submit-button").text("Improve Text");
        });
    });
});