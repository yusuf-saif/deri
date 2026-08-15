# Naomi & Moses — wedding site scaffold

Plain HTML/CSS/JS, no build step. GSAP (+ ScrollTrigger) loaded via CDN for motion.

## Structure
```
wedding-site/
  index.html      opening sequence + all sections
  css/style.css   design tokens, opening sequence, layout
  js/main.js      loading counter, reveal transition, countdown, scroll reveals, RSVP
  assets/         put photos, audio, og-image here
```

## Signature idea
Their story started in a choir, so the opening borrows music's language instead of
a generic spinner: a waveform loading bar, a spinning record as the "open" button,
and a groove that expands outward like a needle drop to reveal the page.

## To make this real
1. Drop real photos into `assets/`, reference them in the `.story-chapter` markup
   and as the hero background.
2. Point `assetsToPreload` in `main.js` at the actual hero image(s) so the loading
   percentage reflects real load progress, not a fake timer.
3. Wire the RSVP form to a real endpoint — Formspree/Basin for zero backend, or a
   Supabase table if you want the data queryable later.
4. Generate a real `og-image.jpg` (1200×630) so shared links preview properly.
5. Add a Travel & Logistics section (flights, visas, hotel block) — see prior review.
6. Test with `prefers-reduced-motion` on — the CSS already disables the record
   spin and bounce, confirm the reveal transition also degrades gracefully.

## Local preview
Just open `index.html` in a browser, or serve it (`npx serve .`) so the Google
Fonts and GSAP CDN calls resolve cleanly.
