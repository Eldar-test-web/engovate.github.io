jQuery(document).ready(function ($) {
    
    const floatCompareOffset = 0.01;

    let player = null;
    let captions = [];
    let missingWordCaptions = [];
    let captionDictationStates = [];
    let isDictationForcePause = false;
    let isLoopingCaption = false;
    let isInDictationMode = false;
    // let isAutoNextDictation = false;
    let isYoutubeChangingState = false;

    const simpleEnglishWords = [
        'I', 'me', 'you', 'he', 'him', 'she', 'her', 'it', 'we', 'us', 'they', 'them',
        'my', 'your', 'his', 'her', 'its', 'our', 'their', 'mine', 'yours', 'his', 'hers', 'ours', 'theirs',
        'a', 'an', 'the',
        'in', 'on', 'at', 'to', 'from', 'by', 'with', 'about', 'for', 'of', 'as', 'over', 'under', 'above', 'below', 'before', 'after', 'between', 'among', 'within', 'against', 'through', 'across', 'along', 'beside', 'beyond', 'near', 'far', 'since', 'during', 'until', 'toward', 'onto', 'upon', 'off', 'around', 'behind', 'besides', 'into', 'out', 'like', 'unlike', 'towards', 'onto',
        'and', 'or', 'but', 'if', 'then', 'else', 'so', 'yet', 'either', 'neither', 'nor', 'while', 'although', 'though', 'because', 'since', 'once', 'whenever', 'whereas', 'as', 'even', 'in', 'whether',
        'is', 'am', 'are', 'was', 'were', 'be', 'been', 'being', 'will', 'would', 'shall', 'should', 'must', 'can', 'could', 'may', 'might', 'ought', 'used', 'to', 'ought', 'to',
        'have', 'has', 'had', 'do', 'does', 'did', 'done', 'who', 'whom', 'whose', 'which', 'that', 'this', 'these', 'those', 'there', 'here', 'where', 'when', 'how', 'why', 'what', 'whichever', 'whoever', 'whomever', 'whenever', 'wherever',
    ];

    //get captions
    $('.caption-line').each(function(index) {
        let start = parseFloat($(this).data('start'));
        let duration = parseFloat($(this).data('duration'));
        let wordElements = $(this).find('.word');
        let words = wordElements.map(function() {
            return $(this).text();
        }).get();
        captions.push({words: words, start: start, duration: duration});
    
        //randomly removing a word (except simple English word like I, they, he, she, etc. or word containing special characters) and replace it with dashes
        let wordsWithMissingInput = [...words];
        replaceIndex = -1;

        //filter out short caption
        if(wordsWithMissingInput.length >= 3)
        {
            const wordRegex = /[^a-z]/; //avoid personal names, special charaters, etc.
            let eligibleWords = wordsWithMissingInput.filter(word => word.length >= 3 && !wordRegex.test(word) && !simpleEnglishWords.includes(word.toLowerCase()));

            if(eligibleWords.length == 0) {
                //try again and allow words with 2 characters and uppcase letter (since some captions like the video Marroon 5 - Girl Like You have all captions uppercased)
                const wordRegexLessStrict = /[^a-zA-z]/;
                eligibleWords = wordsWithMissingInput.filter(word => word.length >= 2 && !wordRegexLessStrict.test(word) && !simpleEnglishWords.includes(word.toLowerCase()));
            }

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
        missingWordCaptions.push({words: wordsWithMissingInput, missingWordIndex: replaceIndex});
        captionDictationStates.push({answer: "", status:false});
    });

    //set dictation info
    $(".correct-dictation-number span").html("0/" + captions.length);


    //make elements having the same height
    equalizeElementHeight();

    // Create a new script element
    var ytScript = document.createElement('script');
    // Set the 'src' attribute to the YouTube IFrame Player API URL
    ytScript.src = 'https://www.youtube.com/iframe_api';
    // Append the script element to the document head
    $('head').append(ytScript);

    function initializePlayer() {
        var videoId = document.getElementById('youtube-iframe').getAttribute('data-video-id');
        var videoSrc = 'https://www.youtube.com/embed/' + videoId + '?enablejsapi=1&cc_load_policy=3';
        document.getElementById('youtube-iframe').src = videoSrc;
        
        // Create a YouTube player
        player = new YT.Player('youtube-iframe', {
            events: {
                'onReady': function (event) {
                    onPlayerReady(event);
                },
                'onStateChange': function (event) {
                    onPlayerStateChange(event);
                },
            }
        });
    }

    function onPlayerStateChange(event) {
        if (event.data !== YT.PlayerState.PAUSED) {

            if(event.data === YT.PlayerState.PLAYING) {
                $('.caption-blocker').hide();
            }

            isDictationForcePause = false;

            //this is for the case when users are looping captions and click on another time frame on the video, we reset the current index to that time frame
            currentActiveCaptionIndex = getActiveCaptionIndex(player.getCurrentTime());
            highlightCaption(currentActiveCaptionIndex);
        }

        isYoutubeChangingState = false;
    }

    window.onYouTubeIframeAPIReady = function () {
        initializePlayer();
    };

    function onPlayerReady(event) {
        setInterval(() => {
            if(!isYoutubeChangingState && player.getPlayerState() !== YT.PlayerState.PAUSED)
            {
                updateCaption(player.getCurrentTime());

                if(isInDictationMode) {
                    updateDictationInput();
                }
            }

        }, 100);
    }

    // Declare a variable to store the last active caption index
    var currentActiveCaptionIndex = null; //should have used -1 to avoid the problem when checking if statement like if(currentActiveCaptionIndex) when currentActiveCaptionIndex === 0 (which will both return false) (but I'm lazy to refactor the code)
    var currentActiveWordIndex = null;

    function getActiveCaptionIndex(currentTime)
    {
        var activeCaptionIndex = null;

        // Find the active caption index
        for (var i = 0; i < captions.length; i++) {
            if (currentTime >= captions[i].start && currentTime <= captions[i].start + captions[i].duration) {
                activeCaptionIndex = i;
                break;
            }
        }

        return activeCaptionIndex;
    }

    function getNextCaptionIndex(timeToCheck) {
        for (let i = 0; i < captions.length; i++) {
          const start = captions[i].start;
      
          if (start > timeToCheck) {
            // This caption's start time is greater than timeToCheck
            return i;
          }
        }
      
        // No next caption found
        return null;
      }

    function getPreviousCaptionIndex(timeToCheck) {
        let previousCaptionIndex = null;
        
        for (let i = 0; i < captions.length; i++) {
            const start = captions[i].start;
            const end = start + captions[i].duration;
        
            if (start < timeToCheck && timeToCheck < end) {
                // TimeToCheck is within this caption's start and end time
                return (i-1) >= 0 ? (i-1) : null;
            } else if (start < timeToCheck) {
                // TimeToCheck is greater than this caption's start time
                previousCaptionIndex = i;
            } else {
                // TimeToCheck is less than this caption's start time
                break;
            }
        }
        
        return previousCaptionIndex;
    }

    function updateCaption(currentTime) {

        var activeCaptionIndex = getActiveCaptionIndex(currentTime);

        if(currentActiveCaptionIndex !== null || activeCaptionIndex !== null) {
            if(isInDictationMode) {                
                var lastActiveCaption = captions[currentActiveCaptionIndex !== null ? currentActiveCaptionIndex : activeCaptionIndex];
                var lastCaptionEndTime = lastActiveCaption.start + lastActiveCaption.duration;
                if (currentTime >= lastCaptionEndTime) {

                    if(!isDictationForcePause) {
                        player.pauseVideo();
                        isDictationForcePause = true;
                        isYoutubeChangingState = true;
                    }
                    return;
                }
            }
            else
            {
                if (isLoopingCaption) {
                    var lastActiveCaption = captions[currentActiveCaptionIndex !== null ? currentActiveCaptionIndex : activeCaptionIndex];
                    var lastCaptionEndTime = lastActiveCaption.start + lastActiveCaption.duration;

                    if (currentTime >= lastCaptionEndTime) {
                        player.seekTo(lastActiveCaption.start + floatCompareOffset, true); //plus floatCompareOffset to avoid annoying float number comparision
                        isYoutubeChangingState = true;
                        return;
                    }
                }
            }
        }

        // Highlight the active word and reset others
        if (activeCaptionIndex !== null) {

            var activeCaption = captions[activeCaptionIndex];
            var words = activeCaption.words;
            var wordDuration = activeCaption.duration / words.length;
            var elapsedTime = currentTime - activeCaption.start;
            var activeWordIndex = Math.floor(elapsedTime / wordDuration);
            
            if (activeCaptionIndex !== currentActiveCaptionIndex) {
                highlightCaption(activeCaptionIndex);
            }
            
            if(activeWordIndex !== currentActiveWordIndex)
            {
                highlightWords(activeCaptionIndex, activeWordIndex);
            }

            // Update the last active caption index
            currentActiveCaptionIndex = activeCaptionIndex;
            currentActiveWordIndex = activeWordIndex;

        } else {
            highlightCaption(null);
        }
    }

    function highlightCaption(captionIndex)
    {
        if(captionIndex !== null) {
            var words = captions[captionIndex].words;

            // Highlight the active caption-line
            $('.caption-line').removeClass('highlighted');
            $('#caption-' + captionIndex).addClass('highlighted');

            // Scroll to the current caption
            var highlightedCaption = document.getElementById('caption-' + captionIndex);
            var captionTextContainer = document.getElementById('caption-text');
            var captionTop = highlightedCaption.offsetTop;
            var containerTop = captionTextContainer.offsetTop;
            var newScrollTop = captionTop - containerTop;
            captionTextContainer.scrollTo({ top: newScrollTop - 100, behavior: 'smooth' });

            // Update the caption-line-overlay
            var overlayCaptionHTML = words.map(function (word, wordIndex) {
                return '<span class="word" id="overlay-caption-' + captionIndex + '-word-' + wordIndex + '">' + word + '</span>';
            }).join(' ');
            $('.caption-line-overlay').html('<div class="english-caption-line-overlay">' + overlayCaptionHTML + "</div>");
            showHideCaptionLineOverlay();
        }
        else {
            $('#caption-text .word').removeClass('highlighted');
            $('.caption-line-overlay .word').removeClass('highlighted');
        }
    }

    function highlightWords(captionIndex, wordIndex)
    {
        if(captionIndex === null || wordIndex === null) return;

        $('#caption-text .word').removeClass('highlighted');
        $('#caption-' + captionIndex + '-word-' + wordIndex).addClass('highlighted');

        $('.caption-line-overlay .word').removeClass('highlighted');
        $('#overlay-caption-' + captionIndex + '-word-' + wordIndex).addClass('highlighted');
    }

    // Add a click event listener for caption-line elements
    $('.caption-line').on('click', function (event) {

        if(isYoutubeChangingState) return;

        // Get the current caption-line element's ID
        const captionIndex = $(this).data('index');
        
        // Get the start time of the caption
        const startTime = captions[captionIndex].start + floatCompareOffset;

        // Seek the video to the start time of the caption
        player.seekTo(startTime, true);
        if(player.getPlayerState() === YT.PlayerState.PAUSED)
        {
            player.playVideo();
        }

        isYoutubeChangingState = true;

        $(".dictation-input").val("");
    });

    $('.next-caption-line-button').on('click', function (event) {

        if(isYoutubeChangingState) return;

        var nextCaptionIndex = getNextCaptionIndex(player.getCurrentTime());
        $("#caption-" + (nextCaptionIndex!==null?nextCaptionIndex:0)).closest(".caption-line").click();
    });

    $('.previous-caption-line-button').on('click', function (event) {

        if(isYoutubeChangingState) return;

        var previousCaptionIndex = getPreviousCaptionIndex(player.getCurrentTime());
        $("#caption-" + (previousCaptionIndex!==null?previousCaptionIndex:(captions.length-1))).closest(".caption-line").click();
    });

    $('.relisten-caption-line-button').on('click', function (event) {

        if(isYoutubeChangingState) return;

        if(currentActiveCaptionIndex === null) {
            $('.previous-caption-line-button').click();
        }
        else {
            player.seekTo(captions[currentActiveCaptionIndex].start + floatCompareOffset, true);
            isYoutubeChangingState = true;
        }
    });

    // Add a click event listener for the English Caption label
    $('.invideo-english-caption-toggle').on('click', function (event) {
        // Prevent the label from triggering the checkbox's default behavior
        event.preventDefault();

        // Get the checkbox element
        const checkbox = $(this).find('input');

        // Update the checkbox status
        checkbox.prop('checked', !checkbox.prop('checked'));

        showHideCaptionLineOverlay();
    });

    function showHideCaptionLineOverlay()
    {
        var isShowEnglishCaptionLine = $('.invideo-english-caption-toggle').find('input').prop('checked');
        $('.caption-line-overlay').css('display', isShowEnglishCaptionLine ? "inline-block" : "none");
    }

    // Add a click event listener for the English Caption label
    $('.box-english-caption-toggle').on('click', function (event) {
        // Prevent the label from triggering the checkbox's default behavior
        event.preventDefault();

        // Get the checkbox element
        const checkbox = $(this).find('input');

        // Update the checkbox status
        checkbox.prop('checked', !checkbox.prop('checked'));

        // Toggle the visibility of the caption
        $('.english-caption-line').toggle();
    });

    // Add a click event listener for the English Caption label
    $('.loop-caption-toggle').on('click', function (event) {
        // Prevent the button from submitting a form or triggering other default behavior
        event.preventDefault();

        if(isInDictationMode) return;

        // Get the checkbox element
        const checkbox = $(this).find('input');

        // Update the checkbox status
        checkbox.prop('checked', !checkbox.prop('checked'));

        isLoopingCaption = checkbox.prop('checked');
    });

    // Add a click event listener for the English Caption label
    $('.enable-dictation-toggle').on('click', function (event) {
        // Prevent the button from submitting a form or triggering other default behavior
        event.preventDefault();

        // Get the checkbox element
        const checkbox = $(this).find('input');

        // Update the checkbox status
        checkbox.prop('checked', !checkbox.prop('checked'));

        isInDictationMode = checkbox.prop('checked');

        $(".dictation-container").toggleClass("hidden");

        if(isInDictationMode) {
            $('.caption-line').removeClass('disabled-dictation');
            if($('.invideo-english-caption-toggle').find('input').prop('checked'))
            {
                $('.invideo-english-caption-toggle').click();
            }
            if($('.box-english-caption-toggle').find('input').prop('checked'))
            {
                $('.box-english-caption-toggle').click();
            }
            if($('.loop-caption-toggle').find('input').prop('checked'))
            {
                $('.loop-caption-toggle').click();
            }
            $('.loop-caption-toggle').hide();
        }
        else
        {
            $('.caption-line').addClass('disabled-dictation');
            if(!$('.box-english-caption-toggle').find('input').prop('checked'))
            {
                $('.box-english-caption-toggle').click();
            }
            $('.loop-caption-toggle').show();
        }

    });

    $('#dictation-mode').on('change', function (event) {
        var selectedMode = $(this).val();

        if(selectedMode === "word") {
            $(".dictation-hint").show();
        } 
        else {
            $(".dictation-hint").hide();
        }
    });

    $('.relisten-dictation-button').on('click', function (event) {
        event.preventDefault();

        if(isYoutubeChangingState) return;

        if(player.getPlayerState() === YT.PlayerState.PAUSED)
        {
            player.playVideo();
        }

        if(currentActiveCaptionIndex === null) {
            $('.previous-dictation-button').click();
        }
        else {
            $('.relisten-caption-line-button').click();
        }
    });

    $('.next-dictation-button').on('click', function (event) {
        event.preventDefault();

        if(isYoutubeChangingState) return;

        var dictationResult = checkDictation();
        saveDictationState(dictationResult);
        updateLastDictation(dictationResult);

        if(!isDictationForcePause) //when force pause, we're already on the next caption
        {
            $('.next-caption-line-button').click();
        }

        if(player.getPlayerState() === YT.PlayerState.PAUSED)
        {
            player.playVideo();
            isYoutubeChangingState = true;
        }

        $(".dictation-input").val("");
        $(".dictation-input").focus();
    });
    
    $('.previous-dictation-button').on('click', function (event) {
        event.preventDefault();

        if(isYoutubeChangingState) return;

        var dictationResult = checkDictation();
        saveDictationState(dictationResult);
        updateLastDictation(dictationResult);

        if(!isDictationForcePause)
        {
            $('.previous-caption-line-button').click();
        }
        else //when force pause, we're already on the next caption. we have to wind back 2 captions
        {
            var previousCaptionIndex = getPreviousCaptionIndex(player.getCurrentTime());
            if(previousCaptionIndex !== null)
            {
                previousCaptionIndex--;
            }
            $("#caption-" + ((previousCaptionIndex !== null && previousCaptionIndex >= 0)?previousCaptionIndex:(captions.length-1))).closest(".caption-line").click();
        }

        if(player.getPlayerState() === YT.PlayerState.PAUSED)
        {
            player.playVideo();
            isYoutubeChangingState = true;
        }

        $(".dictation-input").val("");
        $(".dictation-input").focus();
    });

    $(".dictation-input").on('keydown', function(event) {
        if($(".dictation-input").hasClass("disabled")) {
            event.preventDefault();
        }
    });

    $(document).on('keydown', function(event) {
        if ((event.key === 'Enter') || (event.shiftKey && event.key === 'ArrowRight')) {
            if(isInDictationMode) {
                $('.next-dictation-button').click();
            }
            else {
                $('.next-caption-line-button').click();
            }
        }
        else {
            if (event.shiftKey && event.key === 'ArrowLeft') {
                if(isInDictationMode) {
                    $('.previous-dictation-button').click();
                }
                else {
                    $('.previous-caption-line-button').click();
                }
            }
            else {
                if (event.shiftKey && (event.key === 'd' || event.key === 'D')) {
                    if(isInDictationMode) {
                        event.preventDefault();
                        $('.relisten-dictation-button').click();
                    }
                    else {
                        $('.relisten-caption-line-button').click();
                    }
                }
                else {
                    if (event.shiftKey && (event.key === 'c' || event.key === 'C')) {
                        if(isInDictationMode) {
                            event.preventDefault();
                            $('.check-dictation-button').click();
                        }
                    }
                }
            }
        }
    });

    $('.check-dictation-button').on('click', function (event) {
        event.preventDefault();

        var dictationResult = checkDictation();
        showCheckDictationEffect(dictationResult);
        saveDictationState(dictationResult);
    });

    // $('.auto-next-dictation-toggle').on('click', function (event) {
    //     // Prevent the label from triggering the checkbox's default behavior
    //     event.preventDefault();

    //     // Get the checkbox element
    //     const checkbox = $(this).find('input');

    //     // Update the checkbox status
    //     checkbox.prop('checked', !checkbox.prop('checked'));

    //     isAutoNextDictation = checkbox.prop('checked');
    // });

    function saveDictationState(dictationResult) {
        var captionIndex = currentActiveCaptionIndex;
        if(dictationResult !== null && captionIndex !== null) {
            $("#caption-" + captionIndex).removeClass("correct-dictation");
            $("#caption-" + captionIndex).removeClass("incorrect-dictation");
            if(dictationResult === true)
            {
                captionDictationStates[captionIndex].status = true;
                captionDictationStates[captionIndex].answer = $(".dictation-input").val();
                $("#caption-" + captionIndex).addClass("correct-dictation");    
            }
            else {
                $("#caption-" + captionIndex).addClass("incorrect-dictation");
            }

            $(".correct-dictation-number span").html(captionDictationStates.filter(value => value.status).length + "/engovate.github.io/" + captions.length);
        }
    }

    function updateLastDictation(dictationResult) {
        var captionIndex = currentActiveCaptionIndex;
        if(dictationResult !== null && captionIndex !== null) {
            $('.last-dictation-caption').html(`<strong>Last Caption: ${captions[captionIndex].words.join(" ")}</strong>`);
            if(dictationResult === true)
            {
                $('.last-dictation-answer').html(`<strong style="color: green">&#x2713 Last Answer: ${$(".dictation-input").val()}</strong>`);
            }
            else
            {
                $('.last-dictation-answer').html(`<strong style="color: darkred">&#x2715 Last Answer: ${$(".dictation-input").val()}</strong>`);
            }  
        }
    }

    function checkDictation() {
        if(currentActiveCaptionIndex === null)
        {
            return null;
        }
        else
        {
            var captionIndex = currentActiveCaptionIndex;
            var userDictationInput = "";
            var currentCaptionText = captions[captionIndex].words.join(" ").trim().toLowerCase();
            
            if($("#dictation-mode").val() === "word")
            {
                var missingWordCaption = missingWordCaptions[captionIndex];
                userDictationInput = missingWordCaption.words.map(function (word, index) {
                    if(index === missingWordCaption.missingWordIndex)
                    {
                        return $(".dictation-input").val().trim();
                    }
                    else
                    {
                        return word;
                    }
                }).join(" ").trim().toLowerCase();
            }
            else
            {
                userDictationInput = $(".dictation-input").val().trim().toLowerCase();
            }

            // Remove all special characters, 16 punctuation marks, and double spaces
            var regexPattern = /[^\w\s]|_|\u2013|\u2014|\u2026/g;
            var spacePattern = /\s+/g;
            userDictationInput = userDictationInput.replace(regexPattern, '').replace(spacePattern, ' ');
            currentCaptionText = currentCaptionText.replace(regexPattern, '').replace(spacePattern, ' ');

            return currentCaptionText === userDictationInput;
        }
    }

    function showCheckDictationEffect(dictationResult) {
        // Show the check_dictation_result element
        $('.check-dictation-result').fadeIn();
        // Gradually fade out the check_dictation_result element after a delay (e.g., 2000 milliseconds)
        setTimeout(function () {
            $('.check-dictation-result').fadeOut("slow");
        }, 2000);
    
        if(currentActiveCaptionIndex === null || dictationResult === null)
        {
            $('.check-dictation-result').html('<strong><em>There is nothing to check!</em></strong>');
        }
        else
        {
            if (dictationResult === true){
                $('.check-dictation-result').html('<strong style="color: green">&#x2713 Your answer is correct!</strong>');
            }
            else
            {
                $('.check-dictation-result').html('<strong style="color: darkred">&#x2715 Your answer is incorrect!</strong>');
            }
        }
    }

    function updateDictationInput() {

        if(currentActiveCaptionIndex !== null)
        {
            // Update caption inside the dictation box
            if($("#dictation-mode").val() === "word")
            {
                $(".dictation-hint").html(missingWordCaptions[currentActiveCaptionIndex].words.join(' '));
            }

            if(captionDictationStates[currentActiveCaptionIndex].status === true || missingWordCaptions[currentActiveCaptionIndex].missingWordIndex < 0)
            {
                var userAnswer = captionDictationStates[currentActiveCaptionIndex].answer;
                $(".dictation-input").val(userAnswer);
                $(".dictation-input").addClass("disabled");
            }
            else {
                $(".dictation-input").removeClass("disabled");
            }
        }
        else
        {
            if(!isDictationForcePause) {
                $(".dictation-hint").html("-");
            }

            $(".dictation-input").addClass("disabled");
        }
    }

    let isResizing = false;
    let resizeHandleStartX;
    let originalVideoWidth;

    $('.resize-handle').on('mousedown', function (e) {
        e.preventDefault();
        isResizing = true;
        resizeHandleStartX = e.clientX;
        originalVideoWidth = $('.left-column').outerWidth();
        $('.iframe-blocker').css('display', 'block'); // Show the blocker div when resizing starts
    });

    $(window).on('mousemove', (e) => {
        if (!isResizing) return;
        const delta = e.clientX - resizeHandleStartX;
        const newWidth = originalVideoWidth + delta;
        const maxWidth = $('.main-row').outerWidth();
        const limitedNewWidth = Math.min(newWidth, maxWidth); // Limit the new width to the maximum allowed width

        // Resize left column and right column
        $('.left-column').css('flex-basis', limitedNewWidth + 'px');
        $('.right-column').css('flex-basis', ($('.main-row').outerWidth() - limitedNewWidth) + 'px');

        equalizeElementHeight();
    });

    $(window).on('mouseup', () => {
        isResizing = false;
        $('.iframe-blocker').css('display', 'none'); // Hide the blocker div when resizing ends
    });

    $(window).resize(function() {
        equalizeElementHeight();
    });

    function equalizeElementHeight()
    {
        // Set the height of caption-text to match the height of the embedded video
        $("#caption-text").height($("#embeded-video").height());
        $(".resize-handle").height($("#embeded-video").height());
        $(".caption-blocker").height($("#embeded-video").height());
    }
});