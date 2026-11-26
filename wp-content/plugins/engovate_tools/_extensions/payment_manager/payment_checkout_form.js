jQuery(document).ready(function ($) {
    var savedActivationCode = '';
    try {
        var savedCodeRaw = window.localStorage.getItem('saved_premium_activation_code');
        var savedCode = savedCodeRaw ? JSON.parse(savedCodeRaw) : null;
        if (savedCode && savedCode.code && savedCode.savedAt && (new Date().getTime() - savedCode.savedAt) <= 10 * 24 * 60 * 60 * 1000) {
            savedActivationCode = savedCode.code;
        }
        else if (savedCode) {
            window.localStorage.removeItem('saved_premium_activation_code');
        }
    } catch (e) {}

    if (savedActivationCode) {
        $('.saved-premium-activation-code').find('strong').text(savedActivationCode).end().prop('hidden', false);
    }


  $('.payment-price').on('click', function (e) {
    e.preventDefault();
    var plan = $(this).data('plan');
    updateURLParameter('plan', plan);
  });


  //STRIPE SETUP//
  //set up before PayPal on purpose: paypal.Buttons() below throws when an ad blocker stops PayPal's script loading, and
  //nothing after that line runs, which would leave this button doing nothing
  $(".stripe-buy-button").on('click', function (e) {
    e.preventDefault();

    var stripePaymentLinks = $(this).data('payment-links');
    var plan = $('.payment-price.selected').data('plan');
    var checkoutUrl = stripePaymentLinks[plan];
    if (!checkoutUrl) {
      checkoutUrl = stripePaymentLinks['12-month'];
    }

    //Stripe sends the buyer back to the address set on each payment link in the dashboard. The webhook usually makes
    //the code, and it comes from Stripe with no cookie, so pass the referral cookie along for it. A payment link cannot
    //carry metadata, so it goes as client_reference_id, which Stripe hands back on the checkout session.
    var affiliateRef = document.cookie.match(/(?:^|;\s*)engnovate_affiliate_ref=([^;]*)/);
    if (affiliateRef && affiliateRef[1]) {
      checkoutUrl += (checkoutUrl.indexOf('?') == -1 ? '?' : '&') + 'client_reference_id=' + encodeURIComponent(affiliateRef[1]);
    }

    window.location.href = checkoutUrl;
  });

  //PAYPAL SETUP//
  var currentPaypalSelectedPlan = '';

  paypal.Buttons({
    createOrder: function (data, actions) {
      var plan = $('.payment-price.selected').data('plan');
      var price = payment_checkout_ajax.subscription_plans[plan];
      if (!price) {
        price = payment_checkout_ajax.subscription_plans['12-month'];
      }

      currentPaypalSelectedPlan = plan;

      return actions.order.create({
        purchase_units: [{
          description: plan,
          amount: {
            value: price,
          },
        }],
        application_context: {
          shipping_preference: 'NO_SHIPPING'
        }
      });
    },
    onApprove: function (data, actions) {
      return actions.order.capture().then(function (details) {
        var orderNumber = data.orderID;
        //the success page verifies the order with PayPal and mints the code, the same way the other providers work
        window.location.href = '/engovate.github.io/payment-success/?payment_type=paypal&order_number=' + encodeURIComponent(orderNumber);
      }).catch(function (error) {
        alert("The payment could not be processed. Please check your funding source or try a different payment method.");
        console.error('Capture error', error);
      });
    }
  }).render('.paypal-buy-button');

  //DODO PAYMENTS SETUP//
  $(".dodopayments-buy-button").on('click', function (e) {
    e.preventDefault();

    var dodoPaymentsProducts = $(this).data('products');
    var plan = $('.payment-price.selected').data('plan');
    var productId = dodoPaymentsProducts[plan];
    if (!productId) {
      plan = '12-month';
      productId = dodoPaymentsProducts[plan];
    }

    var checkoutUrl = $(this).data('checkout-url') + '/engovate.github.io/buy/' + productId;

    //Dodo sends the buyer back with payment_id, status and email appended to the redirect_url,
    //and hands the plan back to us on the payment itself through the metadata_ prefixed parameter.
    checkoutUrl += '?quantity=1';
    checkoutUrl += '&showDiscounts=false'; //hide the coupon/promo code box, our prices are already discounted
    checkoutUrl += '&metadata_plan=' + encodeURIComponent(plan);
    checkoutUrl += '&redirect_url=' + encodeURIComponent(window.location.origin + '/engovate.github.io/payment-success/?payment_type=dodopayments');

    window.location.href = checkoutUrl;
  });

  //CONFIRM PAYMENT//
  function updateURLParameter(paramName, paramValue) {
    var params = new URLSearchParams(window.location.search);

    params.set(paramName, paramValue);

    var newUrl = window.location.protocol + "/engovate.github.io//" + window.location.host + window.location.pathname + '?' + params.toString();
    window.history.pushState({ path: newUrl }, '', newUrl);
  }
});