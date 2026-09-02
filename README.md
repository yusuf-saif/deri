# Naomi & Moses — wedding site

Plain HTML/CSS/JS, no build step, no framework. GSAP + ScrollTrigger via CDN for motion.
The song is a gentle generative music-box love song built with the Web Audio API — no audio files required.

## Structure
```
index.html      opening sequence + hero, story, moments, quote, wedding, travel, RSVP
css/style.css   design tokens, opening sequence, photo sections, music player,
                responsive + reduced motion
js/main.js      loading counter, groove reveal, love-song music box, scroll choreography,
                countdown, nav, RSVP
assets/         drop photos / a real song / og-image here
```

## Design language
Their story began in a choir, so the whole site speaks music: a waveform loader,
a spinning record as the "open" button, a groove that ripples outward like a needle
drop to reveal the page, sound-wave dividers, a music-staff texture, and a music-box
love song (I–V–vi–IV waltz) that begins the moment the invitation is opened.
HD finish: full-bleed Seychelles photography with a slow Ken Burns drift and scroll
parallax, film grain, gold ornaments, glass countdown chips and a polaroid gallery.

## Photography
The hero, quote and gallery use free Unsplash photos (hotlinked from `images.unsplash.com`
via CSS variables in style.css `--img-hero` / `--img-quote` and the `<img>` srcs in
index.html). To use the couple's own photos: drop files into `assets/`, swap the URLs,
and add them to `assetsToPreload` in main.js so the loader reflects real progress.
Every image is wrapped so a failed load shows an elegant gradient instead of a broken icon.

## Love song
- Built in `Music` (js/main.js): a C–G–Am–F waltz music box with a gentle reverb,
  scheduled note-by-note via the Web Audio API. No asset needed.
- To use a real track instead: drop it at `assets/audio/love-song.mp3` and it will
  automatically replace the synthesized melody. Keep it royalty-free/owned.
- The round player button (bottom-right) toggles play/pause; audio starts inside the
  opening tap gesture so it is never blocked by autoplay policies.

## To make this real
1. Swap in the couple's own photos (see above) and refresh the `og:image`/`twitter:image`
   meta URLs in index.html (a 1200×630 crop of the hero image is used as a placeholder).
2. RSVP form saves submissions to a Google Sheet and emails the couple on each
   RSVP via a Google Apps Script web app. Set it up:
   1. Create a Google Sheet (e.g. "Naomi & Moses RSVPs") with an empty first sheet.
   2. In the sheet: **Extensions → Apps Script**, replace the default code with
      the `doPost()` handler below, then **Deploy → New deployment → Web app**,
      run as **Me**, access **Anyone**, and copy the deployment URL.
   3. Paste that URL into `RSVP_SCRIPT_URL` at the top of the RSVP section in
      `js/main.js`, and confirm the email in `MailApp.sendEmail.to` is correct.

      ```javascript
      function doPost(e) {
        const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
        const data = JSON.parse(e.postData.contents);
        sheet.appendRow([new Date(), data.name, data.phone, data.party_size]);
        MailApp.sendEmail({
          to: 'abigaildoose12@gmail.com',
          subject: 'New RSVP: ' + data.name,
          body: 'Name: ' + data.name + '\n' +
                'Phone: ' + data.phone + '\n' +
                'Party size: ' + data.party_size + '\n' +
                'Time: ' + new Date()
        });
        return ContentService
          .createTextOutput(JSON.stringify({ status: 'ok' }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      ```
3. Swap in your own song (see above).
4. Confirm `prefers-reduced-motion` on: CSS disables the Ken Burns drift, record spin,
   bounces and equalizer bars; JS reveals content without the choreography. Also test
   the mobile menu, gallery, and RSVP validation before sending invitations.

## Local preview
Open `index.html` in a browser, or serve it (`npx serve .`) so the Google Fonts, GSAP
and Unsplash calls resolve cleanly. The music toggle and song need a user gesture to
start — that's the "tap to begin" screen.
