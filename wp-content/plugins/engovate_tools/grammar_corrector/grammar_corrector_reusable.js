window.grammarCorrectorReusable = window.grammarCorrectorReusable || {};

jQuery(document).ready(function ($) {

    window.grammarCorrectorReusable.loadDiff = function(formWrapper, ajaxFormData, beforeSend, onSuccess, onComplete) {

        window.grammarCorrectorReusable.resetHighlightButton(formWrapper);
        window.grammarCorrectorReusable.hideHighlightButton(formWrapper);

        beforeSend();

        // Two calls: the correction prompt runs on the Worker and its answer comes back sealed, so the
        // red/green diff is still worked out on the server.
        window.aiWorkerSealedCall({
            ajaxurl: engnovate_grammar_corrector_reusable_ajax.ajaxurl,
            formData: ajaxFormData
        }).then(function (diffJSON) {
            if(diffJSON) {
                window.grammarCorrectorReusable.processDiff(formWrapper, diffJSON);
                window.grammarCorrectorReusable.hideDiff(formWrapper);
                window.grammarCorrectorReusable.showHighlightButton(formWrapper);
                onSuccess();
                $('html, body').animate({
                    scrollTop: $('#' + window.grammarCorrectorReusable.getCorrectedTextWrapperId(formWrapper)).offset().top - 100
                }, 500);
            }
            else {
                alert("Server Error. Please try again.");
            }
        }).catch(function (rejection) {
            // hardError is the server refusing outright - a spent limit, text that is too long, an
            // unverified account - which arrives as HTTP 200 with success:false. Anything else is the
            // request itself failing.
            var refused = rejection && rejection.hardError && rejection.hardError.data;
            if (refused) {
                if(refused['error'] == 'rate_limit_exceeded') {
                    alert(refused['message'] + '\nAlternatively, you could remove this restriction by upgrading to our Premium plan.');
                    $('.payment-popup-container').css('display', 'flex');
                }
                else {
                    if(refused['error'] == 'user_not_verified') {
                        $('.fast-verification-popup-container').css('display', 'flex');
                    }
                    else {
                        alert(refused['message'] || "Server Error. Please try again.");
                    }
                }
                console.log(rejection.hardError);
            }
            else if(rejection && rejection['responseJSON'])
            {
                console.log(rejection);
                alert(rejection["responseJSON"]["message"]);
            }
            else
            {
                alert("Server Error. Please try again.");
            }
        }).finally(function () {
            onComplete();
        });
    }

    window.grammarCorrectorReusable.processDiff = function(formWrapper, diffJSON) {
        if(!diffJSON) return;
        var originalContent = '';
        var correctedContent = '';
        diffJSON.forEach(diffElement => {
            if(diffElement['left'] && diffElement['left'].length > 0) {
                var leftPart = diffElement['left'];
                originalContent += '<p>' + leftPart + '</p>';
            }

            if(diffElement['right'] && diffElement['right'].length > 0) {
                var rightPart = diffElement['right'];
                correctedContent += '<p>' + rightPart + '</p>';
            }
        });

        window.contentEditableDiv.setContentEditorHTML('#' + window.grammarCorrectorReusable.getOriginalTextWrapperId(formWrapper), originalContent);
        window.contentEditableDiv.setContentEditorHTML('#' + window.grammarCorrectorReusable.getCorrectedTextWrapperId(formWrapper), correctedContent);
        $(formWrapper).find('del, ins, u').removeClass('hide-diff');
    }

    window.grammarCorrectorReusable.setDiff = function(formWrapper, originalText, correctedText) {
        window.contentEditableDiv.setContentEditorHTML('#' + window.grammarCorrectorReusable.getOriginalTextWrapperId(formWrapper), originalText);
        window.contentEditableDiv.setContentEditorHTML('#' + window.grammarCorrectorReusable.getCorrectedTextWrapperId(formWrapper), correctedText);
    }

    window.grammarCorrectorReusable.hideDiff = function(formWrapper) {
        $(formWrapper + "_container").find('del, ins, u').addClass('hide-diff'); //since Squire automatically converts ins to u, we need to also account for that
    }

    window.grammarCorrectorReusable.showDiff = function(formWrapper) {
        $(formWrapper + "_container").find('del, ins, u').removeClass('hide-diff'); //since Squire automatically converts ins to u, we need to also account for that
    }

    window.grammarCorrectorReusable.isNoDiff = function(formWrapper) {
        // var originalContent = window.contentEditableDiv.getContentEditorPlainText('#' + window.grammarCorrectorReusable.getOriginalTextWrapperId(formWrapper));
        // var correctedContent = window.contentEditableDiv.getContentEditorPlainText('#' + window.grammarCorrectorReusable.getCorrectedTextWrapperId(formWrapper));
        // return originalContent == correctedContent;
        return $(formWrapper + "_container").find('del, ins, u').length == 0;
    }

    window.grammarCorrectorReusable.getFormWrapperId = function(childElement) {
        return $(childElement).closest('.grammar-corrector-form-container').find('.compare-content-editable-div')[0].id;
    }

    window.grammarCorrectorReusable.getOriginalTextWrapperId = function(formWrapper) {
        return $(formWrapper + "_container").find('.content-editable-div-wrapper')[0].id;
    }

    window.grammarCorrectorReusable.getCorrectedTextWrapperId = function(formWrapper) {
        return $(formWrapper + "_container").find('.content-editable-div-wrapper')[1].id;
    }

    window.grammarCorrectorReusable.showHighlightButton = function(formWrapper) {
        $(formWrapper + "_container").find(".highlight-corrected-differences-button").show();
    }

    window.grammarCorrectorReusable.hideHighlightButton = function(formWrapper) {
        $(formWrapper + "_container").find(".highlight-corrected-differences-button").hide();
    }

    window.grammarCorrectorReusable.resetHighlightButton = function(formWrapper) {
        $(formWrapper + "_container").find(".highlight-corrected-differences-button").text("Highlight Differences");
    }

    $(".highlight-corrected-differences-button").on("click", function (event) {
        if($(".highlight-corrected-differences-button").text().includes('Unhighlight')) {
            $(".highlight-corrected-differences-button").text("Highlight Differences");
            window.grammarCorrectorReusable.hideDiff('#' + window.grammarCorrectorReusable.getFormWrapperId(this));
        }
        else {
            $(".highlight-corrected-differences-button").text("Unhighlight Differences");
            window.grammarCorrectorReusable.showDiff('#' + window.grammarCorrectorReusable.getFormWrapperId(this));
            if(window.grammarCorrectorReusable.isNoDiff('#' + window.grammarCorrectorReusable.getFormWrapperId(this))) {
                alert('No differences to highlight! The text is already well-polished!');
            }
        }
    });

    $(document).on('click', '.grammar-corrector-form-container del, .grammar-corrector-form-container u, .grammar-corrector-form-container ins', function(e) {

        let targetIndex = $(this).data('index');

        let formWrapperId = "#" + window.grammarCorrectorReusable.getFormWrapperId(this);
        let delElemeent = $("#" + window.grammarCorrectorReusable.getOriginalTextWrapperId(formWrapperId)).find(`del[data-index="${targetIndex}"]`);
        let insElement = $("#" + window.grammarCorrectorReusable.getCorrectedTextWrapperId(formWrapperId)).find(`u[data-index="${targetIndex}"], ins[data-index="${targetIndex}"]`);

        window.elementHighlighter.highlightElement(delElemeent);
        window.elementHighlighter.highlightElement(insElement);
    });
});