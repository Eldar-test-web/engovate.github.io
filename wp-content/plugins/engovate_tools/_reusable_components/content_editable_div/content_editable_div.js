window.contentEditableDiv = window.contentEditableDiv || {};

jQuery(document).ready(function ($) {
    //CONTENT EDITABLE
    window.contentEditableDiv.editorsMap = new Map();

    // Local-draft key: wrapper id + path + ONLY the query params that identify which test/task is being
    // practiced. Custom single-task practice all runs on the shared 'custom' sentinel path, so its identity
    // lives in the query (?src_test=&section=). Whitelisting these isolates each custom practice, while a
    // normal test stays keyed by path alone (unchanged, and immune to appended utm_*/fbclid params).
    function getUniqueTextAreaName(textAreaWrapperId) {
        var params = new URLSearchParams(window.location.search);
        var identityKeys = ['type', 'scheduled_exam_id', 'src_test', 'section', 'p_tests',
                            'p1_test', 'p2_test', 'p3_test', 'p4_test',
                            'p1_part', 'p2_part', 'p3_part', 'p4_part'];
        var idParts = [];
        identityKeys.forEach(function(k) {
            if (params.has(k)) idParts.push(k + '=' + params.get(k));
        });
        return textAreaWrapperId + window.location.pathname + (idParts.length ? '?' + idParts.join('&') : '');
    }
    document.querySelectorAll(".content-editable-div").forEach(editorElement => {

        var initialText = editorElement.innerText;
        var contenteditable = editorElement.getAttribute('contenteditable');
        
        if(!contenteditable || contenteditable == 'null') return; //don't init elements with no contenteditable

        var squire = new Squire(editorElement, {
            blockTag: 'p', // Set the default block tag to 'p'
            sanitizeToDOMFragment: function(html, editor) {
                // Create a new DocumentFragment
                var docFrag = document.createDocumentFragment();
            
                // Create a container for the HTML content
                var tempDiv = document.createElement('div');
                tempDiv.innerHTML = html;
            
                // Append them to the DocumentFragment
                while (tempDiv.firstChild) {
                    docFrag.appendChild(tempDiv.firstChild);
                }
            
                // Return the DocumentFragment containing the sanitized HTML
                return docFrag;
            }
        });

        editorElement.setAttribute('spellcheck', false);

        // Use the DOM element as the key in the Map
        window.contentEditableDiv.editorsMap.set(editorElement, squire);

        // Have to re-set this attribute since squire auto set the contenteditable to true
        if(contenteditable == 'false') {
            editorElement.setAttribute('contenteditable', false);
        }

        // Set the HTML of the Squire editor to the current innerHTML of the content editable element
        squire.setHTML('<p>' + initialText + '</p>');

        //handle pasted content
        var pastedText = '';
        squire.addEventListener('paste', function(event) {
            pastedText = (event.clipboardData || window.clipboardData).getData('text/plain');
        });
        squire.addEventListener('willPaste', function(event) {
            var cleanText = window.contentEditableDiv.deepCleanText(pastedText);
            var lines = cleanText.split('\n');
            var newFragment = document.createDocumentFragment();
            lines.forEach(function(line) {
                var p = document.createElement('p');
                p.textContent = line;
                newFragment.appendChild(p);
            });

            // Replace the original fragment with our new fragment
            event.fragment = newFragment;
        });

        //handle copy event. If don't do this, squire doesn't allow copy for elements with contenteditable=false
        editorElement.addEventListener('copy', function(event) {
            var selection = window.getSelection();
            if (selection.toString().length > 0) {
              event.clipboardData.setData('text/plain', selection.toString());
              event.preventDefault();
            }
        });

        //Manage placeholders
        function showPlaceholder(editorElement) {
            if (editorElement.innerText.trim() === '' && !editorElement.classList.contains('editor-placeholder')) {
                editorElement.classList.add('editor-placeholder');
            } else {
                if(editorElement.innerText.trim() !== '' && editorElement.classList.contains('editor-placeholder')) {
                    editorElement.classList.remove('editor-placeholder');
                }
            }
        }
        // Call showPlaceholder to handle the initial state of the placeholder
        showPlaceholder(editorElement);

        // Set up the debounced save function
        function debounce(fn, delay) {
            let timeoutID = null;
            return function () {
                clearTimeout(timeoutID);
                var args = arguments;
                var that = this;
                timeoutID = setTimeout(function () {
                    fn.apply(that, args);
                }, delay);
            };
        }
        function saveText() {
            var textAreaWrapperId = $(editorElement).closest('.content-editable-div-wrapper')[0].id;
            var uniqueTextAreaName = getUniqueTextAreaName(textAreaWrapperId);
            var textValue = window.contentEditableDiv.getContentEditorPlainText('#' + textAreaWrapperId);
            localStorage.setItem(uniqueTextAreaName, textValue);
        }
        var debouncedSave = debounce(saveText, 1000);
        
        squire.addEventListener('input', function() {
            window.contentEditableDiv.updateWordCount(editorElement);
            showPlaceholder(editorElement);

            var isEditable = editorElement.getAttribute('contenteditable');
            if(isEditable == true || isEditable == 'true') {
                debouncedSave();
            }
        });

        // Handle caret placement and typing when users place the caret right at the edge of a styled span and start typing
        squire.addEventListener('keydown', function(event) {
            //use setTimeout to solve a problem with the asynchronous nature of the ContentEditor's event handling and the browser's rendering process.
            //the browser may not have had a chance to update the display and the internal model of the editor before the next key press is handled.
            //setTimeout with a delay of 0. This allows the browser to update the display and the internal model of the editor before the code is executed.
            setTimeout(() => {
                const selection = squire.getSelection();

                if(!selection) return;

                const endOffset = selection.endOffset;
                const startOffset = selection.startOffset;

                if (endOffset != startOffset) return; //handle caret only

                const parentSelectionElement = selection.endContainer.parentElement;

                if ((parentSelectionElement.nodeName == 'SPAN' && endOffset == parentSelectionElement.innerText.length) && event.keyCode === 32 /* space */) {
                    // Check if the next sibling of the span is a text node and if it starts with a non-breaking space or a space
                    const nextSibling = parentSelectionElement.nextSibling;
                    if (nextSibling && nextSibling.nodeName == '#text' && (nextSibling.textContent.startsWith('\u00A0') || nextSibling.textContent.startsWith(' '))) {
                        // If a non-breaking space or a space is already there, don't insert a new one
                        return;
                    }

                    if(nextSibling) {
                        squire.saveUndoState();
                        nextSibling.textContent = ' ' + nextSibling.textContent;
                    }
                }
            }, 0);
        });
    });

    // Function to create and show a popup
    function checkSavedTextAndPrompt() {

        var hasSavedText = false;
        document.querySelectorAll(".content-editable-div").forEach(editorElement => {
            if(!hasSavedText && window.contentEditableDiv.editorsMap.get(editorElement)) {
                var textAreaWrapperId = $(editorElement).closest('.content-editable-div-wrapper')[0].id;
                var uniqueTextAreaName = getUniqueTextAreaName(textAreaWrapperId);
                if (localStorage.getItem(uniqueTextAreaName)) {
                    hasSavedText = true;
                }
            }
        });

        if (hasSavedText) {
            var $popup = $('<div></div>').css({
                position: 'fixed',
                bottom: '10px',
                left: '10px',
                backgroundColor: 'white',
                border: '1px solid black',
                padding: '10px',
                zIndex: 99999,
                boxShadow: '0px 8px 16px 0px rgba(0,0,0,0.2)',
                borderRadius: '5px',
                fontSize: '18px',
                lineHeight: '1.6',
                maxWidth: '70vw',
            }).html("Would you like to restore your previously entered text?");

            var $yesButton = $('<button>Yes</button>').css({
                fontSize: '18px',
                padding: '5px 15px',
                backgroundColor: 'green',
                marginLeft: '10px'
            });

            var $noButton = $('<button>No, delete saved text</button>').css({
                fontSize: '12px',
                padding: '5px 10px',
                backgroundColor: 'red',
                marginLeft: '10px'
            });

            var $closeButton = $('<button>X</button>').css({
                fontSize: '12px',
                padding: '0px',
                width: '20px',
                height: '20px',
                backgroundColor: 'white',
                color: 'black',
                border: '1px solid black',
                borderRadius: '50%',
                cursor: 'pointer',
                position: 'absolute',
                top: '-10px',
                right: '-10px',
            });

            $popup.append($yesButton, $noButton, $closeButton);

            $popup.addClass('restore-progress-popup');
            $('body').append($popup);

            $yesButton.click(function() {
                document.querySelectorAll(".content-editable-div").forEach(editorElement => {
                    if(window.contentEditableDiv.editorsMap.get(editorElement)) {
                        var textAreaWrapperId = $(editorElement).closest('.content-editable-div-wrapper')[0].id;
                        var uniqueTextAreaName = getUniqueTextAreaName(textAreaWrapperId);
                        var savedText = localStorage.getItem(uniqueTextAreaName);
                        if(savedText) {
                            window.contentEditableDiv.setContentEditorPlainText('#' + textAreaWrapperId, savedText);
                        }
                    }
                });
                $popup.hide();
            });

            $noButton.click(function() {
                document.querySelectorAll(".content-editable-div").forEach(editorElement => {
                    if(window.contentEditableDiv.editorsMap.get(editorElement)) {
                        var textAreaWrapperId = $(editorElement).closest('.content-editable-div-wrapper')[0].id;
                        var uniqueTextAreaName = getUniqueTextAreaName(textAreaWrapperId);
                        localStorage.removeItem(uniqueTextAreaName);
                    }
                });
                $popup.hide();
            });

            $closeButton.click(function() {
                $popup.hide();
            });
        }
    }

    // Call the function when the document is ready
    checkSavedTextAndPrompt();

    window.contentEditableDiv.deepCleanText = function(text) {
        // Replace non-breaking spaces with regular spaces
        text = text.replace(/\u00a0/g, ' ');
        
        // Replace multiple spaces (including tabs and other whitespace characters on the same line) with a single space
        text = text.replace(/[^\S\r\n]+/g, ' ');
        
        // Replace spaces surrounding newlines with a single newline
        text = text.replace(/\s*?\n\s*?/g, '\n');
        
        // Replace multiple consecutive newlines with a single newline
        text = text.replace(/\n{2,}/g, '\n');

        // Trim whitespace from both ends of the string
        return text.trim();
    }

    window.contentEditableDiv.checkContentEditorCharacterRequirement = function(fieldName, wrapperElementName) {
        var textarea = document.querySelector(`${wrapperElementName} .content-editable-div`);

        var minLength = textarea.getAttribute('minwordlength');
        var maxLength = textarea.getAttribute('maxwordlength');
        
        var textLength = window.contentEditableDiv.countWords(window.contentEditableDiv.getContentEditorPlainText(wrapperElementName));
        
        if(minLength && textLength < minLength) {
            let required = minLength - textLength;
            return `${fieldName} is too short. Please add ${required} more word(s) (the minimum is ${minLength} words).`;
        }
        
        if(maxLength && textLength > maxLength) {
            return `${fieldName} is too long. Please remove ${textLength - maxLength} word(s) (the maximum is ${maxLength} words).`;
        }
        
        return null;
    }

    window.contentEditableDiv.getContentEditor = function(wrapperElementName) {
        var domEditableElement = document.querySelector(`${wrapperElementName} .content-editable-div`);
        var editorInstance = window.contentEditableDiv.editorsMap.get(domEditableElement);
        return editorInstance;
    }

    window.contentEditableDiv.getContentEditorEditableDiv = function(wrapperElementName) {
        var domEditableElement = document.querySelector(`${wrapperElementName} .content-editable-div`);
        return domEditableElement;
    }

    window.contentEditableDiv.getContentEditorPlainText = function(wrapperElementName) {
        var domEditableElement = document.querySelector(`${wrapperElementName} .content-editable-div`);
        var editorInstance = window.contentEditableDiv.editorsMap.get(domEditableElement);
        if(!editorInstance) {
            return window.contentEditableDiv.convertHTMLToPlainText(domEditableElement.innerHTML);
        }
        else {
            var htmlData = editorInstance.getHTML();
            return window.contentEditableDiv.convertHTMLToPlainText(htmlData);
        }
    }

    window.contentEditableDiv.getContentEditorHTML = function(wrapperElementName) {
        var domEditableElement = document.querySelector(`${wrapperElementName} .content-editable-div`);
        var editorInstance = window.contentEditableDiv.editorsMap.get(domEditableElement);
        if(!editorInstance) {
            return domEditableElement.innerHTML;
        }
        else {
            var htmlData = editorInstance.getHTML();
            return htmlData;
        }
    }

    window.contentEditableDiv.setContentEditorPlainText = function(wrapperElementName, plainText) {
        var domEditableElement = document.querySelector(`${wrapperElementName} .content-editable-div`);
        var editorInstance = window.contentEditableDiv.editorsMap.get(domEditableElement);
        if(!editorInstance) {
            domEditableElement.innerHTML = window.contentEditableDiv.convertPlainTextToHTML(plainText);
            window.contentEditableDiv.updateWordCount($(`${wrapperElementName} .content-editable-div`).get(0));
        }
        else {
            editorInstance.setHTML(window.contentEditableDiv.convertPlainTextToHTML(plainText));
            editorInstance.fireEvent('input'); //update word count, placeholder
        }
    }

    window.contentEditableDiv.setContentEditorHTML = function(wrapperElementName, html) {
        var domEditableElement = document.querySelector(`${wrapperElementName} .content-editable-div`);
        var editorInstance = window.contentEditableDiv.editorsMap.get(domEditableElement);
        if(!editorInstance) {
            domEditableElement.innerHTML = html;
            window.contentEditableDiv.updateWordCount($(`${wrapperElementName} .content-editable-div`).get(0));
        }
        else {
            editorInstance.setHTML(html);
            editorInstance.fireEvent('input'); //update word count, placeholder
        }
    }

    //this will save undo state
    window.contentEditableDiv.updateContentEditorHTML = function(wrapperElementName, newHtml) {
        var domEditableElement = document.querySelector(`${wrapperElementName} .content-editable-div`);
        var editorInstance = window.contentEditableDiv.editorsMap.get(domEditableElement);
        if(!editorInstance) {
            domEditableElement.innerHTML = html;
            window.contentEditableDiv.updateWordCount($(`${wrapperElementName} .content-editable-div`).get(0));
        }
        else {
            editorInstance.saveUndoState();
            domEditableElement.innerHTML = newHtml;
            editorInstance.fireEvent('input'); //update word count, placeholder
        }
    }

    window.contentEditableDiv.resetContentEditor = function(wrapperElementName) {
        var domEditableElement = document.querySelector(`${wrapperElementName} .content-editable-div`);
        var editorInstance = window.contentEditableDiv.editorsMap.get(domEditableElement);
        if(!editorInstance) {
            domEditableElement.innerHTML = window.contentEditableDiv.deepCleanText(domEditableElement.innerHTML);
        }
        else {
            window.contentEditableDiv.setContentEditorPlainText(wrapperElementName, window.contentEditableDiv.getContentEditorPlainText(wrapperElementName));
        }
    }

    //just to remove undostate white keeping the same html
    window.contentEditableDiv.resetContentEditorHTML = function(wrapperElementName) {
        var domEditableElement = document.querySelector(`${wrapperElementName} .content-editable-div`);
        var editorInstance = window.contentEditableDiv.editorsMap.get(domEditableElement);
        if(!editorInstance) {
            domEditableElement.innerHTML = window.contentEditableDiv.getContentEditorHTML(wrapperElementName);
        }
        else {
            window.contentEditableDiv.setContentEditorHTML(wrapperElementName, window.contentEditableDiv.getContentEditorHTML(wrapperElementName));
        }
    }

    window.contentEditableDiv.setContentEditorReadOnly = function(wrapperElementName, readonly) {
        var domEditableElement = document.querySelector(`${wrapperElementName} .content-editable-div`);
        if(readonly) {
            domEditableElement.setAttribute('contenteditable', false);
        }
        else {
            domEditableElement.setAttribute('contenteditable', true);
        }
    }

    window.contentEditableDiv.convertPlainTextToHTML = function(plainText) {
        if(!plainText) return '<p></p>';
        plainText = plainText.split(/\n+/)
        .filter(line => line.trim() !== '')
        .map(line => `<p>${line}</p>`)
        .join('');
        return plainText;
    }

    window.contentEditableDiv.convertHTMLToPlainText = function(html) {
        const tempElement = document.createElement("div");
        tempElement.innerHTML = html;

        const paragraphs = Array.from(tempElement.querySelectorAll('p'));
        paragraphs.forEach((p, index) => {
            // Don't add line break to the last paragraph
            if (index !== paragraphs.length - 1) {
                p.textContent = p.textContent + '\n\n';
            }
        });

        let textContent = tempElement.textContent || tempElement.innerText || "";
        return textContent.replace(/\u00a0/g, ' ').trim(); //replace non-breaking spaces with regular ones and trim
    }

    window.contentEditableDiv.updateWordCount = function(textarea) {
        var text = $(textarea).val();
        if(!text) {
            text = window.contentEditableDiv.convertHTMLToPlainText(textarea.innerHTML);
        }

        $(textarea).parent().find('.word-count em').text("Word Count: " + window.contentEditableDiv.countWords(text));
    }

    window.contentEditableDiv.countWords = function(text) {
        if(!text) return 0;
        
        var words = text.trim().split(/\s+/).filter(function (word) {
            return word.length > 0;
        });

        var wordCount = words.length;

        return wordCount;
    }
});