jQuery(document).ready(function ($) {

    $(".ielts-speaking-band-score-calculator").on("submit", function (event) {
        event.preventDefault();

        var speakingPart1Score = parseFloat($('#speaking-part-1-band-score').val() || 0);
        var speakingPart2Score = parseFloat($('#speaking-part-2-band-score').val() || 0);
        var speakingPart3Score = parseFloat($('#speaking-part-3-band-score').val() || 0);

        var unroundedSpeakingScore = Math.round((speakingPart1Score + speakingPart2Score * 2 + speakingPart3Score * 2) / 5.0 * 1000) / 1000;
        var roundedSpeakingScore =  Math.round(unroundedSpeakingScore * 2) / 2.0;
        $('.speaking-band-score-wrapper').hide();
        $('.speaking-band-score-wrapper').fadeIn();
        $('#speaking-unrounded-band-score').text('(' + speakingPart1Score + ' + ' + speakingPart2Score + ' x 2 + ' + speakingPart3Score + ' x 2) / 5 = ' + unroundedSpeakingScore);
        $('#speaking-rounded-band-score').text(roundedSpeakingScore);
    });

});