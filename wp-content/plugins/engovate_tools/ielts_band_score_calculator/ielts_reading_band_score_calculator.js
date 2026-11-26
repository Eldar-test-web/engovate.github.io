jQuery(document).ready(function ($) {

    $(".ielts-reading-band-score-calculator").on("submit", function (event) {
        event.preventDefault();

        var readingRawScore = parseFloat($('#raw-band-score').val() || 0);

        var testType = $('#band-score-type').val();

        var unroundedReadingScore = Math.round(readingRawScore / 40.0 * 9 * 1000)/1000;
        var roundedReadingScore = convertRawScoreToBandScore(readingRawScore, testType);
        $('.reading-band-score-wrapper').hide();
        $('.reading-band-score-wrapper').fadeIn();
        $('#reading-unrounded-band-score').text(readingRawScore + ' / 40 * 9 = ' +  unroundedReadingScore);
        $('#reading-rounded-band-score').text(roundedReadingScore);
    });

    function convertRawScoreToBandScore(rawScore, testType) {
        if(testType == 'academic') {
            if (rawScore >= 39) return 9;
            else if (rawScore >= 37) return 8.5;
            else if (rawScore >= 35) return 8;
            else if (rawScore >= 33) return 7.5;
            else if (rawScore >= 30) return 7;
            else if (rawScore >= 27) return 6.5;
            else if (rawScore >= 23) return 6;
            else if (rawScore >= 19) return 5.5;
            else if (rawScore >= 15) return 5;
            else if (rawScore >= 13) return 4.5;
            else if (rawScore >= 10) return 4;
            else if (rawScore >= 8) return 3.5;
            else if (rawScore >= 6) return 3;
            else if (rawScore >= 4) return 2.5;
            else if (rawScore >= 2) return 2;
            else return 1;
        }
        else {
            if (rawScore >= 40) return 9;
            else if (rawScore >= 39) return 8.5;
            else if (rawScore >= 37) return 8;
            else if (rawScore >= 36) return 7.5;
            else if (rawScore >= 34) return 7;
            else if (rawScore >= 32) return 6.5;
            else if (rawScore >= 30) return 6;
            else if (rawScore >= 27) return 5.5;
            else if (rawScore >= 23) return 5;
            else if (rawScore >= 19) return 4.5;
            else if (rawScore >= 15) return 4;
            else if (rawScore >= 12) return 3.5;
            else if (rawScore >= 9) return 3;
            else if (rawScore >= 7) return 2.5;
            else if (rawScore >= 5) return 2;
            else if (rawScore >= 3) return 1.5;
            else return 1;
        }
    }

});