import { loadCatalog, getProgram, activePrograms, archivedPrograms, hasDeletedBuiltins, addProgram, saveProgram, setArchived, removeProgram, restoreBuiltins, isBuiltin, isEdited, resetBuiltin, versionsOf, recordVersion, restoreVersion, diffPrograms, versionCount, ensureHistory } from "./programs.js";
import { BLOCK_TYPES, authored, normalizeProgram, blankProgram, parseImport, exportProgram, duplicateProgram, slug, parseLines, linesOf, parseGuide, serializeGuide, parseResources, resourcesText } from "./model.js";
import { outlineToPdf } from "./pdf.js";
import { calendarHTML, dayHTML, defaultStart } from "./calendar.js";
import { createStore, timerLeft } from "./store.js";
import { adapter, useAdapter } from "./storage.js";
import { startSession, showAccessError } from "./auth.js";
import { logins, loginByUrl, presentations, documents, CREDENTIAL_NOTE } from "./data/library.js";

const $app = document.getElementById("app");
// Transient UI state (not persisted): which side panel is open, which segment of Prep/Close is showing.
const ui = {
  panel: null, prepTab: "todo", closeTab: "list", showDone: false, collapsed: new Set(), openDays: new Set(),
  home: { q: "", tag: "All", progress: {}, meta: {}, showArchived: false, msg: null, layout: (() => { try { return localStorage.getItem("trainer-runbook:layout") === "list" ? "list" : "cards"; } catch { return "cards"; } })() }, // library page state
  modal: null,
};

/* ---------- helpers ---------- */
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const TYPE_LABEL = { topic: "Topic", activity: "Activity", discussion: "Discussion", assessment: "Assessment", break: "Break", lunch: "Lunch" };
const mins = (m) => (m ? `${m} min` : "");
const mmss = (ms) => {
  const s = Math.ceil(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};
const isRest = (b) => b.type === "break" || b.type === "lunch";
const when = (b) => (b.start ? `${b.start}–${b.end}` : "");
const typeLabel = (b) => (b.flex ? "Flexible practice" : TYPE_LABEL[b.type] || b.type);
const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;

// Nested bullets: a string is an item; an array directly after a string holds its children.
function bullets(items) {
  let html = "<ul>";
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (Array.isArray(it)) continue;
    html += `<li>${esc(it)}`;
    if (Array.isArray(items[i + 1])) html += bullets(items[i + 1]);
    html += "</li>";
  }
  return html + "</ul>";
}

const link = (r) =>
  r.url
    ? `<a class="chip ${loginByUrl.has(r.url) ? "chip-login" : ""}" href="${esc(r.url)}" target="_blank" rel="noopener noreferrer"><span class="chip-kind">${loginByUrl.has(r.url) ? "login" : esc(r.kind)}</span>${esc(r.label)}<span aria-hidden="true"> ↗</span></a>`
    : `<span class="chip chip-missing" title="The source outline has no link for this yet"><span class="chip-kind">${esc(r.kind)}</span>${esc(r.label)} <em>(link needed)</em></span>`;

/* ---------- logins & accounts ---------- */
const loginsIn = (resources) => {
  const seen = new Set();
  return resources.map((r) => loginByUrl.get(r.url)).filter((l) => l && !seen.has(l.id) && seen.add(l.id));
};
const copyBtn = (v) => `<button class="copy" data-copy="${esc(v)}" title="Copy to clipboard">${esc(v)}</button>`;
const acctRows = (l) =>
  l.accounts.length
    ? `<div class="accts">${l.accounts.map(([v, n]) => `<span class="acct">${copyBtn(v)}${n ? `<span class="acct-note">${esc(n)}</span>` : ""}</span>`).join("")}</div>`
    : "";
const loginCard = (l) => `<div class="login">
  <div class="login-head"><a class="btn primary login-btn" href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">${esc(l.label)} ↗</a><span class="muted small">${esc(l.note)}</span></div>
  ${acctRows(l)}</div>`;

/* ---------- derived data ---------- */
const prepItems = (day) => [
  ...day.prep.map((i) => ({ ...i, from: "Day setup" })),
  ...day.blocks.flatMap((b) => b.prep.map((i) => ({ ...i, from: b.title }))),
];
const dayRes = (day) => [...(day.resources || []), ...day.blocks.flatMap((b) => b.resources)];
const dayResources = (day) => {
  const seen = new Map();
  dayRes(day).forEach((r) => { const k = r.url || `${r.kind}:${r.label}`; if (!seen.has(k)) seen.set(k, r); });
  return [...seen.values()];
};
const blockStatus = (s, b) => (s.completed[b.id] ? "done" : s.skipped[b.id] ? "skipped" : "todo");

// Glanceable "cue card" for a block: the trainer's top-level moves, shortened. Full wording stays in the guide panel.
function shorten(t) {
  const colon = t.indexOf(":");
  if (colon > 0 && colon <= 52) return t.slice(0, colon).trim();
  const first = t.split(/(?<=[.?!])\s/)[0].trim();
  return first.length > 95 ? first.slice(0, 92).trimEnd() + "…" : first;
}
function cueSteps(b) {
  const moves = b.sections
    .filter((s) => s.kind === "conduct" || s.kind === "activity")
    .flatMap((s) => s.items.filter((x) => typeof x === "string"))
    .filter((t) => !/^Discussion and activities estimated time/i.test(t));
  // A long paragraph lead-in is context, not a move: leave it for the guide when real short steps follow.
  const short = moves.filter((t) => t.length <= 120 || t.indexOf(":") > 0 && t.indexOf(":") <= 52);
  const base = short.length >= 3 ? short : moves.length ? moves : b.sections.map((s) => s.heading);
  return base.map((t, i) => ({ id: `${b.id}.s${i}`, text: shorten(t) }));
}
const alertsOf = (b) => [
  ...b.warnings.map((text) => ({ kind: "warn", text })),
  ...b.reminders.map((text) => ({ kind: "remind", text })),
];

/* ---------- pace: plan vs. the real clock ---------- */
// Minutes since midnight in the program's zone (Asia/Manila), so it is right on any machine.
// `?clock=HH:MM` in the URL overrides "now" (handy for trying the chip outside class hours).
const hm = (t) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
function zoneMinutes(tz, date = new Date()) {
  const forced = new URLSearchParams(location.search).get("clock");
  if (forced) return hm(forced) + Math.round((date.getTime() - Date.now()) / 60000); // forced "now"; other dates keep their offset
  const p = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date);
  return Number(p.find((x) => x.type === "hour").value) * 60 + Number(p.find((x) => x.type === "minute").value);
}
function paceInfo(store) {
  const s = store.get(), day = store.day(), b = store.currentBlock(), tz = store.program.tz;
  if (!tz || !b.start) return null;
  const now = zoneMinutes(tz);
  if (now < hm(day.start) - 30 || now > hm(day.end) + 60) return null; // outside the scheduled day
  if (!s.completed[b.id] && now > hm(b.end)) return { kind: "late", text: `Over by ${now - hm(b.end)} min` };
  const arrived = s.entered[b.id];
  if (!arrived) return null;
  const delta = zoneMinutes(tz, new Date(arrived)) - hm(b.start);
  if (Math.abs(delta) <= 5) return { kind: "ok", text: "On schedule" };
  return delta > 0 ? { kind: "late", text: `${delta} min behind` } : { kind: "early", text: `${-delta} min ahead` };
}
const paceChip = (store) => {
  const p = paceInfo(store);
  return p ? `<span class="pace pace-${p.kind}" data-pace title="Compared with the planned schedule (${esc(store.program.timezone)})">${esc(p.text)}</span>` : '<span data-pace hidden></span>';
};

/* ---------- shared components ---------- */
function checkbox(store, item, extra = "", cls = "") {
  const on = !!store.get().checks[item.id];
  return `<label class="check ${cls} ${on ? "on" : ""}"><input type="checkbox" data-check="${esc(item.id)}" ${on ? "checked" : ""}><span class="box" aria-hidden="true"></span><span class="check-text">${esc(item.text)}${extra}</span></label>`;
}
const segs = (group, tabs, active) =>
  `<div class="segs" role="tablist">${tabs.map(([k, label, n]) => `<button role="tab" class="seg-btn ${active === k ? "active" : ""}" aria-selected="${active === k}" data-seg="${group}:${k}">${label}${n != null ? `<span class="seg-n ${n ? "" : "zero"}">${n}</span>` : ""}</button>`).join("")}</div>`;

function header(store) {
  const s = store.get();
  const day = store.day();
  const done = day.blocks.filter((b) => s.completed[b.id]).length;
  const tabs = [["prep", "Prep"], ["run", "Run"], ["close", "Close"], ["outline", "Outline"]];
  return `
  <header class="top">
    <div class="top-row">
      <button class="brand" data-act="home" title="Back to the outline library"><span class="brand-mark" aria-hidden="true">▶</span><span class="brand-name">Library</span><span class="brand-back" aria-hidden="true">←</span></button>
      <label class="day-pick"><span class="sr">Training day</span>
        <select data-day>${store.program.days.map((d) => `<option value="${d.id}" ${d.id === day.id ? "selected" : ""}>${esc(d.title)}${s.closed[d.id] ? " ✓" : ""} · ${esc(d.theme)}</option>`).join("")}</select>
      </label>
      <nav class="tabs" role="tablist">${tabs.map(([k, l]) => `<button role="tab" class="tab ${s.mode === k ? "active" : ""}" aria-selected="${s.mode === k}" data-mode="${k}">${l}</button>`).join("")}</nav>
      <button class="tool-btn" data-cal="open:${esc(store.program.id)}" title="See this program on a calendar">Calendar</button>
      <button class="tool-btn" data-panel="toolbox" title="Logins, test accounts, presentations">Toolbox</button>
      <div class="top-progress" title="Blocks completed today">${done}/${day.blocks.length}</div>
    </div>
  </header>`;
}

/* ---------- side panels (Toolbox · Full guide · My notes) ---------- */
function panelShell(title, body, wide) {
  return `<div class="drawer-backdrop" data-panel="close"></div>
  <aside class="drawer ${wide ? "wide" : ""}" role="dialog" aria-label="${esc(title)}">
    <div class="drawer-head"><h2>${esc(title)}</h2><button class="btn" data-panel="close">Close ✕</button></div>
    <div class="drawer-body">${body}</div>
  </aside>`;
}

function toolboxPanel(store) {
  const day = store.day();
  const here = loginsIn(store.currentBlock().resources);
  const today = loginsIn(dayRes(day)).filter((l) => !here.includes(l));
  const rest = logins.filter((l) => !here.includes(l) && !today.includes(l));
  const todayUrls = new Set(dayRes(day).map((r) => r.url).filter(Boolean));
  const pres = [...presentations].sort((a, b) => (todayUrls.has(b.url) ? 1 : 0) - (todayUrls.has(a.url) ? 1 : 0));
  const row = (p, note) => p.url
    ? `<a class="trow" href="${esc(p.url)}" target="_blank" rel="noopener noreferrer"><span class="tname">${esc(p.label)}</span><span class="tmeta">${todayUrls.has(p.url) ? '<b class="tag-today">today</b> ' : ""}${esc(note || "")} ↗</span></a>`
    : `<div class="trow missing"><span class="tname">${esc(p.label)}</span><span class="tmeta">${esc(note || "")} · link needed</span></div>`;
  const group = (title, list) => (list.length ? `<h3>${title}</h3>${list.map(loginCard).join("")}` : "");
  return panelShell("Toolbox", `
      ${group("Logins · this block", here)}
      ${group(`Logins · ${esc(day.title)}`, today)}
      ${group("All logins and tools", rest)}
      <h3>Presentations</h3><div class="tlist">${pres.map((p) => row(p, p.for)).join("")}</div>
      <h3>Forms &amp; documents</h3><div class="tlist">${documents.map((p) => row(p, p.note)).join("")}</div>
      <p class="muted small cred-note">${esc(CREDENTIAL_NOTE)}</p>`);
}

function guidePanel(store) {
  const b = store.currentBlock();
  const alerts = alertsOf(b);
  return panelShell(`Full guide · ${b.title}`, `
    ${alerts.map((a) => `<div class="callout ${a.kind}">${esc(a.text)}</div>`).join("")}
    ${b.objective ? `<div class="objective"><span class="label">Objective</span>${esc(b.objective)}</div>` : ""}
    ${b.summary ? `<p class="summary">${esc(b.summary)}</p>` : ""}
    ${b.sections.length ? `<section class="official" aria-label="Official facilitator guide"><div class="official-tag">Official facilitator guide</div>
      ${b.sections.map((sec, i) => {
        const key = `${b.id}:${i}`;
        return `<details class="gsec k-${sec.kind}" data-key="${key}" ${ui.collapsed.has(key) ? "" : "open"}><summary>${sec.kind === "note" ? "Trainer note · " : ""}${esc(sec.heading)}</summary>${bullets(sec.items)}</details>`;
      }).join("")}</section>` : '<p class="muted">No detailed guide for this block.</p>'}
    ${b.transition ? `<div class="callout transition"><strong>Transition</strong> ${esc(b.transition)}</div>` : ""}`, true);
}

function notesPanel(store) {
  const b = store.currentBlock();
  return panelShell(`My notes · ${b.title}`, `
    <section class="mine">
      <div class="mine-tag">My notes <span>· only on this device, never changes the official guide</span></div>
      <textarea data-note="${b.id}" rows="10" placeholder="e.g. an example that landed well, a timing adjustment…">${esc(store.get().notes[b.id] || "")}</textarea>
    </section>`);
}

/* ---------- PREP ---------- */
function prepView(store) {
  const s = store.get();
  const day = store.day();
  const items = prepItems(day);
  const todo = items.filter((i) => !s.checks[i.id]);
  const doneN = items.length - todo.length;
  const ready = todo.length === 0;
  const dayLogins = loginsIn(dayRes(day));
  const resources = dayResources(day);
  const tab = ui.prepTab;

  const groups = [];
  const list = ui.showDone ? items : todo;
  list.forEach((i) => { let g = groups.find((x) => x.name === i.from); if (!g) groups.push((g = { name: i.from, items: [] })); g.items.push(i); });

  const panes = {
    todo: ready && !ui.showDone
      ? `<div class="empty-ok"><div class="big-ok">✓</div><div>Everything is prepared.</div></div>`
      : groups.map((g) => `<div class="group"><h3>${esc(g.name)}</h3>${g.items.map((i) => checkbox(store, i)).join("")}</div>`).join(""),
    logins: dayLogins.length ? `<div class="login-grid">${dayLogins.map(loginCard).join("")}</div>` : '<p class="muted">No logins needed today.</p>',
    remember: day.reminders.length ? `<ul class="reminders big">${day.reminders.map((r) => `<li>${esc(r)}</li>`).join("")}</ul>` : '<p class="muted">Nothing special today.</p>',
    materials: `<div class="chips">${resources.map(link).join("")}</div>${resources.some((r) => !r.url) ? '<p class="muted small">“Link needed” items have no URL in the source outline yet.</p>' : ""}`,
  };

  return `
  <main class="stage">
    <section class="status-band ${ready ? "is-ready" : ""}">
      <div>
        <div class="kicker">Prep · ${esc(day.title)} · ${esc(day.start)}–${esc(day.end)} ${esc(store.program.timezone || "")}</div>
        <h1>${esc(day.theme)}</h1>
        <div class="ready-line">${ready ? "Ready to go" : `${plural(todo.length, "thing")} to do before trainees arrive`}<span class="muted"> · ${doneN}/${items.length} done</span></div>
      </div>
      <button class="btn primary big" data-mode="run">${ready ? "Start the day" : "Go to Run anyway"} →</button>
    </section>
    <div class="progress"><span style="width:${items.length ? Math.round((doneN / items.length) * 100) : 100}%"></span></div>
    ${segs("prep", [["todo", "To do", todo.length], ["logins", "Logins", dayLogins.length], ["remember", "Remember", day.reminders.length], ["materials", "Materials", resources.length]], tab)}
    <section class="pane">${panes[tab]}
      ${tab === "todo" && doneN ? `<button class="plain small showdone" data-act="toggledone">${ui.showDone ? "Hide" : "Show"} ${doneN} done</button>` : ""}
    </section>
  </main>`;
}

/* ---------- RUN ---------- */
function timerBlock(store, b, big = false) {
  const t = store.get().timers[b.id];
  const left = timerLeft(t);
  const base = b.minutes || (isRest(b) ? 15 : 10);
  if (!t) {
    return `<div class="timer idle ${big ? "big" : ""}"><label>Timer <input type="number" min="1" max="240" value="${base}" data-timer-min aria-label="Timer minutes"> min</label><button class="btn ${big ? "primary" : ""}" data-timer="start">Start</button></div>`;
  }
  const paused = !t.endsAt;
  return `<div class="timer ${big ? "big" : ""} ${left === 0 ? "done" : paused ? "paused" : "running"}"><span class="timer-clock" data-timer-clock="${b.id}">${left === 0 ? "Time" : mmss(left)}</span>
    ${left === 0 ? "" : paused ? '<button class="btn" data-timer="resume">Resume</button>' : '<button class="btn" data-timer="pause">Pause</button>'}
    <button class="btn ghost" data-timer="clear">${left === 0 ? "Dismiss" : "Clear"}</button></div>`;
}

function runView(store) {
  const s = store.get();
  const day = store.day();
  const b = store.currentBlock();
  const i = store.index();
  const nxt = store.next();
  const isDone = !!s.completed[b.id];
  const allHandled = day.blocks.every((x) => s.completed[x.id] || s.skipped[x.id]);
  const noteDot = (s.notes[b.id] || "").trim() ? '<span class="dot" aria-label="has notes"></span>' : "";

  const status = `
    <div class="statusline">
      <div class="where-text"><strong>${esc(day.title)}</strong> · ${i + 1} of ${day.blocks.length}${isDone ? ' · <span class="ok">Done</span>' : ""}</div>
      <div class="strip" role="list">${day.blocks.map((x, n) => `<button role="listitem" class="seg ${blockStatus(s, x)} ${n === i ? "cur" : ""}" data-goto="${x.id}" title="${esc(x.title)}" aria-label="${esc(x.title)}"></button>`).join("")}</div>
      ${paceChip(store)}
      ${checkbox(store, { id: day.attendanceId, text: "Attendance tracker updated" }, "", "slim")}
    </div>`;

  let body;
  if (isRest(b)) {
    body = `
    <section class="now rest-now">
      <div class="kicker">${typeLabel(b)} · ${when(b)} ${esc(store.program.timezone || "")}</div>
      <h1 class="rest-title">Back at ${esc(b.end)}</h1>
      ${timerBlock(store, b, true)}
      ${b.summary ? `<p class="summary">${esc(b.summary)}</p>` : ""}
    </section>`;
  } else {
    const steps = cueSteps(b);
    const remaining = steps.filter((st) => !s.checks[st.id]);
    const doneSteps = steps.length - remaining.length;
    const alerts = alertsOf(b);
    // keep the whole screen in view: fewer steps when the alerts / action list already take room
    const cap = alerts.length >= 2 || b.actions.length >= 2 ? 4 : 5;
    const shown = remaining.slice(0, cap);
    const more = remaining.length - shown.length;
    const shownAlerts = alerts.slice(0, 2);
    const logs = loginsIn(b.resources).filter((l) => l.accounts.length);

    body = `
    <section class="now">
      <div class="now-top">
        <div class="badges"><span class="kicker">Now</span><span class="badge t-${b.type}">${typeLabel(b)}</span>${b.minutes ? `<span class="badge dur">${mins(b.minutes)}</span>` : ""}${b.start ? `<span class="badge dur" title="Planned schedule, not enforced">${when(b)} ${esc(store.program.timezone || "")}</span>` : ""}</div>
        <div class="now-tools">
          ${timerBlock(store, b)}
          <button class="btn" data-panel="guide" title="Complete official facilitator guide">Full guide</button>
          <button class="btn" data-panel="notes">My notes${noteDot}</button>
        </div>
      </div>
      <h1>${esc(b.title)}</h1>
      ${b.objective || b.summary ? `<p class="obj">${esc(b.objective || b.summary)}</p>` : ""}
      ${shownAlerts.length ? `<div class="alerts">${shownAlerts.map((a) => `<div class="alert ${a.kind}"><span class="alert-ic" aria-hidden="true">${a.kind === "warn" ? "!" : "i"}</span>${esc(a.text)}</div>`).join("")}${alerts.length > 2 ? `<button class="plain small" data-panel="guide">+${alerts.length - 2} more in the guide</button>` : ""}</div>` : ""}

      <div class="cols ${b.resources.length ? "" : "one"}">
        ${steps.length ? `<div class="steps"><h2>Steps${doneSteps ? ` <span class="muted">· ${doneSteps} done</span>` : ""}</h2>
          ${shown.length ? shown.map((st, n) => checkbox(store, st, "", `step ${n === 0 ? "current" : ""}`)).join("") : '<p class="ok">All steps covered.</p>'}
          ${more > 0 ? `<button class="plain small" data-panel="guide">+${more} more in the guide</button>` : ""}</div>` : ""}
        ${b.resources.length ? `<div class="open"><h2>Open</h2><div class="chips">${b.resources.map(link).join("")}</div>
            ${logs.length ? `<button class="plain small acct-link" data-panel="toolbox">Test accounts for ${esc(logs.map((l) => l.label.split(" ")[0]).join(", "))} →</button>` : ""}</div>` : ""}
      </div>
      ${b.actions.length ? `<div class="before"><span class="label">Before moving on</span>${b.actions.map((a) => checkbox(store, a, "", "slim")).join("")}</div>` : ""}
    </section>`;
  }

  return `
  <main class="stage run">
    ${status}
    ${body}
    ${allHandled ? `<div class="end-strip"><strong>Every block is handled.</strong><button class="btn primary" data-mode="close">Go to Close →</button></div>` : ""}
  </main>

  <div class="controls" role="toolbar" aria-label="Facilitation controls">
    <div class="controls-inner">
      <button class="btn big" data-act="prev" ${i === 0 ? "disabled" : ""}>← Previous</button>
      <button class="controls-next" data-goto="${nxt ? nxt.id : ""}" ${nxt ? "" : "disabled"}><span class="label">Next · ${nxt ? esc(nxt.start || "") : ""}</span><span class="nt">${nxt ? `${esc(nxt.title)}${nxt.minutes ? ` · ${mins(nxt.minutes)}` : ""}` : "End of day"}</span></button>
      <button class="btn big" data-act="advance" ${nxt ? "" : "disabled"} title="${isDone ? "Next block" : "Move on without completing (marks as skipped)"}">${isDone ? "Next →" : "Skip →"}</button>
      ${isDone
        ? (nxt ? "" : `<button class="btn big primary" data-mode="close">Close the day →</button>`)
        : `<button class="btn big primary" data-act="complete">✓ Complete${nxt ? " &amp; next" : ""}</button>`}
    </div>
  </div>`;
}

/* ---------- CLOSE ---------- */
function closeView(store) {
  const s = store.get();
  const day = store.day();
  const dayIdx = store.program.days.findIndex((d) => d.id === day.id);
  const nextDay = store.program.days[dayIdx + 1];
  const skipped = day.blocks.filter((b) => s.skipped[b.id] && !s.completed[b.id]);
  const notStarted = day.blocks.filter((b) => !s.completed[b.id] && !s.skipped[b.id]);
  const handled = day.blocks.filter((b) => s.completed[b.id] || s.skipped[b.id]);
  const openActions = handled.flatMap((b) => b.actions.filter((a) => !s.checks[a.id]).map((a) => ({ ...a, from: b.title })));
  const closeOpen = day.close.filter((c) => !s.checks[c.id]);
  const notes = day.blocks.filter((b) => (s.notes[b.id] || "").trim());
  const nextPrep = nextDay ? prepItems(nextDay) : [];
  const closed = s.closed[day.id];
  const outstanding = skipped.length + notStarted.length + openActions.length;
  const total = outstanding + closeOpen.length;
  const tab = ui.closeTab;

  const blockLine = (b) => `<li><button class="plain" data-goto="${b.id}" data-then="run">${esc(b.title)}</button> <span class="muted">${esc(when(b))}</span></li>`;
  const panes = {
    list: day.close.map((c) => checkbox(store, c)).join(""),
    out: total === 0 && !outstanding ? '<div class="empty-ok"><div class="big-ok">✓</div><div>Nothing outstanding in today’s blocks.</div></div>' : `
      ${skipped.length ? `<h3>Skipped</h3><ul class="plainlist">${skipped.map(blockLine).join("")}</ul>` : ""}
      ${notStarted.length ? `<h3>Not reached</h3><ul class="plainlist">${notStarted.map(blockLine).join("")}</ul>` : ""}
      ${openActions.length ? `<h3>Unchecked before-moving-on items</h3>${openActions.map((a) => checkbox(store, a, ` <span class="muted">· ${esc(a.from)}</span>`)).join("")}` : ""}`,
    notes: `${notes.length ? notes.map((b) => `<div class="note-row"><div class="note-for">${esc(b.title)}</div><div class="note-body">${esc(s.notes[b.id])}</div></div>`).join("") : '<p class="muted">No block notes today.</p>'}
      <label class="field"><span class="label">Note for tomorrow / handoff</span><textarea data-daynote="${day.id}" rows="3" placeholder="Anything to carry into the next day…">${esc(s.dayNotes[day.id] || "")}</textarea></label>`,
    next: nextDay ? `<h3>${esc(nextDay.title)} · ${esc(nextDay.theme)}</h3>
      ${nextDay.reminders.length ? `<ul class="reminders">${nextDay.reminders.map((r) => `<li>${esc(r)}</li>`).join("")}</ul>` : ""}
      <h3>Prepare now</h3>${nextPrep.map((p) => checkbox(store, p, ` <span class="muted">· ${esc(p.from)}</span>`)).join("")}`
      : '<p class="muted">That’s the final day. After this, trainees move into nesting.</p>',
  };

  return `
  <main class="stage">
    <section class="status-band ${closed ? "is-ready" : ""}">
      <div>
        <div class="kicker">Close · ${esc(day.title)}</div>
        <h1>${closed ? "Day complete" : "Wrap up the day"}</h1>
        <div class="ready-line">${closed ? `Closed ${esc(new Date(closed).toLocaleString())}` : total ? `${plural(total, "item")} still open` : "All clear"}</div>
      </div>
      ${closed ? '<button class="btn" data-act="reopen">Reopen day</button>' : ""}
    </section>
    ${segs("close", [["list", "Checklist", closeOpen.length], ["out", "Outstanding", outstanding], ["notes", "Notes", notes.length || null], ["next", "Tomorrow", null]], tab)}
    <section class="pane">${panes[tab]}</section>
  </main>
  <div class="controls"><div class="controls-inner">
    ${closed
      ? (nextDay ? `<button class="btn big primary" data-act="nextday" data-day="${nextDay.id}">Start ${esc(nextDay.title)} prep →</button>` : "")
      : `<button class="btn big primary" data-act="closeday">Complete ${esc(day.title)}</button><span class="muted close-hint">${total ? "Items still open. You can close anyway." : ""}</span>`}
  </div></div>`;
}

/* ---------- OUTLINE ---------- */
function outlineView(store) {
  const s = store.get();
  const cur = store.currentBlock();
  return `
  <main class="stage wide-stage">
    <div class="page-head"><div class="kicker">Outline</div><h1>${esc(store.program.title)}</h1><p class="muted">${esc(store.program.schedule || "")}. Tap any block to jump there. Nothing is locked. Day groupings and durations are a proposed plan; “Flexible” blocks are open practice time that fills each day to 7.5 hours.</p></div>
    ${store.program.days.map((d) => {
      const done = d.blocks.filter((b) => s.completed[b.id]).length;
      const open = ui.openDays.has(d.id) || d.id === s.day;
      return `<details class="oday" data-oday="${d.id}" ${open ? "open" : ""}>
        <summary><span class="od-title">${esc(d.title)}</span><span class="od-theme">${esc(d.theme)}</span><span class="od-count ${s.closed[d.id] ? "ok" : ""}">${s.closed[d.id] ? "Closed ✓" : `${done}/${d.blocks.length}`}</span></summary>
        <ol class="oblocks">${d.blocks.map((b) => {
          const st = blockStatus(s, b);
          const here = d.id === s.day && b.id === cur.id;
          return `<li><button class="oblock ${st} ${here ? "here" : ""}" data-goto="${b.id}" data-day="${d.id}" data-then="run"><span class="ostat" aria-hidden="true">${here ? "●" : st === "done" ? "✓" : st === "skipped" ? "↷" : "○"}</span><span class="otitle">${esc(b.title)}</span><span class="ometa">${b.start || ""} · ${b.flex ? "Flexible · " : ""}${mins(b.minutes)}</span></button></li>`;
        }).join("")}</ol></details>`;
    }).join("")}
    <section class="card danger"><h2>Reset</h2><p class="muted small">Clears progress, checklists and your notes on this device.</p><button class="btn" data-act="reset">Reset all progress</button></section>
  </main>`;
}

/* ---------- HOME: outline library ---------- */
const workBlocks = (p) => p.days.flatMap((d) => d.blocks.filter((b) => !isRest(b) && !b.flex && !b.continues).map((block) => ({ day: d, block })));
// Searchable index per outline: its own words (title, summary, tags) plus every topic and day theme inside it.
const indexCache = new WeakMap();
function indexOf(p) {
  let e = indexCache.get(p);
  if (!e) {
    e = {
      meta: [p.title, p.summary, p.audience, (p.tags || []).join(" ")].join(" ").toLowerCase(),
      topics: workBlocks(p).map(({ day, block }) => ({ day, block, text: `${block.title} ${day.theme}`.toLowerCase() })),
    };
    indexCache.set(p, e);
  }
  return e;
}
const allTags = () => [...new Set([...activePrograms(), ...archivedPrograms()].flatMap((p) => p.tags || []))].sort((a, b) => a.localeCompare(b));

function searchLibrary(list, q, tag) {
  const tokens = q.toLowerCase().split(/\s+/).filter(Boolean);
  return list
    .filter((p) => tag === "All" || (p.tags || []).includes(tag))
    .map((p) => {
      const e = indexOf(p);
      const ok = tokens.every((t) => e.meta.includes(t) || e.topics.some((x) => x.text.includes(t)));
      const hits = tokens.length
        ? e.topics.map((x) => ({ ...x, score: tokens.filter((t) => x.text.includes(t)).length })).filter((x) => x.score).sort((a, b) => b.score - a.score).slice(0, 4)
        : [];
      return { p, ok, hits, total: e.topics.filter((x) => tokens.some((t) => x.text.includes(t))).length };
    })
    .filter((e) => e.ok)
    .sort((a, b) => (ui.home.meta.lastOpened?.[b.p.id] || 0) - (ui.home.meta.lastOpened?.[a.p.id] || 0) || a.p.title.localeCompare(b.p.title));
}

function progressOf(p, saved) {
  if (!saved) return null;
  const work = workBlocks(p);
  const done = work.filter(({ block }) => saved.completed?.[block.id]).length;
  const day = p.days.find((d) => d.id === saved.day) || p.days[0];
  const cur = day.blocks.find((b) => b.id === saved.pos?.[day.id]);
  if (!done && !cur && !Object.keys(saved.checks || {}).length) return null;
  return { done, total: work.length, day, cur };
}

function programCard({ p, hits, total }, archived = false) {
  const work = workBlocks(p);
  const hours = Math.round((p.days.reduce((n, d) => n + d.blocks.filter((b) => !isRest(b)).reduce((m, b) => m + b.minutes, 0), 0) / 60) * 10) / 10;
  const pr = progressOf(p, ui.home.progress[p.id]);
  const id = esc(p.id);
  const mine = !isBuiltin(p.id);
  const modified = isEdited(p.id);
  return `<article class="pcard ${archived ? "is-archived" : ""}">
    <div class="pc-top"><h2><button class="pc-name" data-outline="${id}" title="Open the overview of this outline">${esc(p.title)}</button></h2>${p.status ? `<span class="status">${esc(p.status)}</span>` : ""}${modified ? `<span class="status">Edited</span>` : ""}</div>
    <p class="pc-sum">${esc(p.summary || "No summary yet.")}</p>
    <div class="pc-meta"><span>${p.days.length} day${p.days.length === 1 ? "" : "s"}</span><span>${hours} training hours</span><span>${work.length} topics</span><span>v${esc(p.version)}</span></div>
    <div class="pc-tags">${(p.tags || []).map((t) => `<button class="tagchip" data-tag="${esc(t)}">${esc(t)}</button>`).join("")}</div>
    ${hits.length ? `<div class="pc-hits"><span class="label">In this outline${total > hits.length ? ` · ${total} matches` : ""}</span>${hits.map((h) => `<button class="hit" data-open="${id}" data-day="${h.day.id}" data-block="${h.block.id}"><strong>${esc(h.block.title)}</strong> <span class="muted">${esc(h.day.title)}</span></button>`).join("")}</div>` : ""}
    ${pr ? `<div class="pc-prog"><div class="progress"><span style="width:${pr.total ? Math.round((pr.done / pr.total) * 100) : 0}%"></span></div><span class="muted small">${pr.done}/${pr.total} topics done · at ${esc(pr.day.title)}${pr.cur ? ` · ${esc(pr.cur.title)}` : ""}</span></div>` : ""}
    <div class="pc-actions">
      ${archived
        ? `<button class="btn primary" data-lib="restore:${id}">Restore</button><button class="btn" data-outline="${id}">View</button>`
        : `<button class="btn primary" data-outline="${id}">View outline</button>${pr ? `<button class="btn" data-open="${id}" data-day="${pr.day.id}" data-block="${pr.cur ? pr.cur.id : ""}" title="Pick up where you left off in Run">Resume</button>` : ""}<button class="btn" data-lib="edit:${id}">Edit</button><button class="btn" data-lib="archive:${id}" title="Hide from the library; restore or delete it later">Archive</button>`}
    </div>
    <div class="pc-manage">
      ${!archived ? `<button class="plain small" data-lib="duplicate:${id}" title="Make a copy">Duplicate</button>` : ""}
      ${versionCount(p.id) > 1 ? `<button class="plain small" data-lib="history:${id}" title="Browse earlier versions of this outline">History (${versionCount(p.id)})</button>` : ""}
      ${modified ? `<button class="plain small" data-lib="reset:${id}" title="Discard your changes and go back to the original">Reset to original</button>` : ""}
      <button class="plain small" data-lib="export:${id}" title="Download as a file you can share or import">Export</button>
      <button class="plain small" data-lib="pdf:${id}" title="Download a PDF of the schedule and guide to share">PDF</button>
      ${archived ? `<button class="plain small danger-link" data-lib="delete:${id}" title="Permanently remove this archived outline">Delete permanently</button>` : ""}
    </div>
  </article>`;
}

function homeResults() {
  const { q, tag } = ui.home;
  const res = searchLibrary(activePrograms(), q, tag);
  const arch = searchLibrary(archivedPrograms(), q, tag);
  const none = !activePrograms().length && !archivedPrograms().length;
  let html = "";
  if (none) {
    html += `<div class="empty-ok muted"><div>No outlines yet.</div><div class="row"><button class="btn primary" data-lib="new">+ New outline</button><button class="btn" data-lib="import">Import a file</button></div></div>`;
  } else if (!res.length) {
    html += `<div class="empty-ok muted"><div>No outlines match${q ? ` “${esc(q)}”` : ""}${tag !== "All" ? ` in ${esc(tag)}` : ""}.</div>${q || tag !== "All" ? '<button class="btn" data-act="clearsearch">Clear search</button>' : ""}</div>`;
  } else {
    const lay = ui.home.layout;
    const seg = (k, label) => `<button class="${lay === k ? "on" : ""}" data-layout="${k}" aria-pressed="${lay === k}">${label}</button>`;
    html += `<div class="count-row"><p class="muted small count">${plural(res.length, "outline")}${q ? ` for “${esc(q)}”` : ""}</p><div class="layout-toggle" role="group" aria-label="Library view">${seg("cards", "Cards")}${seg("list", "List")}</div></div><div class="pgrid ${lay === "list" ? "as-list" : ""}">${res.map((r) => programCard(r)).join("")}</div>`;
  }
  const nArch = archivedPrograms().length;
  if (nArch) {
    html += `<div class="arch-head"><button class="plain" data-lib="togglearchived">${ui.home.showArchived ? "Hide" : "Show"} archived (${nArch})</button></div>`;
    if (ui.home.showArchived) html += arch.length ? `<div class="pgrid ${ui.home.layout === "list" ? "as-list" : ""}">${arch.map((r) => programCard(r, true)).join("")}</div>` : '<p class="muted small">No archived outlines match.</p>';
  }
  if (hasDeletedBuiltins()) html += `<p class="muted small restore-line">You deleted a built-in outline. <button class="plain" data-lib="restorebuiltins">Restore built-in outlines</button></p>`;
  return html;
}

function newOutlineModal() {
  return `<div class="modal-back" data-modal="cancel"></div>
  <form class="modal" data-modal-form role="dialog" aria-label="New outline">
    <h2>New outline</h2>
    <label class="mfield"><span class="label">Title</span><input data-m="title" required maxlength="80" placeholder="e.g. Chat Support Basics" autofocus></label>
    <label class="mfield"><span class="label">Summary</span><textarea data-m="summary" rows="2" placeholder="What this program covers and who it is for"></textarea></label>
    <label class="mfield"><span class="label">Tags <span class="muted">· comma separated</span></span><input data-m="tags" placeholder="Inbound, New hire"></label>
    <div class="mrow">
      <label class="mfield"><span class="label">Audience</span><input data-m="audience" placeholder="Optional"></label>
      <label class="mfield narrow"><span class="label">Days</span><input data-m="days" type="number" min="1" max="30" value="5"></label>
    </div>
    <p class="muted small">You’ll build the days and topics in the editor next. Prefer to bring one in? Use <strong>Import</strong> with an exported outline file.</p>
    <div class="modal-actions"><button type="button" class="btn" data-modal="cancel">Cancel</button><button type="submit" class="btn primary" data-modal="create">Create and edit</button></div>
  </form>`;
}

/* ---------- outline overview: the landing page for one outline ---------- */
function overviewView(p) {
  const id = esc(p.id);
  const work = workBlocks(p);
  const trainMins = p.days.reduce((n, d) => n + d.blocks.filter((b) => !isRest(b)).reduce((m, b) => m + b.minutes, 0), 0);
  const hrs = Math.round((trainMins / 60) * 10) / 10;
  const pr = progressOf(p, ui.home.progress[p.id]);
  const archived = archivedPrograms().some((a) => a.id === p.id);
  const first = p.days[0];
  const shift = first.start && first.end ? `${first.start}–${first.end} ${p.timezone || ""}`.trim() : "";
  const detail = (k, v) => v ? `<div><dt class="label">${k}</dt><dd>${v}</dd></div>` : "";
  const syllabus = p.days.map((d) => {
    const topics = d.blocks.filter((b) => !isRest(b) && !b.continues);
    const m = topics.reduce((n, b) => n + b.minutes, 0);
    return `<section class="syl-day"><header><h3>${esc(d.title)}</h3>${d.theme ? `<span class="syl-theme">${esc(d.theme)}</span>` : ""}<span class="muted small syl-hrs">${Math.round((m / 60) * 10) / 10} h</span></header>
      <ol>${topics.map((b) => `<li class="${b.flex ? "flex" : ""}"><span>${esc(b.title)}</span><span class="muted small">${b.type !== "topic" ? esc(typeLabel(b)) + " · " : ""}${b.minutes} min</span></li>`).join("") || `<li class="muted">No topics yet.</li>`}</ol></section>`;
  }).join("");
  return `
  <header class="top"><div class="top-row">
    <button class="brand" data-act="home" title="Back to the outline library"><span class="brand-mark" aria-hidden="true">▶</span><span class="brand-name">Library</span><span class="brand-back" aria-hidden="true">←</span></button>
  </div></header>
  <main class="stage ov">
    <section class="ov-head">
      <div><div class="kicker">Outline overview</div>
        <h1>${esc(p.title)}${p.status ? ` <span class="status">${esc(p.status)}</span>` : ""}${isEdited(p.id) ? ` <span class="status">Edited</span>` : ""}</h1>
        ${p.summary ? `<p class="muted ov-sum">${esc(p.summary)}</p>` : ""}</div>
      <div class="ov-right"><button class="btn ov-back" data-act="home">← Back to library</button>
      <div class="row ov-actions">
        ${archived ? `<button class="btn primary" data-lib="restore:${id}">Restore</button>`
          : pr ? `<button class="btn primary" data-open="${id}" data-day="${pr.day.id}" data-block="${pr.cur ? pr.cur.id : ""}">Resume · ${esc(pr.day.title)}</button><button class="btn" data-open="${id}">Open from the start</button>`
          : `<button class="btn primary" data-open="${id}">Start this outline</button>`}
        <button class="btn" data-cal="open:${id}" title="See the program laid out on a calendar">Calendar</button>
        ${archived ? "" : `<button class="btn" data-lib="edit:${id}">Edit</button>`}
      </div></div>
    </section>
    <div class="ov-grid">
      <section class="ov-syl" aria-label="Syllabus"><h2>Syllabus</h2>${syllabus}</section>
      <aside class="ov-side">
        <div class="ov-box"><h2>Objectives</h2>
          ${p.objectives?.length ? `<ul class="ov-obj">${p.objectives.map((o) => `<li>${esc(o)}</li>`).join("")}</ul>` : `<p class="muted">No objectives written yet.${archived ? "" : ` <button class="plain" data-lib="edit:${id}">Add them in the editor</button>`}</p>`}</div>
        <div class="ov-box"><h2>Details</h2>
          <dl class="ov-detail">
            ${detail("Duration", `${plural(p.days.length, "day")} · ${hrs} training hours`)}
            ${detail("Topics", String(work.length))}
            ${detail("Intended audience", esc(p.audience))}
            ${detail("Outline version", `v${esc(p.version)}${versionCount(p.id) > 1 ? ` · ${plural(versionCount(p.id), "saved version")}` : ""}`)}
            ${detail("Daily shift", esc(shift))}
            ${detail("Tags", (p.tags || []).map((t) => `<span class="tagchip static">${esc(t)}</span>`).join(" "))}
          </dl></div>
        ${pr ? `<div class="ov-box"><h2>Your progress</h2><div class="progress"><span style="width:${pr.total ? Math.round((pr.done / pr.total) * 100) : 0}%"></span></div><p class="muted small">${pr.done}/${pr.total} topics done · at ${esc(pr.day.title)}${pr.cur ? ` · ${esc(pr.cur.title)}` : ""}</p></div>` : ""}
      </aside>
    </div>
  </main>
  ${ui.modal?.type === "history" ? historyModal() : ""}`;
}

function homeView() {
  const { q, tag, msg } = ui.home;
  const tags = allTags();
  return `
  <header class="top"><div class="top-row"><span class="brand static"><span class="brand-mark" aria-hidden="true">▶</span><span class="brand-name">Trainer Runbook</span></span>${accountBar()}</div></header>
  <main class="stage home">
    <section class="home-head">
      <div class="home-title"><div><div class="kicker">Library</div><h1>Choose an outline</h1></div>
        <div class="row"><button class="btn" data-lib="import" title="Import an outline file exported from this app">Import</button><button class="btn primary" data-lib="new">+ New outline</button></div></div>
      ${msg ? `<div class="banner ${msg.kind}" role="status"><span>${esc(msg.text)}</span><button class="plain small" data-lib="dismiss">Dismiss</button></div>` : ""}
      <label class="search"><span class="sr">Search outlines and topics</span>
        <input type="search" data-search placeholder="Search outlines or topics inside them (e.g. billing, panels, cancellation)" value="${esc(q)}" autocomplete="off"></label>
      ${tags.length > 1 ? `<div class="tagbar">${["All", ...tags].map((t) => `<button class="tagchip ${t === tag ? "on" : ""}" data-tag="${esc(t)}">${esc(t)}</button>`).join("")}</div>` : ""}
      <input type="file" data-import accept=".json,application/json" hidden>
    </section>
    <section id="results">${homeResults()}</section>
  </main>
  ${ui.modal === "new" ? newOutlineModal() : ui.modal?.type === "history" ? historyModal() : ""}`;
}

/* ---------- version history: the "way back machine" ---------- */
const fmtWhen = (t) => new Date(t).toLocaleString([], { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

function changeSummary(d) {
  const bits = [];
  if (d.added.length) bits.push(`${plural(d.added.length, "topic")} added`);
  if (d.removed.length) bits.push(`${plural(d.removed.length, "topic")} removed`);
  if (d.changed.length) bits.push(`${plural(d.changed.length, "topic")} changed`);
  if (d.meta.length) bits.push(`${d.meta.join(", ")} changed`);
  return bits.join(" · ") || "Reordered or re-timed";
}

function historyModal() {
  const m = ui.modal, p = getProgram(m.id);
  if (!p) return "";
  const vs = versionsOf(m.id);
  const cur = JSON.stringify(p);
  const v = vs.find((x) => x.n === m.sel) || vs.at(-1);
  const list = vs.map((x, i) => {
    const d = diffPrograms(vs[i - 1]?.program, x.program);
    const isCur = JSON.stringify(x.program) === cur;
    return `<button class="ver ${v && x.n === v.n ? "on" : ""}" data-hist="sel:${x.n}">
      <span class="ver-top"><strong>Version ${x.n}</strong>${isCur ? `<span class="tag-now">Current</span>` : ""}</span>
      <span class="muted small">${esc(fmtWhen(x.at))}</span>
      <span class="small">${esc(x.note || (i ? changeSummary(d) : "Starting point"))}</span></button>`;
  }).reverse().join("");

  let detail = `<p class="muted">No earlier versions yet. A version is saved each time you finish editing${m.restore ? ", or whenever you press Save version" : ""}.</p>`;
  if (v) {
    const i = vs.indexOf(v), prev = i ? vs[i - 1].program : null;
    const d = diffPrograms(prev, v.program);
    const mark = new Map([...d.added.map((x) => [x.id, "new"]), ...d.changed.map((x) => [x.id, "edited"])]);
    const isCur = JSON.stringify(v.program) === cur;
    const hrs = Math.round((v.program.days.reduce((n, dy) => n + dy.blocks.filter((b) => !isRest(b)).reduce((s, b) => s + b.minutes, 0), 0) / 60) * 10) / 10;
    const lines = (arr, label) => arr.length ? `<div class="chg"><span class="label">${label}</span>${arr.map((x) => `<span class="hchip">${esc(x.title)} <span class="muted">${esc(x.day)}</span></span>`).join("")}</div>` : "";
    detail = `<div class="hv-head"><h3>${esc(v.program.title)} · Version ${v.n}</h3>
        <p class="muted small">${esc(fmtWhen(v.at))}${v.note ? ` · ${esc(v.note)}` : ""}</p>
        <p class="small">${plural(v.program.days.length, "day")} · ${hrs} training hours · v${esc(v.program.version)} · ${esc(v.program.status || "No status")}</p></div>
      ${prev ? `<div class="hv-chg"><div class="label">Changes from version ${vs[i - 1].n}</div>
        ${d.meta.length ? `<p class="small">Details changed: ${esc(d.meta.join(", "))}</p>` : ""}
        ${lines(d.added, "Added")}${lines(d.changed, "Edited")}${lines(d.removed, "Removed")}
        ${!d.meta.length && !d.added.length && !d.changed.length && !d.removed.length ? `<p class="muted small">Only ordering or timing changed.</p>` : ""}</div>` : ""}
      <div class="hv-tree"><div class="label">Preview — read only</div>
        ${v.program.days.map((dy) => `<details><summary><strong>${esc(dy.title)}</strong>${dy.theme ? ` <span class="muted">· ${esc(dy.theme)}</span>` : ""}</summary>
          <ul>${dy.blocks.map((b) => `<li class="${isRest(b) ? "rest" : ""}"><time>${esc(b.start)}</time><span>${esc(b.title)}</span>${mark.get(b.id) ? `<span class="tag-${mark.get(b.id)}">${mark.get(b.id)}</span>` : ""}<span class="muted">${b.minutes}m</span></li>`).join("")}</ul></details>`).join("")}</div>
      <div class="modal-actions">${isCur ? `<span class="muted small">This is the current version.</span>`
        : m.restore ? `<button class="btn primary" data-hist="restore:${v.n}">Restore this version</button>`
        : `<button class="btn" data-hist="toedit:${v.n}">Open in editor to restore…</button>`}</div>`;
  }
  const save = m.restore ? `<div class="hv-save"><input data-hist-note maxlength="80" placeholder="Label the current state (optional), e.g. “Before the Day 4 rewrite”"><button class="btn" data-hist="save">Save version</button></div>` : "";
  return `<div class="modal-back" data-modal="cancel"></div>
  <div class="modal wide" role="dialog" aria-label="Version history">
    <div class="hv-title"><h2>Version history · ${esc(p.title)}</h2><button class="btn" data-modal="cancel">Close</button></div>
    ${save}
    <div class="hv"><div class="hv-list">${list || ""}</div><div class="hv-detail">${detail}</div></div>
  </div>`;
}

async function histAction(spec) {
  const [cmd, arg] = spec.split(":");
  const m = ui.modal, id = m.id;
  if (cmd === "sel") { m.sel = +arg; return render(); }
  if (cmd === "toedit") { ui.editHistory = +arg; ui.modal = null; location.hash = `#/edit/${encodeURIComponent(id)}`; return; }
  if (!ed) return;
  const opts = { base: ed.base, baseNote: ed.baseNote };
  if (cmd === "save") {
    const note = $app.querySelector("[data-hist-note]")?.value.trim() || "";
    await saveProgram(ed.draft);
    const v = await recordVersion(id, ed.draft, { ...opts, note });
    m.sel = v.n;
    return render();
  }
  if (cmd === "restore") {
    const n = +arg;
    if (!confirm(`Restore version ${n}?\n\nThe outline as it is now is saved as a version first, so you can come back to it.`)) return;
    clearTimeout(ed.timer); ed.timer = null;
    const p = await restoreVersion(id, n, ed.draft, opts);
    ed.draft = authored(p);
    ed.sel = { k: "meta" };
    m.sel = versionsOf(id).at(-1).n;
    return render();
  }
}

async function loadHomeData() {
  const list = [...activePrograms(), ...archivedPrograms()];
  const [meta, ...saved] = await Promise.all([adapter.loadMeta(), ...list.map((p) => adapter.load(p.id))]);
  ui.home.meta = meta;
  ui.home.progress = {};
  list.forEach((p, i) => { ui.home.progress[p.id] = saved[i]; });
}

function download(name, data) {
  const blob = data instanceof Blob ? data : new Blob([data], { type: "application/json" });
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: name });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

async function libAction(spec) {
  const [cmd, id] = spec.split(":");
  const p = id ? getProgram(id) : null;
  ui.home.msg = null;
  if (cmd === "new") { ui.modal = "new"; return render(); }
  if (cmd === "import") return $app.querySelector("[data-import]")?.click();
  if (cmd === "dismiss") return render();
  if (cmd === "togglearchived") { ui.home.showArchived = !ui.home.showArchived; return render(); }
  if (cmd === "edit") { location.hash = `#/edit/${encodeURIComponent(id)}`; return; }
  if (cmd === "history" && p) { await ensureHistory(id); ui.modal = { type: "history", id, sel: versionsOf(id).at(-1)?.n, restore: false }; return render(); }
  if (cmd === "export" && p) { download(`${slug(p.title)}.json`, exportProgram(p)); return; }
  if (cmd === "pdf" && p) {
    ui.home.msg = { kind: "ok", text: `Preparing the PDF for “${p.title}”…` };
    render();
    try {
      download(`${slug(p.title)}.pdf`, await outlineToPdf(p));
      ui.home.msg = { kind: "ok", text: `Downloaded “${slug(p.title)}.pdf”. It has the schedule and guide only: no logins, notes or progress.` };
    } catch (err) {
      ui.home.msg = { kind: "err", text: `Couldn’t make the PDF: ${err.message || err}` };
    }
    return render();
  }
  if (cmd === "duplicate" && p) {
    const c = await addProgram(duplicateProgram(p));
    ui.home.msg = { kind: "ok", text: `Created “${c.title}”. Open Edit to change it.` };
  } else if (cmd === "archive" && p) {
    await setArchived(id, true);
    ui.home.msg = { kind: "ok", text: `Archived “${p.title}”. It’s under “Show archived” at the bottom, where you can restore it or delete it permanently.` };
  } else if (cmd === "restore" && p) {
    await setArchived(id, false);
    ui.home.msg = { kind: "ok", text: `Restored “${p.title}”.` };
  } else if (cmd === "delete" && p) {
    if (!archivedPrograms().some((a) => a.id === id)) return; // outlines are archived first; only archived ones can be deleted
    const extra = isBuiltin(id) ? " You can bring built-in outlines back from the library page." : "";
    if (!confirm(`Permanently delete “${p.title}”?\n\nThis removes the outline and its history, progress, checklists and notes on this device, and can’t be undone.${extra}`)) return;
    await removeProgram(id);
    ui.home.msg = { kind: "ok", text: `Deleted “${p.title}”.` };
  } else if (cmd === "reset" && p) {
    if (!confirm(`Reset “${p.title}” to the original?\n\nYour edits to this outline are discarded. Progress, checklists and notes are kept.`)) return;
    await resetBuiltin(id);
    ui.home.msg = { kind: "ok", text: `“${p.title}” is back to the original.` };
  } else if (cmd === "restorebuiltins") {
    await restoreBuiltins();
    ui.home.msg = { kind: "ok", text: "Built-in outlines restored." };
  }
  await loadHomeData();
  render();
}

async function importFile(file) {
  try {
    const p = await addProgram(parseImport(await file.text()));
    ui.home.msg = { kind: "ok", text: `Imported “${p.title}” (${p.days.length} days).` };
  } catch (err) {
    ui.home.msg = { kind: "err", text: err.message || "Couldn’t import that file." };
  }
  await loadHomeData();
  render();
}

async function createFromModal() {
  const v = (k) => $app.querySelector(`[data-m=${k}]`)?.value.trim() || "";
  if (!v("title")) { $app.querySelector("[data-m=title]")?.focus(); return; }
  const p = await addProgram(blankProgram({ title: v("title"), summary: v("summary"), tags: v("tags").split(",").map((t) => t.trim()).filter(Boolean), audience: v("audience"), days: v("days") }));
  ui.modal = null;
  location.hash = `#/edit/${encodeURIComponent(p.id)}`;
}

/* ---------- EDITOR: build and change an outline ---------- */
let ed = null; // { draft, sel: {k:'meta'|'day'|'block', d, b}, timer }
let cal = null; // { program, start: "YYYY-MM-DD", idx: 1-based training day | null } while the calendar is showing
const edDay = () => ed.draft.days[ed.sel.d];
const edBlock = () => ed.draft.days[ed.sel.d].blocks[ed.sel.b];
// The draft is kept in editable form (topics whole, no generated breaks); `edView()` is the laid-out outline with times.
const edNormalize = () => { ed.draft = authored(normalizeProgram(ed.draft)); };
const edView = () => normalizeProgram(ed.draft);
function edSave(now = false) {
  clearTimeout(ed.timer);
  const run = () => { ed.timer = null; return saveProgram(ed.draft); };
  if (now) return run();
  ed.timer = setTimeout(run, 300);
}
function edFlush() { if (ed?.timer) { clearTimeout(ed.timer); ed.timer = null; saveProgram(ed.draft); } }
// Leaving the editor: if anything changed during the session, keep it as a version (with the pre-edit state as the way back).
function edFinish() {
  if (!ed) return;
  edFlush();
  if (JSON.stringify(ed.draft) !== JSON.stringify(ed.base)) recordVersion(ed.draft.id, ed.draft, { base: ed.base, baseNote: ed.baseNote });
}

const fld = (label, key, val, { type = "text", rows, hint, kind = "text", attrs = "" } = {}) =>
  `<label class="efield"><span class="label">${label}</span>${hint ? `<span class="hint">${hint}</span>` : ""}${
    rows ? `<textarea data-f="${key}" data-kind="${kind}" rows="${rows}" ${attrs}>${esc(val ?? "")}</textarea>`
         : `<input data-f="${key}" data-kind="${kind}" type="${type}" value="${esc(val ?? "")}" ${attrs}>`}</label>`;

const MODE_LABEL = {
  standard: "Standard full day: break after 2 h of training, lunch 2 h later, second break 2 h after that",
  none: "No breaks (a short session)",
  custom: "Custom schedule",
  manual: "I’ll place breaks and lunch myself",
};
// Chooser for how breaks and lunch are placed. scope "meta" = the outline; "day" = one day (which may follow the outline).
function breaksEditor(scope, own, shown) {
  const mode = own ? own.mode : "inherit";
  const modes = [...(scope === "day" ? ["inherit"] : []), "standard", "none", "custom", "manual"];
  const name = (m) => (m === "inherit" ? `Same as the outline: ${MODE_LABEL[ed.draft.breaks.mode]}` : MODE_LABEL[m]);
  const rows = own?.mode === "custom" ? `<div class="bk-rows">${own.rests.map((r, i) => `<div class="bk-row">
      <select data-bk="row:${scope}:${i}:kind" aria-label="Type">${["break", "lunch"].map((t) => `<option value="${t}" ${r.kind === t ? "selected" : ""}>${t === "lunch" ? "Lunch" : "Break"}</option>`).join("")}</select>
      <span>after</span><input data-bk="row:${scope}:${i}:after" type="number" min="15" max="480" step="5" value="${r.after}" aria-label="Minutes of training before it">
      <span>min of training${i ? " since the last one" : ""}, lasting</span><input data-bk="row:${scope}:${i}:minutes" type="number" min="5" max="180" step="5" value="${r.minutes}" aria-label="Minutes it lasts"><span>min</span>
      <button class="plain small" data-ed="bkdel:${scope}:${i}" aria-label="Remove">✕</button></div>`).join("")}
    <button class="plain small" data-ed="bkadd:${scope}">+ Add a break</button></div>` : "";
  const rests = shown.filter((b) => isRest(b));
  return `<div class="bk">
    <label class="efield"><span class="label">Breaks and lunch</span><span class="hint">${scope === "day" ? "Override for this day only." : "Applies to every day unless a day overrides it. Standard suits full-day onboarding; pick another for shorter sessions."}</span>
      <select data-bk="mode:${scope}">${modes.map((m) => `<option value="${m}" ${m === mode ? "selected" : ""}>${esc(name(m))}</option>`).join("")}</select></label>
    ${rows}
    <p class="muted small">${rests.length ? `${scope === "day" ? "This day" : "Day 1"}: ${rests.map((b) => `${esc(b.title)} ${esc(b.start)}–${esc(b.end)}`).join(" · ")}` : `${scope === "day" ? "This day" : "Day 1"} has no breaks.`}</p></div>`;
}

function edForm() {
  const { k } = ed.sel;
  const dr = ed.draft;
  const view = edView();
  if (k === "meta") {
    return `<h2>Outline details</h2>
      ${fld("Title", "meta.title", dr.title)}
      ${fld("Summary", "meta.summary", dr.summary, { rows: 3 })}
      ${fld("Tags", "meta.tags", (dr.tags || []).join(", "), { kind: "tags", hint: "Comma separated. Used for browsing the library." })}
      ${fld("Audience", "meta.audience", dr.audience, { hint: "Who the training is for. Shown on the outline’s overview page." })}
      ${fld("Objectives", "meta.objectives", (dr.objectives || []).join("\n"), { rows: 4, kind: "strlines", hint: "One per line. What trainees can do by the end. Shown on the overview page." })}
      <div class="erow"><label class="efield"><span class="label">Status</span><select data-f="meta.status" data-kind="text">${["Draft", "Final"].map((s) => `<option ${dr.status === s ? "selected" : ""}>${s}</option>`).join("")}</select></label>
      ${fld("Version", "meta.version", dr.version)}</div>
      ${breaksEditor("meta", dr.breaks, view.days[0].blocks)}`;
  }
  if (k === "day") {
    const d = edDay();
    const close = d.close.filter((c) => c.id !== d.attendanceId);
    return `<h2>${esc(d.title)}</h2>
      <div class="erow">${fld("Day title", "day.title", d.title)}${fld("Starts", "day.start", d.start, { type: "time", attrs: 'required' })}</div>
      ${fld("Theme", "day.theme", d.theme, { hint: "Shown next to the day everywhere, and searchable." })}
      ${breaksEditor("day", d.breaks, view.days[ed.sel.d].blocks)}
      ${fld("Prep checklist", "day.prep", linesOf(d.prep), { rows: 4, kind: "lines", hint: "One item per line. Things to do before trainees arrive." })}
      ${fld("Reminders", "day.reminders", linesOf(d.reminders), { rows: 3, kind: "lines", hint: "One per line. Contextual, e.g. “Certification is tomorrow: verify assessment access.”" })}
      ${fld("End-of-day checklist", "day.close", linesOf(close), { rows: 3, kind: "lines", hint: "One per line. The attendance tracker reminder is added automatically." })}
      ${fld("Day resources", "day.resources", resourcesText(d.resources), { rows: 3, kind: "res", hint: "One per line: Label | URL | kind" })}
      <div class="ebtns"><button class="btn" data-ed="up" ${ed.sel.d === 0 ? "disabled" : ""}>Move day up</button><button class="btn" data-ed="down" ${ed.sel.d === dr.days.length - 1 ? "disabled" : ""}>Move day down</button><button class="btn danger" data-ed="delete" ${dr.days.length === 1 ? "disabled" : ""}>Delete day</button></div>`;
  }
  const b = edBlock();
  const d = edDay();
  const shown = view.days[ed.sel.d].blocks.find((x) => x.id === b.id) || b; // laid-out times
  const split = view.days[ed.sel.d].blocks.some((x) => x.continues === b.id);
  return `<h2>${esc(b.title)} <span class="muted">· ${esc(d.title)} · ${esc(shown.start)}–${esc(split ? view.days[ed.sel.d].blocks.filter((x) => x.continues === b.id).at(-1).end : shown.end)}</span></h2>
    ${split ? `<p class="muted small">A break falls inside this topic, so Run and the calendar show it in two parts. Edit it here as one topic.</p>` : ""}
    <div class="erow">${fld("Title", "block.title", b.title)}
      <label class="efield narrow"><span class="label">Type</span><select data-f="block.type" data-kind="text">${BLOCK_TYPES.map((t) => `<option ${b.type === t ? "selected" : ""}>${t}</option>`).join("")}</select></label>
      ${fld("Minutes", "block.minutes", b.minutes, { type: "number", kind: "num", attrs: 'min="0" max="600"' })}</div>
    ${isRest(b) ? "" : `
    ${fld("Objective", "block.objective", b.objective || "", { rows: 2, hint: "One or two lines. Shown under the title in Run." })}
    ${fld("Summary", "block.summary", b.summary || "", { rows: 2 })}
    ${fld("Warnings", "block.warnings", linesOf(b.warnings), { rows: 2, kind: "lines", hint: "One per line. Shown first in Run in amber." })}
    ${fld("Reminders", "block.reminders", linesOf(b.reminders), { rows: 2, kind: "lines" })}
    ${fld("Guide (official content)", "block.guide", serializeGuide(b.sections), { rows: 10, kind: "guide", hint: "# Heading | conduct   (kinds: content, conduct, activity, note). Under it, one bullet per line; indent two spaces to nest. The top-level bullets of conduct and activity sections become the steps shown in Run." })}
    ${fld("Links and files", "block.resources", resourcesText(b.resources), { rows: 3, kind: "res", hint: "One per line: Label | URL | kind. Leave the URL empty if the link is still to come." })}
    ${fld("Prepare before the day", "block.prep", linesOf(b.prep), { rows: 2, kind: "lines" })}
    ${fld("Before moving on", "block.actions", linesOf(b.actions), { rows: 2, kind: "lines", hint: "Deliberate actions only, e.g. “All trainees have logged in”." })}
    ${fld("Transition", "block.transition", b.transition || "")}`}
    <div class="ebtns"><button class="btn" data-ed="up" ${ed.sel.b === 0 ? "disabled" : ""}>Move up</button><button class="btn" data-ed="down" ${ed.sel.b === d.blocks.length - 1 ? "disabled" : ""}>Move down</button><button class="btn" data-ed="dupblock">Duplicate</button><button class="btn danger" data-ed="delete" ${d.blocks.length === 1 ? "disabled" : ""}>Delete</button></div>`;
}

function edTree() {
  const view = edView(); // laid out: times, plus the breaks and "(continued)" parts the schedule adds
  const { k, d, b } = ed.sel;
  return `<button class="ed-item ${k === "meta" ? "on" : ""}" data-ed="sel:meta"><strong>Outline details</strong></button>
    ${view.days.map((day, di) => {
      const total = day.blocks.reduce((n, x) => n + x.minutes, 0);
      let src = 0; // index among the editable topics: generated rows are shown but can't be selected
      return `<div class="ed-day">
        <button class="ed-item day ${k === "day" && d === di ? "on" : ""}" data-ed="sel:day:${di}"><span>${esc(day.title)}${day.theme ? ` · ${esc(day.theme)}` : ""}</span><span class="muted">${Math.floor(total / 60)}h ${total % 60}m</span></button>
        ${day.blocks.map((blk) => blk.auto || blk.continues
          ? `<div class="ed-item blk auto ${isRest(blk) ? "rest" : ""}" title="Added by the break schedule"><time>${esc(blk.start)}</time><span>${esc(blk.title)}</span><span class="muted">${blk.minutes}m</span></div>`
          : `<button class="ed-item blk ${k === "block" && d === di && b === src ? "on" : ""} ${isRest(blk) ? "rest" : ""}" data-ed="sel:block:${di}:${src++}"><time>${esc(blk.start)}</time><span>${esc(blk.title)}</span><span class="muted">${blk.minutes}m</span></button>`).join("")}
        <div class="ed-add"><button class="plain small" data-ed="addblock:${di}">+ Topic</button>${day.schedule.mode === "manual" ? `<button class="plain small" data-ed="addrest:${di}:break">+ Break</button><button class="plain small" data-ed="addrest:${di}:lunch">+ Lunch</button>` : ""}</div>
      </div>`;
    }).join("")}
    <button class="btn" data-ed="addday">+ Add day</button>`;
}

function editorView() {
  const dr = ed.draft;
  return `
  <header class="top"><div class="top-row">
    <button class="brand" data-ed="back" title="Back to the library"><span class="brand-mark" aria-hidden="true">▶</span><span class="brand-name">Library</span><span class="brand-back" aria-hidden="true">←</span></button>
    <div class="ed-title"><span class="label">Editing</span> <strong>${esc(dr.title)}</strong></div>
    <span class="muted small ed-saved">Saved automatically</span>
    <button class="btn" data-ed="history" title="Browse and restore earlier versions">History</button>
    <button class="btn primary" data-ed="run">Open in Run →</button>
  </div></header>
  <main class="ed-stage">
    <aside class="ed-tree" id="ed-tree">${edTree()}</aside>
    <section class="ed-form" id="ed-form">${edForm()}</section>
  </main>
  ${ui.modal?.type === "history" ? historyModal() : ""}`;
}

function edSet(el) {
  const [scope, key] = el.dataset.f.split(".");
  const t = scope === "meta" ? ed.draft : scope === "day" ? edDay() : edBlock();
  const v = el.value, kind = el.dataset.kind;
  if (kind === "tags") t.tags = v.split(",").map((x) => x.trim()).filter(Boolean);
  else if (kind === "num") t[key] = Math.max(0, Number(v) || 0);
  else if (kind === "strlines") t[key] = parseLines(v);
  else if (kind === "lines") t[key] = parseLines(v);
  else if (kind === "res") t[key] = parseResources(v);
  else if (kind === "guide") t.sections = parseGuide(v);
  else t[key] = v;
  edSave();
}

// A change in the "Breaks and lunch" controls: the schedule mode (outline or day) or a row of a custom schedule.
function edBreaksChange(el) {
  const [kind, scope, i, field] = el.dataset.bk.split(":");
  const t = scope === "meta" ? ed.draft : edDay();
  if (kind === "mode") {
    const v = el.value;
    const view = edView();
    // days whose breaks this choice decides: the whole outline (days that follow it) or just this day
    const hit = (scope === "meta" ? ed.draft.days.map((d, di) => (d.breaks ? -1 : di)) : [ed.sel.d]).filter((di) => di >= 0);
    const wasManual = hit.filter((di) => view.days[di].schedule.mode === "manual");
    const handPlaced = wasManual.reduce((n, di) => n + ed.draft.days[di].blocks.filter(isRest).length, 0);
    const willManual = v === "manual" || (v === "inherit" && ed.draft.breaks.mode === "manual");
    if (!willManual && handPlaced && !confirm(`Switch to a break schedule?\n\nThe ${plural(handPlaced, "break and lunch block")} you placed by hand will be replaced by the schedule.`)) return render();
    if (willManual) hit.filter((di) => view.days[di].schedule.mode !== "manual").forEach((di) => { ed.draft.days[di].blocks = view.days[di].blocks; }); // keep today's layout as the starting point
    t.breaks = v === "inherit" ? null : { mode: v, rests: v === "custom" ? (t.breaks?.rests?.length ? t.breaks.rests : [{ kind: "break", after: 120, minutes: 15 }, { kind: "lunch", after: 120, minutes: 60 }]) : [] };
  } else if (t.breaks?.mode === "custom" && t.breaks.rests[+i]) {
    t.breaks.rests[+i][field] = field === "kind" ? el.value : Number(el.value);
  }
  edNormalize();
  edSave();
  render();
}

function edAction(spec) {
  const [cmd, a, b2] = spec.split(":");
  const dr = ed.draft;
  const sel = ed.sel;
  if (cmd === "bkadd" || cmd === "bkdel") {
    const t = a === "meta" ? dr : edDay();
    if (t.breaks?.mode !== "custom") return;
    if (cmd === "bkadd") t.breaks.rests.push({ kind: "break", after: 120, minutes: 15 }); else t.breaks.rests.splice(+b2, 1);
    edNormalize(); edSave(); return render();
  }
  if (cmd === "back") { const id = ed.draft.id; edFinish(); location.hash = `#/o/${encodeURIComponent(id)}`; return; }
  if (cmd === "history") { edFlush(); ui.modal = { type: "history", id: dr.id, sel: versionsOf(dr.id).at(-1)?.n, restore: true }; return render(); }
  if (cmd === "run") { edFinish(); saveProgram(ed.draft).then(() => { location.hash = `#/p/${encodeURIComponent(dr.id)}`; }); return; }
  if (cmd === "sel") { ed.sel = a === "meta" ? { k: "meta" } : a === "day" ? { k: "day", d: +b2 } : { k: "block", d: +b2, b: +spec.split(":")[3] }; return render(); }
  if (cmd === "addday") { dr.days.push({ title: `Day ${dr.days.length + 1}`, blocks: [{ title: "New topic", minutes: 30 }] }); edNormalize(); ed.sel = { k: "day", d: dr.days.length - 1 }; }
  else if (cmd === "addblock") { const day = dr.days[+a]; day.blocks.push({ title: "New topic", minutes: 30 }); edNormalize(); ed.sel = { k: "block", d: +a, b: day.blocks.length - 1 }; }
  else if (cmd === "addrest") { const day = dr.days[+a]; day.blocks.push({ type: b2 }); edNormalize(); ed.sel = { k: "block", d: +a, b: day.blocks.length - 1 }; }
  else if (cmd === "dupblock") { const day = edDay(); const c = JSON.parse(JSON.stringify(edBlock())); c.id = ""; c.title += " (copy)"; day.blocks.splice(sel.b + 1, 0, c); edNormalize(); ed.sel.b += 1; }
  else if (cmd === "up" || cmd === "down") {
    const dir = cmd === "up" ? -1 : 1;
    const list = sel.k === "day" ? dr.days : edDay().blocks;
    const i = sel.k === "day" ? sel.d : sel.b;
    if (list[i + dir]) { [list[i], list[i + dir]] = [list[i + dir], list[i]]; if (sel.k === "day") sel.d += dir; else sel.b += dir; edNormalize(); }
  } else if (cmd === "delete") {
    if (sel.k === "day") { if (dr.days.length < 2 || !confirm(`Delete ${edDay().title} and its ${edDay().blocks.length} blocks?`)) return; dr.days.splice(sel.d, 1); ed.sel = { k: "meta" }; }
    else { const day = edDay(); if (day.blocks.length < 2 || !confirm(`Delete “${edBlock().title}”?`)) return; day.blocks.splice(sel.b, 1); ed.sel = { k: "day", d: sel.d }; }
    edNormalize();
  }
  edSave();
  render();
}

/* ---------- routing: #/ = library, #/p/<id> = an outline, #/edit/<id> = the editor ---------- */
let store = null;
let unsub = null;
let ov = null; // id of the outline whose overview page is showing
let pendingGoto = null;
let session = { mode: "local" }; // becomes { mode: "cloud", user, signOut } once signed in to the shared backend
const catalogReady = (async () => {
  session = await startSession($app);
  if (session.mode === "cloud") useAdapter((await import("./cloud.js")).createCloudAdapter(session.user));
  try { await loadCatalog(); } catch (err) { showAccessError($app, session, err); await new Promise(() => {}); } // stay on the message
})();

async function route() {
  await catalogReady;
  const m = location.hash.match(/^#\/p\/([^/?]+)/);
  const em = location.hash.match(/^#\/edit\/([^/?]+)/);
  const program = m ? getProgram(decodeURIComponent(m[1])) : null;
  store?.flush(); // never leave the outline with an unsaved change
  edFinish();
  unsub?.(); unsub = null; store = null; ed = null; cal = null; ov = null;
  ui.panel = null;
  const om = location.hash.match(/^#\/o\/([^/?]+)/);
  if (om) {
    const p = getProgram(decodeURIComponent(om[1]));
    if (!p) { location.hash = "#/"; return; }
    ui.modal = null;
    ov = p.id;
    document.title = `${p.title} · Overview · Trainer Runbook`;
    window.scrollTo(0, 0);
    render();
    await loadHomeData(); // progress for the Resume button
    if (ov === p.id) render();
    return;
  }
  const cm = location.hash.match(/^#\/cal\/([^/?]+)(?:\/(\d+))?/);
  if (cm) {
    const p = getProgram(decodeURIComponent(cm[1]));
    if (!p) { location.hash = "#/"; return; }
    const meta = await adapter.loadMeta();
    const idx = cm[2] ? Math.min(Math.max(1, +cm[2]), p.days.length) : null;
    cal = { program: p, start: meta.startDates?.[p.id] || defaultStart(), idx };
    document.title = `Calendar · ${p.title} · Trainer Runbook`;
    window.scrollTo(0, 0);
    return render();
  }
  const reopen = ui.editHistory; ui.editHistory = null; ui.modal = null;
  if (em) {
    const p = getProgram(decodeURIComponent(em[1]));
    if (!p) { location.hash = "#/"; return; }
    await ensureHistory(p.id); // versions are recorded when editing ends, so they must be loaded first
    ed = { draft: authored(p), base: JSON.parse(JSON.stringify(p)), baseNote: isBuiltin(p.id) && !isEdited(p.id) ? "Original" : "Before your first edit", sel: { k: "meta" }, timer: null };
    if (reopen) ui.modal = { type: "history", id: p.id, sel: reopen, restore: true };
    document.title = `Editing ${p.title} · Trainer Runbook`;
    return render();
  }
  if (!program) {
    document.title = "Trainer Runbook · Library";
    render();                // paint immediately
    await loadHomeData();    // then fill in progress / recency
    if (!store && !ed) render();
    return;
  }
  store = await createStore(program);
  unsub = store.subscribe(render);
  document.title = `${program.title} · Trainer Runbook`;
  if (pendingGoto) { store.goto(pendingGoto.day, pendingGoto.block, "run"); pendingGoto = null; }
  const meta = await adapter.loadMeta();
  meta.lastOpened = { ...(meta.lastOpened || {}), [program.id]: Date.now() };
  adapter.saveMeta(meta);
  render();
}
window.addEventListener("hashchange", route);
window.addEventListener("pagehide", () => { store?.flush(); edFinish(); });
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") { store?.flush(); edFlush(); } });

/* ---------- render + events ---------- */
function render() {
  if (ov) {
    const p = getProgram(ov);
    if (!p) { location.hash = "#/"; return; }
    $app.innerHTML = overviewView(p);
    $app.dataset.view = "overview";
    return;
  }
  if (cal) {
    $app.innerHTML = (cal.idx ? dayHTML : calendarHTML)(cal);
    $app.dataset.view = "cal";
    return;
  }
  if (ed) {
    $app.innerHTML = editorView();
    $app.dataset.view = "edit";
    return;
  }
  if (!store) {
    const y0 = window.scrollY;
    $app.innerHTML = homeView();
    $app.dataset.view = "home";
    window.scrollTo(0, y0);
    if (ui.modal === "new") $app.querySelector("[data-m=title]")?.focus();
    return;
  }
  const s = store.get();
  const y = window.scrollY;
  const view = { prep: prepView, run: runView, close: closeView, outline: outlineView }[s.mode](store);
  const panel = { toolbox: toolboxPanel, guide: guidePanel, notes: notesPanel }[ui.panel];
  $app.innerHTML = header(store) + view + (panel ? panel(store) : "");
  $app.dataset.view = s.mode; // not data-mode: the click handler's closest("[data-mode]") would match the root
  window.scrollTo(0, y);
  if (ui.panel === "notes") $app.querySelector("textarea[data-note]")?.focus();
}

document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (ui.modal) { ui.modal = null; render(); }
  else if (ui.panel) { ui.panel = null; render(); }
});

function openProgram(id, day, block) {
  pendingGoto = day && block ? { day, block } : null;
  const target = `#/p/${encodeURIComponent(id)}`;
  if (location.hash === target) route(); else location.hash = target;
}

const accountBar = () => (session.mode === "cloud"
  ? `<span class="acct"><span class="muted small">${esc(session.user.email)}</span><button class="plain small" data-session="signout">Sign out</button></span>` : "");

// Shared library: pick up other people's changes when the tab regains focus (never while editing or running a session).
let lastRefresh = Date.now();
document.addEventListener("visibilitychange", async () => {
  if (document.visibilityState !== "visible" || session.mode !== "cloud" || ed || cal || store || Date.now() - lastRefresh < 15000) return;
  lastRefresh = Date.now();
  try { await loadCatalog(); await loadHomeData(); if (!ed && !cal && !store) render(); } catch { /* keep what is on screen */ }
});

window.addEventListener("sync-error", (e) => {
  document.querySelector(".sync-toast")?.remove();
  const t = Object.assign(document.createElement("div"), { className: "sync-toast", role: "alert", textContent: `Couldn’t save to the shared library (${e.detail}). Your last change may not be saved.` });
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 9000);
});

$app.addEventListener("click", (e) => {
  if (e.target.closest("[data-session=signout]")) { session.signOut?.(); return; }
  const lt =e.target.closest("[data-layout]");
  if (lt) {
    ui.home.layout = lt.dataset.layout;
    try { localStorage.setItem("trainer-runbook:layout", ui.home.layout); } catch { /* the choice just won't be remembered */ }
    document.getElementById("results").innerHTML = homeResults();
    return;
  }
  const vw = e.target.closest("[data-outline]");
  if (vw) { window.scrollTo(0, 0); location.hash = `#/o/${encodeURIComponent(vw.dataset.outline)}`; return; }
  const cb = e.target.closest("[data-cal]");
  if (cb) {
    const [cmd, arg] = cb.dataset.cal.split(":");
    if (cmd === "open") { location.hash = `#/cal/${encodeURIComponent(arg)}`; return; }
    if (!cal) return;
    const id = encodeURIComponent(cal.program.id);
    if (cmd === "back") location.hash = `#/cal/${id}`;
    else if (cmd === "day") location.hash = `#/cal/${id}/${+arg}`;
    else if (cmd === "run") openProgram(cal.program.id, cal.program.days[+arg - 1].id, cal.program.days[+arg - 1].blocks.find((b) => !isRest(b))?.id);
    return;
  }
  const hist = e.target.closest("[data-hist]");
  if (hist && ui.modal?.type === "history") return histAction(hist.dataset.hist);
  const lib = e.target.closest("[data-lib]");
  if (lib) return libAction(lib.dataset.lib);
  const edb = e.target.closest("[data-ed]");
  if (edb) return edAction(edb.dataset.ed);
  const md = e.target.closest("[data-modal]");
  if (md && md.dataset.modal === "cancel") { ui.modal = null; return render(); }
  const op = e.target.closest("[data-open]");
  if (op) return openProgram(op.dataset.open, op.dataset.day, op.dataset.block);
  const tg = e.target.closest("[data-tag]");
  if (tg) { ui.home.tag = ui.home.tag === tg.dataset.tag ? "All" : tg.dataset.tag; return render(); }
  const nav = e.target.closest("[data-act=home],[data-act=clearsearch]");
  // (data-day on the day <select> and outline buttons never collides with data-open, which only exists on the library page)
  if (nav) {
    if (nav.dataset.act === "home") { window.scrollTo(0, 0); location.hash = "#/"; return; }
    ui.home.q = ""; ui.home.tag = "All"; return render();
  }
  const cp = e.target.closest("[data-copy]");
  if (cp) {
    const v = cp.dataset.copy, old = cp.textContent;
    const done = () => { cp.textContent = "Copied ✓"; setTimeout(() => (cp.textContent = old), 900); };
    (navigator.clipboard?.writeText(v) || Promise.reject()).then(done, () => {
      const ta = Object.assign(document.createElement("textarea"), { value: v });
      document.body.appendChild(ta); ta.select(); try { document.execCommand("copy"); done(); } catch { /* ignore */ } ta.remove();
    });
    return;
  }
  const pn = e.target.closest("[data-panel]");
  if (pn) { ui.panel = pn.dataset.panel === "close" ? null : pn.dataset.panel; return render(); }
  const sg = e.target.closest("[data-seg]");
  if (sg) { const [g, k] = sg.dataset.seg.split(":"); ui[g === "prep" ? "prepTab" : "closeTab"] = k; return render(); }
  const t = e.target.closest("[data-mode],[data-goto],[data-act],[data-timer]");
  if (!t) return;
  const s = store.get();
  if (t.dataset.timer) {
    const b = store.currentBlock();
    const a = t.dataset.timer;
    if (a === "start") store.startTimer(b.id, Math.max(1, Number($app.querySelector("[data-timer-min]").value) || 10));
    else if (a === "pause") store.pauseTimer(b.id);
    else if (a === "resume") store.resumeTimer(b.id);
    else store.clearTimer(b.id);
    return;
  }
  if (t.dataset.goto) {
    ui.panel = null;
    const dayId = t.dataset.day || s.day;
    return store.goto(dayId, t.dataset.goto, t.dataset.then || (s.mode === "run" ? "run" : s.mode));
  }
  if (t.dataset.mode) { ui.panel = null; window.scrollTo(0, 0); return store.setMode(t.dataset.mode); }
  const act = t.dataset.act;
  if (act === "complete") { window.scrollTo(0, 0); store.complete(); }
  else if (act === "advance") { window.scrollTo(0, 0); store.advance(); }
  else if (act === "prev") { window.scrollTo(0, 0); store.prev(); }
  else if (act === "toggledone") { ui.showDone = !ui.showDone; render(); }
  else if (act === "closeday") store.closeDay(s.day);
  else if (act === "reopen") store.reopenDay(s.day);
  else if (act === "nextday") { window.scrollTo(0, 0); ui.prepTab = "todo"; store.setDay(t.dataset.day); store.setMode("prep"); }
  else if (act === "reset" && confirm("Reset all progress, checklists and notes on this device?")) store.resetAll();
});

$app.addEventListener("submit", (e) => {
  if (e.target.matches("[data-modal-form]")) { e.preventDefault(); createFromModal(); }
});
$app.addEventListener("change", async (e) => {
  if (e.target.matches("[data-cal-start]") && cal) {
    if (!e.target.value) return;
    cal.start = e.target.value;
    const meta = await adapter.loadMeta();
    meta.startDates = { ...(meta.startDates || {}), [cal.program.id]: cal.start };
    adapter.saveMeta(meta);
    return render();
  }
  if (e.target.matches("[data-import]")) { const f = e.target.files?.[0]; e.target.value = ""; if (f) importFile(f); return; }
  if (e.target.matches("[data-bk]") && ed) { edBreaksChange(e.target); return; }
  if (e.target.matches("[data-f]") && ed) {
    // refresh the structure list (titles, times) without touching the form, so tabbing between fields keeps focus
    edNormalize();
    document.getElementById("ed-tree").innerHTML = edTree();
    const t = $app.querySelector(".ed-title strong"); if (t) t.textContent = ed.draft.title;
    return;
  }
  if (!store) return;
  if (e.target.matches("[data-check]")) store.toggleCheck(e.target.dataset.check);
  else if (e.target.matches("[data-day]")) { window.scrollTo(0, 0); ui.prepTab = "todo"; store.setDay(e.target.value); }
});
$app.addEventListener("input", (e) => {
  if (e.target.matches("[data-search]")) { ui.home.q = e.target.value; document.getElementById("results").innerHTML = homeResults(); return; }
  if (e.target.matches("[data-f]") && ed) return edSet(e.target);
  if (!store) return;
  if (e.target.matches("[data-note]")) store.setNote(e.target.dataset.note, e.target.value);
  else if (e.target.matches("[data-daynote]")) store.setDayNote(e.target.dataset.daynote, e.target.value);
});
$app.addEventListener("toggle", (e) => {
  const d = e.target;
  if (d.matches?.("details.gsec")) d.open ? ui.collapsed.delete(d.dataset.key) : ui.collapsed.add(d.dataset.key);
  if (d.matches?.("details.oday")) d.open ? ui.openDays.add(d.dataset.oday) : ui.openDays.delete(d.dataset.oday);
}, true);

// Timer ticking updates text only, so typing and focus are never disturbed.
setInterval(() => {
  if (!store) return;
  const chip = $app.querySelector("[data-pace]");
  if (chip) {
    const p = paceInfo(store);
    chip.hidden = !p;
    if (p) { chip.textContent = p.text; chip.className = `pace pace-${p.kind}`; }
  }
  const el = $app.querySelector("[data-timer-clock]");
  if (!el) return;
  const t = store.get().timers[el.dataset.timerClock];
  const left = timerLeft(t);
  if (left == null) return;
  if (left === 0 && t.endsAt) { store.pauseTimer(el.dataset.timerClock); return; } // expires once, re-renders once
  if (t.endsAt) el.textContent = mmss(left);
}, 500);

route();
