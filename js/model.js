// Outline model helpers: validate/normalise user-made or imported outlines so they behave like built-in ones,
// and convert between the structured data and the plain-text forms the editor uses.

export const BLOCK_TYPES = ["topic", "activity", "discussion", "assessment", "break", "lunch"];
export const SECTION_KINDS = ["content", "conduct", "activity", "note"];
const isRest = (b) => b.type === "break" || b.type === "lunch";

const rid = () => Math.random().toString(36).slice(2, 8);
export const newId = (prefix) => `${prefix}${Date.now().toString(36)}${rid()}`;
export const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "outline";

const hm = (t) => { const [h, m] = String(t).split(":").map(Number); return (h || 0) * 60 + (m || 0); };
const clock = (m) => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

// Only web links and mail links are kept: anything else (e.g. javascript:) is dropped.
export function safeUrl(u) {
  const s = String(u || "").trim();
  if (!s) return null;
  if (/^(https?:\/\/|mailto:)/i.test(s)) return s;
  if (/^www\./i.test(s)) return `https://${s}`;
  return null;
}

const str = (v, d = "") => (typeof v === "string" ? v : v == null ? d : String(v));
const strList = (v) => (Array.isArray(v) ? v.map((x) => str(x).trim()).filter(Boolean) : []);
const items = (v) => (Array.isArray(v) ? v.map((x) => (Array.isArray(x) ? items(x) : str(x))) : []);

function normResource(r) {
  const o = r || {};
  return { label: str(o.label, "Link").trim() || "Link", kind: str(o.kind, "other").trim() || "other", url: safeUrl(o.url) };
}
const checklist = (prefix, v) => strList(v.map ? v.map((x) => (typeof x === "string" ? x : x?.text)) : []).map((text, i) => ({ id: `${prefix}.${i}`, text }));

function normBlock(b, i) {
  const o = b || {};
  const type = BLOCK_TYPES.includes(o.type) ? o.type : "topic";
  const id = str(o.id) || newId("b");
  const minutes = Math.max(0, Math.round(Number(o.minutes) || (type === "break" ? 15 : type === "lunch" ? 60 : 30)));
  return {
    id, type, minutes, flex: !!o.flex,
    title: str(o.title, type === "break" ? "Break" : type === "lunch" ? "Lunch" : `Topic ${i + 1}`).trim() || "Untitled",
    objective: o.objective ? str(o.objective) : null,
    summary: o.summary ? str(o.summary) : null,
    transition: o.transition ? str(o.transition) : null,
    sections: (Array.isArray(o.sections) ? o.sections : []).map((s) => ({
      heading: str(s?.heading, "Notes"), kind: SECTION_KINDS.includes(s?.kind) ? s.kind : "content", items: items(s?.items),
    })),
    warnings: strList(o.warnings),
    reminders: strList(o.reminders),
    resources: (Array.isArray(o.resources) ? o.resources : []).map(normResource),
    prep: (Array.isArray(o.prep) ? o.prep : []).map((x, k) => ({ id: `${id}.p${k}`, text: str(typeof x === "string" ? x : x?.text).trim() })).filter((x) => x.text),
    actions: (Array.isArray(o.actions) ? o.actions : []).map((x, k) => ({ id: `${id}.a${k}`, text: str(typeof x === "string" ? x : x?.text).trim() })).filter((x) => x.text),
    // set by the break schedule, never by hand: a generated break/lunch, or the later part of a topic cut by one
    auto: !!o.auto, continues: o.continues ? str(o.continues) : null,
  };
}

/* ---------- break schedule ----------
   An outline (and optionally each day) chooses how breaks and lunch are placed:
     standard  break after 2h of training, lunch after 2h more, a second break after 2h more (the full-day shift)
     none      no breaks (short sessions)
     custom    its own list: each rest comes `after` minutes of training since the previous rest, and lasts `minutes`
     manual    break/lunch blocks placed by hand in the outline, exactly as authored
   For the first three, break/lunch blocks are generated from the topics (flagged `auto`), and a topic that runs into
   one is cut there (the later part is flagged `continues`). Saving again merges the parts back first, so it is repeatable. */
export const BREAK_MODES = ["standard", "none", "custom", "manual"];
export const STANDARD_RESTS = [
  { kind: "break", after: 120, minutes: 15 },
  { kind: "lunch", after: 120, minutes: 60 },
  { kind: "break", after: 120, minutes: 15 },
];
export function normBreaks(v) {
  if (!v || !BREAK_MODES.includes(v.mode)) return null;
  const rests = v.mode !== "custom" ? [] : (Array.isArray(v.rests) ? v.rests : []).map((r) => {
    const kind = r?.kind === "lunch" ? "lunch" : "break";
    return { kind, after: Math.max(15, Math.round(Number(r?.after) || 120)), minutes: Math.max(5, Math.round(Number(r?.minutes) || (kind === "lunch" ? 60 : 15))) };
  });
  return { mode: v.mode, rests };
}
const restsOf = (s) => (s.mode === "standard" ? STANDARD_RESTS : s.mode === "custom" ? s.rests : []);

function unlayout(blocks) {
  const kept = blocks.filter((b) => !isRest(b)); // generated rests go; hand-placed ones are replaced by the schedule
  const byId = new Map(kept.map((b) => [b.id, b]));
  const out = [];
  for (const b of kept) {
    const parent = b.continues && byId.get(b.continues);
    if (parent && parent !== b) parent.minutes += b.minutes; else { b.continues = null; out.push(b); }
  }
  return out;
}

// The editable form of an outline: topics whole, with generated breaks and "(continued)" parts folded back in.
// (Days with hand-placed breaks are returned as they are.) normalizeProgram(authored(p)) gives p back.
export function authored(p) {
  const c = JSON.parse(JSON.stringify(p));
  c.days.forEach((d) => { if ((d.schedule || c.breaks || { mode: "manual" }).mode !== "manual") d.blocks = unlayout(d.blocks); });
  return c;
}

function layoutDay(work, rules, dayId) {
  const out = [];
  let worked = 0, ri = 0, at = rules.length ? rules[0].after : Infinity;
  work.forEach((b, bi) => {
    if (b.minutes <= 0) { out.push(b); return; }
    let left = b.minutes, part = 0;
    while (left > 0) {
      const take = Math.min(left, at - worked);
      out.push(part === 0 ? { ...b, minutes: take } : normBlock({
        id: `${b.id}-${part + 1}`, type: b.type, flex: b.flex, title: `${b.title} (continued)`, minutes: take, continues: b.id,
        summary: "Continues from before the break. The full guide is under the first part.", resources: b.resources,
      }, 0));
      worked += take; left -= take; part++;
      if (worked === at && (left > 0 || bi < work.length - 1)) {
        const r = rules[ri++];
        out.push(normBlock({ id: `${dayId}-rest${ri}`, type: r.kind, title: r.kind === "lunch" ? "Lunch" : "Break", minutes: r.minutes, auto: true }, 0));
        at = ri < rules.length ? at + rules[ri].after : Infinity;
      }
    }
  });
  return out;
}

function normDay(d, i, progBreaks) {
  const o = d || {};
  const id = `d${i + 1}`;
  const own = normBreaks(o.breaks);
  const schedule = own || progBreaks;
  let blocks = (Array.isArray(o.blocks) && o.blocks.length ? o.blocks : [{ title: "New topic" }]).map(normBlock);
  if (schedule.mode === "manual") blocks = blocks.map((b) => ({ ...b, auto: false, continues: null }));
  else blocks = layoutDay(unlayout(blocks), restsOf(schedule), id);
  // keep block ids unique within the outline
  const seen = new Set();
  blocks.forEach((b) => { while (seen.has(b.id)) b.id = newId("b"); seen.add(b.id); });
  const start = /^\d{1,2}:\d{2}$/.test(str(o.start)) ? str(o.start).padStart(5, "0") : "10:00";
  let t = hm(start);
  blocks.forEach((b) => { b.start = clock(t); t += b.minutes; b.end = clock(t); });
  return {
    id, title: str(o.title, `Day ${i + 1}`).trim() || `Day ${i + 1}`, theme: str(o.theme), start, end: clock(t),
    breaks: own, schedule, // own: this day's override (null = follows the outline); schedule: what actually applies
    prep: checklist(`${id}.prep`, o.prep || []), reminders: strList(o.reminders),
    close: checklist(`${id}.close`, (o.close || []).filter((c) => (c?.id || "") !== `${id}.attendance`)),
    resources: (Array.isArray(o.resources) ? o.resources : []).map(normResource),
    attendanceId: `${id}.attendance`, attendanceText: "Update the trainee attendance tracker",
    blocks,
  };
}

export function normalizeProgram(p) {
  const o = p || {};
  const breaks = normBreaks(o.breaks) || { mode: "manual", rests: [] }; // outlines saved before schedules existed keep their hand-placed breaks
  const days = (Array.isArray(o.days) && o.days.length ? o.days : [{}]).map((d, i) => normDay(d, i, breaks));
  // The attendance reminder is part of every day's close checklist, sharing its id with the Run toggle.
  days.forEach((d) => d.close.push({ id: d.attendanceId, text: d.attendanceText }));
  return {
    id: str(o.id) || newId("user-"),
    title: str(o.title, "Untitled outline").trim() || "Untitled outline",
    version: str(o.version, "0.1"),
    summary: str(o.summary), audience: str(o.audience),
    tags: strList(o.tags),
    status: str(o.status, "Draft") || "Draft",
    timezone: str(o.timezone, "PHT"), tz: str(o.tz, "Asia/Manila"),
    schedule: str(o.schedule),
    overview: str(o.overview),
    objectives: strList(o.objectives),
    breaks,
    days,
  };
}

export function blankProgram({ title, summary = "", tags = [], audience = "", days = 5 }) {
  const n = Math.min(30, Math.max(1, Number(days) || 1));
  return normalizeProgram({
    id: `user-${slug(title)}-${rid()}`, title, summary, tags, audience, status: "Draft", version: "0.1",
    breaks: { mode: "standard" },
    days: Array.from({ length: n }, (_, i) => ({ title: `Day ${i + 1}`, blocks: [{ title: "Welcome", minutes: 30 }] })),
  });
}

// Accepts an exported file ({format, program}) or a bare outline object. Throws a readable error if it isn't one.
export function parseImport(text) {
  let data;
  try { data = JSON.parse(text); } catch { throw new Error("That file isn’t valid JSON."); }
  const raw = data?.program || data;
  if (!raw || typeof raw !== "object" || !Array.isArray(raw.days) || !raw.days.length) throw new Error("This doesn’t look like an outline: it needs a title and at least one day.");
  if (!str(raw.title).trim()) throw new Error("The outline has no title.");
  return normalizeProgram({ ...raw, id: `user-${slug(raw.title)}-${rid()}`, status: raw.status || "Draft" });
}

export const exportProgram = (p) => JSON.stringify({ app: "trainer-runbook", format: 1, program: p }, null, 2);

export function duplicateProgram(p) {
  const c = JSON.parse(JSON.stringify(p));
  return normalizeProgram({ ...c, id: `user-${slug(p.title)}-${rid()}`, title: `${p.title} (copy)`, status: "Draft" });
}

/* ---------- text forms used by the editor ---------- */
export const parseLines = (text) => String(text || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
export const linesOf = (list) => (list || []).map((x) => (typeof x === "string" ? x : x.text)).join("\n");

// Guide format:   # Heading | conduct        (kind optional: content, conduct, activity, note)
//                 A bullet
//                   a nested bullet (indent two spaces per level)
export function parseGuide(text) {
  const sections = [];
  let cur = null;
  for (const raw of String(text || "").split(/\r?\n/)) {
    if (!raw.trim()) continue;
    const h = raw.match(/^#\s*(.+?)(?:\s*\|\s*(content|conduct|activity|note))?\s*$/i);
    if (h) { cur = { heading: h[1].trim(), kind: (h[2] || "content").toLowerCase(), items: [] }; sections.push(cur); continue; }
    if (!cur) { cur = { heading: "Guide", kind: "content", items: [] }; sections.push(cur); }
    const indent = raw.match(/^[ \t]*/)[0].replace(/\t/g, "  ").length;
    const level = Math.floor(indent / 2);
    let arr = cur.items;
    for (let l = 0; l < level; l++) {
      const last = arr[arr.length - 1];
      if (Array.isArray(last)) arr = last;
      else if (arr.length) { const child = []; arr.push(child); arr = child; }
      else break;
    }
    arr.push(raw.trim().replace(/^[-•*]\s+/, ""));
  }
  return sections;
}
export function serializeGuide(sections) {
  const out = [];
  const walk = (list, level) => list.forEach((it) => (Array.isArray(it) ? walk(it, level + 1) : out.push(`${"  ".repeat(level)}${it}`)));
  (sections || []).forEach((s) => { out.push(`# ${s.heading} | ${s.kind}`); walk(s.items, 0); out.push(""); });
  return out.join("\n").trim();
}

export const parseResources = (text) =>
  parseLines(text).map((l) => { const [label, url, kind] = l.split("|").map((x) => x.trim()); return normResource({ label, url, kind }); });
export const resourcesText = (list) => (list || []).map((r) => `${r.label} | ${r.url || ""} | ${r.kind}`).join("\n");

export { isRest };
