window.speechDownloader = window.speechDownloader || {};

jQuery(document).ready(function ($) {

    window.speechDownloader.downloadAudio = function(text, audioType, beforeSendCallback = null, completeCallback = null) {
        window.speechDownloader.generateBlob(text, audioType, 
            beforeSendCallback,
            (blob) => {
                // Create download link
                var url = window.URL.createObjectURL(blob);
                var a = document.createElement('a');
                a.href = url;
                // Name the file after what the blob actually is — it may be either format.
                a.download = 'audio_' + audioType + (blob.type === 'audio/wav' ? '.wav' : '.mp3');
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
            }, 
            completeCallback
        );
    }

    window.speechDownloader.generateBlob = function(text, audioType, beforeSendCallback = null, successCallback = null, completeCallback = null) {
        var limitMessage = checkOrSaveRateLimit('speech_downloader_generate_audio');
        if (limitMessage) {
            alert(limitMessage);
            $('.payment-popup-container').css('display', 'flex');
            return;
        }

        let formData = new FormData();
        formData.append('action', 'speech_downloader_generate_audio');
        formData.append('speech_downloader_nonce', speech_downloader_ajax.nonce);
        formData.append('audio_type', audioType);
        formData.append('text', text);

        if(beforeSendCallback) {
            beforeSendCallback();
        }

        window.aiWorkerCall({
            ajaxurl: speech_downloader_ajax.ajaxurl,
            formData: formData,
        })
            .then(function (base64String) {
                if (!base64String) {
                    alert("Error downloading audio. Please try again.");
                    return;
                }

                // Convert base64 to blob
                var byteCharacters = atob(base64String);
                var byteNumbers = new Array(byteCharacters.length);
                for (var i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                }
                var byteArray = new Uint8Array(byteNumbers);
                // The audio can come back as either WAV or MP3, so read the container from
                // the header rather than assuming one.
                var isRiffWav = byteArray[0] === 0x52 && byteArray[1] === 0x49 && byteArray[2] === 0x46 && byteArray[3] === 0x46;
                var blob = new Blob([byteArray], { type: isRiffWav ? 'audio/wav' : 'audio/mpeg' });

                if(successCallback) {
                    successCallback(blob);
                }
            })
            .fail(function (rejection) {
                var response = rejection && rejection.hardError;

                if (response && response.data) {
                    if (response.data['error'] == 'rate_limit_exceeded') {
                        alert(checkOrSaveRateLimit('speech_downloader_generate_audio', response.data['retry_after']));
                        $('.payment-popup-container').css('display', 'flex');
                    }
                    else if (response.data['error'] == 'user_not_verified') {
                        $('.fast-verification-popup-container').css('display', 'flex');
                    }
                    else {
                        alert((typeof response.data === 'string' && response.data) || "Error downloading audio. Please try again.");
                    }
                }
                else {
                    alert("Error: Unable to download audio. Please try again.");
                }
                console.log(response);
            })
            .always(function () {
                if(completeCallback) {
                    completeCallback();
                }
            });
    }
});