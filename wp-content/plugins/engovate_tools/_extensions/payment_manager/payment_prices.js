jQuery(document).ready(function ($) {
    $('.payment-price').on('click', function (e) {
        e.preventDefault();
        $('.payment-price').removeClass('selected');
        $('.payment-price').find('input').prop('checked', false);
        $(this).addClass('selected');
        $(this).find('input').prop('checked', true);
    });

    function updateDiscountTimer() {
        var timerContainer = $('.limited-time-discount-timer');
        if (!timerContainer.length) return;

        var phpExpiry  = parseInt(timerContainer.data('expiry')) * 1000;
        var now        = Date.now();
        var timeDisplay = timerContainer.find('.timer');

        // If PHP expiry is stale (cached page), show a fixed 1 hour without counting down
        if (phpExpiry <= now) {
            timeDisplay.text('01h:00m:00s');
            return;
        }

        var expiryTimestamp = phpExpiry;

        var intervalId = setInterval(function () {
            var remaining = Math.floor((expiryTimestamp - Date.now()) / 1000);

            if (remaining <= 0) {
                timeDisplay.text('00h:00m:00s');
                clearInterval(intervalId);
                return;
            }

            var hours   = Math.floor(remaining / 3600);
            var minutes = Math.floor((remaining % 3600) / 60);
            var seconds = remaining % 60;

            timeDisplay.text(
                String(hours).padStart(2, '0') + 'h:' +
                String(minutes).padStart(2, '0') + 'm:' +
                String(seconds).padStart(2, '0') + 's'
            );
        }, 1000);
    }
    updateDiscountTimer();
});