jQuery(document).ready(function($) {
    // Locked forecast cards open the upgrade popup instead of doing nothing.
    $('.post-locker').on('click', function(e) {
        e.preventDefault();
        $('.payment-popup-container').css('display', 'flex');
    });
});
