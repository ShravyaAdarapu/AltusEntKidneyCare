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

})();

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
  const grid = document.querySelector('.gallery-category-grid');
  if (grid) {
    const cards = Array.from(grid.querySelectorAll('.gallery-shot'));
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    let active = cards[0];
    let visible = false;
    let timer;
    const dots = document.createElement('div');
    dots.className = 'gallery-slide-dots';
    dots.setAttribute('role', 'group');
    dots.setAttribute('aria-label', 'Featured photo slides');
    const slideButtons = [0, 1].map(index => {
      const button = document.createElement('button');
      button.type = 'button';
      button.setAttribute('aria-label', 'Show photo ' + (index + 1));
      button.addEventListener('click', () => {
        clearTimeout(timer);
        setSlide(index);
      });
      dots.append(button);
      return button;
    });

    function setSlide(index) {
      active.classList.toggle('show-alternate', index === 1);
      slideButtons.forEach((button, position) => button.setAttribute('aria-pressed', position === index));
    }

    function schedule() {
      clearTimeout(timer);
      if (visible && !motion.matches && !active.classList.contains('show-alternate')) {
        timer = setTimeout(() => setSlide(1), 3200);
      }
    }

    function select(card) {
      active.classList.remove('show-alternate');
      active.setAttribute('aria-pressed', 'false');
      active = card;
      active.setAttribute('aria-pressed', 'true');
      active.closest('figure').append(dots);
      setSlide(0);
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
      setSlide(0);
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

{
 const dialog=document.getElementById('clinicPhotoDialog');
 if(dialog){const image=dialog.querySelector('img');document.querySelectorAll('[data-photo]').forEach(button=>button.addEventListener('click',()=>{image.src=button.dataset.photo;image.alt=button.querySelector('img').alt;dialog.showModal();}));dialog.querySelector('button').addEventListener('click',()=>dialog.close());dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close();});dialog.addEventListener('close',()=>{image.removeAttribute('src');});}
}

// No third-party player or its JavaScript is requested before Play.
document.querySelectorAll('[data-youtube]').forEach(button=>button.addEventListener('click',()=>{
 const id=button.dataset.youtube;if(!/^[a-zA-Z0-9_-]{11}$/.test(id))return;
 const frame=document.createElement('iframe');frame.src='https://www.youtube-nocookie.com/embed/'+id+'?autoplay=1';frame.title=button.getAttribute('aria-label');frame.allow='autoplay; encrypted-media; picture-in-picture';frame.allowFullscreen=true;button.replaceWith(frame);frame.focus();
}));

// Keep motion continuous on screen while avoiding work in hidden sections/tabs.
if('IntersectionObserver' in window){const observer=new IntersectionObserver(entries=>entries.forEach(entry=>entry.target.classList.toggle('motion-idle',!entry.isIntersecting)));document.querySelectorAll('.care-columns').forEach(section=>observer.observe(section));}
document.addEventListener('visibilitychange',()=>document.documentElement.classList.toggle('page-hidden',document.hidden));
