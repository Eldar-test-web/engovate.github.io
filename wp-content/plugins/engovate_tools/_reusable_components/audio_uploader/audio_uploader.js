window.audioUploaderReusable = window.audioUploaderReusable || {};

jQuery(document).ready(function ($) {
    window.audioUploaderReusable.setOnDoUploadingEvent = function(audioWrapperName, maxUploadingTimeInSeconds, onStart = null, onFinalized = null) {
        const audioWrapper = $(`${audioWrapperName}`);
        const fileInput = audioWrapper.find('input[type="file"]');
        const uploadedAudioPlayer = audioWrapper.find('.uploaded-audio-player');
        const audioElement = audioWrapper.find('audio');
        const uploadButton = audioWrapper.find('.audio-upload-button');

        maxUploadingTimeInSeconds = parseInt(maxUploadingTimeInSeconds);

        // Handle file selection
        fileInput.on('change', function(e) {
            let file = this.files[0];

            if(onStart) {
                onStart();
            }

            if (file) {
                // Load the audio file
                let reader = new FileReader();
                reader.onload = function (e) {
                    audioElement[0].src = e.target.result;
                    audioElement[0].onloadedmetadata = function () {
                        const duration = audioElement[0].duration;
                        if (isNaN(duration) || duration === Infinity) {
                            alert('Error loading audio file. Audio duration is not available. Please try again with another audio file.');
                            window.audioUploaderReusable.resetAudioUploader(audioWrapperName, true);
                            if(onFinalized) {
                                onFinalized(null, null);
                            }
                        }
                        else {
                            if(maxUploadingTimeInSeconds && duration > (maxUploadingTimeInSeconds + 10)) { //10 seconds to make the limit a bit more flexible
                                alert('The maximum duration of the audio file is ' + maxUploadingTimeInSeconds + ' seconds. Please upload a shorter audio file.');
                                window.audioUploaderReusable.resetAudioUploader(audioWrapperName, true);
                                if(onFinalized) {
                                    onFinalized(null, null);
                                }
                            }
                            else {
                                uploadButton.hide();
                                uploadedAudioPlayer.show();
                                if(onFinalized) {
                                    onFinalized(file, Math.floor(duration));
                                }
                            }
                        }
                    };

                    audioElement[0].onerror = function() {
                        alert('Error loading audio file. Please try again with another audio file.');
                        window.audioUploaderReusable.resetAudioUploader(audioWrapperName, true);
                        if(onFinalized) {
                            onFinalized(null, null);
                        }
                    };
                }
                reader.readAsDataURL(file);
            } else {
                window.audioUploaderReusable.resetAudioUploader(audioWrapperName, true);
                if(onFinalized) {
                    onFinalized(null);
                }
            }
        });

        // Trigger file input when upload button is clicked
        uploadButton.on('click', function() {
            fileInput.click();
        });
    }

    window.audioUploaderReusable.setOnUploadedAudioPlayerCloseEvent = function(audioWrapperName, revokeAudioData = true, onClose = null) {
        $(`${audioWrapperName} .uploaded-audio-player-close-button`).on('click', function () {

            if (!window.confirm('Do you want to delete this audio file?')) {
                return;
            }

            window.audioUploaderReusable.resetAudioUploader(audioWrapperName, revokeAudioData);

            if(onClose) onClose();
        });
    }

    window.audioUploaderReusable.resetAudioUploader = function(audioWrapperName, revokeAudioData) {
        const container = $(audioWrapperName);
        const audioElement = container.find('audio');
        const uploadButton = container.find('.audio-upload-button');
        const uploadedAudioPlayer = container.find('.uploaded-audio-player');
        const fileInput = container.find('input[type="file"]');

        audioElement[0].pause();
        audioElement[0].currentTime = 0;
        uploadedAudioPlayer.hide();
        uploadButton.show();
        fileInput.val('');
        if (audioElement.attr('src') && revokeAudioData) {
            URL.revokeObjectURL(audioElement.attr('src'));
        }
        audioElement.attr('src', null);
    }
});