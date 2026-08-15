/* ============ OPENING SEQUENCE ============ */

const loadingScreen = document.getElementById('loading-screen');
const openCard = document.getElementById('open-card');
const openBtn = document.getElementById('open-btn');
const groove = document.getElementById('groove-reveal');
const opening = document.getElementById('opening');
const site = document.getElementById('site');
const pctLabel = document.getElementById('loading-pct');

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Preload the assets that actually gate a "ready" page: hero fonts + first
// section's imagery. Swap the placeholder array for real asset URLs.
const assetsToPreload = [
  // 'assets/hero.jpg',
];

function preload(urls) {
  if (!urls.length) return Promise.resolve();
  return Promise.all(
    urls.map(
      (src) =>
        new Promise((resolve) => {
          const img = new Image();
          img.onload = img.onerror = resolve;
          img.src = src;
        })
    )
  );
}

let pct = 0;
const loadingTimer = setInterval(() => {
  pct = Math.min(100, pct + Math.round(4 + Math.random() * 10));
  pctLabel.textContent = `${pct}%`;
  if (pct >= 100) clearInterval(loadingTimer);
}, 150);

preload(assetsToPreload).then(() => {
  const finish = () => {
    loadingScreen.hidden = true;
    openCard.hidden = false;
  };
  // wait for the visual counter to actually reach 100 before revealing the card
  const waitForCount = setInterval(() => {
    if (pct >= 100) {
      clearInterval(waitForCount);
      setTimeout(finish, 250);
    }
  }, 100);
});

openBtn.addEventListener('click', () => {
  const rect = openBtn.getBoundingClientRect();
  const originX = rect.left + rect.width / 2;
  const originY = rect.top + rect.height / 2;

  groove.style.left = `${originX}px`;
  groove.style.top = `${originY}px`;

  openCard.hidden = true;

  const maxDim = Math.max(window.innerWidth, window.innerHeight) * 2.2;

  if (prefersReducedMotion) {
    opening.remove();
    site.hidden = false;
    runHeroReveal();
    return;
  }

  gsap.to(groove, {
    scale: maxDim / 20,
    duration: 0.9,
    ease: 'power3.out',
    onComplete: () => {
      opening.remove();
      site.hidden = false;
      runHeroReveal();
    },
  });
});

/* ============ HERO + SCROLL REVEALS ============ */

function runHeroReveal() {
  gsap.to('.hero .reveal-up', {
    opacity: 1,
    y: 0,
    duration: 0.8,
    stagger: 0.12,
    ease: 'power2.out',
  });

  if (typeof ScrollTrigger !== 'undefined') {
    gsap.registerPlugin(ScrollTrigger);
    document.querySelectorAll('section:not(.hero) .reveal-up').forEach((el) => {
      gsap.to(el, {
        opacity: 1,
        y: 0,
        duration: 0.8,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: el,
          start: 'top 85%',
        },
      });
    });
  }

  startCountdown();
}

/* ============ COUNTDOWN ============ */

function startCountdown() {
  const el = document.getElementById('countdown');
  const target = new Date(el.dataset.date).getTime();

  function tick() {
    const diff = Math.max(0, target - Date.now());
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);

    el.querySelector('[data-unit="days"]').textContent = String(days).padStart(2, '0');
    el.querySelector('[data-unit="hours"]').textContent = String(hours).padStart(2, '0');
    el.querySelector('[data-unit="minutes"]').textContent = String(minutes).padStart(2, '0');
    el.querySelector('[data-unit="seconds"]').textContent = String(seconds).padStart(2, '0');
  }

  tick();
  setInterval(tick, 1000);
}

/* ============ RSVP FORM ============ */

const rsvpForm = document.getElementById('rsvp-form');
const formStatus = document.getElementById('form-status');

rsvpForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = rsvpForm.name.value.trim();

  if (!name) {
    formStatus.textContent = 'Enter your name to continue.';
    return;
  }

  formStatus.textContent = 'Sending...';

  // Replace with a real endpoint: a Supabase insert, a Google Sheets
  // webhook, or a Formspree/Basin form action.
  try {
    // await fetch('/api/rsvp', { method: 'POST', body: new FormData(rsvpForm) });
    await new Promise((r) => setTimeout(r, 600));
    formStatus.textContent = `Thank you, ${name}. We can't wait to see you.`;
    rsvpForm.reset();
  } catch (err) {
    formStatus.textContent = "Couldn't send that — try again or call us directly.";
  }
});

/* ============ MOBILE NAV ============ */

const navToggle = document.querySelector('.nav-toggle');
const navLinks = document.querySelector('.nav-links');

navToggle?.addEventListener('click', () => {
  const isOpen = navToggle.getAttribute('aria-expanded') === 'true';
  navToggle.setAttribute('aria-expanded', String(!isOpen));
  navLinks.style.display = isOpen ? 'none' : 'flex';
});
