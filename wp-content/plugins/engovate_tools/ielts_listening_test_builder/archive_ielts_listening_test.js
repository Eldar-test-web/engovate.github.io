jQuery(document).ready(function($) {
    // Initialize Select2 on the select element
    $('#ielts_listening_question_section_type').select2({
        placeholder: 'Select types...',
    });

    $('.post-locker').on('click', function(e) {
        e.preventDefault();
        $('.payment-popup-container').css('display', 'flex');
    });

    // Section-picker popup: each full-test card's "Practice a section" button opens a modal
    // listing that test's sections (from the button's data-sections JSON) to practice.
    var modal = document.getElementById('ielts-listening-section-modal');
    if (modal) {
        var titleEl = modal.querySelector('.ielts-listening-section-modal-title');
        var sectionListEl = modal.querySelector('.ielts-listening-section-modal-section-list');
        var partListEl    = modal.querySelector('.ielts-listening-section-modal-part-list');
        // Practice is a premium feature: non-premium learners get the FIRST item of each list free; the
        // rest are locked and open the upgrade popup instead of navigating.
        var isPremium = $('#is_premium').val() === '1';
        // Items carry only the section id / part number; the href is assembled here from the card's
        // practice base (permalink + ?type=) so the archive HTML doesn't repeat a full URL per entry.
        var renderLinks = function (targetEl, items, base, testId, kind) {
            targetEl.innerHTML = '';
            (items || []).forEach(function (s, idx) {
                var li = document.createElement('li');
                var a = document.createElement('a');
                // This lock is off for now, so every item opens for everyone. To turn it back on, use the line below:
                // var locked = !isPremium && idx > 0;
                var locked = false;
                if (locked) {
                    a.className = 'locked';
                    a.href = '/payment-plans/';
                } else {
                    a.href = base + (kind === 'section'
                        ? ('&src_test=' + testId + '&section=' + s.section)
                        : ('&p1_test=' + testId + '&p1_part=' + s.part));
                    a.target = '_blank'; a.rel = 'noopener';
                }
                var range = document.createElement('span');
                range.className = 'ielts-listening-section-modal-range';
                range.textContent = s.label;
                var type = document.createElement('span');
                type.className = 'ielts-listening-section-modal-type';
                type.textContent = s.type;
                a.appendChild(range); a.appendChild(type);
                if (locked) {
                    var lock = document.createElement('i');
                    lock.className = 'fa-solid fa-lock';
                    a.appendChild(lock);
                }
                li.appendChild(a); targetEl.appendChild(li);
            });
        };
        var openModal = function (title, sections, parts, base, testId) {
            titleEl.textContent = title || '';
            renderLinks(sectionListEl, sections, base, testId, 'section');
            renderLinks(partListEl, parts, base, testId, 'part');
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
        document.querySelectorAll('.ielts-listening-practice-section-button').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var sections = [], parts = [];
                try { sections = JSON.parse(btn.getAttribute('data-sections')) || []; } catch (e) {}
                try { parts = JSON.parse(btn.getAttribute('data-parts')) || []; } catch (e) {}
                // Base = the sentinel permalink (once, on the modal) + this card's category.
                var base = (modal.getAttribute('data-practice-permalink') || '')
                    + '?type=' + encodeURIComponent(btn.getAttribute('data-cat') || '');
                openModal(btn.getAttribute('data-test-title'), sections, parts,
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