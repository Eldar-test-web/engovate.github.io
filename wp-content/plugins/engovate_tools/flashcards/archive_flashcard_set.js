jQuery(document).ready(function($) {
    $('.flashcard-set-category').on('click', function(e){
        e.preventDefault();
       
        var categorySlug = $(this).data('categorySlug');

        // Get the current URL parts
        var protocol = window.location.protocol;
        var host = window.location.host;
        var pathname = window.location.pathname;
        
        // Check if the pathname ends with a slash
        if (!pathname.endsWith('/')) {
            // Add the slash
            pathname += '/';
        }
        
        // Construct the new URL
        var newUrl = protocol + '//' + host + pathname;
        if(categorySlug) {
            newUrl += '?category=' + encodeURIComponent(categorySlug);
        }
    
        // Navigate to new URL
        window.location.href = newUrl;
    });

    $('.flashcard-set-search').on('submit', function(e){
        e.preventDefault();

        var searchTerms = $(this).find('input[name="search_terms"]').val();
        var categorySlug = $(this).find('select[name="category_slug"]').val();
        var submitButton = $(this).find('button[type="submit"]');

        var postsContainter = $('#tag-posts-search');
        var postsPaginationContainter = $('#tag-posts-search-pagination');

        searchFlashcardSets(postsContainter, postsPaginationContainter, searchTerms, categorySlug, '', 1, () => {
            submitButton.prop("disabled", true);
            submitButton.text("Searching...");
        }, () => {
            submitButton.prop("disabled", false);
            submitButton.text("Search");
            $(".search-results").show();
        });

        //Search the store this learner actually has sets in. Asking the account when they have none -
        //signed out, or signed in but never Premium - costs a request that can only come back empty and
        //leaves the legacy sets in this browser unsearchable. The flag comes from the template because
        //this runs on the default archive view too, where the account section is not rendered.
        renderSavedSets($('.search-results-local'), searchTerms, 'recent', 1, undefined,
            $('#has_account_sets').val() === '1' ? 'account' : 'browser');
    });

    $(document).on('click', '.pagination a', function(e) {
        e.preventDefault();

        var paginationContainer = $(this).closest('.pagination');
        var tagSlug = paginationContainer.data('tagSlug');
        var tagPostsContainer = $('#tag-posts-' + tagSlug);
        var url = $(this).attr('href');
        var urlSegments = url.split('/');
        var paged = urlSegments[urlSegments.length - 1];

        var categorySlug = "";
        var searchTerms = "";
        if(tagSlug === "search") {
            tagSlug = "";
            searchTerms = $('.flashcard-set-search').find('input[name="search_terms"]').val();
            categorySlug = $('.flashcard-set-search').find('select[name="category_slug"]').val();
        } else {
            categorySlug = paginationContainer.data('categorySlug') || '';
        }

        searchFlashcardSets(tagPostsContainer, paginationContainer, searchTerms, categorySlug, tagSlug, paged);
    });

    function searchFlashcardSets(postsContainer, paginationContainer, searchTerms, categorySlug, tagSlug, paged, beforeSendCallBack = null, completeCallback = null)
    {
        $.ajax({
            url: archive_flashcard_set_ajax.ajaxurl,
            method: 'POST',
            data: {
                action: 'filter_flashcard_sets',
                search_terms: searchTerms,
                category_slug: categorySlug,
                tag_slug: tagSlug,
                paged: paged,
                flashcard_set_filter_nonce: $("#flashcard_set_filter_nonce").val()
            },
            beforeSend: function () {
                postsContainer.css('pointer-events', 'none').animate({opacity: 0}, "fast");
                paginationContainer.html('<div class="spinner"></div>');
                if(beforeSendCallBack)
                {
                    beforeSendCallBack();
                }
            },
            success: function(response) {
                if (response.success) {
                    var filtered_posts = response.data.filtered_posts_data;
                    var postsMarkup = '';
                    $.each(filtered_posts, function(index, post) {
                        postsMarkup += '<div class="flashcard-set" id="post-' + post.id + '">';
                        postsMarkup += '<div class="post-thumbnail">';
                        if (post.thumbnail) {
                            postsMarkup += '<a href="' + post.permalink + '" rel="bookmark">';
                            postsMarkup += '<img src="' + post.thumbnail + '" alt="' + post.title + '">';
                            postsMarkup += '</a>';
                        }
                        postsMarkup += '</div>';
                        postsMarkup += '<header class="post-header">';
                        postsMarkup += '<h3 class="post-title"><a href="' + post.permalink + '" rel="bookmark">' + post.title + '</a></h3>';
                        postsMarkup += '</header>';
                        postsMarkup += '<div class="post-footer">';
                        postsMarkup += '<a href="' + post.permalink + '" class="start-learning-button">Learn</a>';
                        postsMarkup += '</div>';
                        postsMarkup += '</div>';
                    });
                    
                    if(postsMarkup === '')
                    {
                        postsMarkup = "No Flashcard Sets Found!";
                    }

                    postsContainer.html(postsMarkup);
                    postsContainer.css('pointer-events', 'auto').animate({opacity: 1}, "fast");
                    paginationContainer.html(response.data.paginate_links);
                } else {
                    alert('Error loading flashcard sets');
                }
            },
            error: function(jqXHR) {
                alert((jqXHR.responseJSON && jqXHR.responseJSON.data && jqXHR.responseJSON.data.message) || 'Error loading flashcard sets');
            },
            complete: function() {
                if(completeCallback)
                {
                    completeCallback();
                }
            }
        });
    }


    //---------- LOCAL FLASHCARD SETS ----------
    const NEW_FLASHCARD_SET_PATH = "create-new";
    //Comes from FLASHCARD_SETS_PER_PAGE, so the page size is stated once. The server pages the
    //account store by it and the cursor below pages the browser store by it, and the two have to
    //agree or sets would be dropped or repeated across a page boundary. This script is enqueued on
    //exactly the condition under which the input is rendered, so it is always there.
    const SET_PER_PAGE = Number($('#flashcard_sets_per_page').val());

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
    //The account section is server-rendered with its total on the container, so it needs no request
    //to paint - only its pagination wired up.
    var $accountSets = $('.account-flashcard-set-posts');
    if ($accountSets.length) {
        renderSavedSets($accountSets, '', 'recent', 1, Number($accountSets.attr('data-total')), 'account');
    }

    openRequest.onsuccess = function(e) {
        browserDb = e.target.result;

        //Sets still in this browser, from before flashcards moved to the account. Nothing writes this
        //store any more, so the section is a read-only leftover: it is rendered when this browser holds
        //something the account does not, and stays hidden otherwise - once everything has been uploaded
        //there is one list, not two saying the same thing. The check is whole-section rather than
        //per-card, because dropping cards out of a paged list leaves its page count describing a list
        //that is no longer there.
        var $legacySets = $('.legacy-flashcard-set-posts');
        if (!$legacySets.length) {
            return;
        }

        var accountSetIds = ($accountSets.attr('data-set-ids') || '').split(',').filter(Boolean);
        var browserSetCount = 0;
        var everyBrowserSetIsOnTheAccount = true;
        readSavedSets('', 'updated', -1, browserSet => {
            browserSetCount++;
            if (accountSetIds.indexOf(browserSet.setId) === -1) {
                everyBrowserSetIsOnTheAccount = false;
            }
        },
        () => {
            if (browserSetCount === 0 || everyBrowserSetIsOnTheAccount) {
                //Nothing here, and if there is no account list either then the view has nothing at all
                //to show - say so rather than leaving a blank area.
                if (!$accountSets.length) {
                    $('.flashcard-set-empty').show();
                }
                return;
            }
            $legacySets.show();
            renderSavedSets($legacySets, '', 'recent', 1, undefined, 'browser');
        },
        e => {
            console.log(e);
        }, 'browser');
    };
    openRequest.onerror = function(e) {
        console.error('Error opening IndexedDB:', e);
        //No browser store means no legacy list to show, so the view is whatever the account rendered.
        //If that is nothing at all, say so rather than leaving a blank area.
        if (!$accountSets.length) {
            $('.flashcard-set-empty').show();
        }
    };

    function countSavedSets(searchTerm, sortMode, onSuccess, onError, knownTotal) {
        //The caller already holds the total, so asking the server for it is a wasted round trip.
        if (knownTotal !== undefined) {
            onSuccess(knownTotal);
            return;
        }


        // Open transaction and get the object store
        let tx = browserDb.transaction("FlashcardStore", "readonly");
        let store = tx.objectStore("FlashcardStore");

        // Get the index
        let index;
        if(sortMode === 'created') {
            index = store.index('by_createdDate');
        }
        else {
            index = store.index('by_updatedDate');
        }

        // Open a cursor to iterate over all flashcard sets
        let getRequest = index.openCursor(null, 'prev'); //latest first

        // Keep track of the number of results
        let count = 0;
        
        getRequest.onsuccess = function(e) {
            let cursor = e.target.result;
            
            if (!cursor) {
                // No more results
                onSuccess(count);
                return;
            }

            if (!searchTerm || cursor.value.setName.toLowerCase().includes(searchTerm.toLowerCase())) {
                count++;
            }

            // continue to the next flashcard set
            cursor.continue();
        };
        tx.onerror = function(e) {
            onError(e);
        };
    }

    //The only thing that still writes the browser store, and only ever to remove: once a legacy set is
    //on the account, the copy here is a stale duplicate that would otherwise show in both lists for
    //ever. Failing to delete is not an error worth stopping the migration for - the set is already
    //safely on the account.
    function deleteLegacySets(setIds, onDone) {
        if (!browserDb || !setIds.length) {
            onDone();
            return;
        }
        let tx = browserDb.transaction("FlashcardStore", "readwrite");
        let store = tx.objectStore("FlashcardStore");
        setIds.forEach(setId => store.delete(setId));
        tx.oncomplete = onDone;
        tx.onerror = function(e) {
            console.log(e);
            onDone();
        };
    }

    //Any number of sets in one request - the legacy migration and the file import both use it. The
    //account answers with the ids it stored and the ones it refused, so each caller can tell the
    //learner what landed.
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

    function writeSavedSets(flashcardSets, onSuccess, onError) {
        $.post(archive_flashcard_set_ajax.ajaxurl, {
            action: 'flashcard_sets_save',
            flashcards_user_nonce: $('#flashcards_user_nonce').val(),
            sets: JSON.stringify(flashcardSets)
        }, function(response) {
            if (!response.success) {
                onError(response);
                return;
            }
            clearStoredFlashcardSets();
            onSuccess(response.data);
        }).fail(onError);
    }

    //source says which store to read: 'account' for the learner's saved sets, 'browser' for the legacy
    //sets still held by this browser, 'markup' for rows the template already printed. It is never
    //inferred - the two stores hold different things and the caller always knows which it wants.
    function readSavedSets(searchTerm, sortMode, page, onItem, onFinished, onError, source) {
        //'rendered' means the rows are already in the markup: nothing to fetch, nothing to iterate.
        if (source === 'markup') {
            onFinished();
            return;
        }

        if (source === 'account') {
            //page -1 is the export path and is the only one that needs the cards themselves.
            $.post(archive_flashcard_set_ajax.ajaxurl, {
                action: 'flashcard_sets_list',
                flashcards_user_nonce: $('#flashcards_user_nonce').val(),
                search: searchTerm,
                sort: sortMode,
                page: page,
                with_cards: page === -1 ? 1 : 0
            }, function(response) {
                if (!response.success) {
                    onError(response);
                    return;
                }
                //The total rides along with the rows, so onFinished carries it and the pagination
                //needs no second request. The IndexedDB branch below passes nothing and counts itself.
                response.data.sets.forEach(onItem);
                onFinished(response.data.total);
            }).fail(onError);
            return;
        }

        // Open transaction and get the object store
        let tx = browserDb.transaction("FlashcardStore", "readonly");
        let store = tx.objectStore("FlashcardStore");

        // Get the index
        let index;
        if(sortMode === 'created') {
            index = store.index('by_createdDate');
        }
        else {
            index = store.index('by_updatedDate');
        }

        // Open a cursor to iterate over all flashcard sets
        let getRequest = index.openCursor(null, 'prev'); //latest first

        // Calculate the number of records to skip
        let skipCount = page === -1 ? 0 : SET_PER_PAGE * (page - 1);

        // Keep track of the number of results
        let count = 0;
        
        getRequest.onsuccess = function(e) {
            let cursor = e.target.result;
            
            if (!cursor) {
                // No more results
                onFinished();
                return;
            }

            if (searchTerm && !cursor.value.setName.toLowerCase().includes(searchTerm.toLowerCase())) {
                cursor.continue();
                return;
            }

            if (skipCount > 0) {
                // Skip records
                cursor.advance(skipCount);
                skipCount = 0;
            } else if (count < SET_PER_PAGE || page === -1) {
                // Call the callback for this record and continue to the next
                onItem(cursor.value);
                count++;
                cursor.continue();
            } else {
                // We have retrieved enough results
                onFinished();
            }
        };
        tx.onerror = function(e) {
            onError(e);
        };
    }

    $('.add-flashcard-set').on('click', function(e) {
        e.preventDefault();
        var toPath = window.location.protocol + '//' + window.location.host + window.location.pathname;
        toPath += '/custom/?local-set-id=' + encodeURIComponent(NEW_FLASHCARD_SET_PATH);
        window.location.href = toPath;
    });

    $('.local-flashcard-select-sort').on('change', function(e) {
        e.preventDefault();
        var sortMode = $(this).val();
        renderSavedSets($('.account-flashcard-set-posts'), '', sortMode, 1, undefined, 'account');
    });

    $('.local-flashcard-settings-button').on('click', function(e) {
        e.preventDefault();
        
        //Scoped to this gear's own section: both the account list and the legacy list have a panel,
        //and an unscoped selector positions and toggles them both on top of each other - which also
        //puts the legacy section's buttons under the account section's gear.
        //The panel is anchored to this gear's wrapper in CSS, so there is nothing to position here.
        $(this).siblings('.local-flashcard-settings-panel').toggle();
    });

    $(document).on('mousedown', function(e) {
        if (!$(e.target).closest('.local-flashcard-settings-panel, .local-flashcard-settings-button').length) {
            $('.local-flashcard-settings-panel').hide();
        }
    });

    $('.import-sets-button').on('click', function(e) {
        e.preventDefault();
        $('#import-sets-input').click();
    });

    $('#import-sets-input').on('change', async function() {
        var files = this.files;
        if (files.length === 0) {
            console.log('No file is selected');
            return;
        }

        var filePromises = Array.from(files).map(file => {
            return new Promise((resolve, reject) => {
                // If the file is a .zip file
                if (file.name.endsWith('.zip')) {
                    JSZip.loadAsync(file).then(function(zip) {
                        var zipPromises = [];

                        zip.forEach(function(relativePath, zipEntry) {
                            if (!zipEntry.dir) {
                                zipPromises.push(zipEntry.async('text').then(function(content) {
                                    var importedSet = parseSetFromImportedFile(content);
                                    if (!importedSet) {
                                        //Rejects this entry's promise, which Promise.all below
                                        //forwards to the outer reject.
                                        throw 'Failed to parse the imported file';
                                    }
                                    if(!importedSet.setName) {
                                        importedSet.setName = zipEntry.name;
                                    }
                                    return importedSet;
                                }));
                            }
                        });

                        Promise.all(zipPromises).then(resolve).catch(reject);
                    }).catch(reject);
                } 
                // If the file is a text file
                else {
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
                        resolve([importedSet]);
                    };
                    reader.onerror = function() {
                        reject('Failed to read the imported file');
                    };
                    reader.readAsText(file);
                }
            });
        });

        // Wait for all files to be processed
        Promise.all(filePromises)
        .then(allFilesImportedSets => {
            // Flatten the array
            var allImportedSets = [].concat.apply([], allFilesImportedSets);

            allImportedSets.forEach(importedSet => {
                importedSet.setId = generateUUID();
                importedSet.createdDate = Date.now();
                importedSet.updatedDate = Date.now();
            });

            // Every imported set in one request, the same as the legacy upload above.
            return new Promise((resolve, reject) => {
                writeSavedSets(allImportedSets, result => {
                    // A set the account refused is worth saying, but the ones that landed are
                    // already there - so this resolves either way and the reload below shows them.
                    if (result.failed.length) {
                        alert('Imported ' + result.saved.length + ' of ' + allImportedSets.length +
                            ' flashcard set(s). The rest could not be saved - please try again.');
                    }
                    resolve();
                },
                e => {
                    reject('Error saving flashcard set!');
                });
            });
        })
        .then(() => {
            location.reload();
        })
        .catch(e => {
            alert(e);
        });
    });

    $('.export-sets-button, .export-legacy-sets-button').on('click', function(e) {
        e.preventDefault();

        //Each section exports its own store: the account list, or the leftovers in this browser.
        var source = $(this).hasClass('export-legacy-sets-button') ? 'browser' : 'account';

        // Create a new instance of JSZip
        var zip = new JSZip();

        let fileNamesUsed = {};
        var setsExported = 0;

        readSavedSets('', 'updated', -1, flashcardSet => {
            setsExported++;
            // Create a string in the desired format
            var dataString = '';
            dataString += 'setName' + '\t' + flashcardSet.setName + '\n\n';
            flashcardSet.cards.forEach(flashcard => {
                var term = flashcard.term.replace(/[\r\n]/g, '\\n');
                var definition = flashcard.definition.replace(/[\r\n]/g, '\\n');
                dataString += term + '\t' + definition + '\n';
            });

            // The file name will be the set name or the set id with .txt extension
            var originalFileName = flashcardSet.setName ? flashcardSet.setName : flashcardSet.setId;
            var fileName = originalFileName;

            // Check if the file name has been used before
            if (fileNamesUsed[originalFileName]) {
                // If it has, append the count to the file name
                fileName += ` (${fileNamesUsed[originalFileName]})`;
                // Increment the count
                fileNamesUsed[originalFileName]++;
            } else {
                // If it hasn't, add it to the list with a count of 1
                fileNamesUsed[originalFileName] = 1;
            }

            // Add .txt extension
            fileName += '.txt';

            zip.file(fileName, dataString);
        },
        () => {
            //An empty account export downloads a zip with nothing in it, which reads as the export
            //having failed. A premium learner who has not pressed Upload yet is the usual way here.
            if (setsExported === 0) {
                alert('There are no flashcard sets to export.');
                return;
            }

            // After all flashcard sets have been processed, generate the zip file
            zip.generateAsync({type:"blob"})
            .then(function(blob) {
                // Create a link element, use it to download the blob, and then remove it
                var a = document.createElement('a');
                a.download = 'flashcards.zip';
                a.href = window.URL.createObjectURL(blob);
                a.dataset.downloadurl = ['application/zip', a.download, a.href].join(':');
                a.style.display = "none";
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
            });
        }, e => {
            alert('Error exporting flashcard sets!');
        }, source);
    });

    //Moves the sets still held by this browser onto the learner's account, and clears each browser copy
    //once the account has it - so the legacy list shrinks as it goes and disappears when it is empty.
    //
    //The account is read first and matching ids are skipped, because a browser copy of a set the account
    //already holds is a frozen snapshot: nothing has written this store since flashcards moved to the
    //account, so re-uploading one would replace live cards with an older version of themselves. It fails
    //closed - if that read fails, nothing is uploaded.
    //
    //The whole thing is one request. The account answers with the ids it stored, and only those copies
    //are cleared from this browser - so a set is either uploaded or still here, never neither, and a
    //library of any size costs one round trip instead of a burst that gets a learner rate limited.
    $('.upload-local-sets-button').on('click', function(e) {
        e.preventDefault();

        var uploadButton = $(this);
        if (uploadButton.data('uploading')) {
            return;
        }

        if (!browserDb) {
            alert('Still reading the sets saved in this browser. Please try again in a moment.');
            return;
        }
        if (!window.confirm('Upload the flashcard sets saved in this browser to your account?')) {
            return;
        }

        var accountSetIds = {};
        readSavedSets('', 'updated', -1, accountSet => {
            accountSetIds[accountSet.setId] = true;
        },
        () => {
            var localSets = [];
            readSavedSets('', 'updated', -1, flashcardSet => {
                if (!accountSetIds[flashcardSet.setId]) {
                    localSets.push(flashcardSet);
                }
            },
            () => {
                if (localSets.length === 0) {
                    alert('There are no flashcard sets in this browser that your account does not already have.');
                    return;
                }

                uploadButton.data('uploading', true);

                writeSavedSets(localSets, result => {
                    //Only the sets the account confirmed are cleared from this browser. Anything it
                    //refused stays here, so nothing is lost when part of the upload does not land.
                    deleteLegacySets(result.saved, () => {
                        uploadButton.data('uploading', false);
                        if (result.failed.length) {
                            alert('Uploaded ' + result.saved.length + ' of ' + localSets.length +
                                ' flashcard set(s). The rest are still saved in this browser - please try again.');
                        }
                        else {
                            alert(result.saved.length + ' flashcard set(s) uploaded to your account.');
                        }
                        location.reload();
                    });
                }, () => {
                    uploadButton.data('uploading', false);
                    alert('Could not upload your flashcard sets. They are still saved in this browser - please try again.');
                    location.reload();
                });
            },
            e => {
                alert('Error reading the flashcard sets saved in this browser!');
            }, 'browser');
        },
        e => {
            alert('Could not check which sets your account already has, so nothing was uploaded. Please try again.');
        }, 'account');
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
            console.log(e);
            return null;
        }
    }

    //source pins which store this container pages - 'account' or 'browser' - so its own pagination
    //links keep reading the same one. It is always passed: the two stores hold different things.
    function renderSavedSets(parentContainer, searchTerm, sortMode, paged, serverRenderedTotal, source) {
        if(!paged) {
            paged = 1;
        }

        //A total means the sets are already in the markup, and clearing would throw them away.
        //Pagination, sort and search pass none, so they clear and re-fetch.
        if (serverRenderedTotal === undefined) {
            parentContainer.find('.flashcard-set').remove();
        }
        parentContainer.find('.pagination').children().remove();

        var basePath = window.location.protocol + '//' + window.location.host + window.location.pathname;

        readSavedSets(searchTerm, sortMode, paged, flashcardSet => {
            //The same shape the server renders, so a card looks identical
            //whichever side built it.
            var flashcardSetElement = $('<div class="flashcard-set">' +
                '<header class="post-header"><h3 class="post-title"></h3></header>' +
                '<div class="post-footer"><a class="start-learning-button">Learn</a></div>' +
            '</div>');
            flashcardSetElement.attr('id', flashcardSet.setId);
            flashcardSetElement.find('.post-title').text(flashcardSet.setName);
            flashcardSetElement.find('.start-learning-button').attr('href', basePath + 'custom/?local-set-id=' + encodeURIComponent(flashcardSet.setId));

            flashcardSetElement.appendTo(parentContainer.find('.tag-posts'));
        },
        fetchedTotal => { //on finished
            //add pagination
            countSavedSets(searchTerm, sortMode, numberOfSet => {
                var paginationDiv = parentContainer.find('.tag-navigation .pagination');
                let totalPages = Math.ceil(numberOfSet / SET_PER_PAGE);
                let currentPage = paged;

                if(totalPages > 1) {
                    const range = 2; // Number of pages to display around the current page
                    const start = Math.max(1, currentPage - range);
                    const end = Math.min(totalPages, currentPage + range);

                    // Add previous button
                    if (currentPage > 1) {
                        let prevPageLink = $(`<a href="${basePath}page/${currentPage - 1}&category=local" class="page-numbers prev">« Previous</a>`);
                        prevPageLink.on('click', function(e) {
                            e.preventDefault();
                            renderSavedSets(parentContainer ,searchTerm, sortMode, currentPage - 1, undefined, source);
                        });
                        paginationDiv.append(prevPageLink);
                    }
                
                    if (start > 1) {
                        let pageLink = $(`<a class="page-numbers" href="${basePath}page/1&category=local" ${currentPage === 2 ? 'rel="prev"' : ''}>1</a>`);
                        pageLink.on('click', function(e) {
                            e.preventDefault();
                            renderSavedSets(parentContainer, searchTerm, sortMode, 1, undefined, source);
                        });
                        paginationDiv.append(pageLink);
                    }
                
                    if (start > 2) {
                        paginationDiv.append($('<span class="pagination-dots">...</span>'));
                    }
                
                    for (let i = start; i <= end; i++) {
                        let pageLink = $(`<a href="${basePath}page/${i}&category=local" class="page-numbers ${i === currentPage ? 'current" aria-current="page" ' : '"'} ${i === currentPage - 1 ? 'rel="prev"' : i === currentPage + 1 ? 'rel="next"' : ''}>${i}</a>`);
                        pageLink.on('click', function(e) {
                            e.preventDefault();
                            renderSavedSets(parentContainer, searchTerm, sortMode, i, undefined, source);
                        });
                        paginationDiv.append(pageLink);
                    }
                
                    if (end < totalPages - 1) {
                        paginationDiv.append($('<span class="pagination-dots">...</span>'));
                    }
                
                    if (end < totalPages) {
                        let pageLink = $(`<a href="${basePath}page/${totalPages}&category=local" class="page-numbers" ${currentPage === totalPages - 1 ? 'rel="next"' : ''}>${totalPages}</a>`);
                        pageLink.on('click', function(e) {
                            e.preventDefault();
                            renderSavedSets(parentContainer, searchTerm, sortMode, totalPages, undefined, source);
                        });
                        paginationDiv.append(pageLink);
                    }

                    // Add next button
                    if (currentPage < totalPages) {
                        let nextPageLink = $(`<a href="${basePath}page/${currentPage + 1}&category=local" class="page-numbers next">Next »</a>`);
                        nextPageLink.on('click', function(e) {
                            e.preventDefault();
                            renderSavedSets(parentContainer, searchTerm, sortMode, currentPage + 1, undefined, source);
                        });
                        paginationDiv.append(nextPageLink);
                    }
                }
            },
            e => {
                //The sets are on screen but their page links are not, so without saying so the learner
                //silently sees only the first page of a longer list.
                console.log(e);
                alert('Could not load the page links for your saved flashcard sets. Please reload the page.');
            }, serverRenderedTotal !== undefined ? serverRenderedTotal : fetchedTotal);
        },
        e => {
            //An empty grid is indistinguishable from owning no sets, so a failed read has to say so -
            //the sets are all still on the account.
            console.log(e);
            alert((e && e.responseJSON && e.responseJSON.data && e.responseJSON.data.message) || 'Could not load your saved flashcard sets. Please check your connection and reload the page.');
        }, serverRenderedTotal === undefined ? source : 'markup');
    }

    function generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random() * 16 | 0,
                v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }
});