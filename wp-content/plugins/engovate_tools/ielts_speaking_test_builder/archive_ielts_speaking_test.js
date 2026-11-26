jQuery(document).ready(function($) {
    // Initialize Select2 on the select element
    $('#ielts_speaking_question_section_type').select2({
        placeholder: 'Select types...',
    });

    $('.post-locker').on('click', function(e) {
        e.preventDefault();
        $('.payment-popup-container').css('display', 'flex');
    });

    // Part-picker popup: each full-test card's "Practice a part" button opens a modal listing that
    // test's parts (from the button's data-parts JSON) to practice.
    var modal = document.getElementById('ielts-speaking-part-modal');
    if (modal) {
        var titleEl = modal.querySelector('.ielts-speaking-part-modal-title');
        var listEl  = modal.querySelector('.ielts-speaking-part-modal-list');
        // Practice is a premium feature: non-premium learners get the FIRST part free; the rest are locked
        // and open the upgrade popup instead of navigating.
        var isPremium = $('#is_premium').val() === '1';
        // Items carry only the section id; the href is assembled here from the card's practice base
        // (permalink + ?type=) so the archive HTML doesn't repeat a full URL per entry.
        var openModal = function (title, parts, base, testId) {
            titleEl.textContent = title || '';
            listEl.innerHTML = '';
            (parts || []).forEach(function (p, idx) {
                var li = document.createElement('li');
                var a = document.createElement('a');
                // This lock is off for now, so every item opens for everyone. To turn it back on, use the line below:
                // var locked = !isPremium && idx > 0;
                var locked = false;
                if (locked) {
                    a.className = 'locked';
                    a.href = '/payment-plans/';
                } else {
                    a.href = base + '&src_test=' + testId + '&section=' + p.section;
                    a.target = '_blank'; a.rel = 'noopener';
                }
                var range = document.createElement('span');
                range.className = 'ielts-speaking-part-modal-range';
                range.textContent = p.label;
                var type = document.createElement('span');
                type.className = 'ielts-speaking-part-modal-type';
                type.textContent = p.type;
                a.appendChild(range); a.appendChild(type);
                if (locked) {
                    var lock = document.createElement('i');
                    lock.className = 'fa-solid fa-lock';
                    a.appendChild(lock);
                }
                li.appendChild(a); listEl.appendChild(li);
            });
            modal.hidden = false;
            document.body.style.overflow = 'hidden';
        };
        var closeModal = function () {
            modal.hidden = true;
            document.body.style.overflow = '';
        };
        // A locked list item opens the upgrade popup instead of navigating.
        $(modal).on('click', 'a.locked', function (e) {
            e.preventDefault();
            $('.payment-popup-container').css('display', 'flex');
        });
        document.querySelectorAll('.ielts-speaking-practice-part-button').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var parts = [];
                try { parts = JSON.parse(btn.getAttribute('data-parts')) || []; } catch (e) {}
                // Base = the sentinel permalink (once, on the modal) + this card's category.
                var base = (modal.getAttribute('data-practice-permalink') || '')
                    + '?type=' + encodeURIComponent(btn.getAttribute('data-cat') || '');
                openModal(btn.getAttribute('data-test-title'), parts,
                    base, btn.getAttribute('data-test-id') || '');
            });
        });
        modal.querySelectorAll('[data-close]').forEach(function (el) {
            el.addEventListener('click', closeModal);
        });
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && !modal.hidden) closeModal();
        });
    }
});