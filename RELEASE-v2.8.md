# Pasko ng Angkan 2026 — v2.8 Christmas Banner Animation

## What changed

- The original dark-blue gradient, “CHRISTMAS FELLOWSHIP CELEBRATION”, event title and date remain present and unchanged.
- Only the blue event banner has new artwork: **Winter snowfall → Christmas tree → Nativity (Birth of Jesus)**. Scenes crossfade automatically about every 8 seconds and repeat.
- Falling snow drifts over the banner; a delicate, temporary snow-dusting effect appears above “2026”. All animation is decorative and never blocks taps or clicks.
- Responsive layout for phones and desktops. When a visitor enables **Reduce Motion** in their OS/browser, the animation stops and a static Nativity is shown.
- Animation pauses when the tab is hidden or the banner has scrolled offscreen.
- No external stock photos, tracking, fonts, CDN or API calls. All artwork is included as SVG in `index.html`; snow and transitions use local CSS/JS.

## GitHub Pages installation (v2.7 → v2.8)

1. Back up the existing GitHub files.
2. Replace `index.html` in the repository root with the v2.8 copy.
3. **Add these two NEW files** (keep the exact folders and names):
   - `assets/css/hero-animation.css`
   - `assets/js/hero-animation.js`
4. Keep your existing `assets/css/style.css`, `assets/js/app.js`, `assets/js/api.js`, and Google Apps Script Code.gs unchanged. This package includes the full repository to simplify uploading, but **only the files above changed** from v2.7.
5. Commit to the branch deployed by GitHub Pages and wait for the GitHub Actions Pages workflow to succeed. Refresh your website, preferably bypassing the old browser cache.

No Google Sheets data, schema, script properties, or Apps Script deployment needs changing.

## Notes

The event data layer and the user's existing committees, tasks, permissions, login, finance and food modules are untouched. This animation is visual-only and does not edit or send any information.
