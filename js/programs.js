// Outline catalog: built-in outlines (shipped as code) + outlines trainers add in the app.
// Anyone can add, edit (built-ins keep their original and can be reset), duplicate, export, archive, restore and delete. There are no roles.
// Persistence goes through js/storage.js, so a shared backend can replace it without touching the UI.
import { coveInbound } from "./data/cove-inbound.js";
import { adapter } from "./storage.js";
import { normalizeProgram, authored } from "./model.js";

const builtins = [coveInbound].map(normalizeProgram); // normalising lays out each day's breaks from its schedule
let user = [];        // outlines created / imported / duplicated in the app
let archived = {};    // id -> true (built-in or user outline hidden from the main list)
let deleted = {};     // id -> true (built-in outline removed; user outlines are simply dropped)

let edited = {};      // id -> program (a built-in outline with this device's changes; the shipped original is kept)

let history = {};     // id -> versions, oldest first: [{ n, at, note, program }]. A record of past states; restoring never erases it.
let historyCounts = {}; // id -> how many versions exist, for storage that loads history on demand (see ensureHistory)
const MAX_VERSIONS = 60;

const persist = () => adapter.saveCatalog({ programs: user, archived, deleted, edited, history });

export async function loadCatalog() {
  const s = await adapter.loadCatalog();
  history = s.history || {};
  historyCounts = s.historyCounts || {};
  user =(s.programs || []).map(normalizeProgram);
  archived = s.archived || {};
  deleted = s.deleted || {};
  edited = Object.fromEntries(Object.entries(s.edited || {}).map(([id, p]) => [id, normalizeProgram(p)]));
}

export const isBuiltin = (id) => builtins.some((p) => p.id === id);
export const isEdited = (id) => !!edited[id];
const all = () => [...builtins.filter((p) => !deleted[p.id]).map((p) => edited[p.id] || p), ...user];

export const getProgram = (id) => all().find((p) => p.id === id) || null;
export const activePrograms = () => all().filter((p) => !archived[p.id]);
export const archivedPrograms = () => all().filter((p) => archived[p.id]);
export const hasDeletedBuiltins = () => builtins.some((p) => deleted[p.id]);

export async function addProgram(p) { user = [...user, normalizeProgram(p)]; await persist(); return user[user.length - 1]; }
export async function saveProgram(p) {
  if (isBuiltin(p.id)) edited = { ...edited, [p.id]: normalizeProgram(p) };
  else user = user.map((x) => (x.id === p.id ? normalizeProgram(p) : x));
  await persist();
  return getProgram(p.id);
}

/* ---------- version history ---------- */
const clone = (x) => JSON.parse(JSON.stringify(x));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
export const versionsOf = (id) => history[id] || [];
export const versionCount = (id) => (history[id] ? history[id].length : historyCounts[id] || 0);
// Shared storage keeps history out of the initial load; call this before reading versions or recording a new one.
export async function ensureHistory(id) {
  if (history[id] || !adapter.hasLazyHistory) return;
  history = { ...history, [id]: await adapter.loadHistory(id) };
}

// Snapshot `program` as a new version. `base` is the outline as it was before editing began:
// the first time anything is recorded it becomes the starting point, so there is always a way back.
// The state change is synchronous (safe to call from pagehide); the returned promise is only the write.
export function recordVersion(id, program, { note = "", base = null, baseNote = "Starting point" } = {}) {
  const list = [...(history[id] || [])];
  const snap = normalizeProgram(clone(program));
  const add = (p, n) => list.push({ n: (list[list.length - 1]?.n || 0) + 1, at: Date.now(), note: n, program: normalizeProgram(clone(p)) });
  if (!list.length && base && !same(normalizeProgram(clone(base)), snap)) add(base, baseNote);
  const last = list[list.length - 1];
  if (last && same(last.program, snap)) {
    if (note) list[list.length - 1] = { ...last, note };          // labelling the state that is already the latest
    else return Promise.resolve(last);
  } else add(snap, note);
  while (list.length > MAX_VERSIONS) list.splice(1, 1);            // keep the very first, drop the oldest after it
  history = { ...history, [id]: list };
  return persist().then(() => list[list.length - 1]);
}

// Put an earlier version back as the current outline. The state it replaces is kept as a version first.
export async function restoreVersion(id, n, current, opts = {}) {
  const v = versionsOf(id).find((x) => x.n === n);
  if (!v) return null;
  if (current) recordVersion(id, current, { ...opts, note: `Before restoring version ${n}` });
  const p = clone(v.program);
  await saveProgram(p);
  await recordVersion(id, getProgram(id), { note: `Restored from version ${n}` });
  return getProgram(id);
}

// What changed between two snapshots, in plain words: { meta: [...], added: [...], removed: [...], changed: [...] }
export function diffPrograms(a, b) {
  const out = { meta: [], added: [], removed: [], changed: [] };
  if (!a) return out;
  for (const [k, label] of [["title", "Title"], ["summary", "Summary"], ["version", "Version"], ["status", "Status"], ["audience", "Audience"]])
    if ((a[k] || "") !== (b[k] || "")) out.meta.push(label);
  if (!same(a.tags || [], b.tags || [])) out.meta.push("Tags");
  if (!same(a.objectives || [], b.objectives || [])) out.meta.push("Objectives");
  if (!same(a.breaks || null, b.breaks || null) || !same(a.days.map((d) => d.breaks), b.days.map((d) => d.breaks))) out.meta.push("Break schedule");
  // compare topics whole: generated breaks and "(continued)" parts follow from the schedule, they are not edits in their own right
  const idx = (p) => { const m = new Map(); authored(p).days.forEach((d) => d.blocks.forEach((blk) => m.set(blk.id, { blk, day: d.title }))); return m; };
  const A = idx(a), B = idx(b);
  for (const [id, { blk, day }] of B) {
    if (!A.has(id)) out.added.push({ id, title: blk.title, day });
    else if (!same(strip(A.get(id).blk), strip(blk))) out.changed.push({ id, title: blk.title, day });
  }
  for (const [id, { blk, day }] of A) if (!B.has(id)) out.removed.push({ id, title: blk.title, day });
  return out;
}
const strip = (blk) => { const { start, end, ...rest } = blk; return rest; }; // moving a topic shifts its clock times; that is not a content change

export async function resetBuiltin(id) { const e = { ...edited }; delete e[id]; edited = e; await persist(); }
export async function setArchived(id, on) { archived = { ...archived }; if (on) archived[id] = true; else delete archived[id]; await persist(); }
export async function removeProgram(id) {
  if (isBuiltin(id)) { deleted = { ...deleted, [id]: true }; const e = { ...edited }; delete e[id]; edited = e; }
  else user = user.filter((p) => p.id !== id);
  const a = { ...archived }; delete a[id]; archived = a;
  const h = { ...history }; delete h[id]; history = h;
  await persist();
  await adapter.clear(id); // its progress, checklists and notes go with it
}
export async function restoreBuiltins() { deleted = {}; await persist(); }
