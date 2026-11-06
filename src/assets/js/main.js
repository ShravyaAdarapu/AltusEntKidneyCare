(function () {
  // Reveal on scroll
  if ('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const innerPage = document.querySelector('main > .page-hero')?.parentElement;
    if (innerPage) {
      innerPage.querySelectorAll('.inner-photo-banner, .about-photo, .contact-intro img, .about-facts > div, .section .post, .contact-panel')
        .forEach(element => element.classList.add('reveal', 'inner-reveal'));
    }
  }
  var items = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { threshold: 0.12 });
    items.forEach(function (el) { io.observe(el); });
  } else {
    items.forEach(function (el) { el.classList.add('in'); });
  }

  // Portrait fallback: show monogram if photo fails
  document.querySelectorAll('.portrait img').forEach(function (img) {
    img.addEventListener('error', function () { img.remove(); });
  });

  // Appointment form -> WhatsApp message to the clinic
  var form = document.getElementById('bookingForm');
  if (!form) return;
  var CLINIC_WA = '919966881811';
  var date = form.querySelector('[name=date]');
  var today = new Date();
  date.min = today.toISOString().slice(0, 10);

  var doctorSel = form.querySelector('[name=doctor]');
  var params = new URLSearchParams(location.search);
  function syncDoctor() {
    var spec = form.querySelector('[name=specialty]:checked').value;
    doctorSel.value = spec === 'Kidney Care' ? 'Dr. Chetan Veeramaneni' : 'Dr. T. Mounika';
  }
  form.querySelectorAll('[name=specialty]').forEach(function (r) { r.addEventListener('change', syncDoctor); });
  if (params.get('s') === 'ent') form.querySelector('#spec-ent').checked = true;
  syncDoctor();

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!form.reportValidity()) return;
    var d = new FormData(form);
    var lines = [
      'Hello Altus, I would like to book an appointment.',
      '',
      'Name: ' + d.get('name'),
      'Phone: ' + d.get('phone'),
      'Age: ' + (d.get('age') || '-'),
      'Speciality: ' + d.get('specialty'),
      'Doctor: ' + d.get('doctor'),
      'Preferred date: ' + d.get('date'),
      'Preferred time: ' + d.get('slot'),
      'Visit type: ' + d.get('visit'),
      'Concern: ' + (d.get('message') || '-')
    ];
    var url = 'https://wa.me/' + CLINIC_WA + '?text=' + encodeURIComponent(lines.join('\n'));
    document.getElementById('formSuccess').classList.add('show');
    window.open(url, '_blank', 'noopener');
  });
})();

{
  const contactForm = document.getElementById('contactForm');
  if (contactForm) {
    contactForm.addEventListener('submit', event => {
      event.preventDefault();
      const fields = new FormData(contactForm);
      const message = [
        '*Website enquiry | Altus ENT & Kidney Care*',
        '',
        'Hello Altus team, I’d like your help with the enquiry below.',
        '',
        '*Name:* ' + fields.get('name').trim(),
        '*Callback number:* ' + fields.get('phone').trim(),
        '',
        '*My enquiry*',
        fields.get('message').trim(),
        '',
        'Thank you.'
      ].join('\n');
      window.open('https://wa.me/' + contactForm.dataset.whatsapp + '?text=' + encodeURIComponent(message), '_blank', 'noopener');
    });
  }
}

{
  const metrics = document.querySelector('.care-metrics');
  if (metrics && 'IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const observer = new IntersectionObserver(entries => {
      if (!entries[0].isIntersecting) return;
      observer.disconnect();
      const numbers = [...metrics.querySelectorAll('[data-metric]')];
      const start = performance.now();
      function render(now) {
        const progress = Math.min(1, (now - start) / 850);
        numbers.forEach(number => {
          number.textContent = Math.round(Number(number.dataset.metric) * (1 - (1 - progress) ** 3)).toLocaleString('en-IN');
        });
        if (progress < 1) requestAnimationFrame(render);
      }
      requestAnimationFrame(render);
    });
    observer.observe(metrics);
  }
}

{
  const calendar = document.getElementById('bookingCalendar');
  if (calendar) {
    const dateInput = document.getElementById('f-date');
    const timeInput = document.getElementById('f-slot');
    const clinicClock = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    });
    function clinicNow() {
      const parts = Object.fromEntries(clinicClock.formatToParts(new Date()).map(part => [part.type, part.value]));
      return { date: [parts.year, parts.month, parts.day].join('-'), minutes: Number(parts.hour) * 60 + Number(parts.minute) };
    }
    function dateKey(date) {
      return [date.getFullYear(), date.getMonth() + 1, date.getDate()].map(value => String(value).padStart(2, '0')).join('-');
    }
    const [year, month, day] = clinicNow().date.split('-').map(Number);
    let selected = new Date(year, month - 1, day);
    let visible = new Date(year, month - 1, 1);
    let selectedTime = null;
    const monthLabel = new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' });
    const dateLabel = new Intl.DateTimeFormat('en-IN', { dateStyle: 'full' });
    const clock = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' });
    const schedule = Array.from({ length: 18 }, (_, index) => {
      const minutes = 600 + index * 30;
      return { minutes, label: clock.format(new Date(2000, 0, 1, 0, minutes)) };
    });
    function slotsFor(date, now) {
      if (date < now.date) return [];
      return schedule.filter(slot => date > now.date || slot.minutes > now.minutes);
    }

    function render(focusSelector) {
      const y = visible.getFullYear();
      const m = visible.getMonth();
      const days = new Date(y, m + 1, 0).getDate();
      const now = clinicNow();
      const key = dateKey(selected);
      const times = slotsFor(key, now);
      if (!times.some(slot => slot.minutes === selectedTime)) selectedTime = times[0]?.minutes ?? null;
      dateInput.min = now.date;
      dateInput.value = key;
      timeInput.replaceChildren(...times.map(slot => new Option(slot.label, slot.label)));
      timeInput.selectedIndex = times.findIndex(slot => slot.minutes === selectedTime);
      calendar.innerHTML = `
        <div class="booking-calendar-panel"><div class="booking-month"><strong>${monthLabel.format(visible)}</strong>
          <div><button type="button" data-month="-1" aria-label="Previous month" ${dateKey(visible).slice(0, 7) <= now.date.slice(0, 7) ? 'disabled' : ''}>‹</button>
          <button type="button" data-month="1" aria-label="Next month">›</button></div>
        </div>
        <div class="booking-days">
          ${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(label => `<span aria-hidden="true">${label}</span>`).join('')}
          ${'<span></span>'.repeat(visible.getDay())}
          ${Array.from({ length: days }, (_, index) => {
            const candidate = new Date(y, m, index + 1);
            return `<button type="button" data-day="${index + 1}" aria-label="${dateLabel.format(candidate)}" aria-pressed="${+candidate === +selected}" ${dateKey(candidate) < now.date ? 'disabled' : ''}>${String(index + 1).padStart(2, '0')}</button>`;
          }).join('')}
        </div>
        </div>
        <strong class="booking-time-label">Preferred time</strong>
        <div class="booking-times">${times.map(slot => `<button type="button" data-time="${slot.minutes}" aria-pressed="${slot.minutes === selectedTime}">${slot.label}</button>`).join('') || '<p>No times left for this date. Choose another date.</p>'}</div>`;
      if (focusSelector) (calendar.querySelector(focusSelector + ':not(:disabled)') || calendar.querySelector('[data-month="1"]')).focus();
    }

    calendar.addEventListener('click', event => {
      const button = event.target.closest('button');
      if (!button) return;
      const { month: move, day: picked, time } = button.dataset;
      if (move) visible = new Date(visible.getFullYear(), visible.getMonth() + Number(move), 1);
      if (picked) {
        selected = new Date(visible.getFullYear(), visible.getMonth(), Number(picked));
        selectedTime = null;
      }
      if (time !== undefined) selectedTime = Number(time);
      const attribute = move ? 'month' : picked ? 'day' : 'time';
      document.getElementById('bookingSlotStatus').textContent = '';
      render('[data-' + attribute + '="' + button.dataset[attribute] + '"]');
    });

    dateInput.form.addEventListener('submit', event => {
      if (slotsFor(dateKey(selected), clinicNow()).some(slot => slot.minutes === selectedTime)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      render();
      document.getElementById('bookingSlotStatus').textContent = 'That time has passed or no slots remain. Choose another time or date.';
      calendar.querySelector('[data-time], [data-month="1"]').focus();
    }, true);

    render();
    calendar.hidden = false;
    document.getElementById('bookingDateFallback').hidden = true;
    document.getElementById('bookingTimeFallback').hidden = true;
  }
}

{
  const grid = document.querySelector('.gallery-category-grid');
  if (grid) {
    const cards = Array.from(grid.querySelectorAll('.gallery-shot'));
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    let active = cards[0];
    let visible = false;
    let timer;

    function schedule() {
      clearTimeout(timer);
      if (visible && !motion.matches && !active.classList.contains('show-alternate')) {
        timer = setTimeout(() => active.classList.add('show-alternate'), 3200);
      }
    }

    function select(card) {
      active.classList.remove('show-alternate');
      active.setAttribute('aria-pressed', 'false');
      active = card;
      active.setAttribute('aria-pressed', 'true');
      schedule();
    }

    cards.forEach(card => card.addEventListener('click', () => {
      if (card === active) return;
      const figures = cards.map(item => item.closest('figure'));
      figures.forEach(figure => figure.getAnimations().forEach(animation => animation.cancel()));
      const before = motion.matches ? null : figures.map(figure => figure.getBoundingClientRect());
      select(card);
      if (!before) return;
      figures.forEach((figure, index) => {
        const after = figure.getBoundingClientRect();
        const x = before[index].left - after.left;
        const y = before[index].top - after.top;
        if (x || y) figure.animate(
          [{ transform: 'translate(' + x + 'px,' + y + 'px)' }, { transform: 'none' }],
          { duration: 360, easing: 'cubic-bezier(.22,.61,.36,1)' }
        );
      });
    }));
    motion.addEventListener('change', () => {
      active.classList.remove('show-alternate');
      schedule();
    });
    select(active);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(entries => {
        visible = entries[0].isIntersecting;
        schedule();
      }).observe(grid);
    }
  }
}

{
  const sections = document.querySelectorAll('[data-gallery-focus]');
  if (sections.length && 'IntersectionObserver' in window) {
    const focusObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => entry.target.classList.toggle('gallery-in-focus', entry.isIntersecting));
    }, { rootMargin: '-12% 0px -24% 0px' });
    sections.forEach(section => focusObserver.observe(section));
  }
}
