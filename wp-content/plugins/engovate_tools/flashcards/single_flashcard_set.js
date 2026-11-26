jQuery(document).ready(function ($) {
    var currentFlashcardIndex = 0;

    $(document).on('click', '.audio-flashcard-button', function(event) {
        event.preventDefault();

        window.TTSAudio.stopTTSAudio();
        window.TTSAudio.playTTSAudio($(this).closest('.flashcard-item').find('.flashcard-term').val());
    });

    //------------ FLIP FLASHCARDS -----------------
    var isAutoPlayingAudio = true;
    $('.auto-play-audio-toggle').on('click', function(e) {
        e.preventDefault();
        const checkbox = $(this).find('input');
        checkbox.prop('checked', !checkbox.prop('checked'));
        isAutoPlayingAudio = checkbox.prop('checked');
    });

    $(document).on('click', '.flip-flashcard-audio-button', function(event) {
        // Stop event propagation to avoid flashcardElement.onClick
        event.stopPropagation();

        let audioButton = $(this);
        let isThisPlaying = audioButton.attr('playing');

        //no matter which button, just reset all
        $(".flip-flashcard-audio-button").find('i').replaceWith('<i class="fa-solid fa-volume-high"></i>');
        $(".flip-flashcard-audio-button").attr('playing', 'false');
        window.TTSAudio.stopTTSAudio();

        if (!isThisPlaying || isThisPlaying == 'false') {
            window.TTSAudio.playTTSAudio($(this).closest('.flip-flashcard-item').find('.flip-flashcard-term').text(), false, audioButton.text().includes('Male'), () => {
                audioButton.find('i').replaceWith('<i class="fa-solid fa-volume-high"></i>');
                audioButton.attr('playing', 'false');
            });

            audioButton.find('i').replaceWith('<i class="fa-solid fa-pause"></i>');
            audioButton.attr('playing', 'true');
        }
    });

    $(document).on('click', '.flip-flashcard-item', function() {
        if($(this).hasClass('flipped')) {
            $(this).removeClass('flipped');
            if(isAutoPlayingAudio) {
                window.TTSAudio.playTTSAudio($('.flip-flashcard-item.current .flip-flashcard-term').text());
            }
        } else {
            $(this).addClass('flipped');
        }
    });

    $('.flip-flashcard-back-button').on('click', function() {
        $('.flip-flashcard-item').removeClass('current flipped slide-right slide-left');

        currentFlashcardIndex--;
        if(currentFlashcardIndex < 0) {
            currentFlashcardIndex = $('.flip-flashcard-item').length - 1;
        }

        $(`.flip-flashcard-item[data-index="${currentFlashcardIndex}"]`).addClass('current slide-left');
        $('.flip-flashcard-counter span').text(currentFlashcardIndex + 1);
        setTimeout(function() {
            $('.flip-flashcard-item').removeClass('flipped slide-right slide-left');
            if(isAutoPlayingAudio) {
                window.TTSAudio.playTTSAudio($('.flip-flashcard-item.current .flip-flashcard-term').text());
            }
        }, 200);
    });

    $('.flip-flashcard-next-button').on('click', function() {
        $('.flip-flashcard-item').removeClass('current flipped slide-right slide-left');

        currentFlashcardIndex++;
        if(currentFlashcardIndex >= $('.flip-flashcard-item').length) {
            currentFlashcardIndex = 0;
        }

        $(`.flip-flashcard-item[data-index="${currentFlashcardIndex}"]`).addClass('current slide-right');
        $('.flip-flashcard-counter span').text(currentFlashcardIndex + 1);
        setTimeout(function() {
            $('.flip-flashcard-item').removeClass('flipped slide-right slide-left');
            if(isAutoPlayingAudio) {
                window.TTSAudio.playTTSAudio($('.flip-flashcard-item.current .flip-flashcard-term').text());
            }
        }, 200);
    });

    //Arrow keys page through the flip cards. Flip mode only: every other view on this page has a
    //text field in it, and paging on the arrow keys would stop the caret moving inside it.
    $(document).keydown(function(event) {
        if (!$('.flip-flashcard-container').length) {
            return;
        }
        switch(event.which) {
            case 37: // Left arrow key code
                $('.flip-flashcard-back-button').click();
                break;

            case 39: // Right arrow key code
                $('.flip-flashcard-next-button').click();
                break;

            default: return; // Exit this handler for other keys
        }
        event.preventDefault(); // Prevent the default action (scrolling)
    });

    //------------ TYPE FLASHCARDS -----------------
    $(document).on('click', '.type-flashcard-audio-button', function(event) {
        // Stop event propagation to avoid flashcardElement.onClick
        event.stopPropagation();

        let audioButton = $(this);
        let isThisPlaying = audioButton.attr('playing');

        //no matter which button, just reset all
        $(".type-flashcard-audio-button").find('i').replaceWith('<i class="fa-solid fa-volume-high"></i>');
        $(".type-flashcard-audio-button").attr('playing', 'false');
        window.TTSAudio.stopTTSAudio();

        if (!isThisPlaying || isThisPlaying == 'false') {
            window.TTSAudio.playTTSAudio($(this).closest('.type-flashcard-item').find('.type-flashcard-term').text(), false, audioButton.text().includes('Male'), () => {
                audioButton.find('i').replaceWith('<i class="fa-solid fa-volume-high"></i>');
                audioButton.attr('playing', 'false');
            });

            audioButton.find('i').replaceWith('<i class="fa-solid fa-pause"></i>');
            audioButton.attr('playing', 'true');
        }
    });

    $(document).on('click', '.type-flashcard-check-button', function(e) {
        e.preventDefault();

        var userTypeValue = $(this).closest('.type-flashcard-item').find('.type-flashcard-term-textarea').val();
        var term = $(this).closest('.type-flashcard-item').find('.type-flashcard-term').text();

        if(userTypeValue.trim().toLowerCase() === term.trim().toLowerCase()) {
            $('.type-flashcard-item').removeClass('current slide-right');

            currentFlashcardIndex++;
            if(currentFlashcardIndex >= $('.type-flashcard-item').length) {
                $('.type-flashcard-container').append($('.back-to-flashcard-set-button').clone());
                window.TTSAudio.playTTSAudio('Correct!');
                setTimeout(function() {
                    alert("Well done! You've aced this flashcard set!");
                }, 200);
                return;
            }

            $(`.type-flashcard-item[data-index="${currentFlashcardIndex}"]`).addClass('current slide-right');
            $('.type-flashcard-counter span').text(currentFlashcardIndex + 1);
            setTimeout(function() {
                $(`.type-flashcard-item[data-index="${currentFlashcardIndex}"]`).removeClass('slide-right');
            }, 200);

            setTimeout(function() {
                $(`.type-flashcard-item[data-index="${currentFlashcardIndex}"]`).find('.type-flashcard-term-textarea').focus();
            }, 500);

            window.TTSAudio.playTTSAudio('Correct!');
        } else {
            window.TTSAudio.playTTSAudio('Incorrect!');
            alert("Incorrect. Try again!");
        }
    });

    $(document).on('click', '.type-flashcard-show-answer-button a', function(e) {
        e.preventDefault();

        var term = $(this).closest('.type-flashcard-item').find('.type-flashcard-term').text();
        $(this).closest('.type-flashcard-item').find('.type-flashcard-term-textarea').val(term);
    });

    // ------------ LOCAL FLASHCARDS ---------
    const NEW_FLASHCARD_SET_PATH = "create-new";

    //The URL parameter and the hidden input keep their legacy 'local-set-id' spelling:
    //learners have bookmarked and shared those links, and the server-rendered archive cards
    //build the same href.
    var savedSetId = $('#local-set-id').val();
    var learnMode = $('#learn-mode').val();

    var isSomethingChanged = false;

    //Sets are saved to the learner's account. The browser store read below is a read-only leftover
    //holding sets made before flashcards moved there. Both return the identical set object shape, so
    //every renderer below treats them the same.
    var isPremium = $('#is_premium').val() === '1';

    //A premium set is fetched over the network, so a failed load is an ordinary transient rather
    //than the near-impossible IndexedDB read error it replaces. A set that failed to load leaves
    //the screen showing the blank starter card, which is indistinguishable from a brand new set -
    //and saving from there would replace the real cards with that one blank card. Premium keeps no
    //local copy to recover from, so a failed load disables saving until the page is reloaded.
    var didSavedSetFailToLoad = false;

    //The same hazard while the fetch is still in flight. Saving does not read the screen at click
    //time - it issues its own fetch and reads the cards out of the DOM when that returns - so if the
    //save's fetch resolves first, the DOM is still the blank starter card and that is what gets
    //written over the set. Nothing on the page is disabled while the first fetch runs, so a learner
    //on a slow connection can reach Update well before their cards arrive.
    var isSavedSetStillLoading = false;

    //Flashcards are saved to the learner's account and nowhere else, so a set can only be edited when
    //it is on that account AND this learner can write it. Everything else - a legacy set still in this
    //browser, or any set at all for a learner without Premium - can be opened, studied and exported,
    //but not changed. Set by readSavedSet once it knows where the set came from.
    var isSetEditable = false;
    var isLoggedIn = $('#is_logged_in').val() === '1';

    //The template hides the write controls from anyone without Premium. This hides them from a premium
    //learner too when the set turns out to be a legacy one still in this browser, so nobody is offered
    //a button whose only answer is no.
    function setSetEditable(editable) {
        isSetEditable = editable;
        if (!editable) {
            $('.update-flashcard-button, .add-flashcard-item, .delete-set-button, .import-set-button').hide();
        }
    }

    //IndexedDB for storing large database locally
    let browserDb;
    let openRequest = indexedDB.open("EngnovateLocalDatabase", 1);
    openRequest.onupgradeneeded = function(e) {
        browserDb = e.target.result;
        let store;
      
        if (!browserDb.objectStoreNames.contains('FlashcardStore')) {
            store = browserDb.createObjectStore("FlashcardStore", {keyPath: "setId"});
        } else {
            store = openRequest.transaction.objectStore("FlashcardStore");
        }
      
        // Create an index on the 'createdDate' property of the objects in the store
        if (!store.indexNames.contains('by_createdDate')) {
            store.createIndex("by_createdDate", "createdDate", {unique: false});
        }
        // Create an index on the 'updatedDate' property of the objects in the store
        if (!store.indexNames.contains('by_updatedDate')) {
            store.createIndex("by_updatedDate", "updatedDate", {unique: false});
        }
    };
    //One render either way. The account is looked at first, but a set the account does not have may
    //still be a legacy one in this browser, so the handle has to be ready before the read starts.
    openRequest.onsuccess = function(e) {
        browserDb = e.target.result;
        renderSavedSetFromUrl();
    };
    openRequest.onerror = function(e) {
        //The account does not need this store, so a failure here only costs the legacy fallback.
        console.error('Error opening IndexedDB:', e);
        renderSavedSetFromUrl();
    };

    function readSavedSet(setId, onSuccess, onError) {
        if(!setId) {
            onSuccess(null);
            return;
        }

        //The browser store is legacy and read-only: sets made before flashcards moved to the account.
        //Nothing writes it any more, so a set found here can be studied and exported but not edited.
        var readLegacySet = function() {
            if (!browserDb) {
                onSuccess(null);
                return;
            }
            let tx = browserDb.transaction("FlashcardStore", "readonly");
            let getRequest = tx.objectStore("FlashcardStore").get(setId);
            getRequest.onsuccess = function() {
                //A legacy set is readable, studyable and exportable, but not writable by anyone. An id
                //that is in neither store is not a set at all yet - saving from that screen creates a
                //new one on the account, so a premium learner may do it.
                setSetEditable(getRequest.result ? false : isPremium);
                onSuccess(getRequest.result);
            };
            tx.onerror = function(e) {
                onError(e);
            };
        };

        //The account is where every set is saved now, so look there first. A signed-out visitor has
        //no account to look in.
        if (!isLoggedIn) {
            readLegacySet();
            return;
        }

        $.post(single_flashcard_set_ajax.ajaxurl, {
            action: 'flashcard_set_get',
            flashcards_user_nonce: $('#flashcards_user_nonce').val(),
            set_id: setId
        }, function(response) {
            if (!response.success) {
                onError(response);
                return;
            }
            if (response.data.set) {
                //On the account, so it can be edited - by a premium learner.
                setSetEditable(isPremium);
                onSuccess(response.data.set);
                return;
            }
            //A set that isn't there comes back as a null set on the success path, matching what
            //store.get() does for a missing key - writeSavedSetFromScreen relies on that to mint a
            //brand new set.
            readLegacySet();
        }).fail(onError);
    }

    //Both writes below go to the account and nowhere else. The server refuses them without an active
    //subscription, and isSetEditable stops the UI offering them in the first place.
    //The popup keeps the learner's set list in this browser. Creating, renaming or deleting a set
    //here makes that copy wrong, so it is dropped and the next popup open reads the account again.
    //Cleared by prefix because the key carries a learner id this page does not have.
    function clearStoredFlashcardSets() {
        try {
            Object.keys(window.localStorage)
                .filter(key => key.indexOf('engnovate_flashcard_sets_') === 0)
                .forEach(key => window.localStorage.removeItem(key));
        }
        catch (e) {
            //Blocked site data - there was nothing stored to go stale in the first place.
        }
    }

    function writeSavedSet(flashcardSet, onSuccess, onError) {
        $.post(single_flashcard_set_ajax.ajaxurl, {
            action: 'flashcard_set_save',
            flashcards_user_nonce: $('#flashcards_user_nonce').val(),
            set: JSON.stringify(flashcardSet)
        }, function(response) {
            if (!response.success) {
                onError(response);
                return;
            }
            clearStoredFlashcardSets();
            onSuccess(response.data.set);
        }).fail(onError);
    }

    function deleteSavedSet(setId, onSuccess, onError) {
        $.post(single_flashcard_set_ajax.ajaxurl, {
            action: 'flashcard_set_delete',
            flashcards_user_nonce: $('#flashcards_user_nonce').val(),
            set_id: setId
        }, function(response) {
            if (!response.success) {
                onError(response);
                return;
            }
            clearStoredFlashcardSets();
            onSuccess();
        }).fail(onError);
    }

    function writeSavedSetFromScreen(onSuccess, onError) {
        //The screen never received this set's cards, so writing what is on it would wipe them.
        //This guards Update, Import and Export alike - the last two save before they run.
        if (didSavedSetFailToLoad) {
            onError('This flashcard set could not be loaded, so it cannot be saved. Please reload the page.');
            return;
        }
        if (isSavedSetStillLoading) {
            onError('This flashcard set is still loading, so it cannot be saved yet. Please try again in a moment.');
            return;
        }
        if (!isSetEditable) {
            onError(isPremium
                ? 'This set is saved in this browser, not on your account. Use "Upload Them To Your Account" on the flashcards page to copy it across, then you can edit it.'
                : 'Saving flashcards needs Premium. Upgrade to save this set to your account and use it on any device.');
            return;
        }

        // Everything written comes off the screen. flashcard_set_save leaves created_date alone on an
        // existing set and stamps now when createdDate is 0, so the account already knows the one
        // field the screen cannot supply - no read is needed first.
        var updatedFlashcards = [];
        $('.flashcard-item').each(function() {
            var id = $(this).attr('id');
            var term = $(this).find('.flashcard-term').val().trim();
            var definition = $(this).find('.flashcard-definition').val().trim();
            updatedFlashcards.push({id: id, term: term, definition: definition});
        });

        var setName = $('.flashcard-set-title-input').val();
        if(setName.trim() == '') {
            setName = 'Untitled Flashcard Set';
        }

        if (savedSetId === '' || savedSetId === NEW_FLASHCARD_SET_PATH) {
            savedSetId = generateUUID();
        }

        writeSavedSet({
            setId: savedSetId,
            setName: setName,
            cards: updatedFlashcards,
            createdDate: 0,
            updatedDate: Date.now()
        }, flashcardSet => {
            isSomethingChanged = false;
            onSuccess(flashcardSet);
        }, onError);
    }

    function renderSavedSetFromUrl() {
        //The set is on this learner's account, so the page arrived with the cards, the name and the
        //term count already in it. Nothing left to fetch or build - only whether this learner may
        //edit what is on screen.
        if($('#saved-set-rendered').val() === '1') {
            setSetEditable(isPremium);
            return;
        }
        if(savedSetId == '') {
            //No set named at all, so the screen is a blank new one - the same case as create-new.
            setSetEditable(isPremium);
            return;
        }
        // If a savedSetId is specified, render the flashcard set
        if (savedSetId === NEW_FLASHCARD_SET_PATH) {
            //Nothing to load: this is a blank set the learner is about to create on their account.
            setSetEditable(isPremium);
            renderSavedSetEditor(null);
        } else {
            isSavedSetStillLoading = true;
            readSavedSet(savedSetId, flashcardSet => {
                isSavedSetStillLoading = false;
                if(flashcardSet) {
                    switch(learnMode) {
                        case "flip": {
                            renderSavedSetFlipMode(flashcardSet);
                            break;
                        }
                        case "type": {
                            renderSavedSetTypeMode(flashcardSet);
                            break;
                        }
                        default: {
                            renderSavedSetEditor(flashcardSet);
                        }
                    }
                }
                else {
                    //No such set in either store. Harmless: the screen is a blank new set, and saving
                    //from here creates it on the account.
                    console.log('Cannot load the flashcard set with ID: ' + savedSetId);
                }
            },
            e => {
                //The set exists as far as we know, we just could not read it. Say so, because the
                //screen now looks like an empty set and saving is disabled until a reload.
                isSavedSetStillLoading = false;
                didSavedSetFailToLoad = true;
                console.log('Cannot load the flashcard set with ID: ' + savedSetId);
                alert((e && e.responseJSON && e.responseJSON.data && e.responseJSON.data.message) || 'Could not load this flashcard set. Please check your connection and reload the page.');
            });
        }
    }

    // Function to render a flashcard set
    function renderSavedSetEditor(flashcardSet) {
        var setId = '';
        var setName = '';
        var flashcards = [];

        if(flashcardSet) {
            setId = flashcardSet.setId;
            setName = flashcardSet.setName;
            flashcards = flashcardSet.cards;
        }

        $('.flashcard-set-title-input').val(setName);
        $('.flashcard-set-term-count').text(flashcards.length + " terms");

        // Get the container
        var flashcardContainer = $('.flashcard-container');
        flashcardContainer.attr('id', setId);

        // Create a flashcard for each term/definition in the set
        flashcards.forEach(function(flashcard) {
            var flashcardElement = createFlashcardItem(flashcard.id, flashcard.term, flashcard.definition);
            flashcardContainer.append(flashcardElement);
        });
        
        if(flashcardSet && flashcards.length > 0) {
            $('.flashcard-item:first').remove(); //remove the empty template element
        }
    }

    function renderSavedSetFlipMode(flashcardSet) {
        var setId = '';
        var setName = '';
        var flashcards = [];

        if(flashcardSet) {
            setId = flashcardSet.setId;
            setName = flashcardSet.setName;
            flashcards = flashcardSet.cards;
        }
    
        $('h1').text(flashcardSet.setName);
        $('.flip-flashcard-counter').html('<span>1</span> / ' + flashcards.length);
    
        // Get the container
        var flashcardContainer = $('.flip-flashcard-container');
        flashcardContainer.attr('id', setId);

        // Create a flashcard for each term/definition in the set
        flashcards.forEach(function(flashcard, index) {
            var flashcardElement = $('.flip-flashcard-item:first').clone();
            flashcardElement.find('.flip-flashcard-term').text(flashcard.term);
            flashcardElement.find('.flip-flashcard-definition').text(flashcard.definition);
            flashcardElement.removeClass('current');
            if(index == 0) {
                flashcardElement.addClass('current');
            }
            flashcardElement.attr('data-index', index);
            flashcardElement.insertAfter(flashcardContainer.find('.flip-flashcard-item:last-of-type'));
        });
        $('.flip-flashcard-item:first').remove(); //remove the empty template element
    }

    function renderSavedSetTypeMode(flashcardSet) {
        var setId = '';
        var setName = '';
        var flashcards = [];

        if(flashcardSet) {
            setId = flashcardSet.setId;
            setName = flashcardSet.setName;
            flashcards = flashcardSet.cards;
        }
    
        $('h1').text(flashcardSet.setName);
        $('.type-flashcard-counter').html('<span>1</span> / ' + flashcards.length);
    
        // Get the container
        var flashcardContainer = $('.type-flashcard-container');
        flashcardContainer.attr('id', setId);

        // Create a flashcard for each term/definition in the set
        flashcards.forEach(function(flashcard, index) {
            var flashcardElement = $('.type-flashcard-item:first').clone();
            flashcardElement.find('.type-flashcard-term').text(flashcard.term);
            flashcardElement.find('.type-flashcard-definition').text(flashcard.definition);
            flashcardElement.removeClass('current');
            if(index == 0) {
                flashcardElement.addClass('current');
            }
            flashcardElement.attr('data-index', index);
            flashcardElement.insertAfter(flashcardContainer.find('.type-flashcard-item:last-of-type'));
        });
        $('.type-flashcard-item:first').remove(); //remove the empty template element
    }

    function createFlashcardItem(id, term, definition) {
        var flashcardElement = $('.flashcard-item:first').clone().attr('id', id);
        flashcardElement.find('.flashcard-term').val(term);
        flashcardElement.find('.flashcard-definition').val(definition);

        setTimeout(() => {
            autoResize(flashcardElement.find('.flashcard-term')[0]);
            autoResize(flashcardElement.find('.flashcard-definition')[0]);
        }, 0);

        return flashcardElement;
    }

    $(document).on('click', '.delete-flashcard-button', function(event) {
        event.preventDefault();
        if($('.flashcard-item').length == 1) {
            $('.flashcard-item:first').find('.flashcard-term').val('');
            $('.flashcard-item:first').find('.flashcard-definition').val('');
            return;
        }
        $(this).closest('.flashcard-item').remove();
    });

    $('.add-flashcard-item').on('click', function(e) {
        var flashcardElement = createFlashcardItem(generateUUID(), "", "");
        $('.flashcard-container').append(flashcardElement);
    });

    $('.update-flashcard-button').on('click', function(e) {
        writeSavedSetFromScreen(updatedSet=> {
            alert("Flashcard set updated successfully!");
            var toPath = window.location.protocol + '/engovate.github.io//' + window.location.host + window.location.pathname;
            toPath += '?local-set-id=' + encodeURIComponent(updatedSet.setId);
            window.location.href = toPath;
        },
        e => {
            //e is the guard's explanation when the save was refused before it started.
            alert(typeof e === 'string' ? e : ((e && e.data && e.data.message) || 'Error saving flashcard set!'));
        });
    });

    $('.flashcard-set-settings-button').on('click', function(e) {
        e.preventDefault();
        
        //The panel is anchored to this gear's wrapper in CSS, so there is nothing to position here.
        $(this).siblings('.flashcard-set-settings-panel').toggle();
    });

    $(document).on('mousedown', function(e) {
        if (!$(e.target).closest('.flashcard-set-settings-panel, .flashcard-set-settings-button').length) {
            $('.flashcard-set-settings-panel').hide();
        }
    });

    $('.delete-set-button').on('click', function(e) {
        e.preventDefault();

        //Deleting is a write like any other, so it follows the same rule.
        if (!isSetEditable) {
            alert(isPremium
                ? 'This set is saved in this browser, not on your account, so there is nothing to delete there.'
                : 'Deleting flashcard sets needs Premium.');
            return;
        }

        var userConfirmed = window.confirm("Are you sure you want to delete this set?");
        if(userConfirmed) {
            deleteSavedSet(savedSetId, () => {
                alert("Flashcard set deleted successfully!");
                var toPath = window.location.protocol + '/engovate.github.io//' + window.location.host;
                window.location.href = toPath + '/engovate.github.io/flashcards/?category=local';
            }, e => {
                alert((e && e.responseJSON && e.responseJSON.data && e.responseJSON.data.message) || "Error deleting flashcard set!");
            });
        }
    });

    $('.import-set-button').on('click', function(e) {
        e.preventDefault();
        $('#import-set-input').click();
    });

    $('#import-set-input').on('change', function(e) {
        var files = this.files;
        if (files.length === 0) {
            console.log('No file is selected');
            return;
        }
        
        var filePromises = Array.from(files).map(file => new Promise((resolve, reject) => {
            var reader = new FileReader();
            reader.onload = function(event) {
                var importedSet = parseSetFromImportedFile(event.target.result);
                if (!importedSet) {
                    reject('Failed to parse the imported file');
                    return;
                }
                if(!importedSet.setName) {
                    importedSet.setName = file.name;
                }
                resolve(importedSet); // Resolve the Promise
            };
            reader.onerror = function() {
                reject('Failed to read the imported file');
            };
            reader.readAsText(file);
        }));
    
        // Wait for all files to be processed
        Promise.all(filePromises)
        .then(importedSets => {
            // Put the imported cards on screen and name an untitled set after the files, then save
            // once. Saving the screen first and saving again with the cards merged wrote the whole
            // set twice - two round trips on the account store - and the name never took, because
            // by the time the first save returned it had already defaulted to 'Untitled Flashcard
            // Set' and the check below it could never be true.
            var importedNames = [];
            importedSets.forEach(importedSet => {
                if (importedSet.setName) {
                    importedNames.push(importedSet.setName);
                }
                importedSet.cards.forEach(flashcard => {
                    $('.flashcard-container').append(
                        createFlashcardItem(flashcard.id, flashcard.term, flashcard.definition));
                });
            });

            var titleInput = $('.flashcard-set-title-input');
            if (titleInput.val().trim() === '' && importedNames.length) {
                titleInput.val(importedNames.join(' + '));
            }

            writeSavedSetFromScreen(savedSet => {
                location.reload();
            },
            e => {
                alert(typeof e === 'string' ? e : ((e && e.data && e.data.message) || 'Error saving flashcard set!'));
            });
        })
        .catch(e => {
            alert(e);
        });
    });

    $('.export-set-button').on('click', function(e) {
        e.preventDefault();
            
        //Exporting is a read, so it must work for a set nobody can write - a legacy one, or any set at
        //all for a learner without Premium. Saving first is a convenience for a set that IS editable,
        //so that unsaved edits make it into the file; otherwise go straight to the export.
        var exportSetFromScreen = function(flashcardSet) {
            // Create a string in the desired format
            var dataString = '';
            dataString += 'setName' + '\t' + flashcardSet.setName + '\n\n';
            flashcardSet.cards.forEach(flashcard => {
                var term = flashcard.term.replace(/[\r\n]/g, '\\n');
                var definition = flashcard.definition.replace(/[\r\n]/g, '\\n');
                dataString += term + '\t' + definition + '\n';
            });
            
            // Create a blob from the string
            var blob = new Blob([dataString], {type: 'text/plain'});
    
            // Create a link element, use it to download the blob, and then remove it
            var a = document.createElement('a');
            a.download = flashcardSet.setName ? flashcardSet.setName : flashcardSet.setId + '.txt';
            a.href = window.URL.createObjectURL(blob);
            a.dataset.downloadurl = ['text/plain', a.download, a.href].join(':');
            a.style.display = "none";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
    
        };

        if (!isSetEditable) {
            readSavedSet(savedSetId, storedSet => {
                exportSetFromScreen(storedSet || {setId: savedSetId, setName: $('.flashcard-set-title-input').val(), cards: []});
            }, e => {
                alert((e && e.responseJSON && e.responseJSON.data && e.responseJSON.data.message) || 'Could not read this flashcard set, so it was not exported.');
            });
            return;
        }

        writeSavedSetFromScreen(flashcardSet => {
            exportSetFromScreen(flashcardSet);
            location.reload();
        },
        e => {
            alert(typeof e === 'string' ? e : ((e && e.data && e.data.message) || 'Error saving flashcard set!'));
        });
    });

    function parseSetFromImportedFile(fileContent) {
        try {
            //Inside the try: this is the call that throws on anything that is not text, and the null
            //below is the callers' only signal that parsing failed.
            var lines = fileContent.split('\n');
            var importedSet = { setName:'', cards: [] };
            lines.forEach(line => {
                var parts = line.split('\t');
                var term = parts[0].replace(/\\n/g, '\n');
                if(!term) return;
                var definition = (parts.length >= 2) ? parts[1].replace(/\\n/g, '\n') : '';
                if(term === "setName") {
                    importedSet.setName = definition;
                    return;
                }
                var flashcard = {
                    id: generateUUID(),
                    term: term,
                    definition: definition
                };
                importedSet.cards.push(flashcard);
            });
            return importedSet;
        } catch (e) {
            return null;
        }
    }

    function generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random() * 16 | 0,
                v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    // ------------ AUTO RESIZE --------------
    // Only the cards' boxes: the comment box below has its own size, and typing a comment is not an unsaved card change.
    $(document).on('input', '.flashcard-container textarea', function() {
        autoResize(this);
        isSomethingChanged = true;
    });

    function autoResize(textarea) {
        $(textarea).css("height", "auto");
        $(textarea).css("height", textarea.scrollHeight + "px");
    }

    $('.flashcard-container textarea').each(function() {
        autoResize(this);
    });

    //--- PRINT PDF ---//
    // Prints the set as a numbered Term / Definition table, read from the cards on the page so a
    // learner's own set prints with their latest edits. The table is added to the page only for the
    // print, and while it prints everything else on the page is hidden.
    $(document).on('click', '.print-flashcard-button', function(event) {
        event.preventDefault();

        var $rows = $('<tbody>');
        $('.flashcard-item').each(function() {
            var term = ($(this).find('.flashcard-term').val() || '').trim();
            // Blank lines inside a definition become single line breaks, so more cards fit on a page.
            var definition = ($(this).find('.flashcard-definition').val() || '').trim().replace(/\n\s*\n/g, '\n');
            if (!term && !definition) return;
            $rows.append($('<tr>').append(
                $('<td>').text($rows.children().length + 1),
                $('<td>').text(term),
                $('<td>').text(definition)
            ));
        });
        if (!$rows.children().length) {
            alert('There are no flashcards to print yet.');
            return;
        }

        // A site set has its title in the heading; a learner's own set has it in the name box.
        var title = $('#main .entry-header h1').text().trim() || ($('.flashcard-set-title-input').val() || '').trim() || 'Vocabulary Flashcards';
        $('.flashcard-print-sheet').remove();
        $('<div class="flashcard-print-sheet">').append(
            $('<h1>').text(title),
            $('<table>').append('<thead><tr><th>#</th><th>Term</th><th>Definition</th></tr></thead>', $rows)
        ).appendTo('body');

        $('body').addClass('flashcard-printing');
        window.addEventListener('afterprint', function() {
            $('body').removeClass('flashcard-printing');
            $('.flashcard-print-sheet').remove();
        }, { once: true });
        window.print();
    });

    //--- ASK BEFORE LEAVING ---//
    window.addEventListener("beforeunload", (event) => {
        if(isSomethingChanged) {
            event.preventDefault();
        }
    });
});