jQuery(document).ready(function ($) {

    $(".speaking-part-generator-form").on("submit", function (e) {
        e.preventDefault();

        //Check word count
        var checkResult = window.contentEditableDiv.checkContentEditorCharacterRequirement("The topic", "#speaking-part-topic");
        if(checkResult) {
            alert(checkResult);
            return;
        }

        //Check word count
        var checkResult = window.contentEditableDiv.checkContentEditorCharacterRequirement("The idea", "#speaking-part-idea");
        if(checkResult) {
            alert(checkResult);
            return;
        }

        //just reset the textarea to remove old highlight if any. This will also remove unnecessary line break, white space, etc.
        window.contentEditableDiv.resetContentEditor("#speaking-part-topic");
        window.contentEditableDiv.resetContentEditor("#speaking-part-idea");

        var topic = window.contentEditableDiv.getContentEditorPlainText("#speaking-part-topic");
        var idea = window.contentEditableDiv.getContentEditorPlainText("#speaking-part-idea");

        var part = speaking_part_generator_ajax.partnumber;

        var limitMessage = checkOrSaveRateLimit('speaking_part_' + part + '_generate');
        if (limitMessage) {
            alert(limitMessage);
            $('.payment-popup-container').css('display', 'flex');
            return;
        }

        $('.speaking-part-generator-form button[type="submit"]').prop("disabled", true);
        $('.speaking-part-generator-form button[type="submit"]').text("Generating...");
        $(".speaking-part-generator-form").after('<div class="spinner"></div>');
        window.contentEditableDiv.setContentEditorReadOnly("#speaking-part-topic", true);
        window.contentEditableDiv.setContentEditorReadOnly("#speaking-part-idea", true);
        $('.speaking-part-generator-result').hide();

        let formData = new FormData();
        formData.append('action', 'speaking_part_' + part + '_generate');
        formData.append('speaking_part_' + part + '_generator_nonce', $('#speaking_part_' + part + '_generator_nonce').val());
        formData.append('topic', topic);
        formData.append('idea', idea);

        window.aiWorkerCall({
            ajaxurl: speaking_part_generator_ajax.ajaxurl,
            formData: formData,
            json: true,
        })
            .then(function (json) {
                // All three parts answer under the same key. Part 2 asks for an array, because its
                // prompt requires four short paragraphs; parts 1 and 3 ask for one string.
                var text = Array.isArray(json.answer) ? json.answer.join('\n') : json.answer;
                if (!text) {
                    alert("Server Error. Please try again.");
                    console.log(text);
                    return;
                }

                $('.speaking-part-generator-result').show();
                window.contentEditableDiv.setContentEditorPlainText('#speaking-part-generated-sample', text);
            })
            // A refusal from either path: the limit is spent, the input is too long, or the account
            // is not verified.
            .fail(function (rejection) {
                var response = rejection && rejection.hardError;

                if (response && response.data) {
                    if (response.data['error'] == 'rate_limit_exceeded') {
                        alert(checkOrSaveRateLimit('speaking_part_' + part + '_generate', response.data['retry_after']));
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
                    alert("Error: Unable to generate your sample. Please try again.");
                }
            })
            .always(function () {
                $('.speaking-part-generator-form button[type="submit"]').prop("disabled", false);
                $('.speaking-part-generator-form button[type="submit"]').text("Generate Sample");
                $(".speaking-part-generator-form").siblings('.spinner').remove();
                window.contentEditableDiv.setContentEditorReadOnly("#speaking-part-topic", false);
                window.contentEditableDiv.setContentEditorReadOnly("#speaking-part-idea", false);
            });
    });

    $(".male-audio-button, .female-audio-button").on("click", function (e) {
        let audioButton = $(this);
        let isThisPlaying = audioButton.attr('playing');

        //no matter which button, just reset all
        $(".male-audio-button, .female-audio-button").find('i').replaceWith('<i class="fa-solid fa-volume-high"></i>');
        $(".male-audio-button, .female-audio-button").attr('playing', 'false');
        window.TTSAudio.stopTTSAudio();

        if(!isThisPlaying || isThisPlaying == 'false') {
            window.TTSAudio.playTTSAudio($('.speaking-part-generator-result .content-editable-div').text(), false, audioButton.text().includes('Male'), () => {
                audioButton.find('i').replaceWith('<i class="fa-solid fa-volume-high"></i>');
                audioButton.attr('playing', 'false');
            });

            audioButton.find('i').replaceWith('<i class="fa-solid fa-pause"></i>');
            audioButton.attr('playing', 'true');
        }
    });

    //--- DOWNLOAD AUDIO ---//
    $(".download-male-audio-button, .download-female-audio-button").on("click", function (e) {
        let audioButton = $(this);
        let audioType = audioButton.text().includes('Male') ? 'male' : 'female';
        let text = $('.speaking-part-generator-result .content-editable-div').text();

        if (text.trim().length == 0) {
            alert('There is no text to generate audio from!');
            return;
        }

        window.speechDownloader.downloadAudio(text, audioType, () => {
            audioButton.prop("disabled", true);
            audioButton.find('i').replaceWith('<i class="fa-solid fa-spinner fa-spin"></i>');
        }, () => {
            audioButton.prop("disabled", false);
            audioButton.find('i').replaceWith('<i class="fa-solid fa-download"></i>');
        });
    });
});
