jQuery(document).ready(function ($) {

    $(".ielts-writing-band-score-calculator").on("submit", function (event) {
        event.preventDefault();

        var writingTask1Score = parseFloat($('#writing-task-1-band-score').val() || 0);
        var writingTask2Score = parseFloat($('#writing-task-2-band-score').val() || 0);

        var unroundedWritingScore = Math.round((writingTask1Score + writingTask2Score * 2) / 3.0 * 1000) / 1000;
        var roundedWritingScore =  Math.round(unroundedWritingScore * 2) / 2.0;
        $('.writing-band-score-wrapper').hide();
        $('.writing-band-score-wrapper').fadeIn();
        $('#writing-unrounded-band-score').text('(' + writingTask1Score + ' + ' + writingTask2Score + ' x 2) / 3 = ' + unroundedWritingScore);
        $('#writing-rounded-band-score').text(roundedWritingScore);
    });

});