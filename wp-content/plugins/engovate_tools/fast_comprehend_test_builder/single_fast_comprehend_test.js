jQuery(document).ready(function ($) {
    let originalTranscriptContent = $('.fast-comprehend-word-display').html();
    let timeoutId = null;
    let isSkimming = false;

    function wrapTextNodesWithSkimmingSpan(element) {
        element.contents().each(function () {
            if (this.nodeType === 3) { // Text node
                const words = this.textContent.trim().split(' ');
                const wrappedWords = words.map(word => `<span class="skimming-word">${word} </span>`);
                $(this).replaceWith(wrappedWords.join(''));
            } else if (this.nodeType === 1) { // Element node
                wrapTextNodesWithSkimmingSpan($(this));
            }
        });
    }
    
    $('.start-fast-comprehend-button').on('click', function(e) {
        e.preventDefault();

        if(isSkimming) {
            stopSkimming();
        }
        else {
            wrapTextNodesWithSkimmingSpan($('.fast-comprehend-word-display'));
            
            //Skimming
            let words = $('.fast-comprehend-word-display').find('.skimming-word');
            let delayPerWord = 60 * 1000 / $('.words-per-minute').val();
            let delay = 0;
            words.each(function() {
                let word = $(this);
                timeoutId = setTimeout(() => {
                    word.animate({opacity: 0}, 500);
                }, delay);
                delay += delayPerWord;
            });
        
            // Restore content automatically after all words have been hidden
            timeoutId = setTimeout(() => {
                $('.start-fast-comprehend-button').text('Restart');
            }, delay + 1000); // Add the duration of the last word's animation

            
            $(this).text('Stop');
            $(this).addClass('running');
            isSkimming = true;
        }
    });

    function stopSkimming() {
        clearTimeout(timeoutId);
        $('.fast-comprehend-word-display').html(originalTranscriptContent);
        $('.start-fast-comprehend-button').text('Start');
        $('.start-fast-comprehend-button').removeClass('running');
        isSkimming = false;
    }

    $('.words-per-minute').on('input', function() {
        const totalSeconds = Math.round(originalTranscriptContent.split(' ').length / $('.words-per-minute').val() * 60);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        $('.estimated-time span').text(`${minutes}:${seconds.toString().padStart(2, '0')}`);
    });

    $('.post-locker').on('click', function(e) {
        e.preventDefault();
        $('.payment-popup-container').css('display', 'flex');
    });

    $('.fast-comprehend-question').on('submit', function(e) {
        e.preventDefault();
        const answer = $(this).find('.fast-comprehend-question-answer').val();
        const userAnswer = $(this).find('.fast-comprehend-question-option input:checked').val();

        // Add the green mark to the user answer, otherwise add the red mark
        if(userAnswer === answer) {
            $(this).find('.fast-comprehend-question-option input:checked').closest('.fast-comprehend-question-option').css('color', 'green').css('font-weight', 'bold').append(' <i class="fa-solid fa-check"></i>');
        }
        else {
            $(this).find('.fast-comprehend-question-option input:checked').closest('.fast-comprehend-question-option').css('color', 'red').append(' <i class="fa-solid fa-xmark"></i>');

            //find the option with the correct answer
            var correctOption = $(this).find('.fast-comprehend-question-option').find('input[value="' + answer + '"]');
            correctOption.closest('.fast-comprehend-question-option').css('color', 'green').css('font-weight', 'bold').append(' <i class="fa-solid fa-check"></i>');;
        }

        $(this).find('.fast-comprehend-question-explanation').show();
        $(this).find('.fast-comprehend-question-check-answer').hide();
    });
});