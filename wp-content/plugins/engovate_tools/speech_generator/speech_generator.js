jQuery(document).ready(function ($) {
    $("#generate-male-speech-button, #generate-female-speech-button").on("click", function (event) {
        event.preventDefault();

        //get audio button
        var audioButton = $(this);

        //Check character count
        var checkResult = window.contentEditableDiv.checkContentEditorCharacterRequirement("The text", "#original-text");
        if(checkResult) {
            alert(checkResult);
            return;
        }

        //get input text
        var input_text = window.contentEditableDiv.getContentEditorPlainText("#original-text");

        //get audio type
        var audioType = audioButton.text().includes('Male') ? 'male' : 'female';

        window.speechDownloader.generateBlob(input_text, audioType, () => {
            audioButton.prop("disabled", true);
            audioButton.find('i').replaceWith('<i class="fa-solid fa-spinner fa-spin"></i>');
            $('#speech-generator-result-container').css('display', 'none');
        },
        (blob) => {
            $('#speech-generator-result-container').css('display', 'flex');
            $('#speech-generator-result-audio').attr('src', window.URL.createObjectURL(blob));
            // Remember the container so the download button can name the file correctly —
            // the audio may come back as either WAV or MP3.
            $('#speech-generator-result-audio').data('file-ext', blob.type === 'audio/wav' ? 'wav' : 'mp3');
            $('#speech-generator-result-audio')[0].play();
        },
        () => {
            audioButton.prop("disabled", false);
            audioButton.find('i').replaceWith('<i class="fa-solid fa-volume-high"></i>');
        });
    });

    $('#download-speech-button').on("click", function (event) {
        event.preventDefault();
        
        // Get the audio source URL
        var audioSrc = $('#speech-generator-result-audio').attr('src');

        // Create a temporary link element
        var link = document.createElement('a');
        link.href = audioSrc;
        link.download = 'speech.' + ($('#speech-generator-result-audio').data('file-ext') || 'mp3');

        // Programmatically click the link to trigger the download
        document.body.appendChild(link);
        link.click();

        // Remove the link from the document
        document.body.removeChild(link);
    });
});