/* ============================================================
   Doose & Deri — main
   Opening sequence, entry soundtrack, GSAP scroll
   choreography, countdown, nav, RSVP.
   Every GSAP timeline lives here (no inline scripts in HTML).
   ============================================================ */

const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const hasGSAP = typeof gsap !== 'undefined';
const entryAudio = $('#entry-audio');

if (hasGSAP && typeof ScrollTrigger !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

/* ============================================================
   LOVE SONGS — the local invitation soundtrack starts with the
   entry video. The YouTube player remains as a fallback if the
   local track is not present.
   ============================================================ */

const LocalSong = {
  volume: 0.82,

  available() {
    return !!entryAudio;
  },

  init() {
    if (!this.available()) return;
    entryAudio.loop = true;
    entryAudio.volume = this.volume;
    entryAudio.muted = false;
  },

  rewind() {
    if (!this.available()) return;
    try { entryAudio.currentTime = 0; } catch (e) { /* media may not be ready yet */ }
  },

  play() {
    if (!this.available()) return false;
    const playPromise = entryAudio.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => {
        // The next trusted gesture will call resumeCurrent() again.
      });
    }
    return true;
  },

  pause() {
    if (!this.available()) return;
    entryAudio.pause();
  },
};

const SONGS = [
  {
    id: 'on-purpose',
    sections: ['home', 'story', 'moments', 'wedding', 'dates', 'rsvp'],
  },
];

const Music = {
  playing: false,
  // Flips true (one-way) the first time playback is genuinely known to
  // be audible — i.e. requested from a real user gesture, since that's
  // the only case a browser actually allows sound. Drives the
  // music-toggle's "tap for sound" pill vs. plain icon-button look.
  audible: false,
  currentId: null,
  activeSection: 'home',

  init() {
    LocalSong.init();
    if (!LocalSong.available()) YouTube.load();
  },

  trackFor(section) {
    return SONGS.find((s) => s.sections.includes(section)) || SONGS[0];
  },

  setSection(section) {
    if (section === this.activeSection) return;
    this.activeSection = section;
    if (this.playing) this.playTrack(this.trackFor(section).id);
  },

  start(options = {}) {
    if (options.restart) LocalSong.rewind();
    if (this.playing) {
      this.resumeCurrent();
      return;
    }
    this.playing = true;
    setMusicUI(true);
    this.playTrack(this.trackFor(this.activeSection).id);
  },

  playTrack(id) {
    this.currentId = id;
    if (LocalSong.play()) return;
    // If the YouTube API isn't ready yet, its onReady handler picks
    // this up as soon as it is.
    if (YouTube.couldPlay()) YouTube.play(id);
  },

  stop() {
    this.playing = false;
    setMusicUI(false);
    this.currentId = null;
    LocalSong.pause();
    YouTube.pauseAll();
  },

  toggle() {
    if (this.playing && this.audible) {
      this.stop();
      return;
    }
    // A tap on the toggle is a real user gesture — the one guaranteed
    // way to make sound audible — regardless of whether `playing` was
    // already true from an earlier, browser-blocked autoplay attempt.
    this.audible = true;
    markAudible();
    this.start();
  },

  resumeCurrent() {
    if (!this.playing) {
      this.start();
      return;
    }
    const id = this.currentId || this.trackFor(this.activeSection).id;
    if (LocalSong.play()) return;
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
            if (!LocalSong.available() && Music.playing && Music.trackFor(Music.activeSection).id === id) {
              this.play(id);
            }
          },
        },
      });
    });
  },

  // Always requests real, unmuted playback — some browsers (a guest
  // who's visited/played audio on this site before, for instance) will
  // actually honor an unmuted autoplay request. Where it's blocked, this
  // silently fails and installMusicUnlock()'s retry picks it up on the
  // guest's first tap/scroll — deliberately muting up front would only
  // rule out the browsers that *would* have let it through.
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
function markAudible() {
  musicToggle.classList.add('is-audible');
}
musicToggle.addEventListener('click', () => Music.toggle());

function startMusicBestEffort(options = {}) {
  try {
    Music.start(options);
    Music.resumeCurrent();
  } catch (err) {
    console.warn('Music unavailable:', err);
  }
}

// Browsers only allow audio to start on a real user gesture. A tap, a
// swipe (which fires touchstart), a click, a keypress, or a scroll/
// wheel anywhere on the page all count and retry playback here — a
// bare mouse hover never does, in any browser, so that one genuinely
// can't be added to this list. Clicks on the music-toggle or the
// preloader's record are skipped here since their own click handlers
// (both Music.toggle()) already own that gesture — letting both fire
// would start playback then immediately pause it.
function installMusicUnlock() {
  const gestures = ['pointerdown', 'touchstart', 'keydown', 'click', 'wheel', 'scroll'];
  const unlock = (event) => {
    if (musicToggle.contains(event.target)) return;
    if (openBtn && openBtn.contains(event.target)) return;
    try {
      Music.audible = true;
      markAudible();
      Music.resumeCurrent();
    } catch (err) {
      console.warn('Music resume unavailable:', err);
    }
    gestures.forEach((type) => window.removeEventListener(type, unlock, true));
  };

  gestures.forEach((type) => window.addEventListener(type, unlock, { capture: true, passive: true }));
}

/* ============================================================
   OPENING SEQUENCE — OLD (video-gate), DISABLED
   Kept for reference only, not deleted. This drove the "tap a pill
   button -> full-screen envelope-open.mp4 -> straight cut to hero"
   gate. Superseded by the "OPENING SEQUENCE — NEW" block below it,
   which matches the current index.html/style.css markup (record +
   needle groove-reveal). To restore: un-comment this, restore the
   matching HTML/CSS blocks (also headed "OPENING SEQUENCE — OLD"),
   and remove the NEW block below so functions aren't redeclared.

const inviteVideo = $('#invite-video');
const openingStartOld = $('#opening-start');
const grooveOld = $('#groove-reveal');
const openingOld = $('#opening');
const siteOld = $('#site');

// Real assets to warm the cache — the hero photo shown right after
// the envelope, and the video poster for an instant first frame.
// None of these gate the opening: the envelope plays immediately,
// straight off the poster if the clip itself is still buffering.
const assetsToPreloadOld = ['assets/web/IMG_4638.jpg', 'assets/web/envelope-open-poster.jpg'];

function preloadOld(urls) {
  urls.forEach((src) => {
    const img = new Image();
    img.src = src;
  });
}
preloadOld(assetsToPreloadOld);

let openSequenceStartedOld = false;

function enterSiteOld() {
  if (Music.playing) Music.resumeCurrent();
  openingOld.remove();
  siteOld.hidden = false;
  showMusicToggle();
  runHeroReveal();
  initScrollChoreography();
  startCountdown();
  const heroContent = $('.hero-content');
  if (heroContent) heroContent.focus({ preventScroll: true });
}

Reduced-motion or playback-blocked guests should never be stuck
   staring at a dead screen, so any failure path falls through to
   enterSiteOld() after a short, deliberate beat rather than hanging.
function installOpeningStartOld() {
  if (!openingStartOld) {
    startOpeningVideo();
    return;
  }

  openingOld.addEventListener('click', startOpeningVideo, { once: true });
  openingStartOld.addEventListener('click', (event) => {
    event.stopPropagation();
    startOpeningVideo();
  }, { once: true });
}

function startOpeningVideo() {
  if (openSequenceStartedOld) return;
  openSequenceStartedOld = true;

  openingStartOld?.classList.add('is-hidden');
  if (openingStartOld) openingStartOld.disabled = true;

  const originX = window.innerWidth / 2;
  const originY = window.innerHeight / 2;
  grooveOld.style.left = `${originX}px`;
  grooveOld.style.top = `${originY}px`;

  showMusicToggle();
  startMusicBestEffort({ restart: true });

  if (prefersReducedMotion || !inviteVideo) {
    setTimeout(enterSiteOld, 600);
    return;
  }

  let handedOff = false;
  const goToSite = () => {
    if (handedOff) return;
    handedOff = true;
    enterSiteOld();
  };

  const fallbackTimer = setTimeout(goToSite, 6000);

  try { inviteVideo.currentTime = 0; } catch (e) { } // media may not be ready yet

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
      clearTimeout(fallbackTimer);
      goToSite();
    });
  }
}

end of "OPENING SEQUENCE — OLD" block ============================ */

/* ============================================================
   OPENING SEQUENCE
   Waveform loader -> spinning record "tap to begin" -> groove
   ripple reveal -> hero.
   ============================================================ */

const loadingScreen = $('#loading-screen');
const openCard = $('#open-card');
const openBtn = $('#open-btn');
const groove = $('#groove-reveal');
const opening = $('#opening');
const site = $('#site');
const pctLabel = $('#loading-pct');

const assetsToPreload = [];

function preload(urls) {
  if (!urls.length) return Promise.resolve();
  return Promise.all(urls.map((src) => new Promise((resolve) => {
    const img = new Image();
    img.onload = img.onerror = resolve;
    img.src = src;
  })));
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
  const waitForCount = setInterval(() => {
    if (pct >= 100) {
      clearInterval(waitForCount);
      setTimeout(finish, 250);
    }
  }, 100);
});

function enterSite() {
  if (Music.playing) Music.resumeCurrent();
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

/* ---- record tap -> groove reveal ----
   The spinning record is the open button. The tap is also a real user
   gesture — the one guaranteed way to start the song audibly, since
   autoplay alone is blocked by browsers. Reduced-motion guests skip
   straight to a clean hand-off with no spin/bob/groove at all. */
openBtn.addEventListener('click', () => {
  if (openBtn.disabled) return;
  openBtn.disabled = true;

  // centre the groove ripple on the record itself
  const rect = openBtn.getBoundingClientRect();
  const originX = rect.left + rect.width / 2;
  const originY = rect.top + rect.height / 2;
  groove.style.left = `${originX}px`;
  groove.style.top = `${originY}px`;

  openCard.hidden = true;

  try { Music.start(); } catch (err) { console.warn('Music unavailable:', err); }

  if (prefersReducedMotion || !hasGSAP) {
    enterSite();
    return;
  }

  // scale big enough that the circle floods every screen corner
  const maxDim = Math.max(window.innerWidth, window.innerHeight) * 2.2;
  gsap.to(groove, {
    scale: maxDim / 20,
    duration: 0.9,
    ease: 'power3.out',
    onComplete: enterSite,
  });
});

function showMusicToggle() {
  if (!musicToggle.hidden && musicToggle.classList.contains('is-ready')) return;
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

  /* ---- straight-to-hero reveal ----
     No black curtain — the photo is visible immediately (the slow
     push-in is handled by the CSS Ken Burns on .hero-bg-img). Title,
     needle and notes simply rise/fade in over the scene, with a
     light film-grain shimmer for texture. */
  const grain = $('.filmgrain');
  gsap.set(grain, { opacity: 0 });

  const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

  tl.to(grain, { opacity: 0.18, duration: 1.4, ease: 'sine.out' }, 0);

  // print the title onto the scene, starting right away
  tl.to('.hero .reveal-up', {
    opacity: 1, y: 0, duration: 1.0, stagger: 0.14,
  }, 0)
    .fromTo('.hero-art', { opacity: 0, scale: 0.92 }, { opacity: 1, scale: 1, duration: 1.3 }, 0)
    .to('.needle-arm', { strokeDashoffset: 0, duration: 1.1, ease: 'power2.inOut' }, 0.6)
    .to('.needle-head', { strokeDashoffset: 0, duration: 0.7, ease: 'power2.inOut' }, 1.1)
    .to(grain, { opacity: 0.05, duration: 1.6, ease: 'sine.out' }, 0.9);
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
// The #open-btn tap handler is wired above; installMusicUnlock() covers
// every other first gesture so sound starts as soon as the browser allows.

// If JS runs but GSAP/CDN failed, reveal content & controls anyway
if (!hasGSAP) {
  document.body.classList.add('gsap-missing');
}
