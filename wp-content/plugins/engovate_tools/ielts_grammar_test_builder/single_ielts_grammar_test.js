jQuery(document).ready(function($) {

    // A typed answer counts when it matches an accepted answer once capitals, extra spaces,
    // curly apostrophes and a final full stop are set aside.
    function normalizeAnswer(text) {
        return $.trim(String(text).toLowerCase().replace(/[‘’`´]/g, "'").replace(/\s+/g, ' ')).replace(/[.!]+$/, '');
    }

    // Each question is checked on its own. The answers and explanations are already in the page,
    // so checking needs no request, and checking again after a change marks the new answer.
    $('.grammar-check-button').on('click', function() {
        var $question = $(this).closest('.grammar-question');
        var right;

        if ($question.hasClass('grammar-question-typed')) {
            var typed = normalizeAnswer($question.find('.grammar-answer-input').val());
            var accepted = $.map($question.data('answers') || [], normalizeAnswer);
            right = typed !== '' && $.inArray(typed, accepted) !== -1;
            // The right answer shows only when the learner missed it.
            $question.find('.grammar-correct-answer').toggle(!right);
        } else {
            var correctIndex = String($question.data('correct'));
            var selected = $question.find('input[type="radio"]:checked').val();
            var $options = $question.find('.grammar-option').removeClass('correct selected-wrong');
            $options.filter('[data-option-index="' + correctIndex + '"]').addClass('correct');
            right = selected !== undefined && String(selected) === correctIndex;
            if (selected !== undefined && !right) {
                $options.filter('[data-option-index="' + selected + '"]').addClass('selected-wrong');
            }
        }

        $question.removeClass('correct incorrect').addClass(right ? 'correct' : 'incorrect');
        $('.grammar-score').text($('.grammar-question.correct').length + ' / ' + $('.grammar-question').length);

        var $explanation = $question.find('.grammar-explanation');
        if ($.trim($explanation.text()) !== '') {
            $explanation.show();
        }
    });

    // Enter in an answer box checks that question, the same as pressing its button.
    $('.grammar-answer-input').on('keydown', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            $(this).closest('.grammar-question').find('.grammar-check-button').trigger('click');
        }
    });
});
