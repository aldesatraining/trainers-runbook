// Quiz library: every quiz blueprint, with version history. Shared by everyone signed in (see cloud.js).
// Persistence goes through js/storage.js: the adapter only needs loadQuizzes, loadQuizVersions, saveQuiz and deleteQuiz.
import { adapter } from "./storage.js";
import { normalizeQuiz, duplicateQuiz as copyOf, core } from "./quiz-model.js";

let quizzes = [];     // current content of every quiz
let history = {};     // id -> versions, oldest first: [{ n, at, note, quiz }]. Loaded when a quiz is opened.
let counts = {};      // id -> how many versions exist (known before the history itself is loaded)
let author = "";
let pending = Promise.resolve(); // writes in flight, so a reload never reads half-saved data
const MAX_VERSIONS = 60;

const clone = (x) => JSON.parse(JSON.stringify(x));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
export const setAuthor = (email) => { author = email || ""; };

export async function loadQuizzes() {
  await pending;
  const s = await adapter.loadQuizzes();
  quizzes = (s.quizzes || []).map(normalizeQuiz);
  counts = s.counts || {};
  history = {};
}

export const listQuizzes = () => [...quizzes].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
export const getQuiz = (id) => quizzes.find((q) => q.id === id) || null;
export const quizVersions = (id) => history[id] || [];
export const quizVersionCount = (id) => (history[id] ? history[id].length : counts[id] || 0);
export async function ensureQuizHistory(id) {
  if (history[id]) return;
  await pending;
  history = { ...history, [id]: (await adapter.loadQuizVersions(id)) || [] };
}

function write(q, extra) {
  const saved = { ...normalizeQuiz(q), updatedAt: Date.now(), updatedBy: author };
  quizzes = quizzes.some((x) => x.id === saved.id) ? quizzes.map((x) => (x.id === saved.id ? saved : x)) : [...quizzes, saved];
  const count = history[saved.id] ? history[saved.id].length : counts[saved.id] || 0;
  const done = adapter.saveQuiz(saved, { count, ...extra });
  pending = Promise.allSettled([pending, done]);
  return done.then(() => saved);
}

// Saves what the quiz looks like now. Versions are recorded separately (recordQuizVersion).
export const saveQuiz = (q) => write(q);
export const addQuiz = (q) => write(q);
export const duplicateQuiz = (q) => write(copyOf(q));

export async function removeQuiz(id) {
  quizzes = quizzes.filter((q) => q.id !== id);
  const h = { ...history }; delete h[id]; history = h;
  const done = adapter.deleteQuiz(id);
  pending = Promise.allSettled([pending, done]);
  await done;
}

// Snapshot `quiz` as a new version. `base` is the quiz as it was before editing began: the first time anything
// is recorded it becomes the starting point, so there is always a way back. The state change is synchronous
// (safe to call from pagehide); the returned promise is only the write.
export function recordQuizVersion(id, quiz, { note = "", base = null, baseNote = "Before your first edit", relabel = true } = {}) {
  const list = [...(history[id] || [])];
  const add = [], drop = [];
  const snap = core(normalizeQuiz(quiz));
  const push = (q, n) => { const v = { n: (list[list.length - 1]?.n || 0) + 1, at: Date.now(), note: n, quiz: core(normalizeQuiz(clone(q))) }; list.push(v); add.push(v); };
  if (!list.length && base && !same(core(normalizeQuiz(base)), snap)) push(base, baseNote);
  const last = list[list.length - 1];
  if (last && same(last.quiz, snap)) {
    if (note && last.note !== note && (relabel || !last.note)) { list[list.length - 1] = { ...last, note }; add.push(list[list.length - 1]); } // labelling the state that is already the latest
    else return Promise.resolve(last);
  } else push(snap, note);
  while (list.length > MAX_VERSIONS) drop.push(list.splice(1, 1)[0].n); // keep the very first, drop the oldest after it
  history = { ...history, [id]: list };
  return write(quiz, { add: add.filter((v) => !drop.includes(v.n)), drop, count: list.length }).then(() => list[list.length - 1]);
}

// Put an earlier version back as the current quiz. The state it replaces is kept as a version first.
export async function restoreQuizVersion(id, n, current, opts = {}) {
  const v = quizVersions(id).find((x) => x.n === n);
  if (!v) return null;
  if (current) await recordQuizVersion(id, current, { ...opts, note: `Before restoring version ${n}`, relabel: false }); // never overwrites a label the user chose
  const restored = { ...clone(v.quiz), id };
  await recordQuizVersion(id, restored, { note: `Restored from version ${n}` });
  return getQuiz(id);
}
