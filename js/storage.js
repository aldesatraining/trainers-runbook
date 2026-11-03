// Persistence boundary. The UI and store only talk to an adapter with this shape:
//   load(programId)        -> Promise<state | null>
//   save(programId, state) -> Promise<void>
//   clear(programId)       -> Promise<void>
// Swap `adapter` for an HTTP/database implementation later; nothing else needs to change.

const KEY = (programId) => `trainer-runbook:v1:${programId}`;

export const localStorageAdapter = {
  async load(programId) {
    try {
      const raw = localStorage.getItem(KEY(programId));
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },
  async save(programId, state) {
    try {
      localStorage.setItem(KEY(programId), JSON.stringify(state));
    } catch {
      /* storage full or unavailable: the app keeps working in memory */
    }
  },
  async clear(programId) {
    try {
      localStorage.removeItem(KEY(programId));
    } catch {
      /* ignore */
    }
  },
};

// App-level (cross-program) data: when each outline was last opened. Same swap-in rule as above.
const META_KEY = "trainer-runbook:v1:meta";
localStorageAdapter.loadMeta = async () => {
  try { return JSON.parse(localStorage.getItem(META_KEY)) || {}; } catch { return {}; }
};
localStorageAdapter.saveMeta = async (meta) => {
  try { localStorage.setItem(META_KEY, JSON.stringify(meta)); } catch { /* ignore */ }
};

// The outline catalog (outlines trainers added, plus archive/delete markers).
const CATALOG_KEY = "trainer-runbook:v1:catalog";
localStorageAdapter.loadCatalog = async () => {
  try { return JSON.parse(localStorage.getItem(CATALOG_KEY)) || {}; } catch { return {}; }
};
localStorageAdapter.saveCatalog = async (catalog) => {
  try { localStorage.setItem(CATALOG_KEY, JSON.stringify(catalog)); } catch { /* ignore */ }
};

// The rest of the app imports `adapter`; it forwards to whichever implementation is active.
// Local (this browser only) until signed in to a shared backend calls useAdapter (see cloud.js).
let active = localStorageAdapter;
export const useAdapter = (impl) => { active = impl; };
export const adapter = {
  load: (...a) => active.load(...a),
  save: (...a) => active.save(...a),
  clear: (...a) => active.clear(...a),
  loadMeta: (...a) => active.loadMeta(...a),
  saveMeta: (...a) => active.saveMeta(...a),
  loadCatalog: (...a) => active.loadCatalog(...a),
  saveCatalog: (...a) => active.saveCatalog(...a),
  // optional: only storage that keeps version history out of the initial load has it
  loadHistory: (...a) => (active.loadHistory ? active.loadHistory(...a) : undefined),
  get hasLazyHistory() { return !!active.loadHistory; },
};
