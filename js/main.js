/* ============================================================
   Doose & Deri — main
   Opening sequence, real love songs with a generative music-box
   fallback, GSAP scroll choreography, countdown, nav, RSVP.
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
   LOVE SONGS — real tracks with a generative music-box fallback.
   Drop your own purchased files into assets/audio/ with these
   exact names:
     assets/audio/i-do-aloe-blacc.mp3      "I Do" by Aloe Blacc
     assets/audio/on-purpose-nico.mp3      "On Purpose" by Ni/co
   The track follows the section being viewed: "I Do" plays for
   the hero + ceremony, "On Purpose" for the rest of the site.
   If a file hasn't been added yet it falls back to the
   synthesized music box instead of breaking.
   ============================================================ */

const MIDI = (m) => 440 * Math.pow(2, (m - 69) / 12);

const TRACKS = [
  {
    id: 'on-purpose',
    file: 'assets/audio/on-purpose-nico.mp3',
    label: 'On Purpose — Ni/co',
    sections: ['home', 'story', 'moments', 'wedding', 'dates', 'rsvp'],
  },
];

const Music = {
  playing: false,
  ctx: null,
  master: null,
  timer: null,
  nextTime: 0,
  step: 0,
  active: new Set(),
  tracks: {},
  currentId: null,
  activeSection: 'home',

  // waltz, 72 bpm, 4 bars of 6 eighths
  EIGHTH: 60 / 72 / 2,
  TOTAL_STEPS: 24,
  chords: [
    { bass: 36, triad: [60, 64, 67] }, // C
    { bass: 43, triad: [55, 59, 62] }, // G
    { bass: 45, triad: [57, 60, 64] }, // Am
    { bass: 41, triad: [53, 57, 60] }, // F
  ],
  // sweet pentatonic line over the four bars (null = rest)
  melody: [
    null, 64, null, 67, null, 69,
    null, 71, null, 74, null, 71,
    null, 69, null, 72, null, 76,
    null, 69, null, 67, null, 64,
  ],
  arpPattern: [0, 1, 2, 1, 0, 1],

  init() {
    TRACKS.forEach((t) => {
      const el = new Audio(t.file);
      el.loop = true;
      el.preload = 'auto';
      el.volume = 0;
      t.el = el;
      t.ok = false;
      el.addEventListener('canplaythrough', () => { t.ok = true; });
      el.addEventListener('error', () => { t.ok = false; });
      this.tracks[t.id] = t;
    });
    YouTube.load();
  },

  trackFor(section) {
    return TRACKS.find((t) => t.sections.includes(section)) || TRACKS[0];
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
    if (id === this.currentId) return;
    this.currentId = id;
    this.stopBox();
    TRACKS.forEach((t) => {
      if (t.id !== id) { t.el.pause(); t.el.volume = 0; }
    });
    const track = this.tracks[id];
    if (track && track.ok && track.el.readyState > 1) {
      // 1. a real MP3 the owner dropped in
      YouTube.pauseAll();
      this.fadeIn(track.el);
    } else if (YouTube.couldPlay()) {
      // 2. official YouTube embed for these songs
      YouTube.play(id);
    } else {
      // 3. graceful generative music-box fallback
      YouTube.load();
      this.startBox();
    }
  },

  fadeIn(el, durS = 1.2) {
    el.volume = 0;
    el.play().catch(() => { /* media resume needs a gesture */ });
    const t0 = performance.now();
    const step = () => {
      const k = Math.min(1, (performance.now() - t0) / (durS * 1000));
      el.volume = k;
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  },

  stop() {
    this.playing = false;
    setMusicUI(false);
    this.currentId = null;
    TRACKS.forEach((t) => { t.el.pause(); t.el.volume = 0; });
    YouTube.pauseAll();
    this.stopBox();
  },

  toggle() {
    this.playing ? this.stop() : this.start();
  },

  /* ---- silence the synthesized box ---- */
  stopBox() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.active.forEach((osc) => { try { osc.stop(); } catch (e) { /* already stopped */ } });
    this.active.clear();
    if (this.ctx && this.master) {
      const now = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(now);
      this.master.gain.setValueAtTime(this.master.gain.value, now);
      this.master.gain.linearRampToValueAtTime(0.0001, now + 0.4);
    }
  },

  /* ---- synthesized music box ---- */
  startBox() {
    if (!this.ctx) this.buildGraph();
    this.ctx.resume();
    const now = this.ctx.currentTime;
    this.step = 0;
    this.nextTime = now + 0.12;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setValueAtTime(0.0001, now);
    this.master.gain.linearRampToValueAtTime(0.16, now + 1.2);
    if (!this.timer) {
      this.timer = setInterval(() => this.schedule(), 120);
    }
  },

  buildGraph() {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.ctx = ctx;

    this.master = ctx.createGain();
    this.master.gain.value = 0.0001;
    this.master.connect(ctx.destination);

    this.bus = ctx.createGain();   // dry path
    this.send = ctx.createGain();  // reverb send
    this.dry = ctx.createGain();
    this.wet = ctx.createGain();
    this.bus.connect(this.dry); this.dry.connect(this.master);
    this.bus.connect(this.send);
    this.send.gain.value = 0.5;

    const convolver = ctx.createConvolver();
    convolver.buffer = this.impulse();
    convolver.connect(this.wet); this.wet.connect(this.master);
    this.wet.gain.value = 0.5;

    this.convolver = convolver;
  },

  impulse() {
    const rate = this.ctx.sampleRate;
    const len = Math.floor(rate * 2.2);
    const buf = this.ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.8);
      }
    }
    return buf;
  },

  schedule() {
    // lookahead well above one eighth (0.417s) so throttled tabs
    // never dump a burst of overdue notes on refocus
    while (this.nextTime < this.ctx.currentTime + 1.2) {
      this.scheduleStep(this.step, this.nextTime);
      this.nextTime += this.EIGHTH;
      this.step = (this.step + 1) % this.TOTAL_STEPS;
    }
  },

  scheduleStep(step, t) {
    const bar = Math.floor(step / 6);
    const pos = step % 6;
    const chord = this.chords[bar];

    if (pos === 0) this.tone(MIDI(chord.bass), t, 3.4, 0.5);

    const arp = chord.triad[this.arpPattern[pos]];
    this.tone(MIDI(arp), t, 2.2, 0.38);

    const mel = this.melody[step];
    if (mel != null) {
      this.tone(MIDI(mel), t, 2.6, 0.85);
      this.tone(MIDI(mel + 12), t, 1.7, 0.28); // music-box shimmer
    }
  },

  tone(freq, t, dur, vol) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    osc.connect(g);
    g.connect(this.bus);
    g.connect(this.send);

    this.active.add(osc);
    osc.onended = () => this.active.delete(osc);

    osc.start(t);
    osc.stop(t + dur + 0.05);
  },
};

/* ============================================================
   YOUTUBE EMBED — official IFrame player for On Purpose.
   Plays audio from youtube.com (no downloaded files, no rips)
   and hands back to the generative box if the API is blocked.
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

/* ============================================================
   OPENING SEQUENCE
   ============================================================ */

const loadingScreen = $('#loading-screen');
const openCard = $('#open-card');
const openBtn = $('#open-btn');
const groove = $('#groove-reveal');
const opening = $('#opening');
const site = $('#site');
const pctLabel = $('#loading-pct');

// Real assets to gate a "ready" page — add hero/og images here.
const assetsToPreload = [];

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
  const waitForCount = setInterval(() => {
    if (pct >= 100) {
      clearInterval(waitForCount);
      setTimeout(finish, 250);
    }
  }, 100);
});

function enterSite() {
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

openBtn.addEventListener('click', () => {
  const rect = openBtn.getBoundingClientRect();
  const originX = rect.left + rect.width / 2;
  const originY = rect.top + rect.height / 2;

  groove.style.left = `${originX}px`;
  groove.style.top = `${originY}px`;
  openCard.hidden = true;

  // Start the song now — we're inside the user gesture, so the
  // browser's autoplay policy allows audio to begin. Never let a
  // Web Audio failure trap the visitor on the loading screen.
  try {
    Music.start();
  } catch (err) {
    console.warn('Music unavailable:', err);
  }

  if (prefersReducedMotion || !hasGSAP) {
    enterSite();
    return;
  }

  const maxDim = Math.max(window.innerWidth, window.innerHeight) * 2.2;
  gsap.to(groove, {
    scale: maxDim / 20,
    duration: 0.9,
    ease: 'power3.out',
    onComplete: enterSite,
  });
});

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

  // set up the needle so it can draw itself in
  const arm = $('.needle-arm');
  const head = $('.needle-head');
  const armLen = arm.getTotalLength();
  const headLen = head.getTotalLength();
  gsap.set([arm, head], { strokeDasharray: (i) => (i ? headLen : armLen), strokeDashoffset: (i) => (i ? headLen : armLen) });

  const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

  tl.to('.hero .reveal-up', {
    opacity: 1, y: 0, duration: 0.9, stagger: 0.13,
  }, 0.1)
    .fromTo('.hero-art', { opacity: 0, scale: 0.9 }, { opacity: 1, scale: 1, duration: 1.2 }, 0.1)
    .to('.needle-arm', { strokeDashoffset: 0, duration: 1.1, ease: 'power2.inOut' }, 0.5)
    .to('.needle-head', { strokeDashoffset: 0, duration: 0.7, ease: 'power2.inOut' }, 1.0);
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
   BOOT
   ============================================================ */
Music.init();

// If JS runs but GSAP/CDN failed, reveal content & controls anyway
if (!hasGSAP) {
  document.body.classList.add('gsap-missing');
}
