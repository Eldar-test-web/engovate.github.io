jQuery(document).ready(function ($) {

    $(".writing-task-1-academic-generator-form").on("submit", function (e) {
        e.preventDefault();

        var limitMessage = checkOrSaveRateLimit('writing_task_1_academic_generate');
        if (limitMessage) {
            alert(limitMessage);
            $('.payment-popup-container').css('display', 'flex');
            return;
        }

        //Check word count
        var checkResult = window.contentEditableDiv.checkContentEditorCharacterRequirement("The topic", "#writing-task-1-topic");
        if(checkResult) {
            alert(checkResult);
            return;
        }

        checkResult = window.contentEditableDiv.checkContentEditorCharacterRequirement("The idea", "#writing-task-1-idea");
        if(checkResult) {
            alert(checkResult);
            return;
        }

        //just reset the textarea to remove old highlight if any. This will also remove unnecessary line break, white space, etc.
        window.contentEditableDiv.resetContentEditor("#writing-task-1-topic");
        window.contentEditableDiv.resetContentEditor("#writing-task-1-idea");

        var topic = window.contentEditableDiv.getContentEditorPlainText("#writing-task-1-topic");
        var idea = window.contentEditableDiv.getContentEditorPlainText("#writing-task-1-idea");
        
        //get image data
        var imageData = $('.writing-task-1-image input')[0].files[0];
        var imageHash = '';
        if(!imageData) {
            imageHash = $('.writing-task-1-image input').data('imageHash');
            if(!imageHash) {
                alert('Please upload an image!');
                return;
            }
        }

        $('.writing-task-1-academic-generator-form button[type="submit"]').prop("disabled", true);
        $('.writing-task-1-academic-generator-form button[type="submit"]').text("Generating...");
        $(".writing-task-1-academic-generator-form").after('<div class="spinner"></div>');
        window.contentEditableDiv.setContentEditorReadOnly("#writing-task-1-topic", true);
        window.contentEditableDiv.setContentEditorReadOnly("#writing-task-1-idea", true);
        $('.writing-task-1-academic-generator-result').hide();

        var imageDescription = '';

        let formData = new FormData();
        formData.append('action', 'writing_task_1_academic_generate');
        formData.append('writing_task_1_academic_generator_nonce', $('#writing_task_1_academic_generator_nonce').val());
        formData.append('topic', topic);
        formData.append('idea', idea);
        formData.append('image_data', imageData);
        formData.append('image_hash', imageHash);

        window.aiWorkerCall({
            ajaxurl: writing_task_1_academic_generator_ajax.ajaxurl,
            formData: formData,
            json: true,
            onReply: function (data) {
                if (data['image_description']) {
                    imageDescription = data['image_description'];
                }
            },
        })
            .then(function (json) {
                // The four parts of the report, in order. A missing one becomes a blank line, which
                // window.contentEditableDiv.convertPlainTextToHTML() then drops.
                var essay = ['introduction', 'overview', 'body_1', 'body_2']
                    .map(function (f) { return json[f] ?? ''; })
                    .join('\n');

                if (!imageDescription || !essay.trim()) {
                    alert("Server Error. Please try again.");
                    console.log(imageDescription, json);
                    return;
                }

                $('.writing-task-1-academic-generator-result').show();
                window.contentEditableDiv.setContentEditorPlainText('#writing-task-1-image-description', imageDescription);
                window.contentEditableDiv.setContentEditorPlainText('#writing-task-1-generated-essay', essay);
            })
            // A refusal from either path: the limit is spent, the input is too long, the image could
            // not be processed, or the account is not verified.
            .fail(function (rejection) {
                var response = rejection && rejection.hardError;

                if (response && response.data) {
                    if (response.data['error'] == 'rate_limit_exceeded') {
                        alert(checkOrSaveRateLimit('writing_task_1_academic_generate', response.data['retry_after']));
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
                    alert("Error: Unable to generate your essay. Please try again.");
                }
            })
            .always(function () {
                $('.writing-task-1-academic-generator-form button[type="submit"]').prop("disabled", false);
                $('.writing-task-1-academic-generator-form button[type="submit"]').text("Generate Sample");
                $(".writing-task-1-academic-generator-form").siblings('.spinner').remove();
                window.contentEditableDiv.setContentEditorReadOnly("#writing-task-1-topic", false);
                window.contentEditableDiv.setContentEditorReadOnly("#writing-task-1-idea", false);
            });
    });

    $('.writing-task-1-image input').on('change', function(event){
        var file = event.target.files[0];
        if (file) {
            // Check the file type
            var validTypes = ['image/jpeg', 'image/png', 'image/webp'];
            if (!validTypes.includes(file.type)) {
                $('.writing-task-1-image-remove-button').click();
                alert('Please select an image with a file type of PNG, JPEG, or WEBP.');
            }
            else {
                var reader = new FileReader();
                reader.onload = function(e) {
                    var image = new Image();
                    image.onload = function() {
                        // Check the dimensions
                        if (image.width < 150 || image.height < 150) {
                            $('.writing-task-1-image-remove-button').click();
                            alert('Please select an image with dimensions of at least 150x150 pixels.');
                        }
                        else {       
                            // If dimensions are sufficient, proceed
                            $('.writing-task-1-image input').removeClass('should-display');
                            $('.writing-task-1-image-wrapper').addClass('should-display');
                            $('.writing-task-1-image img').attr('src', e.target.result);
                        }
                    };
        
                    image.onerror = function() {
                        $('.writing-task-1-image-remove-button').click();
                        alert('There was an error processing your image.');
                    };
        
                    // Set the src of the image to trigger the load
                    image.src = e.target.result;
                };
                reader.readAsDataURL(file);
            }
        }
        else {
            $('.writing-task-1-image-remove-button').click();
        }
    });

    $('.writing-task-1-image-remove-button').on('click', function(event){
        event.preventDefault();
        $('.writing-task-1-image input').data('imageHash', '');
        $('.writing-task-1-image input').val('');
        $('.writing-task-1-image input').addClass('should-display');
        $('.writing-task-1-image-wrapper').removeClass('should-display');
    });
});
