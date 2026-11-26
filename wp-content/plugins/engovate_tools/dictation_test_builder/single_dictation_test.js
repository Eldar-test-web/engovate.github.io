jQuery(document).ready(function ($) {

    const floatCompareOffset = 0.01;

    var transcriptLines = [];
    var wholeScript = '';
    var missingWordTranscriptLines = [];
    var dictationStates = [];
    var shadowingStates = [];
    var currentTranscriptLineIndex = -1;
    var currentAudioTime = 0;
    var isDictationForcePause = false;
    var dictationAudio = $('.dictation-audio')[0];
    var practiceMode = $('#practice-mode').val();
    var dictationMode = 'word';

    const simpleEnglishWords = [
        'I', 'me', 'you', 'he', 'him', 'she', 'her', 'it', 'we', 'us', 'they', 'them',
        'my', 'your', 'his', 'her', 'its', 'our', 'their', 'mine', 'yours', 'his', 'hers', 'ours', 'theirs',
        'a', 'an', 'the',
        'in', 'on', 'at', 'to', 'from', 'by', 'with', 'about', 'for', 'of', 'as', 'over', 'under', 'above', 'below', 'before', 'after', 'between', 'among', 'within', 'against', 'through', 'across', 'along', 'beside', 'beyond', 'near', 'far', 'since', 'during', 'until', 'toward', 'onto', 'upon', 'off', 'around', 'behind', 'besides', 'into', 'out', 'like', 'unlike', 'towards', 'onto',
        'and', 'or', 'but', 'if', 'then', 'else', 'so', 'yet', 'either', 'neither', 'nor', 'while', 'although', 'though', 'because', 'since', 'once', 'whenever', 'whereas', 'as', 'even', 'in', 'whether',
        'is', 'am', 'are', 'was', 'were', 'be', 'been', 'being', 'will', 'would', 'shall', 'should', 'must', 'can', 'could', 'may', 'might', 'ought', 'used', 'to', 'ought', 'to',
        'very', 'have', 'has', 'had', 'do', 'does', 'did', 'done', 'who', 'whom', 'whose', 'which', 'that', 'this', 'these', 'those', 'there', 'here', 'where', 'when', 'how', 'why', 'what', 'whichever', 'whoever', 'whomever', 'whenever', 'wherever',
    ];

    $('.transcript-line').each(function (index) {
        let start = parseFloat($(this).data('start'));
        let duration = parseFloat($(this).data('duration'));
        let wordElements = $(this).find('.word');
        let words = wordElements.map(function () {
            return $(this).text();
        }).get();

        transcriptLines.push({ words: words, start: start, duration: duration });
        wholeScript += joinWordsToSentence(words) + ' ';

        //consider '.' or ',' a separate word so that when we filter fill-in-blank words, we still consider the final word of the sentence eligible
        let wordsWithMissingInput = [...words];
        replaceIndex = -1;
        //filter out short caption
        if(wordsWithMissingInput.length >= 2)
        {
            const wordRegex = /[^a-z]/; //avoid personal names, special charaters, etc.
            let eligibleWords = wordsWithMissingInput.filter(word => word.length >= 4 && !wordRegex.test(word) && !simpleEnglishWords.includes(word.toLowerCase()));

            if(eligibleWords.length == 0) {
                //try again and allow words with 3 characters
                eligibleWords = wordsWithMissingInput.filter(word => word.length >= 3 && !wordRegex.test(word) && !simpleEnglishWords.includes(word.toLowerCase()));
            }

            if(eligibleWords.length == 0) {
                //try again and allow words with 2 characters
                eligibleWords = wordsWithMissingInput.filter(word => word.length >= 2 && !wordRegex.test(word));
            }

            //randomly removing a word (except simple English word like I, they, he, she, etc. or word containing special characters) and replace it with dashes
            if (eligibleWords.length > 0) {
                let randomIndex = Math.floor(Math.random() * eligibleWords.length);
                let wordToReplace = eligibleWords[randomIndex];
                replaceIndex = wordsWithMissingInput.indexOf(wordToReplace);
                if (replaceIndex !== -1) {
                    let dashedWord = '-'.repeat(wordToReplace.length);
                    wordsWithMissingInput[replaceIndex] = `<strong>[${dashedWord}](${wordToReplace.length})</strong>`;
                }
            }
        }
        missingWordTranscriptLines.push({words: wordsWithMissingInput, missingWordIndex: replaceIndex});
        dictationStates.push({answer: "", status:false, diff: ""});
        shadowingStates.push({answer: "", audioURL: "", score: -1, diff: ""});
    });

    function joinWordsToSentence(words) {
        if(!Array.isArray(words)) return '';
        let sentence = '';
        for (let i = 0; i < words.length; i++) {
            let word = words[i];
            if ((word !== '.' && word !== ',') && i > 0) {
                sentence += ' ';
            }
            sentence += word;
        }

        return sentence;
    }

    setInterval(() => { //don't use dictationAudio.onTimeUpdate since its update rate is not reliable and not frequent enough
        var currentTime = dictationAudio.currentTime;

        if(currentTime == currentAudioTime) {
            return;
        }

        currentAudioTime = currentTime;

        var shouldActiveTranscriptLineIndex = findTranscriptLineIndex(currentTime);

        if (currentTranscriptLineIndex >= 0) {
            var currentTranscriptLine = transcriptLines[currentTranscriptLineIndex];
            if (currentTime >= currentTranscriptLine.start + currentTranscriptLine.duration) {
                if(practiceMode !== "full_recall") {
                    isDictationForcePause = true;
                    stopAudio();
                    return;
                }
            }
        }

        if (shouldActiveTranscriptLineIndex >= 0) {

            var shouldActiveTranscriptLine = transcriptLines[shouldActiveTranscriptLineIndex];
            var words = shouldActiveTranscriptLine.words;
            var wordDuration = shouldActiveTranscriptLine.duration / words.length;
            var elapsedTime = currentTime - shouldActiveTranscriptLine.start + 0.1; //plus a small offset so that we always see the final word highlighted
            var shouldActiveWordIndex = Math.floor(elapsedTime / wordDuration);

            updateUI(shouldActiveTranscriptLineIndex, shouldActiveWordIndex);

            currentTranscriptLineIndex = shouldActiveTranscriptLineIndex;
        }
        else {
            updateUI(-1, -1);
        }
    }, 100);

    dictationAudio.addEventListener('play', function () {
        //in case the user manually click the play button
        currentTranscriptLineIndex = -1; //just reset so the optimeupdate function can take care of highlighting the right caption
        isDictationForcePause = false;
    });

    dictationAudio.addEventListener('seeked', function() {
        //in case the user manually jump to a new location
        currentTranscriptLineIndex = -1;
        isDictationForcePause =false;
    });

    function seekAudioTo(index) {
        if (index >= 0) {
            dictationAudio.currentTime = transcriptLines[index].start + floatCompareOffset; //plus floatCompareOffset to avoid annoying float number add or minus behavior (for example, 1.23 + 2.46 might equal 3.690000001)
            dictationAudio.play();
            currentTranscriptLineIndex = -1;
            isDictationForcePause = false;
        }
    }

    function stopAudio() {
        dictationAudio.pause();
    }

    function getCurrentAudioTime() {
        return currentAudioTime;
    }

    $('#dictation-mode').on('change', function (event) {
        dictationMode = $(this).val();

        if(dictationMode === "word") {
            $(".dictation-unit").show();
        } 
        else {
            $(".dictation-unit").hide();
        }

        renderDictationUnit(getOnScreenTranscriptLineIndex(), true);
    });

    $('.show-transcript-toggle').on('click', function (e) {
        e.preventDefault();
        const checkbox = $(this).find('input');
        checkbox.prop('checked', !checkbox.prop('checked'));
        if(checkbox.prop('checked')) {
            $('.transcript-container').show();
        }
        else {
            $('.transcript-container').hide();
        }
    });

    $('.transcript-line').on('click', function () {
        const transcriptLineIndex = $(this).data('index');
        seekAudioTo(transcriptLineIndex);
        updateUI(transcriptLineIndex, 0);
    });

    $('.previous-unit-button').on('click', function () {
        var previousTranscriptLineIndex = findPreviousTranscriptLineIndex(getCurrentAudioTime());
        if(isDictationForcePause) { //when force pause, the current time is already on the next transcript, we might have to wind back 2
            previousTranscriptLineIndex--;
        }

        $("#transcript-line-" + previousTranscriptLineIndex).click();
    });

    $('.next-unit-button').on('click', function () {
        //We don't want to manupulate currentTranscriptLineIndex (such as +1) here since sometimes, users click randomly at a random time on the audio
        //and click the next-unit-button, the behavior should be to start the next transcript line from the time user have just selected
        var nextTranscriptLineIndex = findNextTranscriptLineIndex(getCurrentAudioTime());

        if(isDictationForcePause) { //when force pause, the current time is already on the next transcript
            var activeTranscriptLineIndex = findTranscriptLineIndex(getCurrentAudioTime());
            if(activeTranscriptLineIndex >= 0) {
                nextTranscriptLineIndex = activeTranscriptLineIndex;
            }
        }

        $("#transcript-line-" + nextTranscriptLineIndex).click();

        //we have reached the end of the transcript
        if(nextTranscriptLineIndex < 0) {
            if(!$('.show-transcript-toggle').find('input').prop('checked')) {
                $('.show-transcript-toggle').click();
            }

            $('.dictation-result').html('See the transcript section for detailed results');
            $('.dictation-result-container').css('background-color', 'darkviolet');
            $('.dictation-result-container').fadeIn('fast');
            setTimeout(() => {
                $('.dictation-result-container').fadeOut('fast');
            }, 3000); 
        }
    });

    $('.relisten-dictation-button').on('click', function (event) {
        var activeTranscriptLineIndex = findTranscriptLineIndex(getCurrentAudioTime());

        if(activeTranscriptLineIndex < 0 || isDictationForcePause) {
            activeTranscriptLineIndex = findPreviousTranscriptLineIndex(getCurrentAudioTime());
        }

        $("#transcript-line-" + activeTranscriptLineIndex).click();
    });

    $('.show-answer-button').on('click', function (event) {
        var activeTranscriptLineIndex = getOnScreenTranscriptLineIndex();
        if(activeTranscriptLineIndex >= 0) {
            if(dictationMode === "word") {
                var missingWordIndex = missingWordTranscriptLines[activeTranscriptLineIndex].missingWordIndex;
                setAndResizeDictationInput(transcriptLines[activeTranscriptLineIndex].words[missingWordIndex]);
            }
            else {
                setAndResizeDictationInput(joinWordsToSentence(transcriptLines[activeTranscriptLineIndex].words));
            }
        }
    });

    $('.check-dictation-button').on('click', function (event) {
        checkCurrentDictation(true);
    });

    function checkCurrentDictation(forceShowResult = false) {
        var activeTranscriptLineIndex = getOnScreenTranscriptLineIndex();

        if(activeTranscriptLineIndex < 0 && practiceMode !== "full_recall") return;

        if(practiceMode === "full_recall") {
            let similarity = Math.round(checkSimilarity(cleanText(wholeScript), cleanText($('.dictation-user-input').val())) * 100);
            $('.shadowing-result').text('Accuracy Score: ' + similarity + "%");
            $('.shadowing-result').css('background-color', getMarkColor(similarity));
            $('.shadowing-result').show();
            $('.dictation-unit').html(wholeScript);
            showDictationDiffHtml(getWordLetterDiffHtml(wholeScript, $('.dictation-user-input').val()));
        }
        else if(practiceMode === "shadowing") {
            let similarity = Math.round(checkSimilarity(cleanText(joinWordsToSentence(transcriptLines[activeTranscriptLineIndex].words)), cleanText($('.dictation-user-input').val())) * 100);
            $('.shadowing-result').text('Accuracy Score: ' + similarity + "%");
            $('.shadowing-result').css('background-color', getMarkColor(similarity));
            $('.shadowing-result').show();
            var shadowingDiffHtml = getWordLetterDiffHtml(joinWordsToSentence(transcriptLines[activeTranscriptLineIndex].words), $('.dictation-user-input').val());
            showDictationDiffHtml(shadowingDiffHtml);
            shadowingStates[activeTranscriptLineIndex] = {
                answer: $('.dictation-user-input').val(),
                audioURL: $('.shadowing-user-audio').attr('src'),
                score: similarity,
                diff: shadowingDiffHtml
            };

            $('.transcript-line.highlighted').addClass('shadowing-checked');
            $('.transcript-line.highlighted').css('background-color', getMarkColor(similarity));
        }
        else if(practiceMode === "dictation") {
            var missingWordTranscriptLine = missingWordTranscriptLines[activeTranscriptLineIndex];

            if(($(".dictation-user-input").val().trim().length > 0 && !dictationStates[activeTranscriptLineIndex].status) || forceShowResult) {
                var currentTranscriptLineText = joinWordsToSentence(transcriptLines[activeTranscriptLineIndex].words).trim().toLowerCase();

                var userDictationInput = "";
                if(dictationMode === "word")
                {
                    var userDictationInputWords = missingWordTranscriptLine.words.map(function (word, index) {
                        if(index === missingWordTranscriptLine.missingWordIndex)
                        {
                            return $(".dictation-user-input").val().trim();
                        }
                        else
                        {
                            return word;
                        }
                    });
                    userDictationInput = joinWordsToSentence(userDictationInputWords).trim().toLowerCase();
                }
                else {
                    userDictationInput = $(".dictation-user-input").val().trim().toLowerCase();
                }
                

                // Remove all special characters, 16 punctuation marks, and double spaces
                var regexPattern = /[^\w\s]|_|\u2013|\u2014|\u2026/g;
                var spacePattern = /\s+/g;
                userDictationInput = userDictationInput.replace(regexPattern, '').replace(spacePattern, ' ');
                currentTranscriptLineText = currentTranscriptLineText.replace(regexPattern, '').replace(spacePattern, ' ');

                $('.dictation-result-container').fadeIn('fast');
                $('.transcript-line.highlighted').removeClass('incorrect correct');
                if(currentTranscriptLineText === userDictationInput) {
                    $('.dictation-result').html('<i class="fa-solid fa-check"></i> Your answer is correct!');
                    $('.dictation-result-container').css('background-color', 'green');
                    dictationStates[activeTranscriptLineIndex].answer = $('.dictation-user-input').val().trim();
                    dictationStates[activeTranscriptLineIndex].status = true;
                    dictationStates[activeTranscriptLineIndex].diff = "";
                    $('.dictation-user-input').prop('disabled', true);
                    $('.transcript-line.highlighted').addClass('correct');
                    clearDictationDiff();
                }
                else {
                    $('.dictation-result').html('<i class="fa-solid fa-xmark"></i> Your answer is incorrect!');
                    $('.dictation-result-container').css('background-color', 'maroon');
                    $('.transcript-line.highlighted').addClass('incorrect');
                    var dictationDiffHtml = getWordLetterDiffHtml(currentTranscriptLineText, userDictationInput);
                    showDictationDiffHtml(dictationDiffHtml);
                    // persist the incorrect attempt + diff so they survive navigation (like shadowing)
                    dictationStates[activeTranscriptLineIndex].answer = $('.dictation-user-input').val().trim();
                    dictationStates[activeTranscriptLineIndex].diff = dictationDiffHtml;
                }

                setTimeout(() => {
                    $('.dictation-result-container').fadeOut('fast');
                }, 2000);
            }
            else {
                if(missingWordTranscriptLines[activeTranscriptLineIndex].missingWordIndex < 0 && dictationMode === "word") {
                    dictationStates[activeTranscriptLineIndex].status = true;
                    $('.transcript-line.highlighted').removeClass('incorrect correct');
                    $('.transcript-line.highlighted').addClass('correct');
                }
            }
            
            $('.correct-answer-counter').text(dictationStates.filter(element => element.status).length);
        }
    }

    function updateUI(transcriptLineIndex, wordIndex) {

        var currentHighlightedTranscriptLineIndex = getOnScreenTranscriptLineIndex();

        if(currentHighlightedTranscriptLineIndex != transcriptLineIndex) {
            highlightTranscriptLine(transcriptLineIndex);
            renderDictationUnit(transcriptLineIndex, transcriptLineIndex - currentHighlightedTranscriptLineIndex > 0 ? true : false);
            $('.dictation-result-container').hide();
            
            //hide the initial guidance tooltip
            $('.next-unit-button').find('.tooltiptext.guidance').hide();
        }

        var currentHighlightedWordIndex = $('.word.highlighted').closest('.words').find('.word').index($('.word.highlighted'));
        if(currentHighlightedWordIndex != wordIndex) {
            highlightWords(transcriptLineIndex, wordIndex);
        }
    }

    function highlightTranscriptLine(index) {
        if (index >= 0) {
            // Highlight the active transcript-line
            $('.transcript-line').removeClass('highlighted');
            $('#transcript-line-' + index).addClass('highlighted');

            // Scroll to the current transcript line
            var highlightedTranscriptLine = $('#transcript-line-' + index)[0];
            var transcriptContainer = $('.transcript-container')[0];
            var newScrollTop = highlightedTranscriptLine.offsetTop - transcriptContainer.offsetTop;
            transcriptContainer.scrollTo({ top: newScrollTop - 100, behavior: 'smooth' });
        }
        else {
            $('.transcript-line').removeClass('highlighted');
        }
    }

    function highlightWords(transcriptLineIndex, wordIndex) {
        if (transcriptLineIndex >= 0 && wordIndex >= 0) {
            $('.transcript-container .word').removeClass('highlighted');
            $('#transcript-line-' + transcriptLineIndex + '-word-' + wordIndex).addClass('highlighted');
        }
        else {
            $('.transcript-container .word').removeClass('highlighted');
        }
    }

    function renderDictationUnit(index, fromRight) {

        clearDictationDiff();

        if(practiceMode === "shadowing") {
            if (index >= 0) {
                var dictationUnitContainer = $('.dictation-unit-container');
                dictationUnitContainer.removeClass('slide-right slide-left');
                dictationUnitContainer.addClass(fromRight ? 'slide-right' : 'slide-left');
                $('.dictation-unit').html(joinWordsToSentence(transcriptLines[index].words));
                $('.translated-dictation-text-container').html('');
                if(transcriptLines[index].translated) {
                    for (let toLanguage in transcriptLines[index].translated) {
                        if (transcriptLines[index].translated.hasOwnProperty(toLanguage)) {
                            var translatedText = transcriptLines[index].translated[toLanguage];
                            $('.translated-dictation-text-container').append(translatedText);
                        }
                    }
                }
                $('.dictation-unit-counter').html((index + 1) + ' / ' + transcriptLines.length);
                setTimeout(function () {
                    dictationUnitContainer.removeClass('slide-right slide-left');
                }, 200);

                $(".dictation-user-input").prop('disabled', false);
                setAndResizeDictationInput(shadowingStates[index].answer);
                if(shadowingStates[index].audioURL) {
                    $('.shadowing-user-audio').attr('src', shadowingStates[index].audioURL);
                    $('.shadowing-user-audio').show();
                }
                else {
                    $('.shadowing-user-audio').hide();
                }
                if(shadowingStates[index].score >= 0) {
                    $('.shadowing-result').text("Accuracy Score: " + shadowingStates[index].score + "%");
                    $('.shadowing-result').css('background-color', getMarkColor(shadowingStates[index].score));
                    $('.shadowing-result').show();
                    if(shadowingStates[index].diff) {
                        showDictationDiffHtml(shadowingStates[index].diff);
                    }
                }
                else {
                    $('.shadowing-result').hide();
                }

                $('.record-button').prop('disabled', false);
            }
            else {
                setAndResizeDictationInput(" ");
                $('.shadowing-user-audio').hide();
                $('.shadowing-result').hide();
                $(".dictation-user-input").prop('disabled', true);
                $('.record-button').prop('disabled', true);
            }
        }
        else if(practiceMode === "dictation") {
            if (index >= 0) {
                var dictationUnitContainer = $('.dictation-unit-container');
                dictationUnitContainer.removeClass('slide-right slide-left');
                dictationUnitContainer.addClass(fromRight ? 'slide-right' : 'slide-left');
                $('.dictation-unit').html(joinWordsToSentence(missingWordTranscriptLines[index].words));
                $('.translated-dictation-text-container').html('');
                if(transcriptLines[index].translated) {
                    for (let toLanguage in transcriptLines[index].translated) {
                        if (transcriptLines[index].translated.hasOwnProperty(toLanguage)) {
                            var translatedText = transcriptLines[index].translated[toLanguage];
                            $('.translated-dictation-text-container').append(translatedText);
                        }
                    }
                }
                $('.dictation-unit-counter').html((index + 1) + ' / ' + transcriptLines.length);
                setTimeout(function () {
                    dictationUnitContainer.removeClass('slide-right slide-left');
                }, 200);

                $(".dictation-user-input").prop('disabled', false);
                setAndResizeDictationInput("");
                $('.dictation-user-input').focus();
                if(missingWordTranscriptLines[index].missingWordIndex < 0 && dictationMode === "word") {
                    $(".dictation-user-input").prop('disabled', true);
                    setAndResizeDictationInput(" ");
                }
                else {
                    if(dictationStates[index].status) {
                        $(".dictation-user-input").prop('disabled', true);
                        setAndResizeDictationInput(dictationStates[index].answer);
                    }
                    else if(dictationStates[index].answer !== "") {
                        // restore a previous incorrect attempt + its diff; input stays editable for another try
                        setAndResizeDictationInput(dictationStates[index].answer);
                        if(dictationStates[index].diff) {
                            showDictationDiffHtml(dictationStates[index].diff);
                        }
                    }
                }
            }
            else {
                setAndResizeDictationInput(" ");
                $(".dictation-user-input").prop('disabled', true);
            }
        }
    }

    function getOnScreenTranscriptLineIndex() {
        return $('.transcript-line').index($('.transcript-line.highlighted'));
    }

    function findTranscriptLineIndex(currentTime) {
        var activeDictationIndex = -1;

        for (var i = 0; i < transcriptLines.length; i++) {
            if (currentTime >= transcriptLines[i].start && currentTime < transcriptLines[i].start + transcriptLines[i].duration) {
                activeDictationIndex = i;
                break;
            }
        }

        return activeDictationIndex;
    }

    function findNextTranscriptLineIndex(timeToCheck) {
        for (let i = 0; i < transcriptLines.length; i++) {
            const start = transcriptLines[i].start;

            if (start > timeToCheck) {
                return i;
            }
        }

        return -1;
    }

    function findPreviousTranscriptLineIndex(timeToCheck) {
        let previousTranscriptLineIndex = -1;
        
        for (let i = 0; i < transcriptLines.length; i++) {
            const start = transcriptLines[i].start;
            const end = start + transcriptLines[i].duration;
        
            if (start <= timeToCheck && timeToCheck < end) {
                return i-1;
            } else if (start < timeToCheck) {
                previousTranscriptLineIndex = i;
            } else {
                break;
            }
        }
        
        return previousTranscriptLineIndex;
    }

    //---- TRANSLATION ----//
    $('body').append('<div class="text-translation-popup"><select class="language-selector"></select><br><button>Translate</button></div>');
    function loadSupportedTranslationLanguages() {
        $.getJSON('https://api.cognitive.microsofttranslator.com/languages?api-version=3.0&scope=translation', function(data) {
            var languages = data.translation;

            for (var code in languages) {
                // Skip English
                if (code === 'en') continue;

                var option = $('<option></option>').val(code).text(languages[code].name);
                // Append the new option to all select elements
                $('.language-selector').append(option);
            }

            // Try to guess the user's preferred language based on their browser setting
            var userLanguage = (navigator.language || navigator.userLanguage).substring(0, 2);

            // If a matching option exists, select it. Otherwise, default to Vietnamese.
            if ($('.language-selector option[value="' + userLanguage + '"]').length > 0) {
                $('.language-selector').val(userLanguage);
            } else {
                $('.language-selector').val('vi');
            }
        }).fail(function() {
            console.error('Error: Unable to fetch languages');
        });
    }
    //get on load
    loadSupportedTranslationLanguages();

    $('.dictation-translation-button').on('click', function () {

        var button = $(this);

        var popup = $('.text-translation-popup');
        if (popup.is(':visible')) {
            popup.fadeOut('fast');
        } else {
            popup.fadeIn('fast');
        }
        var buttonOffset = button.offset();
        popup.css({
            'top': buttonOffset.top + 30,
            'left': buttonOffset.left - popup.outerWidth() + button.outerWidth()
        });
    });

    $(document).on('mousedown', function (e) {
        if (!$(e.target).closest('.text-translation-popup, .dictation-translation-button').length) {
            $('.text-translation-popup').hide();
        }
    });

    $('.text-translation-popup button').on('click', function () {
        var translationPopup = $('.text-translation-popup');
        var translatedTextContainer = $('.translated-dictation-text-container');
        var dictationUnitIndex = getOnScreenTranscriptLineIndex();
        var dictationElement = $('.dictation-unit');
        var textToTranslate = dictationElement.text();
        var toLanguage = translationPopup.find('select').val();
        var toLanguageText = translationPopup.find('select option:selected').text();

        translationPopup.hide();

        if(!textToTranslate.trim()) {
            return;
        }

        //if already translated, do nothing.
        if(transcriptLines[dictationUnitIndex].translated && transcriptLines[dictationUnitIndex].translated[toLanguage]) {
            return;
        }

        var limitMessage = checkOrSaveRateLimit('translate_dictation_text');
        if (limitMessage) {
            alert(limitMessage);
            $('.payment-popup-container').css('display', 'flex');
            return;
        }

        $.ajax({
            type: 'POST',
            url: single_dictation_test_ajax.ajaxurl,
            data: {
                action: 'translate_dictation_text',
                dictation_test_nonce: $('#dictation_test_nonce').val(),
                text_to_translate: textToTranslate,
                to_language: toLanguage,
            },
            beforeSend: function () {
                dictationElement.after('<div class="spinner"></div>');
            },
            success: function (response) {
                if(!response.success) {
                    if(response.data['error'] == 'rate_limit_exceeded') {
                        alert(checkOrSaveRateLimit('translate_dictation_text', response.data['retry_after']));
                        $('.payment-popup-container').css('display', 'flex');
                    }
                    else {
                        if(response.data['error'] == 'user_not_verified') {
                            $('.fast-verification-popup-container').css('display', 'flex');
                        }
                        else {
                            alert(response.data['message'] || "Server Error. Please try again.");
                        }
                    }
                }
                else {
                    if(response.data.result["error"])
                    {
                        alert("Server Error. Please try again.");
                        console.log(response);
                    }
                    else
                    {
                        if(response.data.result['translation']) {
                            var translatedText = `<div class="${toLanguage}-dictation-text translated-dictation-text">${toLanguageText}: ` + response.data.result['translation'] + '</div>';
                            $("#transcript-line-" + dictationUnitIndex).find('.translated-transcript-container').append(translatedText);

                            if(!transcriptLines[dictationUnitIndex].translated) {
                                transcriptLines[dictationUnitIndex].translated = {};
                            }

                            transcriptLines[dictationUnitIndex].translated[toLanguage] = translatedText;

                            //make sure users haven't change the current onscreen dictation
                            if(dictationUnitIndex == getOnScreenTranscriptLineIndex()) {
                                translatedTextContainer.append(translatedText);
                            }
                        }
                        else {
                            alert("Cannot translate the text!");
                        }
                    }
                }
            },
            error: function (error) {      
                console.log(error);
                alert("Server Error. Please try again.");
            },
            complete: function () {
                dictationElement.siblings('.spinner').remove();
            },
        });
    });

    //---- AUDIO INPUT----//
    const MAX_RECORDING_TIME_IN_SECONDS = 600;
    let chunks = [];
    let stream = null;
    let mediaRecorder = null;
    let isRecording = false;

    let recognition = null;
    let isRecognitionStopping = false;
    let recognitionBackoffMs = 0; // grows after transient recognition errors so we don't hammer the backend

    let silenceTimer = null;

    let recordingStartTime;
    let timeIntervalId;

    let fullTranscript = "";

    let isAutoStopRecording = false;

    function doRecording(onStart = null, onTimerFill = null, onInterimTranscriptUpdate = null, onFullTranscriptUpdate = null, onStop = null, onFinalized = null) {
        if (isRecognitionStopping) return;

        if (isRecording) {
            stopRecording();
        } else {
            navigator.mediaDevices.getUserMedia({ audio: true })
                .then(function (strm) {
                    stream = strm;
                    mediaRecorder = new MediaRecorder(stream);

                    mediaRecorder.addEventListener('dataavailable', function (e) {
                        chunks.push(e.data);
                    });

                    mediaRecorder.addEventListener('stop', function () {
                        const blob = new Blob(chunks, { type: 'audio/mp4' });

                        clearTimeout(silenceTimer);
                        
                        clearInterval(timeIntervalId);

                        isRecognitionStopping = true;

                        if (recognition) {
                            // Finalize exactly once, whether or not onend fires. recognition.stop() is a no-op that
                            // does NOT re-fire onend when recognition is already inactive (e.g. it was stopped mid-backoff
                            // while waiting to restart), so we must not depend on onend alone — otherwise isRecognitionStopping
                            // would stay true forever, the textarea would stay on 'Finalizing...', and isUserRecording()
                            // would permanently block the record button + keyboard shortcuts.
                            var recognitionFinalized = false;
                            var finalizeRecognition = function() {
                                if (recognitionFinalized) return;
                                recognitionFinalized = true;

                                if (recognition) {
                                    recognition.onend = null;
                                    recognition.onresult = null;
                                    recognition.onerror = null;
                                    recognition = null;
                                }

                                isRecognitionStopping = false;

                                if(onFinalized) onFinalized(blob, fullTranscript);
                            };

                            recognition.onend = finalizeRecognition;

                            setTimeout(() => {
                                try {
                                    if (recognition) recognition.stop(); // fires onend if active; no-op if already inactive
                                } catch (e) { /* stop() on an inactive recognizer can throw — ignore */ }
                                // Guaranteed finalize even if stop() could not fire onend.
                                setTimeout(finalizeRecognition, 700);
                            }, 500);
                        } else {
                            isRecognitionStopping = false;

                            if(onFinalized) onFinalized(blob, fullTranscript);
                        }

                        if (stream) {
                            stream.getTracks().forEach(track => track.stop());
                        }

                        chunks = [];

                        isRecording = false;

                        if(onStop) onStop(blob, fullTranscript);
                    });

                    mediaRecorder.start();
                    fullTranscript = "";
                    isRecording = true;
                    if(onStart) onStart();

                    // Start the timer
                    recordingStartTime = new Date();
                    updateRecordingTime();
                    timeIntervalId = setInterval(() => {
                        let timeElapsed = updateRecordingTime();
                        let percentage = timeElapsed * 100.0 / MAX_RECORDING_TIME_IN_SECONDS;
                        if(onTimerFill) onTimerFill(timeElapsed, percentage);
                        if(timeElapsed > MAX_RECORDING_TIME_IN_SECONDS) {
                            stopRecording();
                        } 
                    }, 1000);

                    //Transcribe user speech to text. Also, detect if user is speaking or not
                    recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition || window.mozSpeechRecognition || window.msSpeechRecognition)();
                    recognition.lang = 'en-US';
                    recognition.interimResults = true;
                    recognition.maxAlternatives = 1;
                    recognition.continuous = true;
                    recognitionBackoffMs = 0;

                    // Restart recognition safely (handles the ~60s session cap and transient drops)
                    // without ever stopping the local capture.
                    var restartRecognition = function () {
                        if (isRecognitionStopping || !recognition) return;
                        setTimeout(function () {
                            if (isRecognitionStopping || !recognition) return;
                            try {
                                recognition.start();
                            } catch (e) {
                                // InvalidStateError ("already started") is expected on a racey restart — ignore.
                                console.warn('Speech recognition restart skipped: ' + e.name);
                            }
                        }, recognitionBackoffMs || 300);
                    };

                    recognition.onresult = function (event) {
                        recognitionBackoffMs = 0; // a result means the service recovered — reset backoff

                        // Get the current transcribed text
                        const currentText = event.results[event.results.length - 1][0].transcript;

                        if(onInterimTranscriptUpdate) onInterimTranscriptUpdate(currentText);

                        // Check if the current result is final
                        if (event.results[event.results.length - 1].isFinal) {
                            // Add the current text to the full transcript
                            fullTranscript += currentText.trim() + ' ';

                            if (!isRecognitionStopping) {
                                if(onFullTranscriptUpdate) onFullTranscriptUpdate(fullTranscript);
                            }
                        }

                        clearTimeout(silenceTimer);
                        silenceTimer = setTimeout(() => {
                            if (isRecording && isAutoStopRecording) {
                                stopRecording();
                            }
                        }, 3000);
                    };


                    //Recognition naturally ends (no-speech, the ~60s cap, a transient drop) — just restart it,
                    //never touch the recorder, so a transcription hiccup can't kill the recording.
                    recognition.onend = function () {
                        restartRecognition();
                    };

                    recognition.onerror = function (event) {
                        if(isRecognitionStopping) return; //avoid reacting while we're finalizing

                        // Only a genuinely unavailable microphone justifies stopping the recording.
                        if (event.error === 'not-allowed' || event.error === 'audio-capture') {
                            alert('Microphone is unavailable (' + event.error + ').\nPlease allow microphone access and try again.');
                            stopRecording();
                            return;
                        }

                        // Speech recognition is permanently unavailable in this browser (NOT a transient blip).
                        // Dictation's answer IS the transcript, so without recognition there is nothing to score;
                        // retrying forever would record into a void, so surface a one-time notice and stop.
                        if (event.error === 'service-not-allowed' || event.error === 'language-not-supported') {
                            alert('Speech recognition is not available in this browser.\nPlease use Chrome, Safari, or CocCoc.');
                            stopRecording();
                            return;
                        }

                        // 'network': transient backend failure. Back off, then let onend restart recognition.
                        // The local capture keeps running, so a transient blip no longer aborts the recording
                        // (though a sustained outage still blocks dictation, since the transcript is the answer).
                        if (event.error === 'network') {
                            recognitionBackoffMs = Math.min(recognitionBackoffMs ? recognitionBackoffMs * 2 : 500, 8000);
                            console.warn('Speech recognition "network" (non-fatal) — recording continues; retrying in ' + recognitionBackoffMs + 'ms');
                        }
                        // 'no-speech', 'aborted', etc.: harmless — onend restarts at the default delay.
                    };

                    recognition.start();
                })
                .catch(function (err) {
                    console.log(err);
                    // Handle media access blocked error
                    if (err.name === 'NotAllowedError') {
                        alert('Microphone access is blocked. Please manually allow access to your microphone in your browser settings (Usually on the top right corner of the address bar).');
                    }
                    else {
                        alert('Please check your internet connection, or consider changing your browser to Chrome, Safari, or CocCoc.');
                    }

                    stopRecording();
                });
        }
    }

    function stopRecording() {
        if (mediaRecorder) {
            isRecognitionStopping = true; //close the restart-race window before the async 'stop' handler runs
            mediaRecorder.stop();
        }
    }

    function updateRecordingTime() {
        let currentTime = new Date();
        let timeElapsed = Math.floor((currentTime - recordingStartTime) / 1000);
        return timeElapsed;
    }

    function isUserRecording() {
        return isRecording || isRecognitionStopping;
    }

    $('.record-button').on('click', function () {
        let recordButton = $(this);
        let recordButtonFill = recordButton.find('.button-fill');
        let activeTranscriptLineIndex = getOnScreenTranscriptLineIndex();

        doRecording( 
        () => { //onStart
            stopAudio();
            $('.shadowing-user-audio').hide();
            $('.shadowing-result').hide();
            $('.shadowing-control-buttons').hide();
            $('.full-recall-container .dictation-unit-wrapper').hide();
            $('.dictation-audio').addClass('disabled');
            setAndResizeDictationInput('Recording...');
            recordButton.find('i').replaceWith('<i class="fa-solid fa-wave-square"></i>');
            recordButton.addClass('recording');
        },
        (elapsedTime, percentage) => { //onTimerFill
            recordButtonFill.css('width', `${percentage}%`);
        },
        (transcript) => { //onInterimTranscriptUpdate
            
        },
        (transcript) => { //onFullTranscriptUpdate
            setAndResizeDictationInput(transcript);
        },
        (audioData, transcript) => { //onStop
            setAndResizeDictationInput('Finalizing...');
            recordButton.find('i').replaceWith('<i class="fa-solid fa-paper-plane"></i>');
            recordButtonFill.css('width', '0%');
            recordButton.prop("disabled", true);
        },
        (audioData, transcript) => { //onFinalized
            $('.shadowing-control-buttons').show();
            $('.full-recall-container .dictation-unit-wrapper').show();
            $('.dictation-audio').removeClass('disabled');
            setAndResizeDictationInput(transcript);
            let audioURL = URL.createObjectURL(audioData);
            $('.shadowing-user-audio').attr('src', audioURL);
            $('.shadowing-user-audio').show();
            checkCurrentDictation();
            recordButton.removeClass('recording');
            recordButton.find('i').replaceWith('<i class="fa-solid fa-microphone"></i>');
            recordButton.prop("disabled", false);
        });
    });

    function getMarkColor(mark) {
        let color = 'black';
        if(mark >= 80) {
            color = 'green';
        }
        else {
            if(mark >= 60) {
                color = "#b35919";
            }
            else {
                color = "maroon";
            }
        }

        return color;
    }

    //--- CHECK TEXT SIMILARITY ---//
    function cleanText(text) {
        // Remove all special characters, 16 punctuation marks, and double spaces
        var regexPattern = /[^\w\s]|_|\u2013|\u2014|\u2026/g;
        var spacePattern = /\s+/g;
        return text.trim().toLowerCase().replace(regexPattern, '').replace(spacePattern, ' ');
    }

    //the "Longest Common Subsequence" (LCS) algorithm. This algorithm finds the longest subsequence common to both strings, ignoring characters that don't match.
    function lcs(s1, s2) {
        var matrix = [];
        for(var i = 0; i <= s1.length; i++){
            matrix[i] = [0];
            for(var j = 0; j <= s2.length; j++){
            matrix[i][j] = 0;
            }
        }
        
        for(var i = 1; i <= s1.length; i++){
            for(var j = 1; j <= s2.length; j++){
            if(s1[i-1] === s2[j-1]){
                matrix[i][j] = matrix[i-1][j-1] + 1;
            }
            else{
                matrix[i][j] = Math.max(matrix[i-1][j], matrix[i][j-1]);
            }
            }
        }
        
        return matrix[s1.length][s2.length];
    }
    
    function checkSimilarity(s1, s2) {
        var longerLength = Math.max(s1.length, s2.length);
        if (longerLength === 0) {
            return 1.0; // if both are empty strings
        }
        return lcs(s1, s2) / longerLength;
    }

    //--- VISUAL DIFF (word + letter hybrid) ---//
    function escapeDiffHtml(s) {
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    // Build an LCS table for two arrays/strings and return it.
    function buildLcsTable(a, b) {
        var dp = [];
        for (var i = 0; i <= a.length; i++) {
            dp[i] = new Array(b.length + 1).fill(0);
        }
        for (var i = 1; i <= a.length; i++) {
            for (var j = 1; j <= b.length; j++) {
                dp[i][j] = (a[i - 1] === b[j - 1]) ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
            }
        }
        return dp;
    }

    // Character-level diff of a single word pair: show the correct word with the user's
    // missing letters highlighted and any extra typed letters struck through.
    function getCharDiffHtml(correctWord, userWord) {
        var dp = buildLcsTable(correctWord, userWord);
        var i = correctWord.length, j = userWord.length, parts = [];
        while (i > 0 && j > 0) {
            if (correctWord[i - 1] === userWord[j - 1]) { parts.push(['eq', correctWord[i - 1]]); i--; j--; }
            else if (dp[i - 1][j] >= dp[i][j - 1]) { parts.push(['missing', correctWord[i - 1]]); i--; }
            else { parts.push(['extra', userWord[j - 1]]); j--; }
        }
        while (i > 0) { parts.push(['missing', correctWord[i - 1]]); i--; }
        while (j > 0) { parts.push(['extra', userWord[j - 1]]); j--; }
        parts.reverse();

        var html = '';
        parts.forEach(function (p) {
            var ch = escapeDiffHtml(p[1]);
            if (p[0] === 'eq') html += ch;
            // missing letter: show a placeholder marker, not the correct letter (don't reveal the answer)
            else if (p[0] === 'missing') html += '<span class="dict-diff-missing">_</span>';
            else html += '<span class="dict-diff-extra">' + ch + '</span>';
        });
        return html;
    }

    // Word-level alignment; matched words stay plain, substituted words get letter-level
    // highlighting, fully missing words are red, extra typed words are struck through.
    function getWordLetterDiffHtml(correctText, userText) {
        var correctWords = cleanText(correctText).split(' ').filter(Boolean);
        var userWords = cleanText(userText).split(' ').filter(Boolean);

        var dp = buildLcsTable(correctWords, userWords);
        var i = correctWords.length, j = userWords.length, ops = [];
        while (i > 0 && j > 0) {
            if (correctWords[i - 1] === userWords[j - 1]) { ops.push(['eq', correctWords[i - 1], null]); i--; j--; }
            else if (dp[i - 1][j] >= dp[i][j - 1]) { ops.push(['del', correctWords[i - 1], null]); i--; }
            else { ops.push(['ins', null, userWords[j - 1]]); j--; }
        }
        while (i > 0) { ops.push(['del', correctWords[i - 1], null]); i--; }
        while (j > 0) { ops.push(['ins', null, userWords[j - 1]]); j--; }
        ops.reverse();

        var tokens = [];
        var k = 0;
        while (k < ops.length) {
            if (ops[k][0] === 'eq') {
                tokens.push(escapeDiffHtml(ops[k][1]));
                k++;
            }
            else {
                // collect a run of changed words, then pair them up as substitutions
                var dels = [], inss = [];
                while (k < ops.length && ops[k][0] !== 'eq') {
                    if (ops[k][0] === 'del') dels.push(ops[k][1]);
                    else inss.push(ops[k][2]);
                    k++;
                }
                var pairCount = Math.min(dels.length, inss.length);
                for (var x = 0; x < pairCount; x++) {
                    tokens.push(getCharDiffHtml(dels[x], inss[x]));
                }
                for (var x = pairCount; x < dels.length; x++) {
                    // fully missing word: show a blank of the same length, not the word itself
                    tokens.push('<span class="dict-diff-missing">' + '_'.repeat(dels[x].length) + '</span>');
                }
                for (var x = pairCount; x < inss.length; x++) {
                    tokens.push('<span class="dict-diff-extra">' + escapeDiffHtml(inss[x]) + '</span>');
                }
            }
        }
        return tokens.join(' ');
    }

    function showDictationDiffHtml(diffHtml) {
        $('.dictation-diff').html(
            '<div class="dictation-diff-label">Your answer (mistakes in red, _ marks a missing letter):</div>' +
            '<div class="dictation-diff-text">' + diffHtml + '</div>'
        ).show();
    }

    function clearDictationDiff() {
        $('.dictation-diff').empty().hide();
    }

    //--- USER CONTROL ----//
    $(document).on('keydown', function(event) {

        if(isUserRecording()) return;

        if (event.key === 'Enter') {
            event.preventDefault();
            var activeTranscriptLineIndex = getOnScreenTranscriptLineIndex();
            if(activeTranscriptLineIndex >= 0) {
                if(dictationStates[activeTranscriptLineIndex].status || (missingWordTranscriptLines[activeTranscriptLineIndex].missingWordIndex < 0 && dictationMode === "word")) {
                    checkCurrentDictation(); //call this so that transcript line without missing words get green highlighted
                    $('.next-unit-button').click();
                }
                else {
                    $('.check-dictation-button').click();
                }
            }
            else {
                $('.next-unit-button').click();
            }
        }
        else {
            if (event.shiftKey && event.key === 'ArrowRight') {
                event.preventDefault();
                $('.next-unit-button').click();
            }
            else {
                if (event.shiftKey && event.key === 'ArrowLeft') {
                    event.preventDefault();
                    $('.previous-unit-button').click();
                }
                else {
                    if (event.shiftKey && (event.key === 'r' || event.key === 'R')) {
                        event.preventDefault();
                        $('.relisten-dictation-button').click();
                    }
                    else {
                        if (event.shiftKey && (event.key === 'c' || event.key === 'C')) {
                            event.preventDefault();
                            $('.check-dictation-button').click();
                        }
                        else {
                            if (event.shiftKey && (event.key === 'h' || event.key === 'H')) {
                                event.preventDefault();
                                $('.show-answer-button').click();
                            }
                        }
                    }
                }
            }
        }
    });

    //--- AUTO RESIZING ---//
    $('.dictation-user-input').on('input', function () {
        autoResize(this);
    });

    function autoResize(textarea) {
        $(textarea).css("height", "auto");
        $(textarea).css("height", textarea.scrollHeight + "px");
    }

    function setAndResizeDictationInput(message) {
        $('.dictation-user-input').val(message);
        autoResize($('.dictation-user-input')[0]);
    }

    $('.post-locker').on('click', function(e) {
        e.preventDefault();
        $('.payment-popup-container').css('display', 'flex');
    });
});