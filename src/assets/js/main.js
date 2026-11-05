(function () {
  // Reveal on scroll
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
