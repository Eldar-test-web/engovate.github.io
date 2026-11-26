jQuery(document).ready(function ($) {
    $('.module-part-why-learn').on('click', function() {
        $(this).next('.module-part-why-learn-content-container').css('display', 'flex');
    });

    $('.close-module-part-why-learn-content-button').on('click', function() {
        $(this).closest('.module-part-why-learn-content-container').hide();
    });

    $('.module-part-locker').on('click', function(e) {
        e.preventDefault();
        $('.payment-popup-container').css('display', 'flex');
    });
});