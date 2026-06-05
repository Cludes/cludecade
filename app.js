// Map ROM file extension -> EmulatorJS core name.
const CORES = {
  gb: "gb",
  gbc: "gbc",
  gba: "gba",
  nes: "nes",
  sfc: "snes",
  smc: "snes",
  snes: "snes",
  // Nintendo
  n64: "n64",
  z64: "n64",
  v64: "n64",
  nds: "nds",
  // Sony (single-file PS1 format; disc images are handled via the console picker)
  pbp: "psx",
  // Sega
  md: "segaMD",
  gen: "segaMD",
  smd: "segaMD",
  gg: "segaGG",
  sms: "segaMS",
  // Others
  pce: "pce",
  vb: "vb",
  a26: "atari2600",
  a78: "atari7800",
  lnx: "lynx",
  ngp: "ngp",
  ngc: "ngp",
  ws: "ws",
  wsc: "ws",
  col: "coleco",
};

// EmulatorJS core name to request. The gambatte "gb" core handles both Game Boy
// and Game Boy Color - EmulatorJS has no "gbc" core, so requesting it 404s.
const EJS_CORE = { gb: "gb", gbc: "gb", gba: "gba", nes: "nes", snes: "snes" };

// Friendly system names for the "Now playing" badge.
const SYSTEMS = {
  gb: "Game Boy",
  gbc: "Game Boy Color",
  gba: "Game Boy Advance",
  nes: "NES",
  snes: "SNES",
  n64: "Nintendo 64",
  nds: "Nintendo DS",
  psx: "PlayStation",
  segaMD: "Sega Genesis",
  segaGG: "Game Gear",
  segaMS: "Master System",
  pce: "PC Engine",
  vb: "Virtual Boy",
  atari2600: "Atari 2600",
  atari7800: "Atari 7800",
  lynx: "Atari Lynx",
  ngp: "Neo Geo Pocket",
  ws: "WonderSwan",
  coleco: "ColecoVision",
};

// Screen aspect ratio per core so games fill the frame instead of letterboxing.
const ASPECT = {
  gb: "10 / 9",
  gbc: "10 / 9",
  gba: "3 / 2",
  nes: "8 / 7",
  snes: "4 / 3",
  n64: "4 / 3",
  nds: "2 / 3",
  psx: "4 / 3",
  segaMD: "4 / 3",
  segaGG: "10 / 9",
  segaMS: "4 / 3",
  pce: "4 / 3",
  vb: "12 / 7",
  atari2600: "4 / 3",
  atari7800: "4 / 3",
  lynx: "80 / 51",
  ngp: "20 / 19",
  ws: "14 / 9",
  coleco: "4 / 3",
};

let romName = "game";
let currentFileName = "";
let currentCore = "";
let emulatorReady = false;
let bootTimer = null;
let gameRunning = false;

// Curated per-game cheat database, auto-applied when a matching ROM loads.
// Loaded once at startup; matching is done by normalised filename.
let cheatsDb = [];
let matchedCheatGame = null;
// Kept as a promise so the boot path can await it - otherwise a fast ROM load
// could race ahead of the fetch and apply no cheats.
const cheatsReady = fetch("cheats.json")
  .then((r) => (r.ok ? r.json() : []))
  .then((d) => (cheatsDb = d))
  .catch(() => []);

// Find the cheat entry whose system matches the core and whose match tokens all
// appear in the ROM filename. Entries are ordered specific-first (e.g. FireRed
// before Red) so the first hit wins. The system check stops same-named games on
// different consoles from colliding (e.g. GB vs NES Zelda).
function findCheats(fileName, core) {
  const compact = fileName.toLowerCase().replace(/[^a-z0-9]+/g, "");
  for (const entry of cheatsDb) {
    if (entry.system && entry.system !== core) continue;
    for (const tokens of entry.match) {
      if (tokens.every((t) => compact.includes(t))) return entry;
    }
  }
  return null;
}

const romInput = document.getElementById("rom-input");
const picker = document.getElementById("picker");
const pickerError = document.getElementById("picker-error");
const recentWrap = document.getElementById("recent");
const recentList = document.getElementById("recent-list");
const storageEl = document.getElementById("storage");
const clearRomsBtn = document.getElementById("clear-roms");
const builtinWrap = document.getElementById("builtin");
const builtinList = document.getElementById("builtin-list");
const romUrlInput = document.getElementById("rom-url");
const loadUrlBtn = document.getElementById("load-url");
const gameWrap = document.getElementById("game-wrap");
const loadingEl = document.getElementById("loading");
const saveControls = document.getElementById("save-controls");
const statusEl = document.getElementById("status");

const exportSavBtn = document.getElementById("export-sav");
const importSavInput = document.getElementById("import-sav");
const exportStateBtn = document.getElementById("export-state");
const importStateInput = document.getElementById("import-state");
const linkAutosaveBtn = document.getElementById("link-autosave");
const autosaveState = document.getElementById("autosave-state");
const linkAutostateBtn = document.getElementById("link-autostate");
const loadAutostateBtn = document.getElementById("load-autostate");
const autostateState = document.getElementById("autostate-state");
const exportBackupBtn = document.getElementById("export-backup");
const importBackupInput = document.getElementById("import-backup");
const autostateInterval = document.getElementById("autostate-interval");
const nowPlayingName = document.getElementById("now-playing-name");
const nowPlayingSystem = document.getElementById("now-playing-system");
const changeGameBtn = document.getElementById("change-game");

// Reloading is the only clean way back to the picker, since EmulatorJS only
// initialises once per page load. Recent ROMs persist, so the game list is
// right there to resume from.
changeGameBtn.addEventListener("click", () => {
  if (confirm("Return to the game list? Make sure you've saved in-game first.")) {
    location.reload();
  }
});

romInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (file) loadRomFile(file);
});

// Drag and drop onto the picker.
["dragenter", "dragover"].forEach((ev) =>
  picker.addEventListener(ev, (e) => {
    e.preventDefault();
    picker.classList.add("dragover");
  })
);
["dragleave", "drop"].forEach((ev) =>
  picker.addEventListener(ev, (e) => {
    e.preventDefault();
    picker.classList.remove("dragover");
  })
);
picker.addEventListener("drop", (e) => {
  const file = e.dataTransfer.files[0];
  if (file) loadRomFile(file);
});

function showError(msg) {
  pickerError.textContent = msg;
  pickerError.hidden = false;
}

function hideError() {
  pickerError.hidden = true;
}

// Console chosen on the front page (null = auto-detect from the file extension).
let selectedCore = null;
// Don't cache very large ROMs (PS1 / N64 etc.) for quick-resume - it would fill
// IndexedDB. They still play, just won't appear in the recent list.
const MAX_CACHE_BYTES = 48 * 1024 * 1024;

// Validate, persist for quick-resume, then boot. Shared by the file picker,
// drag-drop, the built-in shelf, and load-from-URL. coreOverride forces a core
// (used when a console is picked, e.g. for disc images detection can't identify).
async function loadRomData(name, bytes, coreOverride) {
  hideError();
  const core = coreOverride || (await detectCore(name, bytes));
  if (!core) {
    showError("Unsupported or unrecognised ROM: " + name + ". Pick a console above if it can't be auto-detected.");
    return;
  }
  if (bytes.length <= MAX_CACHE_BYTES) await saveRom(name, core, bytes).catch(() => {});
  bootFromBytes(name, core, bytes);
}

async function loadRomFile(file) {
  loadRomData(file.name, new Uint8Array(await file.arrayBuffer()), selectedCore);
}

// Load a ROM from any URL the user pastes (we host nothing). Subject to the
// remote host's CORS policy.
async function loadRomFromUrl(url) {
  hideError();
  let res;
  try {
    res = await fetch(url);
  } catch (e) {
    showError("Could not fetch that URL (network or CORS blocked).");
    return;
  }
  if (!res.ok) {
    showError("Could not fetch ROM (HTTP " + res.status + ").");
    return;
  }
  const name = (url.split("/").pop() || "game").split("?")[0] || "game";
  loadRomData(name, new Uint8Array(await res.arrayBuffer()));
}

// Load a bundled homebrew ROM (same-origin asset).
async function loadBuiltin(file) {
  hideError();
  try {
    const res = await fetch(file);
    if (!res.ok) throw new Error("HTTP " + res.status);
    loadRomData(file.split("/").pop(), new Uint8Array(await res.arrayBuffer()));
  } catch (e) {
    showError("Could not load built-in game: " + e.message);
  }
}

// Resolve a core from the filename, peeking inside zips when needed.
async function detectCore(fileName, bytes) {
  const ext = fileName.split(".").pop().toLowerCase();
  if (ext !== "zip") return CORES[ext] || null;
  for (const inner of readZipEntryNames(bytes)) {
    const core = CORES[inner.split(".").pop().toLowerCase()];
    if (core) return core;
  }
  return null;
}

function bootFromBytes(fileName, core, bytes) {
  romName = fileName.replace(/\.[^.]+$/, "");
  currentFileName = fileName;
  currentCore = core;
  document.title = romName + " - Cludecade";
  startPlayTracking(fileName);
  const url = URL.createObjectURL(new Blob([bytes], { type: "application/octet-stream" }));
  bootEmulator(core, url, fileName);
}

// EmulatorJS can only be initialised once per page load, so swap the picker
// for the game and inject the loader with the chosen ROM.
async function bootEmulator(core, romUrl, fileName) {
  picker.hidden = true;
  gameWrap.hidden = false;
  document.body.classList.add("playing");
  loadingEl.textContent = "Loading " + fileName + "...";
  loadingEl.hidden = false;

  window.EJS_player = "#game";
  window.EJS_core = EJS_CORE[core] || core;
  window.EJS_gameUrl = romUrl;
  // A blob: URL changes every session; pin the storage key to the filename so
  // auto-saved SRAM and save states survive page reloads.
  window.EJS_gameName = fileName;
  window.EJS_pathtodata = "https://cdn.emulatorjs.org/stable/data/";
  window.EJS_startOnLoaded = true;
  // Disable EmulatorJS's right-click context menu (it pops up on right-click /
  // trackpad two-finger tap and feels intrusive). Same options remain in its
  // bottom control bar.
  window.EJS_Buttons = { rightClick: false };
  window.EJS_ready = onEmulatorReady;
  // Fired whenever the cartridge save changes (deduped by hash). Mirror it to
  // the linked on-disk file if the user has set one up.
  window.EJS_onSaveUpdate = (e) => {
    if (e && e.save) writeAutosave(e.save);
  };

  // Wait for the cheat DB so EJS_cheats is populated before the loader runs.
  await cheatsReady;
  matchedCheatGame = findCheats(fileName, core);
  window.EJS_cheats = matchedCheatGame ? matchedCheatGame.cheats : [];

  const script = document.createElement("script");
  script.src = "https://cdn.emulatorjs.org/stable/data/loader.js";
  document.body.appendChild(script);

  // If the emulator never signals ready (e.g. the CDN is unreachable), surface
  // a clear error instead of an endless spinner. Heavy cores (N64/PS1/DS)
  // download large WASM and init slowly, so allow generous time before erroring.
  bootTimer = setTimeout(() => {
    if (!emulatorReady) {
      loadingEl.classList.add("failed");
      loadingEl.textContent = "The emulator failed to load. Check your connection and reload the page.";
    }
  }, 60000);
}

function onEmulatorReady() {
  emulatorReady = true;
  gameRunning = true;
  if (bootTimer) clearTimeout(bootTimer);
  renderController(currentCore);
  if (gameWrap) gameWrap.dataset.system = currentCore;
  updateControls();
  loadingEl.hidden = true;
  saveControls.hidden = false;
  nowPlayingName.textContent = currentFileName;
  nowPlayingSystem.textContent = SYSTEMS[currentCore] || "";
  // Match the screen box to the system so games fill it (no letterboxing).
  const gameEl = document.getElementById("game");
  if (gameEl) {
    gameEl.style.aspectRatio = ASPECT[currentCore] || "10 / 9";
    window.dispatchEvent(new Event("resize"));
  }
  exportSavBtn.disabled = false;
  importSavInput.disabled = false;
  exportStateBtn.disabled = false;
  importStateInput.disabled = false;
  exportBackupBtn.disabled = false;
  importBackupInput.disabled = false;

  if (window.showSaveFilePicker) {
    linkAutosaveBtn.disabled = false;
    linkAutostateBtn.disabled = false;
    restoreAutosave();
    restoreAutostate();
  } else {
    autosaveState.textContent = "Not supported in this browser. Use Export .sav instead.";
    autostateState.textContent = "Not supported in this browser. Use Export state instead.";
  }

  if (matchedCheatGame) {
    setStatus(
      matchedCheatGame.cheats.length +
        " cheats loaded for " +
        matchedCheatGame.game +
        ". Open the Cheats menu (right-click or the menu button) to turn them on."
    );
  }
}

function gm() {
  const emu = window.EJS_emulator;
  return emu && emu.gameManager ? emu.gameManager : null;
}

let statusTimer = null;
function setStatus(msg) {
  statusEl.textContent = msg;
  if (statusTimer) clearTimeout(statusTimer);
  // Transient feedback shouldn't linger as a stale chip.
  if (msg) statusTimer = setTimeout(() => (statusEl.textContent = ""), 6000);
}

function downloadBytes(bytes, filename) {
  const blob = new Blob([bytes], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Local YYYYMMDD-HHMMSS stamp for versioned, non-colliding backup filenames.
function timestamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return (
    d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + "-" + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds())
  );
}

// --- Screenshot (uses EmulatorJS's core capture, writes a real PNG) ---

const screenshotBtn = document.getElementById("screenshot-btn");
async function takeScreenshot() {
  const g = gm();
  if (!g || typeof g.screenshot !== "function") {
    setStatus("Screenshot not available yet.");
    return;
  }
  try {
    const data = await g.screenshot();
    const base = (nowPlayingName.textContent || "screenshot").replace(/\.[^.]+$/, "") || "screenshot";
    downloadBytes(data, base + "-" + timestamp() + ".png");
    setStatus("Screenshot saved.");
  } catch (e) {
    setStatus("Screenshot failed.");
  }
}
if (screenshotBtn) screenshotBtn.addEventListener("click", takeScreenshot);

// --- Fast-forward toggle (EmulatorJS core fast-forward, ratio ~3x) ---

const fastForwardBtn = document.getElementById("fast-forward-btn");
let fastForwardOn = false;
function toggleFastForward() {
  const g = gm();
  if (!g || typeof g.toggleFastForward !== "function") {
    setStatus("Fast-forward not available yet.");
    return;
  }
  fastForwardOn = !fastForwardOn;
  g.toggleFastForward(fastForwardOn ? 1 : 0);
  reflectToggle(fastForwardBtn, fastForwardOn);
  setStatus(fastForwardOn ? "Fast-forward on (3x)." : "Fast-forward off.");
}
if (fastForwardBtn) fastForwardBtn.addEventListener("click", toggleFastForward);

// --- In-game save (.sav / SRAM) ---

exportSavBtn.addEventListener("click", () => {
  const g = gm();
  if (!g) return;
  const data = g.getSaveFile();
  if (!data || !data.length) {
    setStatus("No in-game save found yet. Save inside the game first.");
    return;
  }
  downloadBytes(data, romName + ".sav");
  setStatus("Exported " + romName + ".sav");
});

importSavInput.addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const g = gm();
  if (g) {
    const data = new Uint8Array(await file.arrayBuffer());
    // Write to the core's SRAM path, then ask the core to re-read it live.
    g.writeFile(g.getSaveFilePath(), data);
    g.loadSaveFiles();
    setStatus("Imported " + file.name + ". Load your save inside the game.");
  }
  e.target.value = "";
});

// --- Save state (full snapshot) ---

exportStateBtn.addEventListener("click", async () => {
  const g = gm();
  if (!g) return;
  const data = await g.getState();
  if (!data || !data.length) {
    setStatus("Could not read save state.");
    return;
  }
  downloadBytes(data, romName + ".state");
  setStatus("Exported " + romName + ".state");
});

importStateInput.addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const g = gm();
  if (g) {
    const data = new Uint8Array(await file.arrayBuffer());
    g.loadState(data);
    setStatus("Loaded state from " + file.name);
  }
  e.target.value = "";
});

// --- Autosave to a real on-disk file (File System Access API) ---

let autosaveHandle = null;
let writing = false;
let pendingBytes = null;

function setAutosaveState(msg) {
  autosaveState.textContent = msg;
}

// FileSystemFileHandles are structured-cloneable, so we can stash them in
// IndexedDB and reconnect to the same file on the next visit.
function handleDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("bgb-autosave", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("handles");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function storeHandle(key, handle) {
  const db = await handleDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("handles", "readwrite");
    tx.objectStore("handles").put(handle, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function readHandle(key) {
  const db = await handleDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("handles", "readonly");
    const req = tx.objectStore("handles").get(key);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

async function writeAutosave(bytes) {
  if (!autosaveHandle) return;
  // Coalesce overlapping writes so we never open two writables at once.
  if (writing) {
    pendingBytes = bytes;
    return;
  }
  writing = true;
  try {
    const writable = await autosaveHandle.createWritable();
    await writable.write(bytes);
    await writable.close();
    setAutosaveState("Saved to " + autosaveHandle.name + " at " + new Date().toLocaleTimeString());
  } catch (err) {
    setAutosaveState("Autosave failed: " + err.message);
  }
  writing = false;
  if (pendingBytes) {
    const next = pendingBytes;
    pendingBytes = null;
    writeAutosave(next);
  }
}

// On load, silently reconnect to a previously linked file if permission is
// still granted. Browsers require a click to re-prompt, so otherwise we wait.
async function restoreAutosave() {
  const handle = await readHandle(romName).catch(() => null);
  if (!handle) return;
  const perm = await handle.queryPermission({ mode: "readwrite" });
  if (perm === "granted") {
    autosaveHandle = handle;
    setAutosaveState("Autosaving to " + handle.name);
  } else {
    setAutosaveState('Click "Link file" to resume autosaving to ' + handle.name);
  }
}

linkAutosaveBtn.addEventListener("click", async () => {
  try {
    let handle = await readHandle(romName).catch(() => null);
    if (handle) {
      const perm = await handle.requestPermission({ mode: "readwrite" });
      if (perm !== "granted") handle = null;
    }
    if (!handle) {
      handle = await window.showSaveFilePicker({
        suggestedName: romName + ".sav",
        types: [{ description: "Save file", accept: { "application/octet-stream": [".sav", ".srm"] } }],
      });
      await storeHandle(romName, handle);
    }
    autosaveHandle = handle;
    setAutosaveState("Autosaving to " + handle.name);

    // Seed the file with the current save so it isn't empty until the next change.
    const g = gm();
    if (g) {
      const current = g.getSaveFile();
      if (current && current.length) writeAutosave(current);
    }
  } catch (err) {
    if (err.name !== "AbortError") setAutosaveState("Could not link file: " + err.message);
  }
});

// --- Autosave save-state to a real on-disk file (periodic snapshot) ---
// No EJS_onSaveUpdate equivalent exists for save states, so we poll getState()
// on a timer. The handle lives in the same "bgb-autosave" store, keyed by
// romName + ".state" to keep it distinct from the .sav handle.

let autostateHandle = null;
let stateWriting = false;
let statePending = null;
let stateTimer = null;
let lastStateCrc = null;

function setAutostateState(msg) {
  autostateState.textContent = msg;
}

function autostateKey() {
  return romName + ".state";
}

async function writeAutostate(bytes) {
  if (!autostateHandle || !bytes || !bytes.length) return;
  if (stateWriting) {
    statePending = bytes;
    return;
  }
  stateWriting = true;
  try {
    const writable = await autostateHandle.createWritable();
    await writable.write(bytes);
    await writable.close();
    setAutostateState("State saved to " + autostateHandle.name + " at " + new Date().toLocaleTimeString());
  } catch (err) {
    setAutostateState("State autosave failed: " + err.message);
  }
  stateWriting = false;
  if (statePending) {
    const next = statePending;
    statePending = null;
    writeAutostate(next);
  }
}

// Periodic snapshot while a game is running and a file is linked. The state is
// only written when it actually changed (cheap crc32 check), so a paused game
// doesn't rewrite the file every tick.
async function snapshotState() {
  if (!autostateHandle) return;
  const g = gm();
  if (!g) return;
  try {
    const bytes = await g.getState();
    if (!bytes || !bytes.length) return;
    const crc = crc32(bytes);
    if (crc === lastStateCrc) return;
    lastStateCrc = crc;
    writeAutostate(bytes);
  } catch (err) {
    /* transient; next tick will retry */
  }
}

function startStateTimer(ms) {
  if (stateTimer) clearInterval(stateTimer);
  stateTimer = setInterval(snapshotState, ms);
}

// Restore the saved interval, default 20s.
autostateInterval.value = localStorage.getItem("bgb-state-interval") || "20000";
startStateTimer(Number(autostateInterval.value));
autostateInterval.addEventListener("change", () => {
  localStorage.setItem("bgb-state-interval", autostateInterval.value);
  startStateTimer(Number(autostateInterval.value));
});

async function restoreAutostate() {
  const handle = await readHandle(autostateKey()).catch(() => null);
  if (!handle) return;
  const perm = await handle.queryPermission({ mode: "readwrite" });
  if (perm === "granted") {
    autostateHandle = handle;
    loadAutostateBtn.disabled = false;
    setAutostateState("Autosaving state to " + handle.name);
  } else {
    setAutostateState('Click "Link state file" to resume autosaving to ' + handle.name);
  }
}

linkAutostateBtn.addEventListener("click", async () => {
  try {
    let handle = await readHandle(autostateKey()).catch(() => null);
    if (handle) {
      const perm = await handle.requestPermission({ mode: "readwrite" });
      if (perm !== "granted") handle = null;
    }
    if (!handle) {
      handle = await window.showSaveFilePicker({
        suggestedName: romName + ".state",
        types: [{ description: "Save state", accept: { "application/octet-stream": [".state"] } }],
      });
      await storeHandle(autostateKey(), handle);
    }
    autostateHandle = handle;
    loadAutostateBtn.disabled = false;
    setAutostateState("Autosaving state to " + handle.name);

    // Seed the file with the current state so "Load latest" works immediately.
    const g = gm();
    if (g) {
      const bytes = await g.getState();
      if (bytes && bytes.length) {
        lastStateCrc = crc32(bytes);
        writeAutostate(bytes);
      }
    }
  } catch (err) {
    if (err.name !== "AbortError") setAutostateState("Could not link state file: " + err.message);
  }
});

loadAutostateBtn.addEventListener("click", async () => {
  const g = gm();
  if (!g || !autostateHandle) return;
  try {
    const file = await autostateHandle.getFile();
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!bytes.length) {
      setAutostateState("Linked state file is empty.");
      return;
    }
    g.loadState(bytes);
    setAutostateState("Loaded state from " + autostateHandle.name);
  } catch (err) {
    setAutostateState("Could not load state: " + err.message);
  }
});

// --- One-file backup: ROM + .sav + .state bundled as a single .zip ---

exportBackupBtn.addEventListener("click", async () => {
  const g = gm();
  if (!g) return;
  const files = [];

  const rec = await romTx("roms", "readonly", (s) => s.get(currentFileName)).catch(() => null);
  if (rec && rec.bytes) files.push({ name: rec.fileName, bytes: new Uint8Array(rec.bytes) });

  const sav = g.getSaveFile();
  if (sav && sav.length) files.push({ name: romName + ".sav", bytes: sav });

  const state = await g.getState();
  if (state && state.length) files.push({ name: romName + ".state", bytes: state });

  if (!files.length) {
    setStatus("Nothing to back up yet.");
    return;
  }
  downloadBytes(makeZip(files), romName + "-backup-" + timestamp() + ".zip");
  setStatus("Exported backup with " + files.length + " file(s).");
});

importBackupInput.addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const g = gm();
  const bytes = new Uint8Array(await file.arrayBuffer());
  const applied = [];
  for (const entry of readZipEntries(bytes)) {
    const ext = entry.name.split(".").pop().toLowerCase();
    if (CORES[ext]) {
      await saveRom(entry.name, CORES[ext], entry.bytes).catch(() => {});
      applied.push("ROM");
    } else if ((ext === "sav" || ext === "srm") && g) {
      g.writeFile(g.getSaveFilePath(), entry.bytes);
      g.loadSaveFiles();
      applied.push(".sav");
    } else if (ext === "state" && g) {
      g.loadState(entry.bytes);
      applied.push("state");
    }
  }
  setStatus(applied.length ? "Imported from backup: " + applied.join(", ") + "." : "No usable files in backup.");
  e.target.value = "";
});

// --- Quick-resume: persist ROMs in IndexedDB and list recent ones ---

const MAX_RECENT = 10;

function romDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("bgb-roms", 2);
    req.onupgradeneeded = () => {
      const db = req.result;
      // "roms" holds the (large) ROM bytes; "meta" holds small per-game stats
      // (play time) so bumping a counter never rewrites a 32MB record.
      if (!db.objectStoreNames.contains("roms")) db.createObjectStore("roms", { keyPath: "fileName" });
      if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta", { keyPath: "fileName" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// Run one transaction on a store and resolve with the request's result (if any).
async function romTx(store, mode, fn) {
  const db = await romDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const req = fn(tx.objectStore(store));
    tx.oncomplete = () => resolve(req ? req.result : undefined);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

async function saveRom(fileName, core, bytes) {
  // ROM bytes live in "roms"; lastPlayed lives in "meta" so bumping the
  // timestamp on resume never rewrites the (up to 32MB) ROM record.
  await romTx("roms", "readwrite", (s) => s.put({ fileName, core, bytes }));
  await touchLastPlayed(fileName);
  await evictOldRoms();
  renderRecent();
}

async function touchLastPlayed(fileName) {
  const meta = await getMeta(fileName);
  meta.lastPlayed = Date.now();
  await romTx("meta", "readwrite", (s) => s.put(meta));
}

async function listRoms() {
  const roms = (await romTx("roms", "readonly", (s) => s.getAll())) || [];
  const metas = (await romTx("meta", "readonly", (s) => s.getAll())) || [];
  const metaByName = {};
  for (const m of metas) metaByName[m.fileName] = m;
  for (const rom of roms) {
    const m = metaByName[rom.fileName] || {};
    // Fall back to a legacy in-record lastPlayed for ROMs stored before the
    // timestamp moved into "meta".
    rom.lastPlayed = m.lastPlayed || rom.lastPlayed || 0;
    rom.playTime = m.playTime || 0;
  }
  return roms.sort((a, b) => b.lastPlayed - a.lastPlayed);
}

async function deleteRom(fileName) {
  await romTx("roms", "readwrite", (s) => s.delete(fileName));
  await romTx("meta", "readwrite", (s) => s.delete(fileName));
}

async function evictOldRoms() {
  const all = await listRoms();
  for (const rom of all.slice(MAX_RECENT)) {
    await deleteRom(rom.fileName);
  }
}

async function resumeRom(fileName) {
  const rec = await romTx("roms", "readonly", (s) => s.get(fileName));
  if (!rec) {
    renderRecent();
    return;
  }
  await touchLastPlayed(rec.fileName); // bump timestamp without rewriting bytes
  renderRecent();
  bootFromBytes(rec.fileName, rec.core, rec.bytes);
}

async function renderRecent() {
  const roms = await listRoms().catch(() => []);
  recentList.innerHTML = "";
  if (!roms.length) {
    recentWrap.hidden = true;
    return;
  }
  recentWrap.hidden = false;
  for (const rom of roms) {
    const li = document.createElement("li");
    li.className = "recent-item";

    const resume = document.createElement("button");
    resume.className = "recent-resume";
    resume.title = "Resume " + rom.fileName;
    resume.setAttribute("aria-label", "Resume " + rom.fileName);
    resume.addEventListener("click", () => resumeRom(rom.fileName));

    const cover = document.createElement("span");
    cover.className = "b-cover";
    cover.setAttribute("aria-hidden", "true");
    cover.textContent = (rom.fileName || "?").charAt(0).toUpperCase();
    cover.style.setProperty("--cover", systemColor(SYSTEMS[rom.core] || ""));

    const info = document.createElement("div");
    info.className = "recent-info";

    const top = document.createElement("div");
    top.className = "recent-top";

    const name = document.createElement("span");
    name.className = "recent-name";
    name.textContent = rom.fileName;

    const sys = document.createElement("span");
    sys.className = "badge";
    sys.textContent = SYSTEMS[rom.core] || "";

    top.append(name, sys);

    const sub = document.createElement("span");
    sub.className = "recent-meta";
    const parts = [formatBytes(rom.bytes.byteLength), "last played " + relTime(rom.lastPlayed)];
    if (rom.playTime > 0) parts.push(formatDuration(rom.playTime) + " played");
    sub.textContent = parts.join(" · ");

    info.append(top, sub);
    resume.append(cover, info);

    const del = document.createElement("button");
    del.className = "recent-del";
    del.textContent = "×";
    del.setAttribute("aria-label", "Remove " + rom.fileName);
    del.addEventListener("click", async () => {
      await deleteRom(rom.fileName);
      renderRecent();
    });

    li.append(resume, del);
    recentList.append(li);
  }
  updateStorage();
}

// --- Per-game play time, storage usage, and clearing ---

async function getMeta(fileName) {
  return (await romTx("meta", "readonly", (s) => s.get(fileName))) || { fileName, playTime: 0, lastPlayed: 0 };
}

let activeRom = null;
let sessionStart = 0;

function startPlayTracking(fileName) {
  activeRom = fileName;
  sessionStart = Date.now();
}

async function flushPlayTime() {
  if (!activeRom) return;
  const now = Date.now();
  const delta = now - sessionStart;
  sessionStart = now;
  if (delta <= 0) return;
  const meta = await getMeta(activeRom);
  meta.playTime = (meta.playTime || 0) + delta;
  await romTx("meta", "readwrite", (s) => s.put(meta));
}

// Flush periodically and whenever the tab is hidden (more reliable than unload).
setInterval(() => flushPlayTime(), 30000);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) flushPlayTime();
});

async function updateStorage() {
  if (!navigator.storage || !navigator.storage.estimate) {
    storageEl.hidden = true;
    return;
  }
  const { usage, quota } = await navigator.storage.estimate();
  storageEl.hidden = false;
  storageEl.textContent =
    "Storage: " + formatBytes(usage || 0) + " used" + (quota ? " of " + formatBytes(quota) : "");
}

clearRomsBtn.addEventListener("click", async () => {
  if (!confirm("Remove all stored ROMs from this browser? Your in-game saves are not affected.")) return;
  await romTx("roms", "readwrite", (s) => s.clear());
  await romTx("meta", "readwrite", (s) => s.clear());
  renderRecent();
});

function formatBytes(n) {
  if (n < 1024) return n + " B";
  const units = ["KB", "MB", "GB"];
  let i = -1;
  do {
    n /= 1024;
    i++;
  } while (n >= 1024 && i < units.length - 1);
  return n.toFixed(1) + " " + units[i];
}

function relTime(ts) {
  const sec = (Date.now() - ts) / 1000;
  if (sec < 60) return "just now";
  const min = sec / 60;
  if (min < 60) return Math.floor(min) + "m ago";
  const hr = min / 60;
  if (hr < 24) return Math.floor(hr) + "h ago";
  return Math.floor(hr / 24) + "d ago";
}

function formatDuration(ms) {
  const min = Math.floor(ms / 60000);
  if (min < 1) return "<1m";
  if (min < 60) return min + "m";
  const hr = Math.floor(min / 60);
  const rem = min % 60;
  return hr + "h" + (rem ? " " + rem + "m" : "");
}

// Read entry filenames from a zip's central directory (no decompression).
function readZipEntryNames(bytes) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const names = [];
  // The End Of Central Directory record (sig 0x06054b50) sits in the last
  // 64KB + 22 bytes; scan backwards for it.
  let eocd = -1;
  const min = Math.max(0, bytes.length - 65557);
  for (let i = bytes.length - 22; i >= min; i--) {
    if (dv.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) return names;

  let off = dv.getUint32(eocd + 16, true);
  const count = dv.getUint16(eocd + 10, true);
  const dec = new TextDecoder();
  for (let n = 0; n < count; n++) {
    if (off + 46 > bytes.length || dv.getUint32(off, true) !== 0x02014b50) break;
    const nameLen = dv.getUint16(off + 28, true);
    const extraLen = dv.getUint16(off + 30, true);
    const commentLen = dv.getUint16(off + 32, true);
    names.push(dec.decode(bytes.subarray(off + 46, off + 46 + nameLen)));
    off += 46 + nameLen + extraLen + commentLen;
  }
  return names;
}

// --- Minimal store-only (uncompressed) zip writer + reader ---

let crcTable = null;
function crc32(bytes) {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) crc = crcTable[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

// files: [{name, bytes}] -> Uint8Array of a stored (no compression) zip.
function makeZip(files) {
  const enc = new TextEncoder();
  const chunks = [];
  const central = [];
  let offset = 0;
  for (const f of files) {
    const nameBytes = enc.encode(f.name);
    const crc = crc32(f.bytes);

    const local = new Uint8Array(30 + nameBytes.length);
    const ldv = new DataView(local.buffer);
    ldv.setUint32(0, 0x04034b50, true);
    ldv.setUint16(4, 20, true);
    ldv.setUint32(14, crc, true);
    ldv.setUint32(18, f.bytes.length, true);
    ldv.setUint32(22, f.bytes.length, true);
    ldv.setUint16(26, nameBytes.length, true);
    local.set(nameBytes, 30);
    chunks.push(local, f.bytes);

    const cen = new Uint8Array(46 + nameBytes.length);
    const cdv = new DataView(cen.buffer);
    cdv.setUint32(0, 0x02014b50, true);
    cdv.setUint16(4, 20, true);
    cdv.setUint16(6, 20, true);
    cdv.setUint32(16, crc, true);
    cdv.setUint32(20, f.bytes.length, true);
    cdv.setUint32(24, f.bytes.length, true);
    cdv.setUint16(28, nameBytes.length, true);
    cdv.setUint32(42, offset, true);
    cen.set(nameBytes, 46);
    central.push(cen);

    offset += local.length + f.bytes.length;
  }

  const cdStart = offset;
  let cdSize = 0;
  for (const c of central) {
    chunks.push(c);
    cdSize += c.length;
  }

  const eocd = new Uint8Array(22);
  const edv = new DataView(eocd.buffer);
  edv.setUint32(0, 0x06054b50, true);
  edv.setUint16(8, central.length, true);
  edv.setUint16(10, central.length, true);
  edv.setUint32(12, cdSize, true);
  edv.setUint32(16, cdStart, true);
  chunks.push(eocd);

  let total = 0;
  for (const c of chunks) total += c.length;
  const out = new Uint8Array(total);
  let p = 0;
  for (const c of chunks) {
    out.set(c, p);
    p += c.length;
  }
  return out;
}

// Extract stored entries by walking local file headers. Compressed entries
// (method != 0) are skipped - this reads our own backup bundles.
function readZipEntries(bytes) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const dec = new TextDecoder();
  const entries = [];
  let off = 0;
  while (off + 30 <= bytes.length && dv.getUint32(off, true) === 0x04034b50) {
    const method = dv.getUint16(off + 8, true);
    const compSize = dv.getUint32(off + 18, true);
    const nameLen = dv.getUint16(off + 26, true);
    const extraLen = dv.getUint16(off + 28, true);
    const nameStart = off + 30;
    const name = dec.decode(bytes.subarray(nameStart, nameStart + nameLen));
    const dataStart = nameStart + nameLen + extraLen;
    if (method === 0) entries.push({ name, bytes: new Uint8Array(bytes.subarray(dataStart, dataStart + compSize)) });
    off = dataStart + compSize;
  }
  return entries;
}

renderRecent();

// Load from URL.
function submitUrl() {
  const url = romUrlInput.value.trim();
  if (url) loadRomFromUrl(url);
}
loadUrlBtn.addEventListener("click", submitUrl);
romUrlInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") submitUrl();
});

// Built-in homebrew shelf, driven by builtin-roms.json. Rendered both as a
// prominent "try one of these" shelf on the home and in the per-console load view.
const homeExamples = document.getElementById("home-examples");
const examplesList = document.getElementById("examples-list");

// Generated placeholder "cover" colour from the system name (no external art).
function systemColor(system) {
  const s = (system || "").toLowerCase();
  if (s.includes("playstation")) return "#3b82f6";
  if (s.includes("genesis") || s.includes("sega") || s.includes("master system") || s.includes("game gear")) return "#1fb6ff";
  if (s.includes("game boy") || s.includes("nes") || s.includes("snes") || s.includes("nintendo") || s.includes("virtual boy")) return "#ff2740";
  return "#a6ff1a";
}

function makeBuiltinButton(g) {
  const li = document.createElement("li");
  const btn = document.createElement("button");
  btn.className = "builtin-game";
  btn.setAttribute("aria-label", "Play " + g.name + (g.system ? ", " + g.system : ""));
  const cover = document.createElement("span");
  cover.className = "b-cover";
  cover.setAttribute("aria-hidden", "true");
  cover.textContent = (g.name || "?").charAt(0).toUpperCase();
  cover.style.setProperty("--cover", systemColor(g.system));
  const text = document.createElement("span");
  text.className = "b-text";
  const name = document.createElement("span");
  name.className = "b-name";
  name.textContent = g.name;
  const meta = document.createElement("span");
  meta.className = "b-meta";
  meta.textContent = [g.system, g.by ? "by " + g.by : "", g.license].filter(Boolean).join(" · ");
  text.append(name, meta);
  btn.append(cover, text);
  btn.addEventListener("click", () => loadBuiltin(g.file));
  li.append(btn);
  return li;
}

let builtinGames = [];

// The core a built-in game runs on, derived from its file extension.
function gameCore(g) {
  const ext = (g.file || "").split(".").pop().toLowerCase();
  return CORES[ext] || null;
}

// Load view: show only the example games for the currently selected console.
function renderBuiltinForCore(core) {
  if (!builtinList || !builtinWrap) return;
  builtinList.innerHTML = "";
  const matches = builtinGames.filter((g) => gameCore(g) === core);
  for (const g of matches) builtinList.append(makeBuiltinButton(g));
  builtinWrap.hidden = matches.length === 0;
}

fetch("builtin-roms.json")
  .then((r) => (r.ok ? r.json() : []))
  .then((list) => {
    if (!Array.isArray(list) || !list.length) return;
    builtinGames = list;
    // Home shelf shows every example ("try anything").
    if (homeExamples) homeExamples.hidden = false;
    for (const g of list) {
      if (examplesList) examplesList.append(makeBuiltinButton(g));
    }
    if (selectedCore) renderBuiltinForCore(selectedCore);
  })
  .catch(() => {});

// --- Console picker on the front page ---
// Pick a console and the next ROM you load is forced to that core. Lets disc
// systems (PlayStation etc.) and ambiguous formats load without guessing.
const CONSOLE_GROUPS = [
  ["Nintendo", [
    ["gb", "Game Boy"], ["gbc", "Game Boy Color"], ["gba", "Game Boy Advance"],
    ["nes", "NES"], ["snes", "SNES"], ["n64", "Nintendo 64"], ["nds", "Nintendo DS"],
  ]],
  ["Sony", [["psx", "PlayStation"]]],
  ["Sega", [["segaMD", "Genesis"], ["segaGG", "Game Gear"], ["segaMS", "Master System"]]],
  ["Other", [
    ["pce", "PC Engine"], ["vb", "Virtual Boy"], ["atari2600", "Atari 2600"],
    ["atari7800", "Atari 7800"], ["lynx", "Lynx"], ["ngp", "Neo Geo Pocket"],
    ["ws", "WonderSwan"], ["coleco", "ColecoVision"],
  ]],
];
const consoleGrid = document.getElementById("console-grid");
const consoleView = document.getElementById("console-view");
const loadView = document.getElementById("load-view");
const loadTitle = document.getElementById("load-title");
const backToConsoles = document.getElementById("back-to-consoles");

// Home shows the console grid; picking one opens the load view for that console.
function selectConsole(core, label) {
  selectedCore = core;
  if (loadTitle) loadTitle.textContent = "Load a " + label + " game";
  renderBuiltinForCore(core);
  if (consoleView) consoleView.hidden = true;
  if (loadView) loadView.hidden = false;
  hideError();
}

function showConsoleView() {
  selectedCore = null;
  if (loadView) loadView.hidden = true;
  if (consoleView) consoleView.hidden = false;
  hideError();
}

if (backToConsoles) backToConsoles.addEventListener("click", showConsoleView);

// Brand accent colours for the console tiles (vivid neon arcade palette).
const BRAND_COLORS = { Nintendo: "#ff2740", Sony: "#3b82f6", Sega: "#1fb6ff", Other: "#a6ff1a" };

if (consoleGrid) {
  for (const [groupName, items] of CONSOLE_GROUPS) {
    const color = BRAND_COLORS[groupName] || "#9bbc0f";
    for (const [core, label] of items) {
      const b = document.createElement("button");
      b.className = "console-btn";
      b.dataset.core = core;
      b.dataset.brand = groupName;
      b.style.setProperty("--brand", color);
      // Faint brand-coloured cartridge glyph for a richer launcher tile.
      b.insertAdjacentHTML(
        "afterbegin",
        '<svg class="console-glyph" viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="2" width="12" height="20" rx="2"/><rect x="9" y="5" width="6" height="5" rx="1" opacity="0.5"/><rect x="9.5" y="17" width="5" height="1.6" rx="0.8" opacity="0.75"/></svg>'
      );
      // The brand + name sit together on a label "sticker" panel, like a cart.
      const labelPanel = document.createElement("span");
      labelPanel.className = "console-label";
      if (groupName !== "Other") {
        const brand = document.createElement("span");
        brand.className = "console-brand";
        brand.textContent = groupName;
        labelPanel.appendChild(brand);
      }
      const name = document.createElement("span");
      name.className = "console-name";
      name.textContent = label;
      labelPanel.appendChild(name);
      b.appendChild(labelPanel);
      b.addEventListener("click", () => selectConsole(core, label));
      consoleGrid.appendChild(b);
    }
  }
}

// Register the service worker for installability + instant offline shell.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}

// Offer an in-page install button when the browser says the app is installable.
const installAppBtn = document.getElementById("install-app");
let deferredInstall = null;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredInstall = e;
  installAppBtn.hidden = false;
});
installAppBtn.addEventListener("click", async () => {
  if (!deferredInstall) return;
  deferredInstall.prompt();
  await deferredInstall.userChoice;
  deferredInstall = null;
  installAppBtn.hidden = true;
});
window.addEventListener("appinstalled", () => {
  installAppBtn.hidden = true;
});

// Remember whether the user keeps the Save & backup section expanded.
const saveBackupDetails = document.querySelector(".save-backup");
if (saveBackupDetails) {
  saveBackupDetails.open = localStorage.getItem("bgb-savebackup-open") === "1";
  saveBackupDetails.addEventListener("toggle", () => {
    localStorage.setItem("bgb-savebackup-open", saveBackupDetails.open ? "1" : "0");
  });
}

// --- Optional on-screen joystick (mouse + touch) -> D-pad ---
// Drives EmulatorJS via gameManager.simulateInput(player, index, value), the same
// path its touch gamepad uses. Default libretro D-pad indices: up 4, down 5,
// left 6, right 7 (player 0). Keyboard input is unaffected.
const DPAD = { up: 4, down: 5, left: 6, right: 7 };
// The steer control drives the D-pad by default; a controller can override this
// (e.g. N64 routes it to the left analog stick: up 19, down 18, left 17, right 16).
let activeDpad = DPAD;
const joystick = document.getElementById("joystick");
const joystickBase = document.getElementById("joystick-base");
const joystickThumb = document.getElementById("joystick-thumb");
const joystickActions = document.getElementById("joystick-actions");
const joystickMeta = document.getElementById("joystick-meta");
const toggleJoystickBtn = document.getElementById("toggle-joystick");
const dirState = { up: false, down: false, left: false, right: false };
let joyPointer = null;

function emuInput(index, pressed) {
  const g = gm();
  if (g && typeof g.simulateInput === "function") {
    try {
      g.simulateInput(0, index, pressed ? 1 : 0);
    } catch (e) {
      /* ignore - input not ready */
    }
  }
}

function setDir(dir, on) {
  if (dirState[dir] === on) return;
  dirState[dir] = on;
  emuInput(activeDpad[dir], on);
}

function releaseJoystick() {
  setDir("up", false);
  setDir("down", false);
  setDir("left", false);
  setDir("right", false);
  if (joystickThumb) joystickThumb.style.transform = "translate(0, 0)";
}

// Map the pointer offset from the base centre to an 8-way D-pad direction.
function steerJoystick(e) {
  const rect = joystickBase.getBoundingClientRect();
  const radius = rect.width / 2;
  let dx = e.clientX - (rect.left + radius);
  let dy = e.clientY - (rect.top + radius);
  const dist = Math.hypot(dx, dy);

  // Keep the thumb inside the base.
  const maxThumb = radius * 0.6;
  if (dist > maxThumb && dist > 0) {
    dx = (dx / dist) * maxThumb;
    dy = (dy / dist) * maxThumb;
  }
  joystickThumb.style.transform = "translate(" + dx + "px, " + dy + "px)";

  if (dist < radius * 0.28) {
    setDir("up", false);
    setDir("down", false);
    setDir("left", false);
    setDir("right", false);
    return;
  }
  const mag = Math.hypot(dx, dy) || 1;
  const nx = dx / mag;
  const ny = dy / mag;
  const t = 0.38; // diagonal threshold: within ~22.5deg of an axis = single direction
  setDir("right", nx > t);
  setDir("left", nx < -t);
  setDir("down", ny > t);
  setDir("up", ny < -t);
}

if (joystickBase) {
  joystickBase.addEventListener("pointerdown", (e) => {
    joyPointer = e.pointerId;
    try {
      joystickBase.setPointerCapture(e.pointerId);
    } catch (err) {}
    steerJoystick(e);
    e.preventDefault();
  });
  joystickBase.addEventListener("pointermove", (e) => {
    if (e.pointerId === joyPointer) steerJoystick(e);
  });
  const endJoy = (e) => {
    if (e.pointerId !== joyPointer) return;
    joyPointer = null;
    releaseJoystick();
  };
  joystickBase.addEventListener("pointerup", endJoy);
  joystickBase.addEventListener("pointercancel", endJoy);
  joystickBase.addEventListener("lostpointercapture", endJoy);
}

const toggleSkinBtn = document.getElementById("toggle-skin");
let joystickOn = false;
let skinOn = false;

function reflectToggle(btn, on) {
  if (!btn) return;
  btn.setAttribute("aria-pressed", on ? "true" : "false");
  btn.classList.toggle("active", on);
}

// Controls show if either the plain joystick or the Game Boy skin is on; the
// skin additionally wraps the screen in the console body.
function updateControls() {
  if (!joystick) return;
  // Skin only takes over once a game is running (picker stays clean/loadable).
  // Handhelds get the GBC handheld body; other consoles get a gamepad skin.
  const handheld = ["gb", "gbc", "gba"].includes(currentCore);
  const skinActive = skinOn && gameRunning;
  const show = joystickOn || skinActive;
  joystick.hidden = !show;
  if (gameWrap) {
    gameWrap.classList.toggle("gb-skin", skinActive && handheld);
    gameWrap.classList.toggle("console-skin", skinActive && !handheld);
  }
  document.body.classList.toggle("skin-mode", skinActive);
  if (!show) releaseJoystick();
}

function setJoystick(on) {
  joystickOn = on;
  reflectToggle(toggleJoystickBtn, on);
  localStorage.setItem("bgb-joystick", on ? "1" : "0");
  updateControls();
}

function setSkin(on) {
  skinOn = on;
  reflectToggle(toggleSkinBtn, on);
  localStorage.setItem("bgb-skin", on ? "1" : "0");
  updateControls();
}

if (toggleJoystickBtn) toggleJoystickBtn.addEventListener("click", () => setJoystick(!joystickOn));
if (toggleSkinBtn) toggleSkinBtn.addEventListener("click", () => setSkin(!skinOn));
if (localStorage.getItem("bgb-joystick") === "1") setJoystick(true);
if (localStorage.getItem("bgb-skin") === "1") setSkin(true);

// Hold-to-press action buttons (A = 8, B = 0 in the libretro RetroPad layout).
function holdButton(btn, index) {
  if (!btn) return;
  const press = (e) => {
    emuInput(index, true);
    btn.classList.add("pressed");
    try {
      btn.setPointerCapture(e.pointerId);
    } catch (err) {}
    e.preventDefault();
  };
  const release = () => {
    emuInput(index, false);
    btn.classList.remove("pressed");
  };
  btn.addEventListener("pointerdown", press);
  btn.addEventListener("pointerup", release);
  btn.addEventListener("pointercancel", release);
  btn.addEventListener("lostpointercapture", release);
}
// Per-system on-screen controller layouts. Buttons map to standard libretro
// RetroPad indices (B=0, Y=1, Select=2, Start=3, A=8, X=9, L=10, R=11). The
// D-pad is always present. More consoles are added over time.
const CONTROLLERS = {
  gb: { face: [["B", 0], ["A", 8]], meta: [["Select", 2], ["Start", 3]] },
  gbc: { face: [["B", 0], ["A", 8]], meta: [["Select", 2], ["Start", 3]] },
  gba: { face: [["B", 0], ["A", 8]], shoulder: [["L", 10], ["R", 11]], meta: [["Select", 2], ["Start", 3]] },
  nes: { face: [["B", 0], ["A", 8]], meta: [["Select", 2], ["Start", 3]] },
  snes: { face: [["Y", 1], ["X", 9], ["B", 0], ["A", 8]], shoulder: [["L", 10], ["R", 11]], meta: [["Select", 2], ["Start", 3]] },
  // PlayStation: the RetroPad face IS the Sony diamond - Square=Y(1), Triangle=X(9),
  // Cross=B(0), Circle=A(8); L1/R1 = L(10)/R(11). (pcsx_rearmed standard mapping.)
  psx: { face: [["□", 1], ["△", 9], ["✕", 0], ["○", 8]], shoulder: [["L1", 10], ["R1", 11]], meta: [["Select", 2], ["Start", 3]] },
  // Sega Genesis 3-button (genesis_plus_gx): A=Y(1), B=B(0), C=A(8), Start=3.
  segaMD: { face: [["A", 1], ["B", 0], ["C", 8]], meta: [["Start", 3]] },
  // Nintendo 64 (mupen64plus-next): A=RetroPad A(8) blue, B=RetroPad B(0) green,
  // Z=R2(13). C-buttons default to the RIGHT analog stick, which EmulatorJS exposes
  // as buttons 20-23 (C-right 20, C-left 21, C-down 22, C-up 23). The centre stick
  // drives the LEFT analog stick (dpad override) so games actually move.
  n64: {
    face: [["B", 0], ["A", 8], ["▲", 23], ["▼", 22], ["◀", 21], ["▶", 20]],
    shoulder: [["L", 10], ["R", 11]],
    meta: [["Z", 13], ["Start", 3]],
    dpad: { up: 19, down: 18, left: 17, right: 16 },
  },
  // Nintendo DS: A/B/X/Y diamond + L/R + Select/Start (maps directly to RetroPad).
  nds: { face: [["Y", 1], ["X", 9], ["B", 0], ["A", 8]], shoulder: [["L", 10], ["R", 11]], meta: [["Select", 2], ["Start", 3]] },
  // Sega Master System / Game Gear (genesis_plus_gx): two fire buttons + Start.
  // The 1/2 labels are best-effort; both are valid fire inputs (B=0, A=8).
  segaMS: { face: [["1", 0], ["2", 8]], meta: [["Start", 3]] },
  segaGG: { face: [["1", 0], ["2", 8]], meta: [["Start", 3]] },
  // PC Engine / TurboGrafx-16: II / I + Select / Run (Run = Start). I/II best-effort.
  pce: { face: [["II", 0], ["I", 8]], meta: [["Select", 2], ["Run", 3]] },
  // Virtual Boy: B/A + L/R + Select/Start.
  vb: { face: [["B", 0], ["A", 8]], shoulder: [["L", 10], ["R", 11]], meta: [["Select", 2], ["Start", 3]] },
  // Atari 2600: single Fire + the console Select/Reset switches (Stella maps Reset to Start).
  atari2600: { face: [["Fire", 0]], meta: [["Select", 2], ["Reset", 3]] },
  // Atari 7800: two fire buttons + Select / Pause.
  atari7800: { face: [["1", 0], ["2", 8]], meta: [["Select", 2], ["Pause", 3]] },
  // Atari Lynx: A / B + Pause (Pause maps to Start); Option buttons omitted.
  lynx: { face: [["B", 0], ["A", 8]], meta: [["Pause", 3]] },
  // Neo Geo Pocket: A / B + Option (Option maps to Start).
  ngp: { face: [["B", 0], ["A", 8]], meta: [["Option", 3]] },
  // WonderSwan: A / B + Start (vertical second d-pad not shown).
  ws: { face: [["B", 0], ["A", 8]], meta: [["Start", 3]] },
};

// Optional per-console body art injected behind the controls (none for now).
const SHELLS = {};

function makeHoldBtn(label, index, cls) {
  const b = document.createElement("button");
  b.className = cls;
  b.textContent = label;
  b.tabIndex = -1;
  b.dataset.btn = String(index);
  holdButton(b, index);
  return b;
}

// Build the on-screen face / shoulder / Start-Select buttons for a system.
function renderController(core) {
  if (!joystickActions || !joystickMeta) return;
  const def = CONTROLLERS[core] || CONTROLLERS.gb;
  activeDpad = def.dpad || DPAD;
  if (joystick) {
    const prevShell = joystick.querySelector(".pad-shell");
    if (prevShell) prevShell.remove();
    if (SHELLS[core]) joystick.insertAdjacentHTML("afterbegin", SHELLS[core]);
  }
  joystickActions.innerHTML = "";
  for (const [label, index] of def.face) joystickActions.appendChild(makeHoldBtn(label, index, "action-btn"));
  joystickMeta.innerHTML = "";
  if (def.shoulder) for (const [label, index] of def.shoulder) joystickMeta.appendChild(makeHoldBtn(label, index, "meta-btn shoulder-btn"));
  for (const [label, index] of def.meta) joystickMeta.appendChild(makeHoldBtn(label, index, "meta-btn"));
}
