# Clicker.exe — v1.6 update

A retro CRT clicker game built from the ClickerJs project. The playable game and landing page live in the same website, with one local save and one shared Master Settings panel.

## Run locally on macOS

1. Install Node.js (the LTS release is recommended).
2. Open Terminal in this project folder.
3. Install the project dependencies if needed:

   ```bash
   npm install
   ```

4. Build the game bundle:

   ```bash
   npm run build
   ```

5. Serve the website from `app/public` (do not open `index.html` directly if you can avoid it):

   ```bash
   npx http-server app/public
   ```

6. Open the local URL printed by `http-server` in your browser.

`npm test` runs the build as a basic project check.

## What's included

- Retro startup landing page with **Launch Game**, built-in Legal & Credits, Source Code, and Master Settings links.
- The existing CRT game, mouse button, loading bar, and shop visuals preserved.
- Shared audio/accessibility preferences for the landing page and game.
- First-launch photosensitivity warning and Reduced Flashing setting.
- Browser-local autosave for current gameplay and long-term progression.
- Gameplay-only reset and full reset, with confirmation.
- Achievements with one-time Power-Up Point rewards; Conception, Learned a Lesson, and Kindergeld are hidden until unlocked.
- Buyable Hacker and AI boosts plus Emergency Patch, which helps with the next glitch.
- Simulated glitch/crash countdown, recovery feedback, escalating rebirth difficulty, and Close Call.
- Generated Web Audio sound effects and optional retro background music; no external audio files are currently used.

## Save and reset notes

Game progress and Master Settings are stored separately in the browser's local storage. Clearing site data in your browser can remove local saves. Gameplay-only Reset preserves permanent achievements, points, career records, and rebirth history. Full Reset removes game progress and permanent progression but intentionally preserves audio and accessibility preferences.

## Before publishing

- The Source Code link currently points to your fork: `https://github.com/az75852-cell/ClickerJs`. Change `SOURCE_CODE_URL` in `app/index.jsx` if you later move the project to another repository.
- Verify the license and attribution requirements for the source project and for every asset you add. The in-site legal page is a starter template, not legal advice.
- Test the first-launch photosensitivity/epilepsy warning, Reduced Flashing, saving, resets, rebirth, and glitch countdown in your target browsers before release.
