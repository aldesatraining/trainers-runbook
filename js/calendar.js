// Calendar view of an outline: which weekday each training day lands on, and a whole-day timeline with the shift's rests.
// Pure functions (data in, HTML string out); routing and events live in app.js.
import { isRest } from "./model.js";

/* ---------- dates (local, ISO "YYYY-MM-DD") ---------- */
const pad = (n) => String(n).padStart(2, "0");
export const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const fromIso = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const weekend = (d) => d.getDay() === 0 || d.getDay() === 6;
const validIso = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || "") && !Number.isNaN(fromIso(s).getTime());

// The coming Monday: a sensible default for a program that starts with a new class.
export function defaultStart(now = new Date()) {
  const d = addDays(new Date(now.getFullYear(), now.getMonth(), now.getDate()), 1);
  while (d.getDay() !== 1) d.setDate(d.getDate() + 1);
  return iso(d);
}

// One training day per working day (Mon–Fri). A weekend start moves to the following Monday.
export function trainingDates(startIso, n) {
  let d = fromIso(validIso(startIso) ? startIso : defaultStart());
  const out = [];
  while (out.length < n) { if (!weekend(d)) out.push(iso(d)); d = addDays(d, 1); }
  return out;
}

/* ---------- the day's timeline: straight from the outline, so it always agrees with Run ---------- */
const toMin = (t) => { const [h, m] = String(t || "10:00").split(":").map(Number); return (h || 0) * 60 + (m || 0); };
const clock = (m) => `${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`;

// Break/lunch blocks and "(continued)" parts are already laid out by the outline's break schedule (see model.js).
export function shiftLayout(day) {
  const segs = day.blocks.filter((b) => b.minutes > 0).map((b) => (isRest(b)
    ? { kind: b.type, label: b.title, start: toMin(b.start), end: toMin(b.end) }
    : { kind: "work", block: b, start: toMin(b.start), end: toMin(b.end) }));
  return { segs, start: toMin(day.start), end: toMin(day.end), trainingMinutes: segs.filter((s) => s.kind === "work").reduce((n, s) => n + s.end - s.start, 0) };
}

// One sentence on how this day's breaks were decided, for the day view.
export function scheduleNote(day) {
  const s = day.schedule || { mode: "manual" };
  const own = day.breaks ? "This day has its own break schedule. " : "";
  if (s.mode === "standard") return `${own}Standard shift: a 15-minute break after 2 hours of training, a 1-hour lunch after 2 more, then a second 15-minute break after 2 more. A topic that runs across one continues after it.`;
  if (s.mode === "none") return `${own}No breaks are scheduled for this day.`;
  if (s.mode === "custom") return `${own}Custom schedule: ${s.rests.map((r) => `${r.kind} after ${r.after} min of training (${r.minutes} min)`).join(", then ") || "no breaks"}.`;
  return `${own}Breaks and lunch are placed by hand in this outline.`;
}
/* ---------- html ---------- */
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const fmt = (d, o) => d.toLocaleDateString([], o);
const hours = (m) => (m < 60 ? `${m}m` : `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ""}`);
const topics = (n) => `${n} topic${n === 1 ? "" : "s"}`;

const bar = (p, right) => `<header class="top"><div class="top-row">
    <button class="brand" data-outline="${esc(p.id)}" title="Back to the outline overview"><span class="brand-mark" aria-hidden="true">▶</span><span class="brand-name">Overview</span><span class="brand-back" aria-hidden="true">←</span></button>
    <div class="ed-title"><span class="label">Calendar</span> <strong>${esc(p.title)}</strong></div>
    ${right}
  </div></header>`;

export function calendarHTML({ program: p, start, today = new Date() }) {
  const dates = trainingDates(start, p.days.length);
  const byDate = new Map(dates.map((d, i) => [d, i]));
  const first = fromIso(dates[0]), last = fromIso(dates[dates.length - 1]);
  let cur = addDays(first, -((first.getDay() + 6) % 7)); // back to that week's Monday
  const end = addDays(last, 6 - ((last.getDay() + 6) % 7));
  const todayIso = iso(today);
  const weeks = [];
  for (let d = cur; d <= end; d = addDays(d, 7)) {
    weeks.push(Array.from({ length: 7 }, (_, k) => addDays(d, k)));
  }
  const chosen = validIso(start) ? start : dates[0];
  const moved = chosen !== dates[0];
  const cell = (d, wi, ki) => {
    const key = iso(d), idx = byDate.get(key);
    const label = d.getDate() === 1 || (wi === 0 && ki === 0) ? `${fmt(d, { month: "short" })} ${d.getDate()}` : d.getDate();
    if (idx == null) return `<div class="cal-cell off ${weekend(d) ? "wknd" : ""} ${key === todayIso ? "today" : ""}"><span class="cal-n">${label}</span></div>`;
    const day = p.days[idx], m = shiftLayout(day);
    return `<button class="cal-cell on ${key === todayIso ? "today" : ""}" data-cal="day:${idx + 1}" title="Open ${esc(day.title)}">
      <span class="cal-n">${label}</span><span class="cal-day">${esc(day.title)}</span>
      <span class="cal-theme">${esc(day.theme || "")}</span>
      <span class="cal-meta">${clock(m.start)}–${clock(m.end)} · ${hours(m.trainingMinutes)}</span></button>`;
  };
  return `${bar(p, `<label class="cal-start"><span class="label">Starts</span><input type="date" data-cal-start value="${esc(chosen)}"></label>`)}
  <main class="stage cal">
    <section class="cal-head">
      <div><div class="kicker">Training calendar</div>
      <h1>${esc(fmt(first, { weekday: "short", month: "long", day: "numeric" }))} → ${esc(fmt(last, { weekday: "short", month: "long", day: "numeric", year: "numeric" }))}</h1>
      <p class="muted">${p.days.length} training days over ${Math.round((last - first) / 864e5) + 1} calendar days · Monday to Friday${moved ? ` · ${esc(fmt(fromIso(chosen), { weekday: "long" }))} isn’t a working day, so Day 1 starts ${esc(fmt(first, { weekday: "long", month: "short", day: "numeric" }))}` : ""}</p></div>
      <p class="muted small">Pick a day to see its hour-by-hour plan.</p>
    </section>
    <div class="cal-grid" role="grid">
      ${["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((n, i) => `<div class="cal-dow ${i > 4 ? "wknd" : ""}">${n}</div>`).join("")}
      ${weeks.map((w, wi) => w.map((d, ki) => cell(d, wi, ki)).join("")).join("")}
    </div>
  </main>`;
}

export function dayHTML({ program: p, start, idx, today = new Date() }) {
  const dates = trainingDates(start, p.days.length);
  const day = p.days[idx - 1], date = fromIso(dates[idx - 1]);
  const m = shiftLayout(day);
  const t0 = Math.floor(m.start / 60) * 60, t1 = Math.ceil(m.end / 60) * 60, span = t1 - t0;
  const pct = (v) => `${((v - t0) / span) * 100}%`;
  const hoursAxis = [];
  for (let h = t0; h <= t1; h += 60) hoursAxis.push(`<div class="tl-hour" style="top:${pct(h)}"><span>${clock(h)}</span></div>`);
  const segs = m.segs.map((s) => {
    const mins = s.end - s.start;
    const pos = `top:${pct(s.start)};height:calc(${(mins / span) * 100}% - 2px)`;
    if (s.kind !== "work") return `<div class="tl-seg rest tiny ${s.kind}" style="${pos}"><span class="tl-t">${s.label}</span><span class="tl-m">${clock(s.start)}–${clock(s.end)} · ${mins} min</span></div>`;
    return `<div class="tl-seg work ${mins >= 45 ? "tall" : mins < 25 ? "tiny" : ""}" style="${pos}" title="${esc(s.block.title)} · ${clock(s.start)}–${clock(s.end)}">
      <span class="tl-t">${esc(s.block.title)}</span><span class="tl-m">${clock(s.start)}–${clock(s.end)} · ${mins} min</span></div>`;
  }).join("");
  const rests = m.segs.filter((s) => s.kind !== "work");
  const isToday = iso(today) === dates[idx - 1];
  const nav = `<div class="cal-nav">
      <button class="btn" data-cal="day:${idx - 1}" ${idx === 1 ? "disabled" : ""} aria-label="Previous day">←</button>
      <button class="btn" data-cal="back">All days</button>
      <button class="btn" data-cal="day:${idx + 1}" ${idx === p.days.length ? "disabled" : ""} aria-label="Next day">→</button></div>`;
  return `${bar(p, nav)}
  <main class="stage cal day">
    <section class="cal-head">
      <div><div class="kicker">${esc(day.title)} of ${p.days.length}${isToday ? " · today" : ""}</div>
      <h1>${esc(fmt(date, { weekday: "long", month: "long", day: "numeric" }))}</h1>
      ${day.theme ? `<p class="cal-theme-big">${esc(day.theme)}</p>` : ""}</div>
      <button class="btn primary" data-cal="run:${idx}">Open ${esc(day.title)} in Run →</button>
    </section>
    <div class="tl-wrap">
      <div class="tl" style="--tl-min:${span}">${hoursAxis.join("")}<div class="tl-body">${segs}</div></div>
      <aside class="tl-side">
        <div class="label">Shift</div>
        <p class="tl-big">${clock(m.start)} – ${clock(m.end)}</p>
        <p class="muted small">${hours(m.trainingMinutes)} of training · ${topics(day.blocks.filter((b) => !isRest(b) && !b.continues).length)}</p>
        <div class="label">Breaks</div>
        ${rests.length ? `<ul class="tl-rests">${rests.map((r) => `<li class="${r.kind}"><strong>${r.label}</strong><span>${clock(r.start)}–${clock(r.end)}</span></li>`).join("")}</ul>` : `<p class="muted small">No breaks on this day.</p>`}
        <p class="muted small">${esc(scheduleNote(day))}</p>
      </aside>
    </div>
  </main>`;
}
