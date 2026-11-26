jQuery(document).ready(function ($) {

    // Function to apply styles based on width of a single element
    function applyStylesBasedOnWidth(element) {
        var containerWidth = $(element).width();
        $(element).toggleClass('mobile', containerWidth <= 768);
    }

    function debounce(func, wait, immediate) {
        var timeout;
        return function() {
            var context = this, args = arguments;
            var later = function() {
                timeout = null;
                if (!immediate) func.apply(context, args);
            };
            var callNow = immediate && !timeout;
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
            if (callNow) func.apply(context, args);
        };
    }
    
    var ro = new ResizeObserver(function (entries) {
        entries.forEach(function(entry) {
            entry.target.debouncedApplyStyles(entry);
        });
    });

    // Observe each .compare-content-row element
    $('.compare-content-row').each(function () {
        // Create a debounced function for each element
        this.debouncedApplyStyles = debounce(function(entry) {
            applyStylesBasedOnWidth(entry.target);
        }, 100);  // 100 ms debounce period

        ro.observe(this);

        // Initial check for each element
        applyStylesBasedOnWidth(this);
    });

});