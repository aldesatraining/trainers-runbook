// Firebase: email sign-in and a Firestore implementation of the storage adapter (see storage.js for its shape).
// Loaded only when js/firebase-config.js is filled in.
//
// Firestore layout
//   outlines/{id}                  shared by everyone: { program (JSON string), builtin, archived, deleted, vcount, updatedAt, updatedBy }
//   outlines/{id}/versions/{n}     shared version history: { n, at, note, program (JSON string) }
//   quizzes/{id}                   shared quiz blueprint: { json (string), title, vcount, updatedAt, updatedBy }
//   quizzes/{id}/versions/{n}      shared quiz history: { n, at, note, json (string) }
//   users/{uid}/progress/{id}      one person's progress, checklists and notes for an outline: { json }
//   users/{uid}/meta/app           one person's last-opened times and calendar start dates: { json }
// Programs are stored as JSON strings because Firestore does not allow arrays inside arrays, which outline guides use.
// Built-in outlines ship in the code; an outlines/{id} document only exists for them once someone edits or archives one.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  sendEmailVerification, sendPasswordResetEmail, signOut,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, deleteDoc, collection, getDocs, writeBatch } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

/* ---------- sign-in ---------- */
export const watch = (cb) => onAuthStateChanged(auth, cb);
export const currentUser = () => auth.currentUser;
export const signIn = (email, password) => signInWithEmailAndPassword(auth, email, password);
export const resetPassword = (email) => sendPasswordResetEmail(auth, email);
export const logout = () => signOut(auth);
export async function signUp(email, password) {
  const c = await createUserWithEmailAndPassword(auth, email, password);
  await sendEmailVerification(c.user);
  return c.user;
}
export const resendVerification = () => sendEmailVerification(auth.currentUser);
// After the link in the email is clicked: re-read the account and refresh the token so Firestore rules see email_verified.
export async function refreshUser() {
  await auth.currentUser.reload();
  await auth.currentUser.getIdToken(true);
  return auth.currentUser;
}

/* ---------- storage adapter ---------- */
const failed = (err) => {
  console.error(err);
  window.dispatchEvent(new CustomEvent("sync-error", { detail: err?.code === "permission-denied" ? "you don’t have permission" : (err?.message || String(err)) }));
};
const parse = (s) => { try { return JSON.parse(s); } catch { return null; } };
const fieldsOf = (d) => JSON.stringify([d.builtin, d.program, d.archived, d.deleted, d.vcount]);

export function createCloudAdapter(user) {
  const mine = (...path) => doc(db, "users", user.uid, ...path);
  const last = { docs: new Map(), vers: new Map() }; // what Firestore held when we last read or wrote it: id -> fields, "id/n" -> fields
  let queue = Promise.resolve();

  const adapter = {
    /* personal: progress, checklists, notes */
    async load(id) {
      try { const s = await getDoc(mine("progress", id)); return s.exists() ? parse(s.data().json) : null; } catch (e) { failed(e); return null; }
    },
    async save(id, state) {
      try { await setDoc(mine("progress", id), { json: JSON.stringify(state), updatedAt: Date.now() }); } catch (e) { failed(e); }
    },
    async clear(id) {
      try { await deleteDoc(mine("progress", id)); } catch (e) { failed(e); }
    },
    async loadMeta() {
      try { const s = await getDoc(mine("meta", "app")); return s.exists() ? parse(s.data().json) || {} : {}; } catch (e) { failed(e); return {}; }
    },
    async saveMeta(meta) {
      try { await setDoc(mine("meta", "app"), { json: JSON.stringify(meta) }); } catch (e) { failed(e); }
    },

    /* shared: the outline catalog */
    async loadCatalog() {
      const snap = await getDocs(collection(db, "outlines")); // throws when the rules refuse: the caller shows why
      const out = { programs: [], archived: {}, deleted: {}, edited: {}, historyCounts: {} };
      last.docs.clear(); last.vers.clear();
      for (const d of snap.docs) {
        const x = d.data(), id = d.id;
        last.docs.set(id, { builtin: !!x.builtin, program: x.program ?? null, archived: !!x.archived, deleted: !!x.deleted, vcount: x.vcount || 0 });
        if (x.archived) out.archived[id] = true;
        if (x.deleted) out.deleted[id] = true;
        if (x.vcount) out.historyCounts[id] = x.vcount;
        const p = x.program ? parse(x.program) : null;
        if (p) (x.builtin ? (out.edited[id] = p) : out.programs.push(p));
      }
      return out;
    },
    // Version history is large, so it is fetched only when an outline is edited or its history is opened.
    async loadHistory(id) {
      const snap = await getDocs(collection(db, "outlines", id, "versions"));
      const list = snap.docs.map((d) => d.data()).map((v) => ({ n: v.n, at: v.at, note: v.note || "", program: parse(v.program) })).filter((v) => v.program).sort((a, b) => a.n - b.n);
      list.forEach((v) => last.vers.set(`${id}/${v.n}`, JSON.stringify([v.at, v.note, JSON.stringify(v.program)])));
      return list;
    },
    // Writes only what differs from what Firestore already holds, so one person's save never rewrites another's outlines.
    saveCatalog(c) {
      queue = queue.then(() => write(c)).catch(failed);
      return queue;
    },

    /* shared: quiz blueprints */
    async loadQuizzes() {
      const snap = await getDocs(collection(db, "quizzes")); // throws when the rules refuse: the caller shows why
      const quizzes = [], counts = {};
      for (const d of snap.docs) {
        const x = d.data(), q = parse(x.json);
        if (!q) continue;
        quizzes.push({ ...q, id: d.id });
        counts[d.id] = x.vcount || 0;
      }
      return { quizzes, counts };
    },
    async loadQuizVersions(id) {
      const snap = await getDocs(collection(db, "quizzes", id, "versions"));
      return snap.docs.map((d) => d.data()).map((v) => ({ n: v.n, at: v.at, note: v.note || "", quiz: parse(v.json) })).filter((v) => v.quiz).sort((a, b) => a.n - b.n);
    },
    // The quiz itself plus any version records to add or drop, in one batch, in the order they were asked for.
    saveQuiz(q, { add = [], drop = [], count = 0 } = {}) {
      queue = queue.then(async () => {
        const batch = writeBatch(db);
        batch.set(doc(db, "quizzes", q.id), { json: JSON.stringify(q), title: q.title, vcount: count, updatedAt: Date.now(), updatedBy: user.email || "" });
        add.forEach((v) => batch.set(doc(db, "quizzes", q.id, "versions", String(v.n)), { n: v.n, at: v.at, note: v.note || "", json: JSON.stringify(v.quiz) }));
        drop.forEach((n) => batch.delete(doc(db, "quizzes", q.id, "versions", String(n))));
        await batch.commit();
      }).catch(failed);
      return queue;
    },
    deleteQuiz(id) {
      queue = queue.then(async () => {
        const vs = await getDocs(collection(db, "quizzes", id, "versions"));
        const refs = [...vs.docs.map((v) => v.ref), doc(db, "quizzes", id)];
        for (let i = 0; i < refs.length; i += 400) {
          const batch = writeBatch(db);
          refs.slice(i, i + 400).forEach((r) => batch.delete(r));
          await batch.commit();
        }
      }).catch(failed);
      return queue;
    },
  };

  async function write(c) {
    const docs = new Map();
    const at = (id) => docs.get(id) || docs.set(id, { builtin: false, program: null, archived: false, deleted: false, vcount: last.docs.get(id)?.vcount || 0 }).get(id);
    c.programs.forEach((p) => { at(p.id).program = JSON.stringify(p); });
    Object.entries(c.edited || {}).forEach(([id, p]) => { const d = at(id); d.builtin = true; d.program = JSON.stringify(p); });
    Object.keys(c.archived || {}).forEach((id) => { at(id).archived = true; });
    Object.keys(c.deleted || {}).forEach((id) => { at(id).deleted = true; });
    Object.entries(c.history || {}).forEach(([id, list]) => { at(id).vcount = list.length; });
    for (const d of docs.values()) if (!d.program) d.builtin = true;           // no program of its own: a flag or history on a built-in outline
    for (const [id, d] of last.docs) if (!docs.has(id) && d.builtin) docs.set(id, { ...d, program: null, archived: false, deleted: false }); // keep a built-in's history reachable after "reset to original"

    const ops = [];
    const stamp = { updatedAt: Date.now(), updatedBy: user.email || "" };
    for (const [id, d] of docs) if (!last.docs.has(id) || fieldsOf(last.docs.get(id)) !== fieldsOf(d)) ops.push({ set: doc(db, "outlines", id), data: { ...d, ...stamp }, after: () => last.docs.set(id, d) });
    for (const [id, d] of [...last.docs]) {
      if (docs.has(id)) continue;                                              // an outline made in the app and then deleted: remove it and its versions
      const vs = await getDocs(collection(db, "outlines", id, "versions"));
      vs.docs.forEach((v) => ops.push({ del: v.ref }));
      ops.push({ del: doc(db, "outlines", id), after: () => last.docs.delete(id) });
    }
    for (const [id, list] of Object.entries(c.history || {})) {
      const keep = new Set(list.map((v) => `${id}/${v.n}`));
      for (const v of list) {
        const key = `${id}/${v.n}`, rec = JSON.stringify([v.at, v.note || "", JSON.stringify(v.program)]);
        if (last.vers.get(key) !== rec) ops.push({ set: doc(db, "outlines", id, "versions", String(v.n)), data: { n: v.n, at: v.at, note: v.note || "", program: JSON.stringify(v.program) }, after: () => last.vers.set(key, rec) });
      }
      for (const key of [...last.vers.keys()]) if (key.startsWith(`${id}/`) && !keep.has(key)) ops.push({ del: doc(db, "outlines", id, "versions", key.slice(id.length + 1)), after: () => last.vers.delete(key) });
    }
    for (let i = 0; i < ops.length; i += 400) {
      const batch = writeBatch(db), part = ops.slice(i, i + 400);
      part.forEach((o) => (o.set ? batch.set(o.set, o.data) : batch.delete(o.del)));
      await batch.commit();
      part.forEach((o) => o.after?.());
    }
  }
  return adapter;
}
