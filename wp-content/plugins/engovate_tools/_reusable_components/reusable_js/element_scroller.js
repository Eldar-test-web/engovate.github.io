window.elementScroller = window.elementScroller || {};

jQuery(document).ready(function ($) {

    var scrollingTimeouts = [];

    window.elementScroller.scrollTo = function(targetElement) {
        if(!targetElement || targetElement.length == 0) return;
                    
        //if the targetRect is previously set to hidden and just set to show, need to wait for the target to finish calculation rect
        var scrollingTimeout = setTimeout(() => {
            if(targetElement.is(':visible')) {
                const topMargin = 120;

                let container = $(targetElement).parents().filter(function() {
                    // Get computed style for the current element
                    var overflowStyle = $(this).css('overflow');
                    var overflowYStyle = $(this).css('overflow-y');
                    // Check if the overflow style is 'auto'
                    return overflowStyle === 'auto' || overflowYStyle === 'scroll';
                }).first();
                
                if(container.length == 0) {
                    $('html, body').animate({
                        scrollTop: targetElement.offset().top - topMargin
                    }, 500);
                }
                else {
                    // Calculate the relative position to the container using getBoundingClientRect()
                    const targetRect = targetElement[0].getBoundingClientRect();
                    const containerRect = container[0].getBoundingClientRect();
                    let scrollTopPosition = container.scrollTop() + targetRect.top - containerRect.top - topMargin;
                    // //a hacky way to signify that if it's near the top, scroll all the way up
                    // if(scrollTopPosition < 200) scrollTopPosition = 0;

                    container.animate(
                        {
                            scrollTop: scrollTopPosition,
                        },
                        500 // Animation duration in milliseconds
                    );
                }
            }

            //remove the timeout from the list
            scrollingTimeouts = scrollingTimeouts.filter(timeout => timeout !== scrollingTimeout);
        }, 100);

        //add the timeout to the list
        scrollingTimeouts.push(scrollingTimeout);
    }

    window.elementScroller.clearAllScrollTimeouts = function() {
        for(var i = 0; i < scrollingTimeouts.length; i++) {
            clearTimeout(scrollingTimeouts[i]);
        }
    }
});