// Quiz blueprints: a quiz and its answer key. Nothing here is delivered, taken or scored.
// Question types follow the Nexus Academy blueprint: single choice, multiple choice, true/false,
// matching, ordering, fill-in-the-blank and open-ended.
import { newId, slug, parseLines } from "./model.js";

export const QUESTION_TYPES = [
  { id: "single", label: "Single choice", short: "Single", hint: "One correct answer from a list of choices." },
  { id: "multiple", label: "Multiple choice", short: "Multiple", hint: "Select all that apply: one or more correct choices." },
  { id: "truefalse", label: "True / False", short: "T / F", hint: "A statement that is either true or false." },
  { id: "matching", label: "Matching", short: "Matching", hint: "Pairs of items that belong together." },
  { id: "ordering", label: "Ordering", short: "Ordering", hint: "Items to put in the correct sequence." },
  { id: "blank", label: "Fill in the blank", short: "Blank", hint: "A sentence with a gap; any accepted answer fills it." },
  { id: "open", label: "Open-ended", short: "Open", hint: "A written answer that a trainer checks by hand." },
];
export const QUIZ_KINDS = ["Quiz", "Certification exam"];
export const QUIZ_STATUS = ["Draft", "Final"];
export const typeLabel = (t) => QUESTION_TYPES.find((x) => x.id === t)?.label || t;
export const typeShort = (t) => QUESTION_TYPES.find((x) => x.id === t)?.short || t;
export const BLANK = "____";
export const hasBlank = (text) => /_{3,}/.test(text || "");
export const letter = (i) => String.fromCharCode(65 + (i % 26));

const str = (v) => String(v ?? "");
const strs = (a) => (Array.isArray(a) ? a : []).map(str);

export function normalizeQuestion(q = {}) {
  const type = QUESTION_TYPES.some((t) => t.id === q.type) ? q.type : "single";
  const options = (Array.isArray(q.options) ? q.options : []).map((o) => str(typeof o === "string" ? o : o?.text));
  let correct = [...new Set((Array.isArray(q.correct) ? q.correct : []).map(Number))].filter((i) => Number.isInteger(i) && i >= 0 && i < options.length).sort((a, b) => a - b);
  if (type === "single") correct = correct.slice(0, 1);
  return {
    id: q.id || newId("q"),
    type,
    text: str(q.text),
    objective: str(q.objective),
    rationale: str(q.rationale),
    options,
    correct,
    answer: typeof q.answer === "boolean" ? q.answer : null,
    pairs: (Array.isArray(q.pairs) ? q.pairs : []).map((p) => ({ left: str(p?.left), right: str(p?.right) })),
    items: strs(q.items),
    accepted: strs(q.accepted),
    model: str(q.model),
  };
}

export function blankQuestion(type = "single") {
  const q = normalizeQuestion({ type });
  if (type === "single" || type === "multiple") q.options = ["", "", "", ""];
  if (type === "matching") q.pairs = [{ left: "", right: "" }, { left: "", right: "" }, { left: "", right: "" }];
  if (type === "ordering") q.items = ["", "", ""];
  return q;
}

export function normalizeQuiz(q = {}) {
  return {
    id: q.id || newId("qz-"),
    title: str(q.title),
    summary: str(q.summary),
    kind: QUIZ_KINDS.includes(q.kind) ? q.kind : "Quiz",
    status: QUIZ_STATUS.includes(q.status) ? q.status : "Draft",
    version: str(q.version || "0.1"),
    outlineId: str(q.outlineId),
    scope: str(q.scope),
    objectives: strs(q.objectives),
    questions: (Array.isArray(q.questions) ? q.questions : []).map(normalizeQuestion),
    createdAt: Number(q.createdAt) || Date.now(),
    updatedAt: Number(q.updatedAt) || 0,
    updatedBy: str(q.updatedBy),
  };
}

export const blankQuiz = ({ title, summary = "", kind = "Quiz", outlineId = "" }) =>
  normalizeQuiz({ id: newId(`qz-${slug(title || "quiz")}-`), title, summary, kind, outlineId, status: "Draft", version: "0.1", questions: [] });

export function duplicateQuiz(q) {
  const c = JSON.parse(JSON.stringify(q));
  return normalizeQuiz({ ...c, id: newId(`qz-${slug(q.title || "quiz")}-`), title: `${q.title} (copy)`, status: "Draft", createdAt: Date.now(), updatedAt: 0,
    questions: c.questions.map((x) => ({ ...x, id: "" })) });
}

// Everything except who/when saved: what a version records and what "changed" means.
export const core = (q) => { const { updatedAt, updatedBy, ...rest } = JSON.parse(JSON.stringify(q)); return rest; };
export const sameQuiz = (a, b) => JSON.stringify(core(normalizeQuiz(a))) === JSON.stringify(core(normalizeQuiz(b)));

// What still needs filling in before the blueprint is complete. Empty list = ready.
export function issues(q) {
  const out = [];
  if (!q.text.trim()) out.push("Write the question.");
  if (q.type === "single" || q.type === "multiple") {
    if (q.options.filter((o) => o.trim()).length < 2) out.push("Add at least two answer choices.");
    if (!q.correct.some((i) => q.options[i]?.trim())) out.push(q.type === "single" ? "Mark the correct choice." : "Mark every correct choice.");
  } else if (q.type === "truefalse") {
    if (q.answer === null) out.push("Choose True or False as the correct answer.");
  } else if (q.type === "matching") {
    if (q.pairs.filter((p) => p.left.trim() && p.right.trim()).length < 2) out.push("Add at least two complete pairs.");
    else if (q.pairs.some((p) => !!p.left.trim() !== !!p.right.trim())) out.push("Some pairs are missing one side.");
  } else if (q.type === "ordering") {
    if (q.items.filter((x) => x.trim()).length < 2) out.push("Add at least two items, listed in the correct order.");
  } else if (q.type === "blank") {
    if (!hasBlank(q.text)) out.push(`Put ${BLANK} in the question where the blank goes.`);
    if (!q.accepted.some((a) => a.trim())) out.push("Add at least one accepted answer.");
  } else if (q.type === "open") {
    if (!q.model.trim()) out.push("Add a model answer or grading notes.");
  }
  return out;
}

// The correct answer in one line, for previews.
export function answerLine(q) {
  if (q.type === "single" || q.type === "multiple") {
    const shown = q.options.map((t, i) => [t, i]).filter(([t]) => t.trim());
    const hit = shown.map(([t, i], n) => [t, n, i]).filter(([, , i]) => q.correct.includes(i));
    return hit.map(([t, n]) => `${letter(n)}. ${t}`).join("; ");
  }
  if (q.type === "truefalse") return q.answer === null ? "" : q.answer ? "True" : "False";
  if (q.type === "matching") return q.pairs.filter((p) => p.left.trim() && p.right.trim()).map((p) => `${p.left} → ${p.right}`).join("; ");
  if (q.type === "ordering") return q.items.filter((x) => x.trim()).map((x, i) => `${i + 1}. ${x}`).join("  ");
  if (q.type === "blank") return q.accepted.filter((a) => a.trim()).join(" / ");
  return q.model.trim().replace(/\s+/g, " ").slice(0, 160);
}

export const typeCounts = (quiz) => {
  const n = {};
  quiz.questions.forEach((q) => { n[q.type] = (n[q.type] || 0) + 1; });
  return QUESTION_TYPES.filter((t) => n[t.id]).map((t) => ({ id: t.id, label: t.label, n: n[t.id] }));
};

// What changed between two snapshots: { meta: [...], added: [...], removed: [...], changed: [...] } (questions by id)
export function diffQuizzes(a, b) {
  const out = { meta: [], added: [], removed: [], changed: [] };
  if (!a) return out;
  for (const [k, label] of [["title", "Title"], ["summary", "Summary"], ["kind", "Type"], ["status", "Status"], ["version", "Version"], ["outlineId", "Linked outline"], ["scope", "Day or topic"]])
    if ((a[k] || "") !== (b[k] || "")) out.meta.push(label);
  if (JSON.stringify(a.objectives || []) !== JSON.stringify(b.objectives || [])) out.meta.push("Objectives");
  const A = new Map(a.questions.map((q, i) => [q.id, { q, n: i + 1 }])), B = new Map(b.questions.map((q, i) => [q.id, { q, n: i + 1 }]));
  for (const [id, { q, n }] of B) {
    if (!A.has(id)) out.added.push({ id, n, text: q.text });
    else if (JSON.stringify(A.get(id).q) !== JSON.stringify(q)) out.changed.push({ id, n, text: q.text });
  }
  for (const [id, { q, n }] of A) if (!B.has(id)) out.removed.push({ id, n, text: q.text });
  if (!out.added.length && !out.removed.length && !out.changed.length && !out.meta.length
    && JSON.stringify(a.questions.map((q) => q.id)) !== JSON.stringify(b.questions.map((q) => q.id))) out.meta.push("Question order");
  return out;
}

export { parseLines };
