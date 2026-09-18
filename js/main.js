/* ============================================================
   Doose & Deri — main
   Opening sequence, YouTube-backed love song, GSAP scroll
   choreography, countdown, nav, RSVP.
   Every GSAP timeline lives here (no inline scripts in HTML).
   ============================================================ */

const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const hasGSAP = typeof gsap !== 'undefined';

if (hasGSAP && typeof ScrollTrigger !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

/* ============================================================
   LOVE SONGS — played only through the official YouTube embed.
   No downloaded files, no synth fallback: if the API isn't ready
   or is blocked, we simply wait for it rather than layering in a
   second audio source.
   ============================================================ */

const SONGS = [
  {
    id: 'on-purpose',
    sections: ['home', 'story', 'moments', 'wedding', 'dates', 'rsvp'],
  },
];

const Music = {
  playing: false,
  currentId: null,
  activeSection: 'home',

  init() {
    YouTube.load();
  },

  trackFor(section) {
    return SONGS.find((s) => s.sections.includes(section)) || SONGS[0];
  },

  setSection(section) {
    if (section === this.activeSection) return;
    this.activeSection = section;
    if (this.playing) this.playTrack(this.trackFor(section).id);
  },

  start() {
    if (this.playing) return;
    this.playing = true;
    setMusicUI(true);
    this.playTrack(this.trackFor(this.activeSection).id);
  },

  playTrack(id) {
    this.currentId = id;
    // If the YouTube API isn't ready yet, its onReady handler picks
    // this up as soon as it is — we don't fall back to anything else.
    if (YouTube.couldPlay()) YouTube.play(id);
  },

  stop() {
    this.playing = false;
    setMusicUI(false);
    this.currentId = null;
    YouTube.pauseAll();
  },

  toggle() {
    this.playing ? this.stop() : this.start();
  },

  resumeCurrent() {
    if (!this.playing) {
      this.start();
      return;
    }
    const id = this.currentId || this.trackFor(this.activeSection).id;
    if (YouTube.couldPlay()) YouTube.play(id);
  },
};

/* ============================================================
   YOUTUBE EMBED — official IFrame player for On Purpose.
   Plays audio straight from youtube.com; no downloaded files.
   ============================================================ */

const YT_VIDEOS = {
  'on-purpose': '86Uru51EqOU', // On Purpose — Ni/co
};

const YouTube = {
  apiReady: false,
  failed: false,
  loaded: false,
  players: {},
  active: null,

  load() {
    if (this.loaded || this.failed) return;
    if (window.YT) { this.apiReady = true; this.build(); return; }
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    tag.async = true;
    tag.onerror = () => { this.failed = true; };
    document.head.appendChild(tag);
  },

  build() {
    if (this.loaded) return;
    this.loaded = true;
    Object.keys(YT_VIDEOS).forEach((id) => {
      this.players[id] = new YT.Player(`yt-${id}`, {
        videoId: YT_VIDEOS[id],
        width: '200',
        height: '113',
        playerVars: {
          autoplay: 0,
          controls: 0,
          disablekb: 1,
          rel: 0,
          playsinline: 1,
          loop: 1,
          playlist: YT_VIDEOS[id],
        },
        events: {
          // The API loads in the background, so playback may already
          // have been requested before the player existed — pick it
          // up here if this song is still the one that should sound.
          onReady: () => {
            if (Music.playing && Music.trackFor(Music.activeSection).id === id) {
              this.play(id);
            }
          },
        },
      });
    });
  },

  play(id) {
    const p = this.players[id];
    if (!p) return;
    if (this.active && this.active !== id) {
      try { this.players[this.active].pauseVideo(); } catch (e) { /* ignore */ }
    }
    this.active = id;
    try {
      p.unMute();
      p.setVolume(85);
      p.playVideo();
    } catch (e) { /* ignore */ }
  },

  pauseAll() {
    Object.keys(this.players).forEach((id) => {
      try { this.players[id].pauseVideo(); } catch (e) { /* ignore */ }
    });
    this.active = null;
  },

  couldPlay() {
    return this.loaded && !!this.players['on-purpose'];
  },
};

window.onYouTubeIframeAPIReady = () => {
  YouTube.apiReady = true;
  YouTube.build();
};

const musicToggle = $('#music-toggle');
function setMusicUI(on) {
  musicToggle.classList.toggle('is-playing', on);
  musicToggle.setAttribute('aria-pressed', String(on));
  musicToggle.setAttribute('aria-label', on ? 'Pause our song' : 'Play our song');
}
musicToggle.addEventListener('click', () => Music.toggle());

function startMusicBestEffort() {
  try {
    Music.start();
    Music.resumeCurrent();
  } catch (err) {
    console.warn('Music unavailable:', err);
  }
}

// Browsers only allow audio to start on a real user gesture. A guest
// who never clicks and just scrolls with a wheel/trackpad still
// counts as "using the site," so the song should still come on —
// it should only ever go quiet if they explicitly hit the toggle.
function installMusicUnlock() {
  const gestures = ['pointerdown', 'touchstart', 'keydown', 'click', 'wheel', 'scroll'];
  const unlock = () => {
    try {
      Music.resumeCurrent();
    } catch (err) {
      console.warn('Music resume unavailable:', err);
    }
    gestures.forEach((type) => window.removeEventListener(type, unlock, true));
  };

  gestures.forEach((type) => window.addEventListener(type, unlock, { capture: true, passive: true }));
}

/* ============================================================
   OPENING SEQUENCE
   ============================================================ */

const inviteVideo = $('#invite-video');
const groove = $('#groove-reveal');
const opening = $('#opening');
const site = $('#site');

// Real assets to warm the cache — the hero photo shown right after
// the envelope, and the video poster for an instant first frame.
// None of these gate the opening: the envelope plays immediately,
// straight off the poster if the clip itself is still buffering.
const assetsToPreload = ['assets/web/IMG_4638.jpg', 'assets/web/envelope-open-poster.jpg'];

function preload(urls) {
  urls.forEach((src) => {
    const img = new Image();
    img.src = src;
  });
}
preload(assetsToPreload);

let openSequenceStarted = false;
startOpeningVideo();

function enterSite() {
  startMusicBestEffort();
  opening.remove();
  site.hidden = false;
  showMusicToggle();
  runHeroReveal();
  initScrollChoreography();
  startCountdown();
  // move keyboard focus into the revealed page
  const heroContent = $('.hero-content');
  if (heroContent) heroContent.focus({ preventScroll: true });
}

/* ---- envelope-open film clip ----
   Reduced-motion or playback-blocked guests should never be stuck
   staring at a dead screen, so any failure path falls through to
   enterSite() after a short, deliberate beat rather than hanging. */
function startOpeningVideo() {
  if (openSequenceStarted) return;
  openSequenceStarted = true;

  const originX = window.innerWidth / 2;
  const originY = window.innerHeight / 2;
  groove.style.left = `${originX}px`;
  groove.style.top = `${originY}px`;

  startMusicBestEffort();

  if (prefersReducedMotion || !inviteVideo) {
    // Respect reduced motion: hold on the poster frame briefly,
    // then go straight to the site rather than play the clip.
    setTimeout(enterSite, 600);
    return;
  }

  let handedOff = false;
  const goToSite = () => {
    if (handedOff) return;
    handedOff = true;
    if (hasGSAP) {
      gsap.set(groove, { opacity: 0.96, scale: 0 });
      const maxDim = Math.max(window.innerWidth, window.innerHeight) * 2.05;
      gsap.to(groove, {
        scale: maxDim / 24,
        duration: 0.6,
        ease: 'power3.out',
        onComplete: enterSite,
      });
    } else {
      enterSite();
    }
  };

  // Safety fallback: if the clip never becomes playable (blocked
  // autoplay, network failure, slow connection), don't hang here.
  const fallbackTimer = setTimeout(goToSite, 6000);

  inviteVideo.addEventListener('ended', () => {
    clearTimeout(fallbackTimer);
    goToSite();
  });
  inviteVideo.addEventListener('error', () => {
    clearTimeout(fallbackTimer);
    goToSite();
  });

  const playPromise = inviteVideo.play();
  if (playPromise && typeof playPromise.catch === 'function') {
    playPromise.catch(() => {
      // Autoplay blocked — don't wait on a frozen poster.
      clearTimeout(fallbackTimer);
      goToSite();
    });
  }
}

function showMusicToggle() {
  musicToggle.hidden = false;
  requestAnimationFrame(() => musicToggle.classList.add('is-ready'));
}

/* ============================================================
   HERO REVEAL
   ============================================================ */
function runHeroReveal() {
  if (!hasGSAP || prefersReducedMotion) {
    document.body.classList.add('gsap-missing');
    return;
  }

  // draw the needle so it can scribe itself in
  const arm = $('.needle-arm');
  const head = $('.needle-head');
  const armLen = arm.getTotalLength();
  const headLen = head.getTotalLength();
  gsap.set([arm, head], { strokeDasharray: (i) => (i ? headLen : armLen), strokeDashoffset: (i) => (i ? headLen : armLen) });

  /* ---- cinematic curtain reveal ----
     The photo sits behind a closed black frame. The top bar rises
     and the bottom bar falls so the scene frames in like a film
     opening — title, needle and notes rise to meet it. (The slow
     push-in is handled by the CSS Ken Burns on .hero-bg-img.) */
  const topBar = $('.letterbox.is-top');
  const bottomBar = $('.letterbox.is-bottom');
  const grain = $('.filmgrain');
  const H = window.innerHeight;
  const barH = Math.ceil(H / 2);

  gsap.set([topBar, bottomBar], { height: 0 });          // start: no bars
  gsap.set(grain, { opacity: 0 });

  const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

  // 1. close the curtain instantly (the frame arrives black)
  tl.set(topBar, { height: barH }, 0)
    .set(bottomBar, { height: barH }, 0)
    .set(grain, { opacity: 0.5 }, 0);

  // 2. part the curtain — a genuinely cinematic widescreen reveal
  tl.to(topBar, { height: 0, duration: 1.3, ease: 'expo.inOut' }, 0.5)
    .to(bottomBar, { height: 0, duration: 1.3, ease: 'expo.inOut' }, 0.5)
    .to(grain, { opacity: 0.18, duration: 2.2, ease: 'sine.out' }, 0.55);

  // 3. print the title onto the scene
  tl.to('.hero .reveal-up', {
    opacity: 1, y: 0, duration: 1.0, stagger: 0.14,
  }, 1.4)
    .fromTo('.hero-art', { opacity: 0, scale: 0.92 }, { opacity: 1, scale: 1, duration: 1.3 }, 1.4)
    .to('.needle-arm', { strokeDashoffset: 0, duration: 1.1, ease: 'power2.inOut' }, 2.0)
    .to('.needle-head', { strokeDashoffset: 0, duration: 0.7, ease: 'power2.inOut' }, 2.5)
    .to(grain, { opacity: 0.05, duration: 1.6, ease: 'sine.out' }, 2.3);
}

/* ============================================================
   SCROLL CHOREOGRAPHY (ScrollTrigger)
   ============================================================ */
function initScrollChoreography() {
  if (prefersReducedMotion) return;

  if (!hasGSAP || typeof ScrollTrigger === 'undefined') {
    document.body.classList.add('gsap-missing');
    return;
  }

  const nav = $('#nav');

  // nav elevation + section -> nav link highlighting
  ScrollTrigger.create({
    trigger: $('#home'),
    start: 'top -6%',
    onToggle: (self) => nav.classList.toggle('scrolled', self.isActive),
  });

  ['home', 'story', 'moments', 'wedding', 'dates', 'rsvp'].forEach((id) => {
    if (!$(`#${id}`)) return;

    ScrollTrigger.create({
      trigger: `#${id}`,
      start: 'top 45%',
      end: 'bottom bottom',
      onToggle: (self) => {
        if (!self.isActive) return;
        Music.setSection(id);
        $$('.nav-links a').forEach((a) => {
          const isActive = a.getAttribute('href') === `#${id}`;
          a.classList.toggle('active', isActive);
          if (isActive) a.setAttribute('aria-current', 'true');
          else a.removeAttribute('aria-current');
        });
      },
    });
  });

  // generic scroll reveals
  $$('section:not(.hero) .reveal-up').forEach((el) => {
    gsap.to(el, {
      opacity: 1, y: 0, duration: 0.9, ease: 'power2.out',
      scrollTrigger: { trigger: el, start: 'top 86%' },
    });
  });

  // story timeline line grows as you scroll
  gsap.fromTo('.timeline-line', { scaleY: 0 }, {
    scaleY: 1, ease: 'none',
    scrollTrigger: {
      trigger: '.timeline',
      start: 'top 75%',
      end: 'bottom 60%',
      scrub: 0.6,
    },
  });

  // gentle parallax on the photo layers (outer wrappers only —
  // the Ken Burns / float animations live on inner elements)
  gsap.to('.hero-bg', {
    yPercent: 12, ease: 'none',
    scrollTrigger: { trigger: '#home', start: 'top top', end: 'bottom top', scrub: true },
  });
  gsap.to('.hero-art', {
    yPercent: -14, ease: 'none',
    scrollTrigger: { trigger: '#home', start: 'top top', end: 'bottom top', scrub: true },
  });
  gsap.to('.quote-bg', {
    yPercent: 12, ease: 'none',
    scrollTrigger: { trigger: '#quote', start: 'top bottom', end: 'bottom top', scrub: true },
  });
}

/* ============================================================
   COUNTDOWN
   ============================================================ */
function startCountdown() {
  const el = $('#countdown');
  const target = new Date(el.dataset.date).getTime();

  function setUnit(unit, value) {
    const node = el.querySelector(`[data-unit="${unit}"]`);
    const text = String(value).padStart(2, '0');
    if (node.textContent === text) return;
    node.textContent = text;
    if (hasGSAP && !prefersReducedMotion) {
      gsap.fromTo(node, { y: 8, opacity: 0.25 }, {
        y: 0, opacity: 1, duration: 0.5, ease: 'power2.out', overwrite: true,
      });
    }
  }

  function tick() {
    const diff = Math.max(0, target - Date.now());
    setUnit('days', Math.floor(diff / 86400000));
    setUnit('hours', Math.floor((diff % 86400000) / 3600000));
    setUnit('minutes', Math.floor((diff % 3600000) / 60000));
    setUnit('seconds', Math.floor((diff % 60000) / 1000));
  }

  tick();
  setInterval(tick, 1000);
}

/* ============================================================
   RSVP FORM
   ============================================================ */
const rsvpForm = $('#rsvp-form');
const formStatus = $('#form-status');

// Google Apps Script web app URL — paste the deployment URL here.
const RSVP_SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbwUt--NGDvjWI1Wuv5jyviXf-Wrd2lWBwKP6REIjgdO_3NEUEraR-Tb094b0_hJt92C/exec';

rsvpForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const nameInput = rsvpForm.name;
  const phoneInput = rsvpForm.phone;
  const partyInput = rsvpForm.party_size;
  const name = nameInput.value.trim();
  const phone = phoneInput.value.trim();
  const party = parseInt(partyInput.value, 10);

  nameInput.setAttribute('aria-invalid', 'false');
  phoneInput.setAttribute('aria-invalid', 'false');
  partyInput.setAttribute('aria-invalid', 'false');
  formStatus.classList.remove('error');

  if (!name) {
    nameInput.setAttribute('aria-invalid', 'true');
    nameInput.focus();
    formStatus.classList.add('error');
    formStatus.textContent = 'Please tell us your name so we can save your seat.';
    return;
  }
  if (!phone || phone.replace(/\D/g, '').length < 7) {
    phoneInput.setAttribute('aria-invalid', 'true');
    phoneInput.focus();
    formStatus.classList.add('error');
    formStatus.textContent = 'Please give us a valid phone number so we can reach you.';
    return;
  }
  if (!party || party < 1 || party > 1) {
    partyInput.setAttribute('aria-invalid', 'true');
    partyInput.focus();
    formStatus.classList.add('error');
    formStatus.textContent = 'Party size is limited to 1 person.';
    return;
  }

  const submitBtn = $('.rsvp-submit');
  const btnLabel = $('.btn-label');
  const originalLabel = btnLabel.textContent;
  btnLabel.textContent = 'Sending…';
  formStatus.textContent = '';

  try {
    await fetch(RSVP_SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors',
      body: JSON.stringify({ name, phone, party_size: party })
    });
    submitBtn.classList.add('is-sent');
    btnLabel.textContent = 'See you there ♡';
    formStatus.textContent = `Thank you, ${name}. We can't wait to sing with you.`;
    rsvpForm.reset();
    setTimeout(() => {
      submitBtn.classList.remove('is-sent');
      btnLabel.textContent = originalLabel;
      formStatus.textContent = '';
    }, 6000);
  } catch (err) {
    formStatus.classList.add('error');
    formStatus.textContent = "Couldn't send that — please try again or call us directly.";
  }
});

/* ============================================================
   HASHTAGS — one-tap copy
   ============================================================ */
const hashtagChips = $$('.hashtag-chip');
const hashtagStatus = $('#hashtag-status');
let hashtagTimer = null;

function hashtagFallbackCopy(text, chip) {
  const range = document.createRange();
  range.selectNodeContents(chip);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch (err) {
    ok = false;
  }
  sel.removeAllRanges();
  return ok;
}

function announceHashtag(chip, text) {
  chip.classList.add('copied');
  if (hashtagStatus) {
    hashtagStatus.textContent = `Copied ${text}`;
    hashtagStatus.hidden = false;
  }
  clearTimeout(hashtagTimer);
  hashtagTimer = setTimeout(() => {
    chip.classList.remove('copied');
    if (hashtagStatus) hashtagStatus.hidden = true;
  }, 2000);
}

hashtagChips.forEach((chip) => {
  chip.addEventListener('click', async () => {
    const text = chip.dataset.copy;
    let ok = false;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        ok = true;
      } catch (err) {
        ok = false;
      }
    }
    if (!ok) ok = hashtagFallbackCopy(text, chip);
    if (ok) announceHashtag(chip, text);
  });
});

/* ============================================================
   MOBILE NAV
   ============================================================ */
const navToggle = $('#nav-toggle');
const navLinks = $('#nav-links');

function setMenu(open) {
  navToggle.setAttribute('aria-expanded', String(open));
  navToggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  navLinks.classList.toggle('is-open', open);
  navLinks.style.display = open ? 'flex' : '';
  document.body.classList.toggle('menu-open', open);
}

navToggle?.addEventListener('click', () => {
  setMenu(navToggle.getAttribute('aria-expanded') !== 'true');
});

navLinks.querySelectorAll('a').forEach((a) => {
  a.addEventListener('click', () => setMenu(false));
});

window.addEventListener('resize', () => {
  if (window.innerWidth > 720) setMenu(false);
});

/* ============================================================
   REDUCED MOTION — ambient gallery videos should not autoplay
   for users who prefer less motion. We pause them on load and
   whenever the preference changes.
   ============================================================ */
const galleryVideos = $$('.moment video');
function applyVideoReducedMotion() {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  galleryVideos.forEach((v) => {
    if (reduce) v.pause();
    else v.play().catch(() => { /* muted autoplay may still be blocked */ });
  });
}
const reducedMotionMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
applyVideoReducedMotion();
reducedMotionMQ.addEventListener?.('change', applyVideoReducedMotion);

/* ============================================================
   HOVER-TO-PLAY — hovering a memory turns the music on; leaving
   a memory restores the state the visitor had before (silent
   becomes silent again, already-playing stays playing).
   Works with the global Music system, not a separate toggle.
   ============================================================ */
const momentCards = $$('.moment');
let musicPlayingBeforeHover = false;

momentCards.forEach((card) => {
  card.addEventListener('pointerenter', () => {
    musicPlayingBeforeHover = Music.playing;
    if (!Music.playing) Music.start();
  });
  card.addEventListener('pointerleave', () => {
    if (!musicPlayingBeforeHover && Music.playing) Music.stop();
  });
});

/* ============================================================
   BOOT
   ============================================================ */
Music.init();
installMusicUnlock();
startMusicBestEffort();

// If JS runs but GSAP/CDN failed, reveal content & controls anyway
if (!hasGSAP) {
  document.body.classList.add('gsap-missing');
}
