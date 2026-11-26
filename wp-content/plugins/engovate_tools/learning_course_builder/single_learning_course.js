jQuery(document).ready(function ($) {
    $('.post-locker').on('click', function(e) {
        e.preventDefault();
        $('.payment-popup-container').css('display', 'flex');
    });
});