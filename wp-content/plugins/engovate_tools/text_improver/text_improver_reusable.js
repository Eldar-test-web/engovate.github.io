window.textImproverReusable = window.textImproverReusable || {};

jQuery(document).ready(function ($) {

    var onDoneHighlightingDifferencesEvents = {};

    window.textImproverReusable.loadDiff = function(formWrapper, ajaxFormData, beforeSend, onSuccess, onComplete) {

        window.textImproverReusable.resetHighlightButton(formWrapper);
        window.textImproverReusable.hideHighlightButton(formWrapper);

        beforeSend();

        // The original text comes back with the first reply.
        var originalContent = '';

        // Which field(s) of the reply hold the revision; the server says which.
        var answerKey = null;

        window.aiWorkerCall({
            ajaxurl: engnovate_text_improver_reusable_ajax.ajaxurl,
            formData: ajaxFormData,
            json: true,
            onReply: function(data) {
                if(data['original_content']) {
                    originalContent = data['original_content'];
                }
                if(data['answer_key']) {
                    answerKey = data['answer_key'];
                }
            }
        })
            .then(function(json) {
                var improvedContent = '';

                if(json && answerKey) {
                    // One key whose value is an array of paragraphs, one key whose value is a lone
                    // string, or several keys that each hold one paragraph - all three join the same
                    // way. A bare string where an array was asked for IS the answer (one paragraph),
                    // so it is accepted rather than treated as a failure.
                    var keys = Array.isArray(answerKey) ? answerKey : [answerKey];
                    improvedContent = keys
                        .map(function(k) { var v = json[k]; return Array.isArray(v) ? v.join('\n') : (v || ''); })
                        .join('\n')
                        .trim();

                    // The original pane is normalised before it is sent back; the revision comes
                    // straight from the gateway and is not. Normalising it the same way keeps the two
                    // panes comparable - the highlight step matches phrases across them by exact text.
                    improvedContent = window.aiWorkerCleanText(improvedContent);
                }

                if(!originalContent || !improvedContent) {
                    alert("Server Error. Please try again.");
                    console.log(originalContent, json);
                    return;
                }

                window.contentEditableDiv.setContentEditorPlainText('#' + window.textImproverReusable.getOriginalTextWrapperId(formWrapper), originalContent);
                window.contentEditableDiv.setContentEditorPlainText('#' + window.textImproverReusable.getImprovedTextWrapperId(formWrapper), improvedContent);
                window.textImproverReusable.hideDiff(formWrapper);
                window.textImproverReusable.showHighlightButton(formWrapper);
                onSuccess();
                window.elementScroller.scrollTo($('#' + window.textImproverReusable.getImprovedTextWrapperId(formWrapper)));
            })
            .fail(function(rejection) {
                var response = rejection && rejection.hardError;

                if(response && response.data) {
                    if(response.data['error'] == 'rate_limit_exceeded') {
                        alert(response.data['message'] + '\nAlternatively, you could remove this restriction by upgrading to our Premium plan.');
                        $('.payment-popup-container').css('display', 'flex');
                    }
                    else {
                        if(response.data['error'] == 'user_not_verified') {
                            $('.fast-verification-popup-container').css('display', 'flex');
                        }
                        else {
                            alert((typeof response.data === 'string' && response.data) || response.data['message'] || "Server Error. Please try again.");
                        }
                    }
                }
                else {
                    alert("Server Error. Please try again.");
                }
                console.log(response);
            })
            .always(function() {
                onComplete();
            });
    };

    window.textImproverReusable.setDiff = function(formWrapper, originalText, improvedText) {
        window.contentEditableDiv.setContentEditorHTML('#' + window.textImproverReusable.getOriginalTextWrapperId(formWrapper), originalText);
        window.contentEditableDiv.setContentEditorHTML('#' + window.textImproverReusable.getImprovedTextWrapperId(formWrapper), improvedText);
    }

    window.textImproverReusable.hideDiff = function(formWrapper) {
        $(formWrapper).find('.improvement-highlight').addClass('unhighlight');
    }

    window.textImproverReusable.showDiff = function(formWrapper) {
        $(formWrapper).find('.improvement-highlight').removeClass('unhighlight');
    }

    window.textImproverReusable.getFormWrapperId = function(childElement) {
        return $(childElement).closest('.text-improver-form-container').find('.compare-content-editable-div')[0].id;
    }

    window.textImproverReusable.getOriginalTextWrapperId = function(formWrapper) {
        return $(formWrapper + "_container").find('.content-editable-div-wrapper')[0].id;
    }

    window.textImproverReusable.getImprovedTextWrapperId = function(formWrapper) {
        return $(formWrapper + "_container").find('.content-editable-div-wrapper')[1].id;
    }

    window.textImproverReusable.showHighlightButton = function(formWrapper) {
        $(formWrapper + "_container").find(".highlight-improved-differences-button").show();
    }

    window.textImproverReusable.hideHighlightButton = function(formWrapper) {
        $(formWrapper + "_container").find(".highlight-improved-differences-button").hide();
    }

    window.textImproverReusable.resetHighlightButton = function(formWrapper) {
        $(formWrapper + "_container").find(".highlight-improved-differences-button").text("Highlight Important Differences");
    }

    window.textImproverReusable.setOnDoneHighlightingDifferencesEvent = function(formWrapper, eventCallback) {
        onDoneHighlightingDifferencesEvents[formWrapper] = eventCallback;
    }

    $(".highlight-improved-differences-button").on("click", function (event) {

        var highlightButton = $(this);

        var formWrapperId = '#' + window.textImproverReusable.getFormWrapperId(this);
        var originalTextId = '#' + window.textImproverReusable.getOriginalTextWrapperId(formWrapperId);
        var improvedTextId = '#' + window.textImproverReusable.getImprovedTextWrapperId(formWrapperId);

        var originalText = window.contentEditableDiv.getContentEditorPlainText(originalTextId);
        var improvedText = window.contentEditableDiv.getContentEditorPlainText(improvedTextId);

        if($(formWrapperId).find('.improvement-highlight').length > 0) {

            if($(formWrapperId).find('.improvement-highlight').text().length == 0) {
                alert('No important differences to highlight! The text is already well-polished!');
            }
            
            if($(formWrapperId).find('.improvement-highlight.unhighlight').length > 0) {
                window.textImproverReusable.showDiff(formWrapperId);
                highlightButton.text("Unhighlight");
            }
            else {
                window.textImproverReusable.hideDiff(formWrapperId);
                highlightButton.text("Highlight Important Differences");
            }

            return;
        }

        var isHighlightSuccess = false;

        var limitMessage = checkOrSaveRateLimit('engnovate_text_improve_differences_highlight');
        if (limitMessage) {
            alert(limitMessage);
            $('.payment-popup-container').css('display', 'flex');
            return;
        }

        highlightButton.prop("disabled", true);
        highlightButton.text("Highlighting...");
        highlightButton.after('<div class="spinner"></div>');

        let formData = new FormData();
        formData.append('action', 'engnovate_text_improve_differences_highlight');
        formData.append('engnovate_text_improver_reusable_nonce', $('#engnovate_text_improver_reusable_nonce').val());
        formData.append('original_content', originalText);
        formData.append('improved_content', improvedText);

        window.aiWorkerCall({
            ajaxurl: engnovate_text_improver_reusable_ajax.ajaxurl,
            formData: formData,
            json: true,
        })
            .then(function (json) {
                var changes = json['differences'];

                if(changes && changes.length > 0) {
                    var lowerCaseOriginalText = originalText.toLowerCase();
                    var lowerCaseImprovedText = improvedText.toLowerCase();
                    for (let index = 0; index < changes.length; index++) {
                        originalWords = changes[index]['short_original_phrases'];
                        improvedWords = changes[index]['short_improved_phrases'];

                        if(Array.isArray(originalWords)) {
                            originalWords = originalWords[0];
                        }
                        originalWords = originalWords.toLowerCase().trim();

                        if(Array.isArray(improvedWords)) {
                            improvedWords = improvedWords[0];
                        }
                        improvedWords = improvedWords.toLowerCase().trim();

                        if (originalWords != improvedWords && originalWords.length > 0 && improvedWords.length > 0 && lowerCaseOriginalText.indexOf(originalWords) !== -1 && lowerCaseImprovedText.indexOf(improvedWords) !== -1) {
                            var hue = (index * 15) % 360; // Generate a hue between 0 and 360
                            var highlightColor = `hsl(${hue}, 100%, 85%)`; // Create an HSL color string

                            window.textMarker.markText(originalTextId, originalWords, 'improvement-highlight', index, 1, highlightColor);
                            window.textMarker.markText(improvedTextId, improvedWords, 'improvement-highlight', index, 1, highlightColor);         
                        }
                    }
                }

                isHighlightSuccess = true;

                if($(formWrapperId).find('.improvement-highlight').length == 0) {
                    alert('No important differences to highlight! The text is already well-polished!');
                    $(originalTextId + ' .content-editable-div').append('<span class="improvement-highlight"></span>'); //just append an empty element to signal that we have already done highlighting
                }

                if(onDoneHighlightingDifferencesEvents[formWrapperId]) {
                    onDoneHighlightingDifferencesEvents[formWrapperId]();
                }
            })
            // A refusal from either path: the limit is spent, the content is too long, or the
            // account is not verified.
            .fail(function (rejection) {
                var response = rejection && rejection.hardError;

                if (response && response.data) {
                    if (response.data['error'] == 'rate_limit_exceeded') {
                        alert(checkOrSaveRateLimit('engnovate_text_improve_differences_highlight', response.data['retry_after']));
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
                    alert("Error: Unable to highlight differences. Please try again.");
                }
            })
            .always(function () {
                highlightButton.prop("disabled", false);
                if(isHighlightSuccess) {
                    highlightButton.text("Unhighlight");
                }
                else {
                    highlightButton.text("Highlight Important Differences");
                }
                highlightButton.siblings('.spinner').remove();
            });
    });

    $(document).on('click', '.improvement-highlight', function(e) {
        e.preventDefault();
        var index = $(this).attr('marked-index');
        window.elementHighlighter.highlightElement($('#' + window.textImproverReusable.getFormWrapperId(this)).find(`.improvement-highlight[marked-index="${index}"]`));
    });
});