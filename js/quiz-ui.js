// Quiz blueprint screens: the quiz list (#/quizzes) and the editor (#/quiz/<id>).
// Self-contained: app.js only asks it whether a route is its own, and lets it draw into the page root.
import { activePrograms, getProgram } from "./programs.js";
import { slug, parseLines } from "./model.js";
import {
  QUESTION_TYPES, QUIZ_KINDS, QUIZ_STATUS, typeLabel, typeShort, blankQuiz, blankQuestion, normalizeQuestion, normalizeQuiz,
  issues, answerLine, diffQuizzes, typeCounts, core, sameQuiz, letter, BLANK,
} from "./quiz-model.js";
import {
  loadQuizzes, listQuizzes, getQuiz, saveQuiz, addQuiz, duplicateQuiz, removeQuiz, ensureQuizHistory,
  quizVersions, quizVersionCount, recordQuizVersion, restoreQuizVersion, setAuthor,
} from "./quizzes.js";
import { quizToDocx } from "./docx.js";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const clone = (x) => JSON.parse(JSON.stringify(x));
const plural = (n, one, many) => `${n} ${n === 1 ? one : many || `${one}s`}`;
const fmtWhen = (t) => new Date(t).toLocaleString([], { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
const snippet = (q) => q.text.trim().replace(/\s+/g, " ").slice(0, 70) || "(empty question)";

export function createQuizUI({ root, rerender, account, download }) {
  let view = null; // null | { kind: "list" } | { kind: "edit", id }
  const st = { loading: false, error: null, msg: null, q: "", modal: null };
  let ed = null;   // { draft, base, baseNote, sel: -1 (details) | question index, timer }

  const match = (hash) => {
    if (/^#\/quizzes\/?$/.test(hash)) return { kind: "list" };
    const m = hash.match(/^#\/quiz\/([^/?]+)/);
    return m ? { kind: "edit", id: decodeURIComponent(m[1]) } : null;
  };
  const active = () => !!view;
  const title = () => (view?.kind === "edit" && ed ? `Editing quiz · ${ed.draft.title || "Untitled"} · Trainer Runbook` : "Quizzes · Trainer Runbook");

  /* ---------- entering and leaving ---------- */
  async function enter(m) {
    view = m; ed = null; st.modal = null; st.error = null; st.loading = true;
    rerender();
    try { await loadQuizzes(); } catch (err) { st.error = err; }
    if (view !== m) return;
    if (m.kind === "edit" && !st.error) {
      const q = getQuiz(m.id);
      if (!q) { st.loading = false; location.hash = "#/quizzes"; return; }
      try { await ensureQuizHistory(m.id); } catch (err) { st.error = err; }
      if (view !== m) return;
      ed = { draft: clone(q), base: clone(q), baseNote: "Before your first edit", sel: -1, timer: null };
    }
    st.loading = false;
  }

  function flush() {
    if (!ed?.timer) return;
    clearTimeout(ed.timer); ed.timer = null;
    saveQuiz(ed.draft).catch(() => {});
  }
  // Leaving the editor: save, and keep a version of what the session changed.
  function leave() {
    if (ed) {
      flush();
      if (!sameQuiz(ed.draft, ed.base)) recordQuizVersion(ed.draft.id, ed.draft, { base: ed.base, baseNote: ed.baseNote }).catch(() => {});
    }
    ed = null; view = null; st.modal = null; st.msg = null;
  }
  const autosave = () => { clearTimeout(ed.timer); ed.timer = setTimeout(() => { ed.timer = null; saveQuiz(ed.draft).catch(() => {}); }, 400); };

  // Redraw without losing the page or tree scroll position.
  function redraw() {
    const y = window.scrollY, t = root.querySelector("#qz-tree")?.scrollTop || 0;
    rerender();
    window.scrollTo(0, y);
    const tree = root.querySelector("#qz-tree"); if (tree) tree.scrollTop = t;
  }
  function after() {
    if (st.modal === "new") root.querySelector("[data-qm=title]")?.focus();
  }

  /* ---------- pages ---------- */
  const outlineTitle = (q) => (q.outlineId ? getProgram(q.outlineId)?.title || "Outline no longer in the library" : "");

  function html() {
    if (st.loading) return page(`<main class="stage home"><p class="muted">Loading…</p></main>`);
    if (st.error) return page(`<main class="stage home"><div class="banner err" role="alert"><span>${esc(errorText(st.error))}</span><button class="btn" data-qz="retry">Try again</button></div></main>`);
    return view.kind === "list" ? listView() : editorView();
  }
  const page = (main) => `<header class="top"><div class="top-row"><button class="brand" data-act="home" title="Back to the outline library"><span class="brand-mark" aria-hidden="true">▶</span><span class="brand-name">Library</span><span class="brand-back" aria-hidden="true">←</span></button>${account()}</div></header>${main}`;
  const errorText = (err) => err?.code === "permission-denied"
    ? "The shared database refused access to quizzes. Publish the latest firestore.rules in Firebase (Firestore Database → Rules), then try again."
    : `Quizzes couldn’t be loaded: ${err?.message || err}`;

  /* ----- list ----- */
  function listView() {
    return page(`<main class="stage home">
      <section class="home-head">
        <div class="home-title"><div><div class="kicker">Quiz blueprints</div><h1>Quizzes</h1></div>
          <div class="row"><button class="btn primary" data-qz="new">+ New quiz</button></div></div>
        <p class="muted qz-intro">A blueprint is a quiz and its answer key: the questions, the answer choices and the correct answers. Nothing is taken or scored here. Export it to Word to use or share.</p>
        ${st.msg ? `<div class="banner ${st.msg.kind}" role="status"><span>${esc(st.msg.text)}</span><button class="plain small" data-qz="dismiss">Dismiss</button></div>` : ""}
        <label class="search"><span class="sr">Search quizzes</span><input type="search" data-qz-search placeholder="Search quizzes or the questions inside them" value="${esc(st.q)}" autocomplete="off"></label>
      </section>
      <section id="qz-results">${results()}</section>
    </main>${st.modal === "new" ? newModal() : ""}`);
  }

  function results() {
    const all = listQuizzes(), needle = st.q.trim().toLowerCase();
    const list = needle ? all.filter((q) => `${q.title} ${q.summary} ${q.questions.map((x) => x.text).join(" ")}`.toLowerCase().includes(needle)) : all;
    if (!all.length) return `<div class="empty-ok muted"><div>No quizzes yet.</div><button class="btn primary" data-qz="new">+ New quiz</button></div>`;
    if (!list.length) return `<div class="empty-ok muted"><div>No quizzes match “${esc(st.q)}”.</div></div>`;
    return `<p class="muted small count">${plural(list.length, "quiz", "quizzes")}${needle ? ` for “${esc(st.q)}”` : ""}</p><div class="pgrid">${list.map(card).join("")}</div>`;
  }

  function card(q) {
    const id = esc(q.id), types = typeCounts(q).map((t) => `${t.n} ${t.label.toLowerCase()}`).join(", ");
    const open = q.questions.filter((x) => issues(x).length).length;
    return `<article class="pcard">
      <div class="pc-top"><h2><button class="pc-name" data-qz="open:${id}" title="Open this quiz">${esc(q.title || "Untitled quiz")}</button></h2><span class="status">${esc(q.status)}</span>${q.kind !== "Quiz" ? `<span class="status">${esc(q.kind)}</span>` : ""}</div>
      <p class="pc-sum">${esc(q.summary || "No summary yet.")}</p>
      <div class="pc-meta"><span>${plural(q.questions.length, "question")}</span><span>v${esc(q.version)}</span>${q.outlineId ? `<span>Outline: ${esc(outlineTitle(q))}</span>` : ""}</div>
      ${types ? `<p class="muted small qz-types">${esc(types)}</p>` : ""}
      ${open ? `<p class="small qz-warn">${plural(open, "question")} still to complete</p>` : ""}
      <p class="muted small">Updated ${q.updatedAt ? esc(fmtWhen(q.updatedAt)) : "never"}${q.updatedBy ? ` by ${esc(q.updatedBy)}` : ""}${quizVersionCount(q.id) > 1 ? ` · ${plural(quizVersionCount(q.id), "saved version")}` : ""}</p>
      <div class="pc-actions"><button class="btn primary" data-qz="open:${id}">Edit</button><button class="btn" data-qz="docx:${id}" title="Download the questions, answer choices and correct answers as a Word document">Export .docx</button></div>
      <div class="pc-manage"><button class="plain small" data-qz="duplicate:${id}" title="Make a copy">Duplicate</button><button class="plain small danger-link" data-qz="delete:${id}" title="Permanently remove this quiz and its history">Delete</button></div>
    </article>`;
  }

  function newModal() {
    const progs = activePrograms();
    return `<div class="modal-back" data-qz="closemodal"></div>
    <form class="modal" data-qz-form="new" role="dialog" aria-label="New quiz">
      <h2>New quiz blueprint</h2>
      <label class="mfield"><span class="label">Title</span><input data-qm="title" required maxlength="100" placeholder="e.g. Day 3 knowledge check" autofocus></label>
      <label class="mfield"><span class="label">Summary</span><textarea data-qm="summary" rows="2" placeholder="What this quiz covers and who it is for"></textarea></label>
      <div class="mrow">
        <label class="mfield"><span class="label">Type</span><select data-qm="kind">${QUIZ_KINDS.map((k) => `<option>${k}</option>`).join("")}</select></label>
        <label class="mfield"><span class="label">Linked outline <span class="muted">· optional</span></span><select data-qm="outlineId"><option value="">None</option>${progs.map((p) => `<option value="${esc(p.id)}">${esc(p.title)}</option>`).join("")}</select></label>
      </div>
      <p class="muted small">You’ll add the questions in the editor next.</p>
      <div class="modal-actions"><button type="button" class="btn" data-qz="closemodal">Cancel</button><button type="submit" class="btn primary">Create and edit</button></div>
    </form>`;
  }

  /* ----- editor ----- */
  const cur = () => (ed.sel >= 0 ? ed.draft.questions[ed.sel] : null);

  function editorView() {
    const dr = ed.draft;
    return `<header class="top"><div class="top-row">
      <button class="brand" data-qz="back" title="Back to the quizzes"><span class="brand-mark" aria-hidden="true">▶</span><span class="brand-name">Quizzes</span><span class="brand-back" aria-hidden="true">←</span></button>
      <div class="ed-title"><span class="label">Editing quiz</span> <strong id="qz-title">${esc(dr.title || "Untitled quiz")}</strong></div>
      <span class="muted small ed-saved">Saved automatically</span>
      <button class="btn" data-qz="history" title="Browse and restore earlier versions">History</button>
      <button class="btn primary" data-qz="docx:${esc(dr.id)}" title="Download the questions, answer choices and correct answers as a Word document">Export .docx</button>
    </div></header>
    <main class="ed-stage">
      <aside class="ed-tree" id="qz-tree">${tree()}</aside>
      <section class="ed-form" id="qz-form">${st.msg ? `<div class="banner ${st.msg.kind}" role="status"><span>${esc(st.msg.text)}</span><button class="plain small" data-qz="dismiss">Dismiss</button></div>` : ""}${form()}</section>
    </main>
    ${st.modal?.type === "history" ? historyModal() : ""}`;
  }

  function tree() {
    const qs = ed.draft.questions;
    return `<button class="ed-item ${ed.sel === -1 ? "on" : ""}" data-qz="sel:-1"><strong>Quiz details</strong></button>
      <div class="ed-day">
        <div class="ed-item day qz-head"><span>Questions</span><span class="muted">${qs.length}</span></div>
        ${qs.map((q, i) => `<button class="ed-item blk ${ed.sel === i ? "on" : ""}" data-qz="sel:${i}" data-tq="${i}"><time>${i + 1}</time><span class="qt">${esc(snippet(q))}</span><span class="qw" title="Still to complete" ${issues(q).length ? "" : "hidden"}>⚠</span><span class="muted qs">${esc(typeShort(q.type))}</span></button>`).join("") || `<p class="muted small qz-none">No questions yet.</p>`}
      </div>
      <select class="qz-add" data-qz-add aria-label="Add a question"><option value="">＋ Add question…</option>${QUESTION_TYPES.map((t) => `<option value="${t.id}">${esc(t.label)}</option>`).join("")}</select>`;
  }

  const fld = (label, key, val, { rows, hint, attrs = "", i } = {}) =>
    `<label class="efield"><span class="label">${label}</span>${hint ? `<span class="hint">${hint}</span>` : ""}${
      rows ? `<textarea data-qf="${key}" ${i != null ? `data-i="${i}"` : ""} rows="${rows}" ${attrs}>${esc(val ?? "")}</textarea>`
           : `<input data-qf="${key}" ${i != null ? `data-i="${i}"` : ""} value="${esc(val ?? "")}" ${attrs}>`}</label>`;
  const sel = (key, val, opts) => `<select data-qf="${key}">${opts.map(([v, l]) => `<option value="${esc(v)}" ${v === val ? "selected" : ""}>${esc(l)}</option>`).join("")}</select>`;

  function form() {
    const dr = ed.draft;
    if (ed.sel < 0) {
      const progs = activePrograms().map((p) => [p.id, p.title]);
      if (dr.outlineId && !progs.some(([id]) => id === dr.outlineId)) progs.push([dr.outlineId, outlineTitle(dr)]);
      const types = typeCounts(dr);
      return `<h2>Quiz details</h2>
        ${fld("Title", "meta.title", dr.title, { attrs: 'maxlength="100"' })}
        ${fld("Summary", "meta.summary", dr.summary, { rows: 3, hint: "What this quiz covers and who it is for." })}
        <div class="erow">
          <label class="efield"><span class="label">Type</span>${sel("meta.kind", dr.kind, QUIZ_KINDS.map((k) => [k, k]))}</label>
          <label class="efield"><span class="label">Status</span>${sel("meta.status", dr.status, QUIZ_STATUS.map((k) => [k, k]))}</label>
          ${fld("Version", "meta.version", dr.version)}
        </div>
        <label class="efield"><span class="label">Linked outline</span><span class="hint">Optional. Named on the exported document.</span>${sel("meta.outlineId", dr.outlineId, [["", "None"], ...progs])}</label>
        ${fld("Day or topic", "meta.scope", dr.scope, { hint: "Optional, e.g. “Day 3 · Escalations”." })}
        ${fld("Objectives", "meta.objectives", dr.objectives.join("\n"), { rows: 4, hint: "One per line. What this quiz checks. Each question can name the objective it tests." })}
        <div class="qz-sum"><span class="label">At a glance</span><p>${plural(dr.questions.length, "question")}${types.length ? `: ${esc(types.map((t) => `${t.n} ${t.label.toLowerCase()}`).join(", "))}` : ""}.</p>
          <p class="muted small">${dr.questions.length ? "Pick a question on the left to edit it, or add another." : "Use “Add question” on the left to start."}</p></div>`;
    }
    const q = cur();
    const hint = { blank: `Write the sentence and put ${BLANK} where the answer goes.`, matching: "Say what to match, e.g. “Match each channel to its target response time.”", ordering: "Say what to put in order, e.g. “Put the escalation steps in order.”" }[q.type];
    return `<h2>Question ${ed.sel + 1} <span class="muted">· ${esc(typeLabel(q.type))}</span></h2>
      <label class="efield narrow-sel"><span class="label">Question type</span><select data-qz-type>${QUESTION_TYPES.map((t) => `<option value="${t.id}" ${t.id === q.type ? "selected" : ""}>${esc(t.label)}</option>`).join("")}</select>
        <span class="hint">${esc(QUESTION_TYPES.find((t) => t.id === q.type).hint)}</span></label>
      ${fld("Question", "q.text", q.text, { rows: 3, hint })}
      ${answerBlock(q)}
      ${fld("Objective", "q.objective", q.objective, { hint: "Optional tag for what this tests, e.g. “OBJ-14 · Verify caller identity”." })}
      ${fld("Rationale", "q.rationale", q.rationale, { rows: 2, hint: "Optional. Why the answer is correct; printed in the answer key." })}
      ${issuesBox()}
      <div class="ebtns"><button class="btn" data-qz="qup" ${ed.sel === 0 ? "disabled" : ""}>Move up</button><button class="btn" data-qz="qdown" ${ed.sel === ed.draft.questions.length - 1 ? "disabled" : ""}>Move down</button><button class="btn" data-qz="qdup">Duplicate</button><button class="btn danger" data-qz="qdel">Delete</button></div>`;
  }

  const issuesBox = () => {
    const q = ed && cur();
    const list = q ? issues(q) : [];
    return `<div id="qz-issues" class="qz-issues" ${list.length ? "" : "hidden"} role="status"><strong>Still to complete</strong><ul>${list.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>`;
  };

  function answerBlock(q) {
    if (q.type === "single" || q.type === "multiple") {
      const kind = q.type === "single" ? "radio" : "checkbox";
      return `<div class="efield"><span class="label">Answer choices</span><span class="hint">${q.type === "single" ? "Select the one correct choice." : "Tick every correct choice."}</span>
        <div class="qz-rows">${q.options.map((o, i) => `<div class="qz-opt ${q.correct.includes(i) ? "ok" : ""}">
          <input type="${kind}" name="qz-correct" data-qc="${i}" ${q.correct.includes(i) ? "checked" : ""} aria-label="Choice ${letter(i)} is correct">
          <span class="qz-letter">${letter(i)}</span>
          <input class="qz-text" data-qf="q.option" data-i="${i}" value="${esc(o)}" placeholder="Choice ${letter(i)}">
          <button class="plain small" data-qz="delopt:${i}" ${q.options.length <= 2 ? "disabled" : ""} aria-label="Remove choice ${letter(i)}">✕</button></div>`).join("")}</div>
        <button class="plain small" data-qz="addopt">+ Add choice</button></div>`;
    }
    if (q.type === "truefalse") {
      return `<div class="efield"><span class="label">Correct answer</span>
        <div class="qz-tf">${[[true, "True"], [false, "False"]].map(([v, l]) => `<label class="qz-tfopt ${q.answer === v ? "ok" : ""}"><input type="radio" name="qz-tf" data-qtf="${v}" ${q.answer === v ? "checked" : ""}> ${l}</label>`).join("")}</div></div>`;
    }
    if (q.type === "matching") {
      return `<div class="efield"><span class="label">Matching pairs</span><span class="hint">Each item on the left matches the answer on the same row. Shuffle them when the quiz is delivered.</span>
        <div class="qz-rows">${q.pairs.map((p, i) => `<div class="qz-pair">
          <input class="qz-text" data-qf="q.pairL" data-i="${i}" value="${esc(p.left)}" placeholder="Item ${i + 1}">
          <span class="muted" aria-hidden="true">→</span>
          <input class="qz-text" data-qf="q.pairR" data-i="${i}" value="${esc(p.right)}" placeholder="Matches">
          <button class="plain small" data-qz="delpair:${i}" ${q.pairs.length <= 2 ? "disabled" : ""} aria-label="Remove pair ${i + 1}">✕</button></div>`).join("")}</div>
        <button class="plain small" data-qz="addpair">+ Add pair</button></div>`;
    }
    if (q.type === "ordering") {
      return `<div class="efield"><span class="label">Items in the correct order</span><span class="hint">First to last. Shuffle them when the quiz is delivered.</span>
        <div class="qz-rows">${q.items.map((t, i) => `<div class="qz-item">
          <span class="qz-letter">${i + 1}</span>
          <input class="qz-text" data-qf="q.item" data-i="${i}" value="${esc(t)}" placeholder="Step ${i + 1}">
          <button class="plain small" data-qz="itemup:${i}" ${i === 0 ? "disabled" : ""} aria-label="Move item ${i + 1} up">↑</button>
          <button class="plain small" data-qz="itemdown:${i}" ${i === q.items.length - 1 ? "disabled" : ""} aria-label="Move item ${i + 1} down">↓</button>
          <button class="plain small" data-qz="delitem:${i}" ${q.items.length <= 2 ? "disabled" : ""} aria-label="Remove item ${i + 1}">✕</button></div>`).join("")}</div>
        <button class="plain small" data-qz="additem">+ Add item</button></div>`;
    }
    if (q.type === "blank") return fld("Accepted answers", "q.accepted", q.accepted.join("\n"), { rows: 3, hint: "One per line. Any of them counts as correct." });
    return fld("Model answer or grading notes", "q.model", q.model, { rows: 5, hint: "What a good answer includes. A trainer checks written answers against this." });
  }

  /* ----- version history ----- */
  const changeSummary = (d) => {
    const bits = [];
    if (d.added.length) bits.push(`${plural(d.added.length, "question")} added`);
    if (d.removed.length) bits.push(`${plural(d.removed.length, "question")} removed`);
    if (d.changed.length) bits.push(`${plural(d.changed.length, "question")} edited`);
    if (d.meta.length) bits.push(`${d.meta.join(", ")} changed`);
    return bits.join(" · ") || "No visible change";
  };

  function historyModal() {
    const id = ed.draft.id, vs = quizVersions(id), now = JSON.stringify(core(normalizeQuiz(ed.draft)));
    const v = vs.find((x) => x.n === st.modal.sel) || vs.at(-1);
    const list = vs.map((x, i) => {
      const isCur = JSON.stringify(x.quiz) === now;
      return `<button class="ver ${v && x.n === v.n ? "on" : ""}" data-qh="sel:${x.n}">
        <span class="ver-top"><strong>Version ${x.n}</strong>${isCur ? `<span class="tag-now">Current</span>` : ""}</span>
        <span class="muted small">${esc(fmtWhen(x.at))}</span>
        <span class="small">${esc(x.note || (i ? changeSummary(diffQuizzes(vs[i - 1].quiz, x.quiz)) : "Starting point"))}</span></button>`;
    }).reverse().join("");

    let detail = `<p class="muted">No earlier versions yet. A version is saved when you finish editing, or whenever you press Save version.</p>`;
    if (v) {
      const i = vs.indexOf(v), prev = i ? vs[i - 1].quiz : null, d = diffQuizzes(prev, v.quiz);
      const mark = new Map([...d.added.map((x) => [x.id, "new"]), ...d.changed.map((x) => [x.id, "edited"])]);
      const isCur = JSON.stringify(v.quiz) === now;
      const chips = (arr, label) => arr.length ? `<div class="chg"><span class="label">${label}</span>${arr.map((x) => `<span class="hchip">Q${x.n} <span class="muted">${esc(x.text.slice(0, 40))}</span></span>`).join("")}</div>` : "";
      detail = `<div class="hv-head"><h3>${esc(v.quiz.title || "Untitled quiz")} · Version ${v.n}</h3>
          <p class="muted small">${esc(fmtWhen(v.at))}${v.note ? ` · ${esc(v.note)}` : ""}</p>
          <p class="small">${plural(v.quiz.questions.length, "question")} · v${esc(v.quiz.version)} · ${esc(v.quiz.status)}</p></div>
        ${prev ? `<div class="hv-chg"><div class="label">Changes from version ${vs[i - 1].n}</div>
          ${d.meta.length ? `<p class="small">Details changed: ${esc(d.meta.join(", "))}</p>` : ""}
          ${chips(d.added, "Added")}${chips(d.changed, "Edited")}${chips(d.removed, "Removed")}
          ${!d.meta.length && !d.added.length && !d.changed.length && !d.removed.length ? `<p class="muted small">No visible change.</p>` : ""}</div>` : ""}
        <div class="hv-tree"><div class="label">Preview · read only</div>
          ${v.quiz.questions.map((q, n) => `<div class="qz-pv"><div><strong>${n + 1}.</strong> ${esc(q.text || "(empty question)")} <span class="muted small">${esc(typeLabel(q.type))}</span>${mark.get(q.id) ? ` <span class="tag-${mark.get(q.id)}">${mark.get(q.id)}</span>` : ""}</div>
            ${answerLine(q) ? `<div class="small qz-ans">Answer: ${esc(answerLine(q))}</div>` : ""}</div>`).join("") || `<p class="muted small">No questions in this version.</p>`}</div>
        <div class="modal-actions">${isCur ? `<span class="muted small">This is the current version.</span>` : `<button class="btn primary" data-qh="restore:${v.n}">Restore this version</button>`}</div>`;
    }
    return `<div class="modal-back" data-qz="closemodal"></div>
    <div class="modal wide" role="dialog" aria-label="Version history">
      <div class="hv-title"><h2>Version history · ${esc(ed.draft.title || "Untitled quiz")}</h2><button class="btn" data-qz="closemodal">Close</button></div>
      <div class="hv-save"><input data-qh-note maxlength="80" placeholder="Label the current state (optional), e.g. “Before the Day 4 rewrite”"><button class="btn" data-qh="save">Save version</button></div>
      <div class="hv"><div class="hv-list">${list}</div><div class="hv-detail">${detail}</div></div>
    </div>`;
  }

  async function histAction(spec) {
    const [cmd, arg] = spec.split(":");
    const id = ed.draft.id;
    if (cmd === "sel") { st.modal.sel = +arg; return redraw(); }
    const opts = { base: ed.base, baseNote: ed.baseNote };
    if (cmd === "save") {
      const note = root.querySelector("[data-qh-note]")?.value.trim() || "";
      clearTimeout(ed.timer); ed.timer = null;
      const v = await recordQuizVersion(id, ed.draft, { ...opts, note });
      st.modal.sel = v.n;
      return redraw();
    }
    if (cmd === "restore") {
      const n = +arg;
      if (!confirm(`Restore version ${n}?\n\nThe quiz as it is now is saved as a version first, so you can come back to it.`)) return;
      clearTimeout(ed.timer); ed.timer = null;
      const q = await restoreQuizVersion(id, n, ed.draft, opts);
      if (!q) return;
      ed.draft = clone(q); ed.base = clone(q); ed.sel = -1;
      st.modal.sel = quizVersions(id).at(-1).n;
      redraw();
    }
  }

  /* ---------- actions ---------- */
  async function exportDocx(id) {
    if (ed?.draft.id === id) flush();
    const q = getQuiz(id);
    if (!q) return;
    const open = q.questions.filter((x) => issues(x).length).length;
    if (open && !confirm(`${plural(open, "question")} of ${q.questions.length} ${open === 1 ? "is" : "are"} not complete yet (flagged ⚠ in the editor). Export anyway?`)) return;
    const name = `${slug(q.title || "quiz")}-blueprint.docx`;
    try {
      download(name, await quizToDocx(q, { outlineTitle: q.outlineId ? getProgram(q.outlineId)?.title || "" : "" }));
      st.msg = { kind: "ok", text: `Downloaded “${name}”. It has every question, its answer choices and the correct answers.` };
    } catch (err) {
      st.msg = { kind: "err", text: `Couldn’t make the Word file: ${err.message || err}` };
    }
    redraw();
  }

  async function create() {
    const v = (k) => root.querySelector(`[data-qm=${k}]`)?.value.trim() || "";
    if (!v("title")) { root.querySelector("[data-qm=title]")?.focus(); return; }
    const q = await addQuiz(blankQuiz({ title: v("title"), summary: v("summary"), kind: v("kind") || "Quiz", outlineId: v("outlineId") }));
    st.modal = null;
    location.hash = `#/quiz/${encodeURIComponent(q.id)}`;
  }

  const focusSoon = (selector) => setTimeout(() => root.querySelector(selector)?.focus(), 0);

  async function click(e) {
    const hb = e.target.closest("[data-qh]");
    if (hb && ed && st.modal?.type === "history") return histAction(hb.dataset.qh);
    const b = e.target.closest("[data-qz]");
    if (!b) return;
    const [cmd, arg] = b.dataset.qz.split(":");
    if (cmd === "goto") { window.scrollTo(0, 0); location.hash = "#/quizzes"; return; } // the Quizzes button on the library page
    if (!view) return;
    if (cmd === "closemodal") { st.modal = null; return redraw(); }
    if (cmd === "dismiss") { st.msg = null; return redraw(); }
    if (cmd === "retry") return enter(view).then(() => rerender());

    if (view.kind === "list") {
      const q = arg ? getQuiz(arg) : null;
      if (cmd === "new") { st.msg = null; st.modal = "new"; return redraw(); }
      if (cmd === "open" && q) { window.scrollTo(0, 0); location.hash = `#/quiz/${encodeURIComponent(arg)}`; return; }
      if (cmd === "docx" && q) return exportDocx(arg);
      if (cmd === "duplicate" && q) { const c = await duplicateQuiz(q); st.msg = { kind: "ok", text: `Created “${c.title}”. Open Edit to change it.` }; return redraw(); }
      if (cmd === "delete" && q) {
        if (!confirm(`Permanently delete “${q.title || "Untitled quiz"}”?\n\nThis removes the quiz and all of its saved versions for everyone, and can’t be undone.`)) return;
        await removeQuiz(arg);
        st.msg = { kind: "ok", text: `Deleted “${q.title || "Untitled quiz"}”.` };
        return redraw();
      }
      return;
    }

    if (!ed) return;
    const dr = ed.draft, qs = dr.questions, q = cur();
    if (cmd === "back") { window.scrollTo(0, 0); location.hash = "#/quizzes"; return; }
    if (cmd === "history") { flush(); st.modal = { type: "history", sel: quizVersions(dr.id).at(-1)?.n }; return redraw(); }
    if (cmd === "docx") return exportDocx(dr.id);
    if (cmd === "sel") { st.msg = null; ed.sel = +arg; return redraw(); }

    if (q) {
      if (cmd === "addopt") { q.options.push(""); autosave(); redraw(); return focusSoon(`[data-qf="q.option"][data-i="${q.options.length - 1}"]`); }
      if (cmd === "delopt") {
        const i = +arg; if (q.options.length <= 2) return;
        q.options.splice(i, 1);
        q.correct = q.correct.filter((c) => c !== i).map((c) => (c > i ? c - 1 : c));
      } else if (cmd === "addpair") { q.pairs.push({ left: "", right: "" }); autosave(); redraw(); return focusSoon(`[data-qf="q.pairL"][data-i="${q.pairs.length - 1}"]`); }
      else if (cmd === "delpair") { if (q.pairs.length <= 2) return; q.pairs.splice(+arg, 1); }
      else if (cmd === "additem") { q.items.push(""); autosave(); redraw(); return focusSoon(`[data-qf="q.item"][data-i="${q.items.length - 1}"]`); }
      else if (cmd === "delitem") { if (q.items.length <= 2) return; q.items.splice(+arg, 1); }
      else if (cmd === "itemup" || cmd === "itemdown") {
        const i = +arg, j = cmd === "itemup" ? i - 1 : i + 1;
        if (!q.items[j] && q.items[j] !== "") return;
        [q.items[i], q.items[j]] = [q.items[j], q.items[i]];
      } else if (cmd === "qup" || cmd === "qdown") {
        const j = ed.sel + (cmd === "qup" ? -1 : 1);
        if (!qs[j]) return;
        [qs[ed.sel], qs[j]] = [qs[j], qs[ed.sel]]; ed.sel = j;
      } else if (cmd === "qdup") {
        qs.splice(ed.sel + 1, 0, normalizeQuestion({ ...clone(q), id: "" })); ed.sel += 1;
      } else if (cmd === "qdel") {
        if (!confirm(`Delete question ${ed.sel + 1}?`)) return;
        qs.splice(ed.sel, 1); ed.sel = Math.min(ed.sel, qs.length - 1);
      } else return;
      autosave();
      redraw();
    }
  }

  // Typing: update the draft in place (no redraw, so focus stays) and save shortly after.
  function setField(el) {
    const key = el.dataset.qf, i = +el.dataset.i, v = el.value, dr = ed.draft;
    if (key.startsWith("meta.")) {
      const k = key.slice(5);
      if (k === "objectives") dr.objectives = parseLines(v); else dr[k] = v;
    } else {
      const q = cur(); if (!q) return;
      if (key === "q.option") q.options[i] = v;
      else if (key === "q.pairL") q.pairs[i].left = v;
      else if (key === "q.pairR") q.pairs[i].right = v;
      else if (key === "q.item") q.items[i] = v;
      else if (key === "q.accepted") q.accepted = parseLines(v);
      else q[key.slice(2)] = v;
    }
    autosave();
  }

  // After a field is committed: refresh the tree labels and warnings in place (replacing the tree would swallow a click on it).
  function refreshChrome() {
    ed.draft.questions.forEach((q, i) => {
      const item = root.querySelector(`[data-tq="${i}"]`); if (!item) return;
      item.querySelector(".qt").textContent = snippet(q);
      item.querySelector(".qw").hidden = !issues(q).length;
    });
    const t = root.querySelector("#qz-title"); if (t) t.textContent = ed.draft.title || "Untitled quiz";
    const box = root.querySelector("#qz-issues"); if (box) box.outerHTML = issuesBox();
    const tag = root.querySelector(".qz-head .muted"); if (tag) tag.textContent = ed.draft.questions.length;
  }

  function changeType(type) {
    const q = cur(); if (!q || q.type === type) return;
    q.type = type;
    if ((type === "single" || type === "multiple") && !q.options.length) q.options = ["", "", "", ""];
    if (type === "single") q.correct = q.correct.slice(0, 1);
    if (type === "matching" && !q.pairs.length) q.pairs = [{ left: "", right: "" }, { left: "", right: "" }, { left: "", right: "" }];
    if (type === "ordering" && !q.items.length) q.items = ["", "", ""];
    autosave(); redraw();
  }

  root.addEventListener("click", click);
  root.addEventListener("submit", (e) => {
    if (!view || !e.target.matches("[data-qz-form]")) return;
    e.preventDefault(); create();
  });
  root.addEventListener("input", (e) => {
    if (!view) return;
    if (e.target.matches("[data-qz-search]")) { st.q = e.target.value; root.querySelector("#qz-results").innerHTML = results(); return; }
    if (ed && e.target.matches("[data-qf]")) setField(e.target);
  });
  root.addEventListener("change", (e) => {
    if (!view || !ed) return;
    const t = e.target;
    if (t.matches("[data-qf]")) { refreshChrome(); return; }
    if (t.matches("[data-qz-add]")) {
      if (!t.value) return;
      ed.draft.questions.push(blankQuestion(t.value));
      ed.sel = ed.draft.questions.length - 1; st.msg = null;
      autosave(); redraw(); return focusSoon('[data-qf="q.text"]');
    }
    const q = cur(); if (!q) return;
    if (t.matches("[data-qz-type]")) return changeType(t.value);
    if (t.matches("[data-qc]")) {
      const i = +t.dataset.qc;
      if (q.type === "single") q.correct = [i];
      else q.correct = t.checked ? [...new Set([...q.correct, i])].sort((a, b) => a - b) : q.correct.filter((c) => c !== i);
      autosave(); redraw(); return;
    }
    if (t.matches("[data-qtf]")) { q.answer = t.dataset.qtf === "true"; autosave(); redraw(); }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && view && st.modal) { st.modal = null; redraw(); }
  });

  return { match, active, title, enter, leave, flush, html, after, setAuthor };
}
