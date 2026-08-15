# Naomi & Moses — wedding site

Plain HTML/CSS/JS, no build step, no framework. GSAP + ScrollTrigger via CDN for motion.

## Structure
- `index.html` — all markup, single page
- `css/style.css` — design tokens (`:root`) + all styles
- `js/main.js` — opening sequence, countdown, scroll reveals, RSVP handling
- `assets/` — photos, audio, og-image

## Design language
Their story began in a choir, so motion and imagery lean on a music motif rather
than generic effects — waveform loader, spinning record as the "open" button,
a groove/needle-drop reveal into the page. Keep that thread if adding new
motion; don't default to generic fades/wipes without a reason tied to the brief.

Palette (see `:root` in style.css): brown `#654633`, peach `#FFB98D`,
pink `#F3DEE9`, lavender `#EAEAF4`, cream `#FBF3EA`.
Type: Cormorant Garamond (display/headings), Jost (body/nav).

## Conventions
- No React/Vue/build tooling — this stays vanilla so it's easy to host anywhere.
- Every animation must have a `prefers-reduced-motion` fallback (see bottom of style.css).
- GSAP timelines live in `js/main.js` only — don't inline `<script>` blocks in HTML.
- Comments in code are fine and encouraged here (unlike some other environments).

## When to delegate
- Animation/timing/GSAP work → `motion-engineer` subagent
- New copy (travel section, gift wording, RSVP microcopy) → `content-writer` subagent
- Pre-ship checks (mobile, reduced motion, form validation, link previews) → `qa-reviewer` subagent
