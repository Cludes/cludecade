# Browser Game Boy

A zero-backend retro emulator that runs entirely in the browser and deploys to GitHub Pages via GitHub Actions. Bring your own ROM; it never leaves your device.

Powered by [EmulatorJS](https://emulatorjs.org) (RetroArch cores compiled to WebAssembly). Supports Game Boy, Game Boy Color, Game Boy Advance, NES, and SNES.

## How it works

- **GitHub Pages** hosts the static site (`index.html`, `style.css`, `app.js`).
- **GitHub Actions** (`.github/workflows/deploy.yml`) deploys the site on every push.
- The emulator core is loaded from the EmulatorJS CDN and runs in WASM, client-side.
- The ROM is chosen with a file picker or drag-and-drop and turned into an in-memory blob. Nothing is uploaded anywhere.
- Zipped ROMs (`.zip`) are supported - the correct core is detected by reading the archive's entry names.

## Quick resume

Recently played ROMs are stored in your browser (IndexedDB, up to 10) and listed on the start screen, so you can jump back into a game with one click instead of re-picking the file each visit. Each entry shows its size, when it was last played, and total play time. Remove any entry with the "x" button, or use **Clear all** to wipe stored ROMs (your in-game saves are not affected). A storage-usage readout shows how much space is in use. ROM bytes are kept locally on your device only.

## Saves

Two independent kinds of saves, both stored automatically in this browser via IndexedDB:

1. **In-game save (`.sav`)** - the cartridge battery save written when you save inside the game.
2. **Save state (`.state`)** - a full snapshot of the console you can resume from anywhere.

Browser storage is per-browser and per-device, and can be cleared. Use the **Export** buttons to download a save as a real file for backup, and **Import** to restore it (including on another device or browser).

- Save states import live and work instantly - the most reliable way to move progress between devices.
- `.sav` import writes to the cartridge save and reloads it; then load your save from inside the game as usual.

### Autosave to a real file

Click **Link file** to pick a `.sav` on your disk. From then on, every time the game writes its cartridge save, it is mirrored automatically to that file - no manual export needed. The link is remembered between visits (you just re-confirm permission with a click).

This uses the [File System Access API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API), which is available in Chromium browsers (Chrome, Edge, Opera). In Firefox and Safari the button is disabled and you fall back to automatic IndexedDB persistence plus the manual Export button.

For durable storage, modern browsers honor [`navigator.storage.persist()`](https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/persist).

## Deploy

1. Push this repo to GitHub.
2. In the repo: **Settings -> Pages -> Build and deployment -> Source -> GitHub Actions**.
3. Push to `main`/`master` (or run the workflow manually). The site publishes at the URL shown in the Actions run.

## Run locally

Any static file server works, for example:

```
python -m http.server 8000
```

Then open http://localhost:8000.

## Legal

Emulators are legal. Game ROMs are copyrighted. Use ROMs you are legally entitled to, and do not commit copyrighted ROMs to a public repository (the `.gitignore` blocks common ROM and save extensions by default).
