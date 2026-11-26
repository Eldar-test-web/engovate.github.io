window.writingTaskCheckerReusable = window.writingTaskCheckerReusable || {};

jQuery(document).ready(function ($) {

    window.writingTaskCheckerReusable.grammarCheckErrors = {};

    window.writingTaskCheckerReusable.displayGrammarAssessmentResult = function(containerName, grammarAssessmentResult) {
        if(!grammarAssessmentResult) {
            return;
        }

        window.contentEditableDiv.setContentEditorHTML(containerName, grammarAssessmentResult['left']);

        window.writingTaskCheckerReusable.grammarCheckErrors[containerName] = grammarAssessmentResult;

        var polishFormContainerId = '#' + window.grammarCorrectorReusable.getFormWrapperId($(containerName).closest('.writing-task-essay-editable').find('.compare-content-editable-div')[0]);
        window.grammarCorrectorReusable.setDiff(polishFormContainerId, grammarAssessmentResult['left'], grammarAssessmentResult['right']);
        window.writingTaskCheckerReusable.setPolishButtonVisibility(containerName, true);

        //display word repetition
        var essay = window.contentEditableDiv.getContentEditorPlainText(containerName);
        var wordRepetitionArray = window.writingTaskCheckerReusable.getWordRepetition(essay);
        var tempDiv = $('<div></div>').html(window.contentEditableDiv.getContentEditorHTML(containerName));
        var index = 0;
        wordRepetitionArray.forEach(repetition => {
            if(repetition.count > 2 && repetition.word.length > 4) {
                window.textMarker.markText(tempDiv, repetition.word, 'repetition-element', index, null);
                index++;
            }
        });
        window.contentEditableDiv.setContentEditorHTML(containerName, tempDiv.html());
        window.textMarker.removeMarkTargetHolder(tempDiv); //remove otherwise the next time we don't see the highlight (since we init Mark on tempDiv and it would get removed after this function but the reference inside the textMarker script is still there)
    }

    $(".writing-task-essay-editable .polish-button").on("click", function (event) {
        if($(this).closest('.writing-task-essay-editable').find('.compare-polish-container').is(':visible')) {
            $(this).closest('.writing-task-essay-editable').find('.content-editable-div-wrapper:first').show();
            $(this).closest('.writing-task-essay-editable').find('.compare-polish-container').hide();
            $(this).html('Show Polished Writing <i class="fa-solid fa-arrow-right"></i>');
        }
        else {
            $(this).closest('.writing-task-essay-editable').find('.content-editable-div-wrapper:first').hide();
            $(this).closest('.writing-task-essay-editable').find('.compare-polish-container').show();
            $(this).html('<i class="fa-solid fa-arrow-left"></i> Back To Edit Writing');
        }
    });

    window.writingTaskCheckerReusable.setPolishButtonVisibility = function(containerName, visible) {
        if(visible) {
            $(containerName).closest('.writing-task-essay-editable').find(".polish-button").show();
        }
        else {
            $(containerName).closest('.writing-task-essay-editable').find(".polish-button").hide();
        }
    } 

    //better to use anchor and text to highlight since the index returned by check grammar is kind of weird (for example, for words with ' like don't person's)
    window.writingTaskCheckerReusable.grammarHighlightText = function(element, anchorIndex, textToHighlight, grammarMistakeIndex) {
        if(!textToHighlight) return;
        
        let charIndex = 0;
    
        function highlight(node) {
            if (node.nodeType === Node.TEXT_NODE) {
                const endCharIndex = charIndex + node.textContent.length;
                if (endCharIndex > anchorIndex) {
                    let closestIndex = -1;
                    let minDistance = Infinity;
                    let startIndex = 0;
                    while ((startIndex = node.textContent.indexOf(textToHighlight, startIndex)) !== -1) {
                        const distance = Math.abs(anchorIndex - charIndex - startIndex);
                        if (distance < minDistance) {
                            minDistance = distance;
                            closestIndex = startIndex;
                        }
                        startIndex++;
                    }
                    if (closestIndex !== -1) {
                        const before = document.createTextNode(node.textContent.substring(0, closestIndex));
                        const highlighted = document.createElement('span');
                        highlighted.setAttribute('data-grammar-mistake-index', grammarMistakeIndex);
                        highlighted.className = 'grammar-highlight';
                        highlighted.textContent = node.textContent.substring(closestIndex, closestIndex + textToHighlight.length);
                        const after = document.createTextNode(node.textContent.substring(closestIndex + textToHighlight.length));
    
                        const parentNode = node.parentNode;
                        parentNode.replaceChild(after, node);
                        parentNode.insertBefore(highlighted, after);
                        parentNode.insertBefore(before, highlighted);
                        return true;
                    }
                }
                charIndex = endCharIndex;
            } else if (node.nodeType === Node.ELEMENT_NODE) {
                if (node.nodeName === 'P' && charIndex > 0) {
                    charIndex = charIndex + 2;
                }
                for (let i = 0; i < node.childNodes.length; i++) {
                    if (highlight(node.childNodes[i])) {
                        return true;
                    }
                }
            }
            return false;
        }
    
        highlight(element);
    }

    window.writingTaskCheckerReusable.unescapeString = function(str) {
        var escapes = {
            "\\'": "'",
            '\\"': '"',
            '\\\\': '\\',
            '\\n': '\n',
            '\\r': '\r',
            '\\t': '\t',
            '\\b': '\b',
            '\\f': '\f'
        };
        return str.replace(/\\['"\\nrftb]/g, function(match) {
            return escapes[match];
        });
    }

    $('body').append('<div class="grammar-mistake-popup"><div class="notice">Note: This is only a suggestion and may not be accurate. Please double-check using the internet.</div><div class="correction"></div><button type="button" class="explain-grammar-mistake-button">Why is this wrong?</button><div class="grammar-mistake-explanation" aria-live="polite"></div></div>');

    // Explanations already fetched, so reopening a mistake shows its explanation without asking again.
    // Keyed by the mistake and its correction as well as its place, so a new check of the essay never
    // shows an old explanation.
    var grammarMistakeExplanations = {};

    $(document).on('click', '.writing-task-essay-editable > .content-editable-div-wrapper del', function(e) {
        let containerName = "#" + $(this).closest('.content-editable-div-wrapper')[0].id;
    
        let delIndex = $(this).data('index');
    
        let rightHtmlString = window.writingTaskCheckerReusable.grammarCheckErrors[containerName]['right'];
        let rightHtml = $('<div></div>').html(rightHtmlString);
        let insText = rightHtml.find(`ins[data-index="${delIndex}"]`).get(0).textContent;

        var popup = $('.grammar-mistake-popup');
        popup.attr('lastClickedContainer', containerName);

        var elementOffset = $(this).offset();
        popup.css({
            'top': elementOffset.top + 30,
            'left': elementOffset.left
        });

        if(popup.is(':visible') && popup.data('grammarMistakeIndex') == delIndex) {
            //same element clicked, just hide
            popup.hide();
        }
        else {
            popup.data('grammarMistakeIndex', delIndex);
            popup.data('grammarMistakeElement', this);
            popup.data('grammarMistakeCorrection', insText);

            var explanationKey = containerName + '|' + delIndex + '|' + this.textContent + '|' + insText;
            popup.data('grammarMistakeExplanationKey', explanationKey);
            popup.find('.grammar-mistake-explanation').text(grammarMistakeExplanations[explanationKey] || '');
            popup.find('.explain-grammar-mistake-button').prop('disabled', false).text('Why is this wrong?').toggle(!grammarMistakeExplanations[explanationKey]);

            var fixes = 'Correction:';
            fixes += '<span class="grammar-correction">' + insText + '</span>';
            if(insText == ' ') {
                fixes += '<span class="correction-note">(Spacing)</span>'
            }
            else {
                if(insText == '') {
                    fixes += '<span class="correction-note">(Deletion)</span>'
                }
            }
            popup.find('.correction').html(fixes);
            popup.fadeIn('fast');
        }
    });

    $(document).on('click', '.grammar-correction', function(e) {
        e.preventDefault();

        var containerName = $('.grammar-mistake-popup').attr('lastClickedContainer');

        var correction = $(this).get(0).textContent;
        var mistakeIndex = $('.grammar-mistake-popup').data('grammarMistakeIndex');
        var essayEditor = window.contentEditableDiv.getContentEditor(containerName);
        var essayHtml = essayEditor.getHTML();
    
        // Parse the editor's data as HTML
        var essayDom = $.parseHTML(essayHtml);
    
        // Find the del with the specified class and data attribute and replace its content
        $(essayDom).find(`del[data-index="${mistakeIndex}"]`).replaceWith(correction);

        // Serialize the modified HTML back to a string
        var newHtml = $('<div>').append(essayDom).html();

        window.contentEditableDiv.updateContentEditorHTML(containerName, newHtml);
    
        $('.grammar-mistake-popup').hide();
    });

    $(document).on('click', '.explain-grammar-mistake-button', function(e) {
        e.preventDefault();

        var button = $(this);
        var popup = $('.grammar-mistake-popup');
        var mistakeElement = popup.data('grammarMistakeElement');
        var explanationKey = popup.data('grammarMistakeExplanationKey');
        if (!mistakeElement) {
            return;
        }

        // The mistake's paragraph, with this mistake wrapped in [[ ]] so the explanation knows which one is
        // meant. The other mistakes in it stay as the learner wrote them.
        var paragraphElement = $(mistakeElement).closest('p, li, div');
        $(mistakeElement).attr('data-explaining', '1');
        var paragraphCopy = paragraphElement.clone();
        $(mistakeElement).removeAttr('data-explaining');
        paragraphCopy.find('[data-explaining]').replaceWith('[[' + mistakeElement.textContent + ']]');
        var paragraph = paragraphCopy.text().replace(/\s+/g, ' ').trim();

        // A very long paragraph is cut to the part around the mistake.
        if (paragraph.length > 3000) {
            var at = paragraph.indexOf('[[');
            paragraph = paragraph.slice(Math.max(0, at - 1200), at + 1200);
        }

        var formData = new FormData();
        formData.append('action', 'explain_writing_grammar_mistake');
        formData.append('explain_grammar_mistake_nonce', $('#explain_grammar_mistake_nonce').val() || '');
        formData.append('paragraph', paragraph);
        formData.append('mistake', mistakeElement.textContent);
        formData.append('correction', popup.data('grammarMistakeCorrection'));

        button.prop('disabled', true).text('Explaining...');

        window.aiWorkerCall({
            ajaxurl: writing_task_essay_editable_ajax.ajaxurl,
            formData: formData,
            json: true
        })
            .then(function (json) {
                var explanation = json && typeof json.explanation === 'string' ? json.explanation.trim() : '';
                if (!explanation) {
                    throw new Error('no explanation');
                }

                grammarMistakeExplanations[explanationKey] = explanation;

                // Only fill the popup if it still shows this mistake.
                if (popup.data('grammarMistakeExplanationKey') === explanationKey) {
                    popup.find('.grammar-mistake-explanation').text(explanation);
                    button.hide();
                }
            })
            .fail(function (rejection) {
                var response = rejection && rejection.hardError;
                var message = response && response.data && response.data.message ? response.data.message : 'Could not explain this mistake right now. Please try again.';

                if (popup.data('grammarMistakeExplanationKey') === explanationKey) {
                    popup.find('.grammar-mistake-explanation').text(message);
                    button.prop('disabled', false).text('Why is this wrong?');
                }
            });
    });

    $(document).on('mousedown', function (e) {
        if (!$(e.target).closest('.grammar-mistake-popup, del').length) {
            $('.grammar-mistake-popup').hide();
        }
    });

    $(document).on('click', '.repetition-element', function(e) {
        let containerName = "#" + $(this).closest('.content-editable-div-wrapper')[0].id;
    
        let index = $(this).attr('marked-index');
        window.elementHighlighter.highlightElement($(containerName).find(`.repetition-element[marked-index="${index}"]`), 'rgb(212, 212, 255)');
    });

    $(document).on('input paste keyup change', '.writing-task-essay-editable .content-editable-div', function(e) {
        //make the ocr button less visible if the input is long. Prevent users from accidentally overwriting the text.
        if($(this).text().length > 200) {
            // $(this).closest('.writing-task-essay-editable').find('.ocr-button').css('opacity', '0.8');
            $(this).closest('.writing-task-essay-editable').find('.ocr-button').html('<i class="fa-solid fa-image"></i>');
        }
        else {
            // $(this).closest('.writing-task-essay-editable').find('.ocr-button').css('opacity', '1');
            $(this).closest('.writing-task-essay-editable').find('.ocr-button').html('Image to Text <i class="fa-solid fa-image"></i>');
        }
    });

    $(document).on('click', '.writing-task-essay-editable .ocr-button', function(e) {
        $(this).closest('.writing-task-essay-editable').find('.ocr-input').val('');
        $(this).closest('.writing-task-essay-editable').find('.ocr-input').click();
    });

    $('.writing-task-essay-editable .ocr-input').on('change', function(event){
        var ocrButton = $(this).closest('.writing-task-essay-editable').find('.ocr-button');
        var containerName = "#" + $(this).closest('.writing-task-essay-editable').find('.content-editable-div-wrapper')[0].id;

        //get the file
        var file = event.target.files[0];
        if (file) {
            // Check the file type
            var validTypes = ['image/jpeg', 'image/png', 'image/webp'];
            if (!validTypes.includes(file.type)) {
                $('.writing-task-essay-editable .ocr-input').val('');
                alert('Please select an image with a file type of PNG, JPEG, or WEBP.');
            }
            else {
                var reader = new FileReader();
                reader.onload = function(e) {
                    var image = new Image();
                    image.onload = function() {   
                        if(confirm('Do you want to clear the current text and replace it with the text extracted from the image?')) {

                            window.contentEditableDiv.setContentEditorPlainText(containerName, '');

                            var limitMessage = checkOrSaveRateLimit('image_ocr_scan');
                            if (limitMessage) {
                                alert(limitMessage);
                                $('.payment-popup-container').css('display', 'flex');
                                return;
                            }

                            ocrButton.prop('disabled', true);
                            ocrButton.html('Extracting... <i class="fa-solid fa-spinner fa-spin"></i>');

                            window.aiWorkerResizeImageToJpeg(file, 512, 512)
                                .then(function (resized) {
                                    let formData = new FormData();
                                    formData.append('action', 'image_ocr_scan');
                                    formData.append('image_ocr_scan_nonce', $('#image_ocr_scan_nonce').val());
                                    formData.append('image_data', resized, 'image.jpg');

                                    return window.aiWorkerCall({
                                        ajaxurl: writing_task_essay_editable_ajax.ajaxurl,
                                        formData: formData,
                                        // The image cannot ride inside the token, so it goes to the Worker beside it.
                                        workerImage: resized,
                                        json: true,
                                    });
                                })
                                .then(function (json) {
                                    var extractedText = json && json['extracted_text'];
                                    if (!extractedText) {
                                        alert("There seems to be no valid essay text in the image. Please try again with a different one.");
                                        return;
                                    }

                                    window.contentEditableDiv.setContentEditorPlainText(containerName, extractedText);

                                    //set timeout to make this run after the complete callback of the ajax call
                                    setTimeout(function() {
                                        if(extractedText.length > 200) {
                                            ocrButton.html('<i class="fa-solid fa-image"></i>');
                                        }
                                        else {
                                            ocrButton.html('Image to Text <i class="fa-solid fa-image"></i>');
                                        }
                                    }, 100);
                                })
                                // .catch/.finally, not .fail/.always: this chain starts at the resize, which is a
                                // native Promise, so the jQuery Deferred methods are not available on it.
                                .catch(function (rejection) {
                                    var response = rejection && rejection.hardError;

                                    if (response && response.data) {
                                        if (response.data['error'] == 'rate_limit_exceeded') {
                                            alert(checkOrSaveRateLimit('image_ocr_scan', response.data['retry_after']));
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
                                        alert("Error: Unable to extract text from the image. Please try again.");
                                    }
                                })
                                .finally(function () {
                                    ocrButton.prop('disabled', false);
                                    ocrButton.html('Image to Text <i class="fa-solid fa-image"></i>');
                                });
                        }
                    };
        
                    image.onerror = function() {
                        $('.writing-task-essay-editable .ocr-input').val('');
                        alert('There was an error processing your image.');
                    };
        
                    // Set the src of the image to trigger the load
                    image.src = e.target.result;
                };
                reader.readAsDataURL(file);
            }
        }
        else {
            $('.writing-task-essay-editable .ocr-input').val('');
        }
    });
});