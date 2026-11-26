jQuery(document).ready(function ($) {

    //Flashcards are saved to the learner's account, so only a premium learner gets the form here.
    var isPremium = flashcard_popup_ajax.is_premium === '1';

    var textSelectionPopup = $('<div id="text-selection-popup">' +
        '<button id="flashcard-button"><i class="fa-solid fa-clone"></i></button>' +
        '</div>');

    if($('#ielts-reading-highlight-popup').length > 0) {
        $('#ielts-reading-highlight-popup').append(textSelectionPopup.find('#flashcard-button'));
    }
    else {
        if($('#ielts-listening-highlight-popup').length > 0) {
            $('#ielts-listening-highlight-popup').append(textSelectionPopup.find('#flashcard-button'));
        }
        else {
            $('body').append(textSelectionPopup);
        }
    }

    var flashcardPopup = $('<div id="flashcard-popup-overlay">' +
        '<div id="flashcard-popup-wrapper">' +
        '<button id="close-flashcard-button" type="button" aria-label="Close">&times;</button>' +
        '<form id="flashcard-popup">' +
        '<h3>Add Flashcard</h3>' +
        '<div class="flashcard-popup-field">' +
        '<label for="flashcard-set-select">Save to set</label>' +
        '<div id="flashcard-set-select-wrapper">' +
        '<select id="flashcard-set-select"><option value="">Select set</option></select>' +
        '<button id="refresh-flashcard-sets-button" type="button" title="Reload your sets" aria-label="Reload your sets"><i class="fa-solid fa-rotate-right"></i></button>' +
        '<button id="view-flashcard-set-button" type="button">View</button>' +
        '</div>' +
        '<button id="new-flashcard-set-button" type="button">+ Create a new set</button>' +
        '<div id="new-flashcard-set-info">' +
        '<label for="new-flashcard-set-name">New set name</label>' +
        '<input type="text" id="new-flashcard-set-name" placeholder="e.g. Academic Word List">' +
        '<button id="existing-flashcard-set-button" type="button">Use an existing set instead</button>' +
        '</div>' +
        '</div>' +
        '<div class="flashcard-popup-field">' +
        '<label for="term">Term</label>' +
        '<textarea id="term" placeholder="The word or phrase" rows="2"></textarea>' +
        '</div>' +
        '<div class="flashcard-popup-field">' +
        '<label for="definition">Definition</label>' +
        '<textarea id="definition" placeholder="What it means" rows="4"></textarea>' +
        '</div>' +
        '<button type="submit" class="flashcard-popup-save">Save Flashcard</button>' +
        '<a href="/engovate.github.io/flashcards/" class="go-to-all-flashcards-link" target="_blank" rel="noopener">Go to all flashcards</a>' +
        '</form>' +
        '<div id="flashcard-premium-required">' +
        '<h3>Add Flashcard</h3>' +
        '<p>Saving flashcards needs Premium. Your sets are saved to your account, so they follow you to any device you sign in on.</p>' +
        '<a href="/engovate.github.io/payment-plans/" class="flashcard-popup-save" target="_blank" rel="noopener">Upgrade to Premium</a>' +
        '<a href="/engovate.github.io/flashcards/" class="go-to-all-flashcards-link" target="_blank" rel="noopener">Go to all flashcards</a>' +
        '</div>' +
        '</div>' +
        '</div>');

    $('body').append(flashcardPopup);

    var isAddingFlashcard = false;

    $('#flashcard-popup').on('submit', function (event) {
        event.preventDefault();

        //Nothing on the form is disabled while the request is out, and the new-set branch mints a
        //fresh setId per submit - so a double press creates two sets with the same name rather than
        //one set with two cards.
        if (isAddingFlashcard) {
            return;
        }

        // Check whether a set was selected or a new set name was entered
        var setId = $('#flashcard-popup #flashcard-set-select').val();
        var setName = $('#flashcard-popup #flashcard-set-select option:selected').text();
        var isNewSet = !setId;
        if (isNewSet) {
            setId = generateUUID();
            setName = $('#flashcard-popup #new-flashcard-set-name').val();
            if (!setName) {
                alert('Please select a set or enter a new set name.');
                return;
            }
        }

        // Collect data from the form
        var term = $('#flashcard-popup #term').val();
        if(!term) {
            alert('Please enter a term.');
            return;
        }

        var definition = $('#flashcard-popup #definition').val();

        // Create a flashcard object
        var flashcard = {
            id: generateUUID(),
            term: term,
            definition: definition
        };

        //Send just the one card, not the whole set: this popup never loaded the set's other cards,
        //so the server does the append. Flashcards are only ever saved to the learner's account, so
        //this is the single write path and it needs Premium. The form is cleared only once the save
        //has landed - a dropped request would otherwise throw away what the learner just typed.
        var onAddCardFailed = function(response) {
            isAddingFlashcard = false;
            var code = response && response.data && response.data.code;
            if (code === 'too_many_cards') {
                alert('This flashcard set is full, so the card was not added. Please start a new set.');
            }
            else if (code === 'too_many_sets') {
                alert('You have reached the maximum number of flashcard sets, so the card was not added.');
            }
            else if (code === 'not_premium' || code === 'not_logged_in') {
                alert('Saving flashcards needs an active Premium subscription.');
            }
            else {
                alert((response && response.data && response.data.message) || 'Error saving flashcard. Please check your connection and try again.');
            }
        };

        isAddingFlashcard = true;
        $.post(flashcard_popup_ajax.ajaxurl, {
            action: 'flashcard_add_card',
            nonce: flashcard_popup_ajax.nonce,
            set_id: setId,
            set_name: setName,
            card_id: flashcard.id,
            term: term,
            definition: definition
        }, function(response) {
            if (!response.success) {
                onAddCardFailed(response);
                return;
            }
            isAddingFlashcard = false;
            //The stored list is what the dropdown shows, so a set this popup just created joins it
            //here - otherwise it would be missing until the learner reloaded the list by hand.
            if (isNewSet) {
                $('#flashcard-set-select').append($('<option></option>').val(setId).text(setName));
                var storedSets = readStoredSets() || [];
                storedSets.unshift({setId: setId, setName: setName});
                writeStoredSets(storedSets);
            }
            //When this page is the editor for that set, the card has to land on screen as well:
            //Update writes back the cards the editor holds, so one that only reached the account
            //would be erased by the next save.
            if ($('#local-set-id').val() === setId && $('.flashcard-container').length) {
                var newCard = $('.flashcard-item').first().clone().attr('id', flashcard.id);
                newCard.find('.flashcard-term').val(term);
                newCard.find('.flashcard-definition').val(definition);
                $('.flashcard-container').append(newCard);
            }
            clearAndCloseFlashcardPopup();
        }).fail(function(jqXHR) {
            //The handlers answer an error with a 4xx/5xx, so jQuery brings them here rather than to the
            //callback above - the body is on responseJSON, and without it every refusal would read as a
            //connection problem.
            onAddCardFailed(jqXHR && jqXHR.responseJSON);
        });
    });

    function clearAndCloseFlashcardPopup() {
        $('#flashcard-popup #term').val('');
        $('#flashcard-popup #definition').val('');

        //Resets the <select> and clears the new-set name field.
        $('#existing-flashcard-set-button').trigger('click');

        $('#flashcard-popup-overlay').hide();
    }

    $(document).on('mouseup', function (event) {
        var selectedText = window.getSelection().toString();

        if (selectedText) {
            // Fill the term field with the selected text
            $('#flashcard-popup #term').val(selectedText);

            // Show the popup at the range position
            const selectedRange = window.getSelection().getRangeAt(0);
            const rangePosition = getRangePosition(selectedRange, document.body);
            // Get the height of the popup
            const popupHeight = $('#text-selection-popup').height();
            // Get the margin top of the <html> (for login users)
            let htmlStyle = window.getComputedStyle(document.documentElement);
            let htmlMarginTop = parseFloat(htmlStyle.getPropertyValue('margin-top'));
            $('#text-selection-popup').css({
                top: `${rangePosition.top - popupHeight - 10 + htmlMarginTop}px`,
                left: `${rangePosition.left}px`,
                display: 'block'
            });
        }
        else {
            $('#text-selection-popup').hide();
        }
    });

    function getRangePosition(range, parent) {
        const rects = range.getClientRects();
        const rangeRect = rects[0];

        if(!rangeRect) {
            return {left: 0, top: 0};
        }
    
        const parentRect = parent.getBoundingClientRect();
    
        const left = rangeRect.left - parentRect.left;
        const top = rangeRect.top - parentRect.top;

        return { left: left, top: top };
    }

    //Only a premium learner can save a flashcard, so anyone else is shown why rather than a form that
    //cannot work. The button stays for everyone: a learner selecting text is exactly the moment the
    //offer means something.
    $('#flashcard-premium-required').toggle(!isPremium);
    $('#flashcard-popup').toggle(isPremium);

    $('#flashcard-button').on('click', function (event) {
        $('#flashcard-popup-overlay').css('display', 'flex');
        //A textarea inside a hidden element measures scrollHeight as 0, so any page-wide auto-resize
        //that ran while this popup sat hidden will have written height:0 onto these. Clear it now that
        //they are visible and let the stylesheet size them. (min-height in the CSS is the belt to this
        //braces - it keeps them usable even if something resizes them again while open.)
        $('#flashcard-popup textarea').css('height', '');
        if (!isPremium) {
            return;
        }
        //Filled on open rather than on page load - this script runs on every pageview of the site.
        //It also picks up sets added on another device since the page loaded.
        updateSetOptions($('#flashcard-set-select').val() || '');
        $('#flashcard-set-select').trigger('change');
    });

    $('#close-flashcard-button').on('click', function (event) {
        $('#flashcard-popup-overlay').hide();
    });

    $('#new-flashcard-set-button').on('click', function (event) {
        $('#new-flashcard-set-info').show();
        $('#flashcard-set-select-wrapper').hide();
        $('#new-flashcard-set-button').hide();
        $('#flashcard-set-select').val('');
        $('#flashcard-set-select').trigger('change');
    });

    $('#existing-flashcard-set-button').on('click', function (event) {
        $('#new-flashcard-set-info').hide();
        $('#flashcard-set-select-wrapper').show();
        $('#new-flashcard-set-button').show();
        $('#flashcard-popup #new-flashcard-set-name').val('');
    });

    $('#flashcard-set-select').on('change', function (event) {
        if($(this).val()) {
            $('#view-flashcard-set-button').show();
        }
        else {
            $('#view-flashcard-set-button').hide();
        }
    });

    $('#view-flashcard-set-button').on('click', function (event) {
        //The same URL the archive's Learn buttons build. Opened in a new tab like the links beside it,
        //so a learner keeps the page they were reading - and whatever they had already typed here.
        window.open('/engovate.github.io/flashcards/custom/?local-set-id=' +
            encodeURIComponent($('#flashcard-set-select').val()), '_blank', 'noopener');
    });

    //A dropdown that failed to load looks exactly like an account with no sets, and the only thing
    //the learner can do from there is type a new set name - which puts the card in a duplicate set
    //rather than the one they meant.
    function onSetListFailed(e) {
        console.error('Error reading flashcard sets:', e);
        $('#flashcard-set-select').html('<option value="">Could not load your sets - reload the page</option>');
    }

    //The list of set names is kept in this browser between pageviews, so opening the popup costs
    //nothing. The account is only read when there is nothing stored yet, or when the learner asks
    //with the reload button - which is also how a set renamed or deleted on another device is picked
    //up. Keyed by learner, so a shared browser never shows one learner's set names to the next.
    var setsStorageKey = 'engnovate_flashcard_sets_' + flashcard_popup_ajax.learner_id;

    function readStoredSets() {
        try {
            var stored = JSON.parse(window.localStorage.getItem(setsStorageKey));
            return Array.isArray(stored) ? stored : null;
        }
        catch (e) {
            //A private window or blocked site data throws here rather than answering null.
            return null;
        }
    }

    function writeStoredSets(sets) {
        try {
            window.localStorage.setItem(setsStorageKey, JSON.stringify(sets));
        }
        catch (e) {
            //Nothing stored just means the next open reads the account again.
        }
    }

    function fillSetOptions(sets, currentSetId) {
        var setSelect = $('#flashcard-set-select');
        setSelect.html('<option value="">Select set</option>');
        sets.forEach(function(flashcardSet) {
            setSelect.append($('<option></option>').val(flashcardSet.setId).text(flashcardSet.setName));
        });
        setSelect.val(currentSetId);
        setSelect.trigger('change');
    }

    function updateSetOptions(currentSetId) {
        var stored = readStoredSets();
        if (stored) {
            fillSetOptions(stored, currentSetId);
            return;
        }
        //Nothing stored yet, so this learner has never opened the popup in this browser - read the
        //account once rather than showing them an empty list they have to know to reload.
        loadSetOptions(currentSetId);
    }

    //Names only - the popup never shows cards, so they stay out of the payload and out of storage.
    function loadSetOptions(currentSetId) {
        var refreshButton = $('#refresh-flashcard-sets-button');
        refreshButton.addClass('is-loading').prop('disabled', true);

        $.post(flashcard_popup_ajax.ajaxurl, {
            action: 'flashcard_sets_list',
            nonce: flashcard_popup_ajax.nonce,
            page: -1,
            sort: 'recent'
        }, function(response) {
            refreshButton.removeClass('is-loading').prop('disabled', false);
            if (!response.success) {
                onSetListFailed(response);
                return;
            }
            var sets = response.data.sets.map(function(flashcardSet) {
                return {setId: flashcardSet.setId, setName: flashcardSet.setName};
            });
            writeStoredSets(sets);
            fillSetOptions(sets, currentSetId);
        }).fail(function(jqXHR) {
            refreshButton.removeClass('is-loading').prop('disabled', false);
            onSetListFailed(jqXHR && jqXHR.responseJSON);
        });
    }

    $('#refresh-flashcard-sets-button').on('click', function (event) {
        loadSetOptions($('#flashcard-set-select').val() || '');
    });

    function generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random() * 16 | 0,
                v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }
});