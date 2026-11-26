window.textMarker = window.textMarker || {};

jQuery(document).ready(function ($) {

    var markContainer = {};

    window.textMarker.markText = function(targetElementName, textToMark, className, markedIndex, markCount = null, backgroundColor = null) {
        if(!markContainer[targetElementName]) {
            markContainer[targetElementName] = new Mark($(targetElementName).get(0));
        }

        markContainer[targetElementName].mark(textToMark, {
            element: 'span',
            className: className,
            separateWordSearch: false,
            acrossElements: true,
            accuracy: {
                "value": "exactly",
                "limiters": ":;.,-_(){}[]!?'\"+=".split(""),
            },
            each: function(node) {
                if(backgroundColor) {
                    node.style.backgroundColor = backgroundColor;
                }
                $(node).attr('marked-index', markedIndex);
            },
            filter: function(node, term, totalCounter, counter){
                if(term === textToMark && markCount != null && counter >= markCount){
                    return false;
                }
                else {
                    return true;
                }
            },
        });
    }

    window.textMarker.removeMarkTargetHolder = function(targetElementName) {
        if(markContainer[targetElementName]) {
            delete markContainer[targetElementName];
        }
    }
});