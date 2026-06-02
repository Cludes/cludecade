// Map ROM file extension -> EmulatorJS core name.
const CORES = {
  gb: "gb",
  gbc: "gbc",
  gba: "gba",
  nes: "nes",
  sfc: "snes",
  smc: "snes",
  snes: "snes",
};

let romName = "game";

const romInput = document.getElementById("rom-input");
const picker = document.getElementById("picker");
const pickerError = document.getElementById("picker-error");
const recentWrap = document.getElementById("recent");
const recentList = document.getElementById("recent-list");
const storageEl = document.getElementById("storage");
const clearRomsBtn = document.getElementById("clear-roms");
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

// Validate, persist for quick-resume, then boot.
async function loadRomFile(file) {
  hideError();
  const bytes = new Uint8Array(await file.arrayBuffer());
  const core = await detectCore(file.name, bytes);
  if (!core) {
    showError("Unsupported or unrecognised ROM: " + file.name);
    return;
  }
  // Persist for resume; ignore quota/permission errors so play still works.
  await saveRom(file.name, core, bytes).catch(() => {});
  bootFromBytes(file.name, core, bytes);
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
  startPlayTracking(fileName);
  const url = URL.createObjectURL(new Blob([bytes], { type: "application/octet-stream" }));
  bootEmulator(core, url, fileName);
}

// EmulatorJS can only be initialised once per page load, so swap the picker
// for the game and inject the loader with the chosen ROM.
function bootEmulator(core, romUrl, fileName) {
  picker.hidden = true;
  gameWrap.hidden = false;
  loadingEl.textContent = "Loading " + fileName + "...";
  loadingEl.hidden = false;

  window.EJS_player = "#game";
  window.EJS_core = core;
  window.EJS_gameUrl = romUrl;
  // A blob: URL changes every session; pin the storage key to the filename so
  // auto-saved SRAM and save states survive page reloads.
  window.EJS_gameName = fileName;
  window.EJS_pathtodata = "https://cdn.emulatorjs.org/stable/data/";
  window.EJS_startOnLoaded = true;
  window.EJS_ready = onEmulatorReady;
  // Fired whenever the cartridge save changes (deduped by hash). Mirror it to
  // the linked on-disk file if the user has set one up.
  window.EJS_onSaveUpdate = (e) => {
    if (e && e.save) writeAutosave(e.save);
  };

  const script = document.createElement("script");
  script.src = "https://cdn.emulatorjs.org/stable/data/loader.js";
  document.body.appendChild(script);
}

function onEmulatorReady() {
  loadingEl.hidden = true;
  saveControls.hidden = false;
  exportSavBtn.disabled = false;
  importSavInput.disabled = false;
  exportStateBtn.disabled = false;
  importStateInput.disabled = false;

  if (window.showSaveFilePicker) {
    linkAutosaveBtn.disabled = false;
    restoreAutosave();
  } else {
    autosaveState.textContent = "Not supported in this browser. Use Export .sav instead.";
  }
}

function gm() {
  const emu = window.EJS_emulator;
  return emu && emu.gameManager ? emu.gameManager : null;
}

function setStatus(msg) {
  statusEl.textContent = msg;
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
  await romTx("roms", "readwrite", (s) => s.put({ fileName, core, bytes, lastPlayed: Date.now() }));
  await evictOldRoms();
  renderRecent();
}

async function listRoms() {
  const all = (await romTx("roms", "readonly", (s) => s.getAll())) || [];
  return all.sort((a, b) => b.lastPlayed - a.lastPlayed);
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
  await saveRom(rec.fileName, rec.core, rec.bytes); // bump lastPlayed
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
    const meta = await getMeta(rom.fileName);

    const li = document.createElement("li");
    li.className = "recent-item";

    const resume = document.createElement("button");
    resume.className = "recent-resume";
    resume.title = "Resume " + rom.fileName;
    resume.addEventListener("click", () => resumeRom(rom.fileName));

    const name = document.createElement("span");
    name.className = "recent-name";
    name.textContent = rom.fileName;

    const sub = document.createElement("span");
    sub.className = "recent-meta";
    const parts = [formatBytes(rom.bytes.byteLength), "last played " + relTime(rom.lastPlayed)];
    if (meta.playTime > 0) parts.push(formatDuration(meta.playTime) + " played");
    sub.textContent = parts.join(" · ");

    resume.append(name, sub);

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
  return (await romTx("meta", "readonly", (s) => s.get(fileName))) || { fileName, playTime: 0 };
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

renderRecent();
