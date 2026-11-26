jQuery(document).ready(function($) {

    // A category tab opens the archive for that category; "All" opens it with none.
    $('.ielts-grammar-test-category').on('click', function(e) {
        e.preventDefault();

        var categorySlug = $(this).data('categorySlug');
        var pathname = window.location.pathname;
        if (!pathname.endsWith('/')) {
            pathname += '/';
        }

        var newUrl = window.location.protocol + '//' + window.location.host + pathname;
        if (categorySlug) {
            newUrl += '?category=' + encodeURIComponent(categorySlug);
        }
        window.location.href = newUrl;
    });

    $('.ielts-grammar-test-search').on('submit', function(e) {
        e.preventDefault();

        var searchTerms = $(this).find('input[name="search_terms"]').val();
        var categorySlug = $(this).find('select[name="category_slug"]').val();
        var submitButton = $(this).find('button[type="submit"]');

        searchGrammarTests($('#tag-posts-search'), $('#tag-posts-search-pagination'), searchTerms, categorySlug, '', 1, function() {
            submitButton.prop('disabled', true);
            submitButton.text('Searching...');
        }, function() {
            submitButton.prop('disabled', false);
            submitButton.text('Search');
            $('.search-results').show();
        });
    });

    // Page links load that page of the search results or of a tag's tests in place.
    $(document).on('click', '.pagination a', function(e) {
        e.preventDefault();

        var paginationContainer = $(this).closest('.pagination');
        var tagSlug = paginationContainer.data('tagSlug');
        var tagPostsContainer = $('#tag-posts-' + tagSlug);
        var urlSegments = $(this).attr('href').split('/');
        var paged = urlSegments[urlSegments.length - 1];

        var categorySlug = '';
        var searchTerms = '';
        if (tagSlug === 'search') {
            tagSlug = '';
            searchTerms = $('.ielts-grammar-test-search').find('input[name="search_terms"]').val();
            categorySlug = $('.ielts-grammar-test-search').find('select[name="category_slug"]').val();
        } else {
            categorySlug = paginationContainer.data('categorySlug') || '';
        }

        searchGrammarTests(tagPostsContainer, paginationContainer, searchTerms, categorySlug, tagSlug, paged);
    });

    function searchGrammarTests(postsContainer, paginationContainer, searchTerms, categorySlug, tagSlug, paged, beforeSendCallback, completeCallback) {
        $.ajax({
            url: archive_ielts_grammar_test_ajax.ajaxurl,
            method: 'POST',
            data: {
                action: 'filter_ielts_grammar_tests',
                search_terms: searchTerms,
                category_slug: categorySlug,
                tag_slug: tagSlug,
                paged: paged,
                ielts_grammar_test_filter_nonce: $('#ielts_grammar_test_filter_nonce').val()
            },
            beforeSend: function() {
                postsContainer.css('pointer-events', 'none').animate({opacity: 0}, 'fast');
                paginationContainer.html('<div class="spinner"></div>');
                if (beforeSendCallback) {
                    beforeSendCallback();
                }
            },
            success: function(response) {
                if (response.success) {
                    var postsMarkup = '';
                    $.each(response.data.filtered_posts_data, function(index, post) {
                        postsMarkup += '<article id="post-' + post.id + '">';
                        postsMarkup += '<header class="post-header">';
                        postsMarkup += '<h3 class="post-title"><a href="' + post.permalink + '" rel="bookmark">' + post.title + '</a></h3>';
                        postsMarkup += '</header>';
                        postsMarkup += '<div class="post-content"><p>' + post.excerpt + '</p></div>';
                        postsMarkup += '<div class="post-footer">';
                        postsMarkup += '<a href="' + post.permalink + '" class="start-grammar-test-button">Start Test</a>';
                        postsMarkup += '</div>';
                        postsMarkup += '</article>';
                    });

                    if (postsMarkup === '') {
                        postsMarkup = 'No Grammar Tests Found!';
                    }

                    postsContainer.html(postsMarkup);
                    postsContainer.css('pointer-events', 'auto').animate({opacity: 1}, 'fast');
                    paginationContainer.html(response.data.paginate_links);
                } else {
                    alert((response.data && response.data.message) || 'Error loading grammar tests');
                }
            },
            error: function(xhr) {
                alert((xhr.responseJSON && xhr.responseJSON.data && xhr.responseJSON.data.message) || 'Error loading grammar tests');
            },
            complete: function() {
                if (completeCallback) {
                    completeCallback();
                }
            }
        });
    }
});
