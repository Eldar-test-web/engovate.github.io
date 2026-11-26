window.elementHighlighter = window.elementHighlighter || {};

jQuery(document).ready(function ($) {
    window.elementHighlighter.highlightElement = function(targetElement, backgroundColor = 'yellow') {

        var isHighlighting = targetElement.attr('highlighting');

        if(isHighlighting == 1) {
            return;
        }

        // Get the old background color and display property
        var oldBackgroundColor = targetElement.css('background-color');
        var oldTransition = targetElement.css('transition');
        var oldBorder = targetElement.css('border');
    
        // Apply highlight, scaling and set display to inline-block
        targetElement.css({
            'transition': 'background-color 0.5s ease-in-out',
            'background-color': backgroundColor,
            'border': '1px solid black',
        });

        targetElement.attr('highlighting', 1);
    
        // After 1 second, revert to the old color, remove scaling and set display back to its original value
        setTimeout(function () {
            targetElement.css({
                'transition': oldTransition,
                'background-color': oldBackgroundColor,
                'border': oldBorder,
            });

            targetElement.attr('highlighting', 0);
        }, 3000);
    }
});