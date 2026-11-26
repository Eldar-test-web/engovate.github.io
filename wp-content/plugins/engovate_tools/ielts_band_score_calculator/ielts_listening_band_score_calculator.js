jQuery(document).ready(function ($) {

    $(".ielts-listening-band-score-calculator").on("submit", function (event) {
        event.preventDefault();

        var listeningRawScore = parseFloat($('#raw-band-score').val() || 0);

        var unroundedListeningScore = Math.round(listeningRawScore / 40.0 * 9 * 1000)/1000;
        var roundedListeningScore = convertRawScoreToBandScore(listeningRawScore);
        $('.listening-band-score-wrapper').hide();
        $('.listening-band-score-wrapper').fadeIn();
        $('#listening-unrounded-band-score').text(listeningRawScore + ' / 40 * 9 = ' +  unroundedListeningScore);
        $('#listening-rounded-band-score').text(roundedListeningScore);
    });

    function convertRawScoreToBandScore(rawScore) {
        if (rawScore >= 39) return 9;
        else if (rawScore >= 37) return 8.5;
        else if (rawScore >= 35) return 8;
        else if (rawScore >= 32) return 7.5;
        else if (rawScore >= 30) return 7;
        else if (rawScore >= 26) return 6.5;
        else if (rawScore >= 23) return 6;
        else if (rawScore >= 18) return 5.5;
        else if (rawScore >= 16) return 5;
        else if (rawScore >= 13) return 4.5;
        else if (rawScore >= 11) return 4;
        else if (rawScore >= 9) return 3.5;
        else if (rawScore >= 7) return 3;
        else if (rawScore >= 5) return 2.5;
        else if (rawScore >= 3) return 2;
        else return 1;
    }

});