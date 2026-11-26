jQuery(document).ready(function ($) {
    function getPlanLabel(plan) {
        var parts = plan.split('-');
        var months = parseInt(parts[0]);
        if (months === 12) return 'Get 12 Months — Best Value →';
        return 'Start Premium — ' + months + (months === 1 ? ' Month' : ' Months') + ' →';
    }

    $('.payment-price').on('click', function (e) {
        e.preventDefault();
        var plan = $(this).data('plan');
        $('.go-to-checkout-page-button')
            .attr('href', '/engovate.github.io/payment-checkout/?plan=' + plan)
            .text(getPlanLabel(plan));
    });
});