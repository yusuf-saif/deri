const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

document.body.classList.add('loading');

const loader = $('#loader');
const splashStart = $('#splash-start');
const splashCount = $('#splash-count');
const loadingCount = $('#loading-count');
const splashBarFill = $('#splash-bar-fill');
const splashNote = $('#splash-note');
const soundToggle = $('#sound-toggle');
const header = $('#site-header');
const progress = $('#page-progress');
const menuToggle = $('#menu-toggle');
const navLinks = $('#nav-links');
const countdown = $('#countdown');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const CeremonySong = {
  ctx: null,
  master: null,
  timer: null,
  nextTime: 0,
  step: 0,
  playing: false,
  active: new Set(),
  eighth: 60 / 74 / 2,
  chords: [
    { bass: 41, notes: [57, 60, 65] },
    { bass: 48, notes: [60, 64, 67] },
    { bass: 45, notes: [57, 60, 64] },
    { bass: 43, notes: [55, 59, 62] },
  ],
  melody: [69, null, 72, null, 74, 72, 69, null, 67, null, 64, null, 65, null, 69, null, 72, 76, 74, null, 72, null, 69, null],

  frequency(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
  },

  init() {
    if (this.ctx) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;

    this.ctx = new AudioContext();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.0001;
    this.master.connect(this.ctx.destination);
  },

  start() {
    this.init();
    if (!this.ctx || this.playing) return;

    this.playing = true;
    this.ctx.resume();
    const now = this.ctx.currentTime;
    this.nextTime = now + 0.08;
    this.step = 0;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setValueAtTime(0.0001, now);
    this.master.gain.linearRampToValueAtTime(0.13, now + 1.1);
    this.timer = setInterval(() => this.schedule(), 90);
    this.schedule();
    updateSoundButton();
  },

  stop() {
    this.playing = false;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.active.forEach((node) => {
      try {
        node.stop();
      } catch (error) {
        /* node already stopped */
      }
    });
    this.active.clear();
    if (this.master && this.ctx) {
      const now = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(now);
      this.master.gain.setValueAtTime(this.master.gain.value, now);
      this.master.gain.linearRampToValueAtTime(0.0001, now + 0.4);
    }
    updateSoundButton();
  },

  toggle() {
    if (this.playing) this.stop();
    else this.start();
  },

  schedule() {
    while (this.nextTime < this.ctx.currentTime + 0.8) {
      this.scheduleStep(this.step, this.nextTime);
      this.nextTime += this.eighth;
      this.step = (this.step + 1) % 24;
    }
  },

  scheduleStep(step, time) {
    const chord = this.chords[Math.floor(step / 6)];
    const pos = step % 6;

    if (pos === 0) this.tone(chord.bass, time, 2.6, 0.32);
    this.tone(chord.notes[[0, 1, 2, 1, 0, 2][pos]], time, 1.6, 0.18);

    const note = this.melody[step];
    if (note) {
      this.tone(note, time, 1.9, 0.42);
      this.tone(note + 12, time + 0.01, 1.25, 0.16);
    }
  },

  tone(midi, time, duration, volume) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(this.frequency(midi), time);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2600, time);

    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(volume, time + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);

    this.active.add(osc);
    osc.onended = () => this.active.delete(osc);
    osc.start(time);
    osc.stop(time + duration + 0.05);
  },
};

function updateSoundButton() {
  if (!soundToggle) return;
  soundToggle.hidden = false;
  soundToggle.textContent = CeremonySong.playing ? 'Pause song' : 'Play song';
  soundToggle.setAttribute('aria-pressed', String(CeremonySong.playing));
}

function revealSite() {
  loader?.classList.add('is-hidden');
  document.body.classList.remove('loading');
  document.body.classList.add('hero-revealed');
  updateProgress();
  setTimeout(() => loader?.remove(), 900);
}

function runSplashCount() {
  loader.classList.add('is-counting');
  splashStart.disabled = true;
  splashCount.hidden = false;
  splashNote.textContent = 'Tuning the memories.';

  const start = performance.now();
  const duration = reducedMotion ? 700 : 4300;

  function tick(now) {
    const elapsed = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - elapsed, 3);
    const value = Math.min(100, Math.floor(eased * 100));

    loadingCount.textContent = String(value);
    splashBarFill.style.width = `${value}%`;

    if (elapsed < 1) {
      requestAnimationFrame(tick);
      return;
    }

    loadingCount.textContent = '100';
    splashBarFill.style.width = '100%';
    splashNote.textContent = 'Opening the story.';
    setTimeout(revealSite, reducedMotion ? 150 : 650);
  }

  requestAnimationFrame(tick);
}

splashStart?.addEventListener('click', () => {
  try {
    CeremonySong.start();
  } catch (error) {
    updateSoundButton();
  }
  runSplashCount();
});

soundToggle?.addEventListener('click', () => CeremonySong.toggle());

function updateProgress() {
  const height = document.documentElement.scrollHeight - window.innerHeight;
  const pct = height > 0 ? (window.scrollY / height) * 100 : 0;
  progress.style.width = `${Math.min(100, Math.max(0, pct))}%`;
  header.classList.toggle('scrolled', window.scrollY > 24);
}

function setMenu(open) {
  menuToggle.setAttribute('aria-expanded', String(open));
  menuToggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  navLinks.classList.toggle('is-open', open);
  header.classList.toggle('menu-active', open);
  document.body.classList.toggle('menu-open', open);
}

menuToggle.addEventListener('click', () => {
  setMenu(menuToggle.getAttribute('aria-expanded') !== 'true');
});

navLinks.addEventListener('click', (event) => {
  if (event.target.matches('a')) setMenu(false);
});

window.addEventListener('resize', () => {
  if (window.innerWidth > 760) setMenu(false);
});

const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    entry.target.classList.add('is-visible');
    revealObserver.unobserve(entry.target);
  });
}, { threshold: 0.16, rootMargin: '0px 0px -8% 0px' });

$$('.reveal').forEach((element) => revealObserver.observe(element));

const sectionObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    const id = entry.target.getAttribute('id');
    $$('.nav-links a').forEach((link) => {
      const active = link.getAttribute('href') === `#${id}`;
      link.classList.toggle('active', active);
      if (active) link.setAttribute('aria-current', 'true');
      else link.removeAttribute('aria-current');
    });
  });
}, { threshold: 0.42 });

['story', 'moments', 'couple', 'gallery', 'week', 'families', 'details', 'gifts', 'rsvp'].forEach((id) => {
  const section = $(`#${id}`);
  if (section) sectionObserver.observe(section);
});

function setCountdownUnit(unit, value) {
  const node = countdown.querySelector(`[data-unit="${unit}"]`);
  if (!node) return;
  const next = String(value).padStart(2, '0');
  if (node.textContent !== next) node.textContent = next;
}

function updateCountdown() {
  if (!countdown) return;
  const target = new Date(countdown.dataset.date).getTime();
  const diff = Math.max(0, target - Date.now());
  setCountdownUnit('days', Math.floor(diff / 86400000));
  setCountdownUnit('hours', Math.floor((diff % 86400000) / 3600000));
  setCountdownUnit('minutes', Math.floor((diff % 3600000) / 60000));
  setCountdownUnit('seconds', Math.floor((diff % 60000) / 1000));
}

updateProgress();
updateCountdown();

window.addEventListener('scroll', updateProgress, { passive: true });
setInterval(updateCountdown, 1000);

/* ═══════════════════════════════════
   SPARKLE CANVAS
   ═══════════════════════════════════ */
(function () {
  const cvs = document.getElementById('sparkle-canvas');
  if (!cvs) return;
  const ctx = cvs.getContext('2d');
  const COLORS = [
    'rgba(237, 178, 159,',
    'rgba(242, 217, 134,',
    'rgba(215, 227, 211,',
    'rgba(239, 231, 246,',
    'rgba(201, 168, 76,',
  ];
  let W, H;
  const sparks = [];

  class Spark {
    constructor() {
      this.init(true);
    }

    init(rand) {
      this.x = Math.random() * W;
      this.y = rand ? Math.random() * H : -8;
      this.size = Math.random() * 2.2 + 0.6;
      this.alpha = 0;
      this.maxA = Math.random() * 0.5 + 0.12;
      this.vx = (Math.random() - 0.5) * 0.22;
      this.vy = Math.random() * 0.35 + 0.12;
      this.color = COLORS[Math.floor(Math.random() * COLORS.length)];
      this.phase = Math.random() * Math.PI * 2;
      this.freq = 0.012 + Math.random() * 0.018;
    }

    tick() {
      this.phase += this.freq;
      this.x += this.vx + Math.sin(this.phase) * 0.28;
      this.y += this.vy;
      this.alpha = Math.min(this.maxA, this.alpha + 0.007);
      if (this.y > H + 8) this.init(false);
    }

    draw() {
      const s = this.size;
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.fillStyle = this.color + this.alpha + ')';
      ctx.beginPath();
      ctx.moveTo(0, -s * 1.8);
      ctx.lineTo(s * 0.5, -s * 0.5);
      ctx.lineTo(s * 1.8, 0);
      ctx.lineTo(s * 0.5, s * 0.5);
      ctx.lineTo(0, s * 1.8);
      ctx.lineTo(-s * 0.5, s * 0.5);
      ctx.lineTo(-s * 1.8, 0);
      ctx.lineTo(-s * 0.5, -s * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  function resize() {
    W = cvs.width = window.innerWidth;
    H = cvs.height = window.innerHeight;
    if (!sparks.length) {
      for (let i = 0; i < 50; i++) sparks.push(new Spark());
    }
  }

  function loop() {
    ctx.clearRect(0, 0, W, H);
    sparks.forEach((s) => {
      s.tick();
      s.draw();
    });
    requestAnimationFrame(loop);
  }

  window.addEventListener('resize', resize);
  resize();
  loop();
})();

/* ═══════════════════════════════════
   COUNTDOWN PARTICLES
   ═══════════════════════════════════ */
(function () {
  const cvs = document.getElementById('cd-particles');
  if (!cvs) return;
  const ctx = cvs.getContext('2d');
  let stars = [];

  function resize() {
    const p = cvs.parentElement;
    cvs.width = p.offsetWidth;
    cvs.height = p.offsetHeight;
    stars = [];
    for (let i = 0; i < 45; i++) {
      stars.push({
        x: Math.random() * cvs.width,
        y: Math.random() * cvs.height,
        r: 0.4 + Math.random() * 1.2,
        a: Math.random(),
        da: (0.003 + Math.random() * 0.004) * (Math.random() < 0.5 ? 1 : -1),
      });
    }
  }

  function draw() {
    ctx.clearRect(0, 0, cvs.width, cvs.height);
    stars.forEach((s) => {
      s.a += s.da;
      if (s.a < 0 || s.a > 1) s.da *= -1;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(201, 168, 76, ' + s.a + ')';
      ctx.fill();
    });
    requestAnimationFrame(draw);
  }

  new ResizeObserver(resize).observe(cvs.parentElement);
  resize();
  draw();
})();

/* ═══════════════════════════════════
   CROSSWORD PUZZLE
   ═══════════════════════════════════ */
const CW_DATA = [
  [0, 3, 'D', 1], [0, 9, 'C', 2],
  [1, 0, 'L', 3], [1, 1, 'O'], [1, 2, 'V'], [1, 3, 'E'], [1, 9, 'H'],
  [2, 3, 'R'], [2, 9, 'A'],
  [3, 3, 'I'], [3, 4, 'A', 4], [3, 5, 'M'], [3, 6, 'E'], [3, 7, 'N'], [3, 9, 'P'],
  [4, 3, 'D', 5], [4, 4, 'O'], [4, 5, 'O'], [4, 6, 'S'], [4, 7, 'E'], [4, 8, 'V', 6], [4, 9, 'E'],
  [5, 8, 'O'], [5, 9, 'L'],
  [6, 8, 'W'],
  [7, 0, 'N', 7], [7, 1, 'O'], [7, 2, 'V'], [7, 3, 'E'], [7, 4, 'M'], [7, 5, 'B'], [7, 6, 'E'], [7, 7, 'R'], [7, 8, 'S'],
];
const CW_ROWS = 8;
const CW_COLS = 10;

function buildCW() {
  const grid = document.getElementById('cw-grid');
  if (!grid) return;
  const map = {};
  CW_DATA.forEach(([r, c, l, n]) => {
    map[r + ',' + c] = { l, n: n || null };
  });
  grid.innerHTML = '';
  for (let r = 0; r < CW_ROWS; r++) {
    for (let c = 0; c < CW_COLS; c++) {
      const k = r + ',' + c;
      const d = document.createElement('div');
      d.className = 'cw-cell' + (map[k] ? '' : ' blk');
      if (map[k]) {
        if (map[k].n) {
          const num = document.createElement('div');
          num.className = 'cw-num';
          num.textContent = map[k].n;
          d.appendChild(num);
        }
        const inp = document.createElement('input');
        inp.maxLength = 1;
        inp.dataset.r = r;
        inp.dataset.c = c;
        inp.dataset.a = map[k].l;
        inp.addEventListener('input', function (e) {
          e.target.value = e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(-1);
          e.target.classList.remove('ok', 'ng');
          document.getElementById('cw-msg').textContent = '';
          if (e.target.value) {
            const nr =
              grid.querySelector('input[data-r="' + r + '"][data-c="' + (c + 1) + '"]') ||
              grid.querySelector('input[data-r="' + (r + 1) + '"][data-c="' + c + '"]');
            if (nr) nr.focus();
          }
        });
        inp.addEventListener('keydown', function (e) {
          const dirs = {
            ArrowRight: [r, c + 1],
            ArrowLeft: [r, c - 1],
            ArrowDown: [r + 1, c],
            ArrowUp: [r - 1, c],
          };
          if (dirs[e.key]) {
            e.preventDefault();
            const pair = dirs[e.key];
            const t = grid.querySelector('input[data-r="' + pair[0] + '"][data-c="' + pair[1] + '"]');
            if (t) t.focus();
          }
          if (e.key === 'Backspace' && !e.target.value) {
            const prev =
              grid.querySelector('input[data-r="' + r + '"][data-c="' + (c - 1) + '"]') ||
              grid.querySelector('input[data-r="' + (r - 1) + '"][data-c="' + c + '"]');
            if (prev) {
              prev.focus();
              prev.value = '';
            }
          }
        });
        d.appendChild(inp);
      }
      grid.appendChild(d);
    }
  }
}

function checkCW() {
  const all = document.querySelectorAll('#cw-grid input');
  let correct = 0;
  let empty = 0;
  all.forEach(function (i) {
    if (!i.value) {
      empty++;
      return;
    }
    const ok = i.value === i.dataset.a;
    i.classList.toggle('ok', ok);
    i.classList.toggle('ng', !ok);
    if (ok) correct++;
  });
  const msg = document.getElementById('cw-msg');
  if (empty) {
    msg.textContent = empty + ' cell' + (empty > 1 ? 's' : '') + ' still empty!';
  } else if (correct === all.length) {
    msg.textContent = 'Perfect! You truly know Doose & Deri!';
  } else {
    msg.textContent = correct + '/' + all.length + ' correct — keep going!';
  }
}

function clearCW() {
  document.querySelectorAll('#cw-grid input').forEach(function (i) {
    i.value = '';
    i.classList.remove('ok', 'ng');
  });
  document.getElementById('cw-msg').textContent = '';
}

buildCW();
document.getElementById('cw-check')?.addEventListener('click', checkCW);
document.getElementById('cw-clear')?.addEventListener('click', clearCW);

/* ═══════════════════════════════════
   GSAP SCROLL TRIGGERS
   ═══════════════════════════════════ */
if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);

  ScrollTrigger.create({
    trigger: '#countdown',
    start: 'top 80%',
    once: true,
    onEnter: function () {
      gsap.from('#countdown .time-box', {
        opacity: 0,
        y: 24,
        duration: 0.7,
        stagger: 0.1,
        ease: 'power2.out',
      });
    },
  });
}
