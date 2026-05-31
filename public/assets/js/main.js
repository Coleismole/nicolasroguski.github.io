// Keep the site visible if forwarded previews or blockers fail to load motion CDNs.
(function installMotionFallback() {
  if (window.gsap && window.ScrollTrigger && window.ScrollToPlugin && window.Lenis) return;

  const loader = document.getElementById('loader');
  if (loader) loader.style.display = 'none';
  console.warn('Motion libraries unavailable; using static fallback.');

  const noop = () => {};
  const chain = { from: () => chain, to: () => chain, fromTo: () => chain };

  window.ScrollTrigger = window.ScrollTrigger || {
    update: noop,
    refresh: noop,
    create: () => ({ kill: noop })
  };

  window.ScrollToPlugin = window.ScrollToPlugin || {};

  window.gsap = window.gsap || {
    registerPlugin: noop,
    ticker: { add: noop, lagSmoothing: noop },
    timeline: () => chain,
    from: noop,
    to: noop,
    fromTo: noop,
    matchMedia: () => ({ add: noop }),
    utils: { toArray: selector => Array.from(document.querySelectorAll(selector)) }
  };

  window.Lenis = window.Lenis || class {
    on() {}
    raf() {}
    scrollTo(target) {
      if (target === 0) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        document.querySelector(target)?.scrollIntoView({ behavior: 'smooth' });
      }
    }
    stop() {}
    start() {}
  };
})();

// ── GSAP + Lenis setup ────────────────────────────────────────────────────────
gsap.registerPlugin(ScrollTrigger, ScrollToPlugin);

const lenis = new Lenis({ lerp: 0.12, smoothWheel: true, wheelMultiplier: 1.2, touchMultiplier: 1.8 });
lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.add((time) => lenis.raf(time * 1000));
gsap.ticker.lagSmoothing(0);

// ── Dark mode (system preference + manual toggle) ──────────────────────────────
const html = document.documentElement;
const darkToggle = document.getElementById('dark-toggle');
const savedDark = localStorage.getItem('dark');
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
if (savedDark === '1' || (savedDark === null && prefersDark)) {
  html.classList.add('dark');
  darkToggle.textContent = '○';
}
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
  if (localStorage.getItem('dark') === null) {
    html.classList.toggle('dark', e.matches);
    darkToggle.textContent = e.matches ? '○' : '☽';
  }
});
darkToggle.addEventListener('click', () => {
  html.classList.toggle('dark');
  const on = html.classList.contains('dark');
  darkToggle.textContent = on ? '○' : '☽';
  localStorage.setItem('dark', on ? '1' : '0');
});

// ── Page load reveal ───────────────────────────────────────────────────────────
window.addEventListener('pageshow', (e) => {
  document.getElementById('page-overlay').classList.remove('active');
  document.body.classList.add('loaded');
  if (e.persisted) {
    const loader = document.getElementById('loader');
    if (loader) { loader.style.display = 'none'; }
    startHeroAnimation();
  }
});

// ── Hero entrance animation (called after loader exits) ────────────────────────
function startHeroAnimation() {
  const heroTl = gsap.timeline({ delay: 0.05 });
  heroTl
    .from('.hero-eyebrow', { y: 22, opacity: 0, duration: 0.8, ease: 'power3.out' })
    .from('.hero-role',    { y: 16, opacity: 0, duration: 0.6, ease: 'power2.out' }, '-=0.5')
    .from('.hero-name-line > *', {
      y: '105%', duration: 1.05, ease: 'power4.out', stagger: 0.12
    }, '-=0.4')
    .from('.hero-tagline',   { y: 24, opacity: 0, duration: 0.8, ease: 'power2.out' }, '-=0.55')
    .from('.hero-cta',       { y: 20, opacity: 0, duration: 0.7, ease: 'power2.out' }, '-=0.5')
    .from('.hero-stat-strip',{ y: 18, opacity: 0, duration: 0.7, ease: 'power2.out' }, '-=0.45')
    .from('.hero-photo-wrap',{ scale: 1.06, opacity: 0, duration: 1.3, ease: 'power3.out' }, '-=0.9');
}

// ── Loader sequence ────────────────────────────────────────────────────────────
(function runLoader() {
  const loader    = document.getElementById('loader');
  const loaderNum = loader.querySelector('.loader-num');
  const loaderBar = document.getElementById('loader-bar');

  gsap.from('.loader-logo',  { y: -16, opacity: 0, duration: 0.6, ease: 'power2.out', delay: 0.1 });
  gsap.from('.loader-center',{ y: 20,  opacity: 0, duration: 0.7, ease: 'power2.out', delay: 0.2 });

  const counter = { val: 0 };
  gsap.to(counter, {
    val: 100,
    duration: 1.55,
    delay: 0.35,
    ease: 'power1.inOut',
    onUpdate() {
      const v = Math.round(counter.val);
      loaderNum.textContent = v;
      loaderBar.style.width = v + '%';
    },
    onComplete() {
      gsap.to(loader, {
        yPercent: -100,
        duration: 0.78,
        delay: 0.18,
        ease: 'power3.inOut',
        onComplete() {
          loader.style.display = 'none';
          startHeroAnimation();
          ScrollTrigger.refresh();
        }
      });
    }
  });
})();

// ── Hero photo parallax on scroll ─────────────────────────────────────────────
gsap.to('.hero-photo-wrap', {
  yPercent: 12,
  ease: 'none',
  scrollTrigger: {
    trigger: '.hero',
    start: 'top top',
    end: 'bottom top',
    scrub: true
  }
});

// ── Nav shrink on scroll ───────────────────────────────────────────────────────
ScrollTrigger.create({
  start: 'top -60',
  onEnter: () => document.getElementById('main-nav').classList.add('scrolled'),
  onLeaveBack: () => document.getElementById('main-nav').classList.remove('scrolled')
});

// ── Scroll progress bar + back-to-top ring ────────────────────────────────────
const progressBar = document.getElementById('scroll-progress');
const backToTop = document.getElementById('back-to-top');
const ringFill = document.getElementById('btt-ring-fill');
const RING_CIRC = 2 * Math.PI * 18;
if (ringFill) { ringFill.style.strokeDasharray = RING_CIRC; ringFill.style.strokeDashoffset = RING_CIRC; }
lenis.on('scroll', ({ progress }) => {
  progressBar.style.width = (progress * 100) + '%';
  backToTop.classList.toggle('visible', progress > 0.12);
  if (ringFill) ringFill.style.strokeDashoffset = RING_CIRC * (1 - progress);
});

// ── Active nav highlight ───────────────────────────────────────────────────────
const navLinks = document.querySelectorAll('.nav-links a');
document.querySelectorAll('section[id]').forEach(section => {
  ScrollTrigger.create({
    trigger: section,
    start: 'top 45%',
    end: 'bottom 45%',
    onEnter: () => setActive(section.id),
    onEnterBack: () => setActive(section.id)
  });
});
function setActive(id) {
  navLinks.forEach(link => {
    link.classList.toggle('active', link.getAttribute('href') === '#' + id);
  });
}

// ── Smooth anchor scroll via Lenis ────────────────────────────────────────────
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', e => {
    const href = anchor.getAttribute('href');
    if (href === '#') return;
    e.preventDefault();
    lenis.scrollTo(href, { offset: -72, duration: 1.4, easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)) });
  });
});

// ── Section title clip reveals ─────────────────────────────────────────────────
document.querySelectorAll('.title-clip .section-title').forEach(el => {
  gsap.from(el, {
    y: '108%',
    duration: 1.0,
    ease: 'power4.out',
    scrollTrigger: { trigger: el.parentElement, start: 'top 88%' }
  });
});

// ── Section labels slide in ────────────────────────────────────────────────────
gsap.utils.toArray('.section-label').forEach(el => {
  gsap.from(el, {
    x: -20, opacity: 0, duration: 0.7, ease: 'power2.out',
    scrollTrigger: { trigger: el, start: 'top 90%' }
  });
});

// ── About section ─────────────────────────────────────────────────────────────
gsap.from('.about-text', {
  x: -50, opacity: 0, duration: 1.1, ease: 'power3.out',
  scrollTrigger: { trigger: '#about', start: 'top 72%' }
});
gsap.from('.about-sidebar', {
  x: 50, opacity: 0, duration: 1.1, ease: 'power3.out',
  scrollTrigger: { trigger: '#about', start: 'top 72%' }
});
gsap.from('.about-body', {
  y: 20, opacity: 0, duration: 0.7, ease: 'power2.out', stagger: 0.15,
  scrollTrigger: { trigger: '.about-text', start: 'top 75%' }
});
gsap.from('.about-card', {
  y: 30, opacity: 0, duration: 0.6, ease: 'power2.out', stagger: 0.12,
  scrollTrigger: { trigger: '.about-sidebar', start: 'top 75%' }
});

// ── Timeline draw animation ────────────────────────────────────────────────────
gsap.from('.timeline-line', {
  scaleY: 0,
  transformOrigin: 'top center',
  duration: 1.4,
  ease: 'power2.out',
  scrollTrigger: { trigger: '.timeline', start: 'top 78%' }
});
gsap.from('.timeline-item', {
  x: -44, opacity: 0, duration: 0.8, ease: 'power3.out', stagger: 0.28,
  scrollTrigger: { trigger: '.timeline', start: 'top 78%' }
});

// ── Skills stagger + bar fills ─────────────────────────────────────────────────
gsap.from('.skill-item', {
  y: 50, opacity: 0, duration: 0.75, ease: 'power3.out', stagger: 0.1,
  scrollTrigger: { trigger: '.skills-grid', start: 'top 75%' }
});

document.querySelectorAll('.skill-bar-fill').forEach(bar => {
  const targetWidth = bar.dataset.width;
  gsap.fromTo(bar,
    { width: 0 },
    {
      width: targetWidth + '%',
      duration: 1.4,
      ease: 'power2.out',
      scrollTrigger: { trigger: bar, start: 'top 90%' }
    }
  );
});

// ── Projects horizontal scroll (desktop only) ─────────────────────────────────
const mm = gsap.matchMedia();

mm.add('(min-width: 900px)', () => {
  const outer = document.querySelector('.projects-horizontal-outer');
  const track = document.querySelector('.projects-horizontal-track');

  const getScrollDistance = () => track.scrollWidth - outer.offsetWidth;

  const hScroll = gsap.to(track, {
    x: () => -getScrollDistance(),
    ease: 'none',
    scrollTrigger: {
      trigger: '#projects',
      pin: true,
      anticipatePin: 1,
      scrub: 1.2,
      end: () => '+=' + getScrollDistance(),
      invalidateOnRefresh: true
    }
  });

  gsap.from('.project-card', {
    opacity: 0,
    x: 60,
    duration: 0.9,
    ease: 'power3.out',
    stagger: 0.15,
    scrollTrigger: { trigger: '#projects', start: 'top 75%' }
  });

  return () => { hScroll.scrollTrigger.kill(); };
});

mm.add('(max-width: 899px)', () => {
  gsap.from('.project-card', {
    y: 40, opacity: 0, duration: 0.8, ease: 'power3.out', stagger: 0.15,
    scrollTrigger: { trigger: '.projects-horizontal-track', start: 'top 80%' }
  });
});

// ── Contact reveal ─────────────────────────────────────────────────────────────
gsap.from('.contact-left', {
  x: -50, opacity: 0, duration: 1.1, ease: 'power3.out',
  scrollTrigger: { trigger: '#contact', start: 'top 75%' }
});
gsap.from('.contact-right', {
  x: 50, opacity: 0, duration: 1.1, ease: 'power3.out',
  scrollTrigger: { trigger: '#contact', start: 'top 75%' }
});
gsap.from('.contact-info-item', {
  y: 20, opacity: 0, duration: 0.6, ease: 'power2.out', stagger: 0.12,
  scrollTrigger: { trigger: '.contact-info', start: 'top 82%' }
});
gsap.from('.contact-sub', {
  y: 16, opacity: 0, duration: 0.7, ease: 'power2.out',
  scrollTrigger: { trigger: '.contact-sub', start: 'top 88%' }
});
gsap.from('.contact-form input, .contact-form textarea', {
  y: 20, opacity: 0, duration: 0.55, ease: 'power2.out', stagger: 0.09,
  scrollTrigger: { trigger: '.contact-form', start: 'top 82%' }
});

// ── Scroll-reveal hint pulsing ─────────────────────────────────────────────────
gsap.from('.projects-scroll-hint', {
  opacity: 0, y: 10, duration: 0.6, ease: 'power2.out',
  scrollTrigger: { trigger: '#projects', start: 'top 80%' }
});

// ── Counting stat animation ────────────────────────────────────────────────────
const countEls = document.querySelectorAll('[data-count]');
countEls.forEach(el => {
  const target = parseInt(el.dataset.count);
  const suffix = el.dataset.suffix || '';
  ScrollTrigger.create({
    trigger: el,
    start: 'top 85%',
    once: true,
    onEnter: () => {
      gsap.fromTo({ val: 0 }, { val: target, duration: 1.4, ease: 'power2.out',
        onUpdate: function() { el.textContent = Math.round(this.targets()[0].val) + suffix; }
      });
    }
  });
});

// ── Hamburger menu ─────────────────────────────────────────────────────────────
const hamburger = document.getElementById('nav-hamburger');
const navMenu = document.getElementById('nav-links');
hamburger.addEventListener('click', () => {
  hamburger.classList.toggle('open');
  navMenu.classList.toggle('open');
});
navMenu.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => {
    hamburger.classList.remove('open');
    navMenu.classList.remove('open');
  });
});

// ── Custom cursor (already uses rAF loop internally) ──────────────────────────
const dot = document.getElementById('cursor-dot');
const ring = document.getElementById('cursor-ring');
let mx = -100, my = -100, rx = -100, ry = -100;
document.addEventListener('mousemove', e => { mx = e.clientX; my = e.clientY; });
(function animateCursor() {
  rx += (mx - rx) * 0.18;
  ry += (my - ry) * 0.18;
  dot.style.left = mx + 'px'; dot.style.top = my + 'px';
  ring.style.left = rx + 'px'; ring.style.top = ry + 'px';
  requestAnimationFrame(animateCursor);
})();
document.querySelectorAll('a, button, .skill-item, .project-card').forEach(el => {
  el.addEventListener('mouseenter', () => document.body.classList.add('cursor-hover'));
  el.addEventListener('mouseleave', () => document.body.classList.remove('cursor-hover'));
});

// ── Back to top ────────────────────────────────────────────────────────────────
backToTop.addEventListener('click', () => lenis.scrollTo(0, { duration: 1.6 }));

// ── Page transitions (outbound links to sub-pages) ────────────────────────────
const overlay = document.getElementById('page-overlay');
document.querySelectorAll('a[href]').forEach(link => {
  const href = link.getAttribute('href');
  if (href && !href.startsWith('#') && !href.startsWith('http') && !href.startsWith('mailto')) {
    link.addEventListener('click', e => {
      e.preventDefault();
      overlay.classList.add('active');
      setTimeout(() => { window.location.href = href; }, 360);
    });
  }
});

// ── Typewriter effect ──────────────────────────────────────────────────────────
const words = ['Student', 'Researcher', 'Scientist', 'Future Clinician', 'Curious Mind'];
const tw = document.getElementById('typewriter-text');
let wi = 0, ci = 0, deleting = false;
function typeLoop() {
  const word = words[wi];
  if (!deleting) {
    tw.textContent = word.slice(0, ++ci);
    if (ci === word.length) { deleting = true; setTimeout(typeLoop, 1800); return; }
  } else {
    tw.textContent = word.slice(0, --ci);
    if (ci === 0) { deleting = false; wi = (wi + 1) % words.length; setTimeout(typeLoop, 300); return; }
  }
  setTimeout(typeLoop, deleting ? 55 : 90);
}
setTimeout(typeLoop, 1200);

// ── 3D card tilt + glare (uses rAF internally) ────────────────────────────────
document.querySelectorAll('.project-card').forEach(card => {
  const glare = document.createElement('div');
  glare.className = 'project-card-glare';
  card.appendChild(glare);
  const inner = card.querySelector('.project-card-inner');
  let rafId = null, curRx = 0, curRy = 0, tgtRx = 0, tgtRy = 0, mouseX = 50, mouseY = 50, active = false;
  function animateTilt() {
    curRx += (tgtRx - curRx) * 0.1;
    curRy += (tgtRy - curRy) * 0.1;
    card.style.transition = 'none';
    card.style.transform = `perspective(1200px) rotateX(${curRx}deg) rotateY(${curRy}deg) translateY(-4px)`;
    card.style.boxShadow = `${-curRy * 1.2}px ${curRx * 1.2}px 36px rgba(28,42,74,0.13)`;
    glare.style.setProperty('--gx', mouseX + '%');
    glare.style.setProperty('--gy', mouseY + '%');
    if (inner) {
      inner.style.transition = 'none';
      inner.style.transform = `translateX(${curRy * -1.4}px) translateY(${curRx * 1.4}px)`;
    }
    if (active || Math.abs(curRx) > 0.05 || Math.abs(curRy) > 0.05) {
      rafId = requestAnimationFrame(animateTilt);
    } else {
      curRx = 0; curRy = 0;
      card.style.transition = 'transform 0.4s ease, box-shadow 0.4s ease';
      card.style.transform = '';
      card.style.boxShadow = '';
      if (inner) { inner.style.transition = 'transform 0.4s ease'; inner.style.transform = ''; }
      rafId = null;
    }
  }
  card.addEventListener('mouseenter', () => { active = true; if (!rafId) rafId = requestAnimationFrame(animateTilt); });
  card.addEventListener('mousemove', e => {
    const r = card.getBoundingClientRect();
    tgtRx = ((e.clientY - r.top  - r.height / 2) / r.height) * -5;
    tgtRy = ((e.clientX - r.left - r.width  / 2) / r.width)  *  5;
    mouseX = ((e.clientX - r.left) / r.width)  * 100;
    mouseY = ((e.clientY - r.top)  / r.height) * 100;
  });
  card.addEventListener('mouseleave', () => { active = false; tgtRx = 0; tgtRy = 0; });
});

// ── Copy email ─────────────────────────────────────────────────────────────────
const copyToast = document.getElementById('copy-toast');
let toastTimer;
window.copyEmail = function() {
  navigator.clipboard.writeText('coleroguski@gmail.com').then(() => {
    clearTimeout(toastTimer);
    copyToast.classList.add('show');
    toastTimer = setTimeout(() => copyToast.classList.remove('show'), 2200);
  });
};

// ── CV Modal ───────────────────────────────────────────────────────────────────
const cvModal = document.getElementById('cv-modal');
const cvIframe = document.getElementById('cv-iframe');
let cvLoaded = false;
window.openCVModal = function() {
  if (!cvLoaded) { cvIframe.src = 'assets/pdf/nicolas-roguski-cv.pdf'; cvLoaded = true; }
  cvModal.classList.add('open');
  document.body.style.overflow = 'hidden';
  lenis.stop();
};
window.closeCVModal = function() {
  cvModal.classList.remove('open');
  document.body.style.overflow = '';
  lenis.start();
};
document.addEventListener('keydown', e => { if (e.key === 'Escape') window.closeCVModal(); });

// ── Animated tab title ─────────────────────────────────────────────────────────
const origTitle = document.title;
document.addEventListener('visibilitychange', () => {
  document.title = document.hidden ? '👋 Come back — N. Roguski' : origTitle;
});

// ── Contact form via Formspree ─────────────────────────────────────────────────
async function handleSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const btn = form.querySelector('button');
  btn.textContent = 'Sending…';
  btn.disabled = true;
  try {
    const res = await fetch('https://formspree.io/f/xzdwyynv', {
      method: 'POST', body: new FormData(form), headers: { 'Accept': 'application/json' }
    });
    if (res.ok) {
      btn.textContent = 'Message sent ✓';
      btn.style.background = '#3d6147'; btn.style.borderColor = '#3d6147'; btn.style.color = '#f5f0e8';
      form.reset();
      setTimeout(() => {
        btn.textContent = 'Send message';
        btn.style.background = ''; btn.style.borderColor = ''; btn.style.color = ''; btn.disabled = false;
      }, 3500);
    } else {
      btn.textContent = 'Error — try again'; btn.disabled = false;
      setTimeout(() => { btn.textContent = 'Send message'; }, 3000);
    }
  } catch {
    btn.textContent = 'Error — try again'; btn.disabled = false;
    setTimeout(() => { btn.textContent = 'Send message'; }, 3000);
  }
}

(() => {
  const form = document.getElementById('contact-form');
  const sendBtn = document.getElementById('contact-send');
  if (!form || !sendBtn) return;

  form.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' && ev.target && ev.target.tagName !== 'TEXTAREA') {
      ev.preventDefault();
    }
  });

  form.addEventListener('submit', handleSubmit);

  sendBtn.addEventListener('click', () => {
    if (typeof form.requestSubmit === 'function') {
      form.requestSubmit();
    } else {
      form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    }
  });
})();
