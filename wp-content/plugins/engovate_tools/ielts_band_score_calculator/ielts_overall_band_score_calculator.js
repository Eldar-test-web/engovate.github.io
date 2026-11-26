jQuery(document).ready(function ($) {

    $(".ielts-overall-band-score-calculator").on("submit", function (event) {
        event.preventDefault();

        var listeningScore = parseFloat($('#listening-band-score').val() || 0);
        var readingScore = parseFloat($('#reading-band-score').val() || 0);
        var writingScore = parseFloat($('#writing-band-score').val() || 0);
        var speakingScore = parseFloat($('#speaking-band-score').val() || 0);

        var unroundedOverallBandScore = (listeningScore + readingScore + writingScore + speakingScore)/4.0;
        var roundedOverallScore = Math.round(unroundedOverallBandScore * 2) / 2.0;
        $('.overall-band-score-wrapper').hide();
        $('.overall-band-score-wrapper').fadeIn();
        $('#overall-unrounded-band-score').text('(' + listeningScore + ' + ' + readingScore + ' + ' + writingScore + ' + ' + speakingScore + ' ) / 4 = ' + unroundedOverallBandScore);
        $('#overall-rounded-band-score').text(roundedOverallScore);
    });

});