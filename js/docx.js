// Quiz blueprint -> Word (.docx). A .docx is a zip of XML files, so this writes the zip itself:
// no libraries, nothing to install. The document lists every question, its answer choices and the correct answers.
import { QUESTION_TYPES, typeLabel, typeCounts, issues, letter } from "./quiz-model.js";

const MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/* ---------- zip (stored, no compression) ---------- */
const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
const crc32 = (u8) => { let c = 0xffffffff; for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };

export function zip(files) {
  const enc = new TextEncoder();
  const parts = [], central = [];
  const now = new Date();
  const time = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
  const date = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  let offset = 0;
  for (const f of files) {
    const name = enc.encode(f.name), data = enc.encode(f.data), crc = crc32(data), size = data.length;
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true);
    lh.setUint16(10, time, true); lh.setUint16(12, date, true); lh.setUint32(14, crc, true);
    lh.setUint32(18, size, true); lh.setUint32(22, size, true); lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
    parts.push(new Uint8Array(lh.buffer), name, data);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true);
    ch.setUint16(12, time, true); ch.setUint16(14, date, true); ch.setUint32(16, crc, true);
    ch.setUint32(20, size, true); ch.setUint32(24, size, true); ch.setUint16(28, name.length, true);
    ch.setUint32(42, offset, true);
    central.push(new Uint8Array(ch.buffer), name);
    offset += 30 + name.length + size;
  }
  const cdSize = central.reduce((n, p) => n + p.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
  end.setUint32(12, cdSize, true); end.setUint32(16, offset, true);
  return new Blob([...parts, ...central, new Uint8Array(end.buffer)], { type: MIME });
}

/* ---------- WordprocessingML helpers ---------- */
const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
const clean = (s) => String(s ?? "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, "");
const x = (s) => clean(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const MUTED = "5B6878", GREEN = "1B7F4B", RED = "B3261E", ACCENT = "1F5FBF";

// A run of text. Line breaks in the text become Word line breaks.
const run = (text, o = {}) => {
  const pr = `${o.b ? "<w:b/>" : o.b === false ? '<w:b w:val="0"/>' : ""}${o.i ? "<w:i/>" : ""}${o.color ? `<w:color w:val="${o.color}"/>` : ""}${o.size ? `<w:sz w:val="${o.size}"/><w:szCs w:val="${o.size}"/>` : ""}`;
  const body = clean(text).split(/\r?\n/).map((l, i) => `${i ? "<w:br/>" : ""}<w:t xml:space="preserve">${x(l)}</w:t>`).join("");
  return `<w:r>${pr ? `<w:rPr>${pr}</w:rPr>` : ""}${body}</w:r>`;
};
const para = (runs, o = {}) => {
  const pr = `${o.style ? `<w:pStyle w:val="${o.style}"/>` : ""}${o.keep ? "<w:keepNext/>" : ""}${o.fill ? `<w:shd w:val="clear" w:color="auto" w:fill="${o.fill}"/>` : ""}${o.after != null || o.before != null ? `<w:spacing${o.before != null ? ` w:before="${o.before}"` : ""}${o.after != null ? ` w:after="${o.after}"` : ""}/>` : ""}${o.left ? `<w:ind w:left="${o.left}"${o.hanging ? ` w:hanging="${o.hanging}"` : ""}/>` : ""}`;
  return `<w:p>${pr ? `<w:pPr>${pr}</w:pPr>` : ""}${Array.isArray(runs) ? runs.join("") : runs}</w:p>`;
};
const text = (t, o) => para(run(t, o?.run), o);

const cell = (content, w, o = {}) =>
  `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/>${o.fill ? `<w:shd w:val="clear" w:color="auto" w:fill="${o.fill}"/>` : ""}</w:tcPr>${content}</w:tc>`;
const table = (widths, rows) =>
  `<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="${widths.reduce((a, b) => a + b, 0)}" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblCellMar><w:top w:w="60" w:type="dxa"/><w:left w:w="100" w:type="dxa"/><w:bottom w:w="60" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tblCellMar></w:tblPr>
  <w:tblGrid>${widths.map((w) => `<w:gridCol w:w="${w}"/>`).join("")}</w:tblGrid>${rows.join("")}</w:tbl>`;
const row = (cells, header) => `<w:tr>${header ? "<w:trPr><w:cantSplit/><w:tblHeader/></w:trPr>" : "<w:trPr><w:cantSplit/></w:trPr>"}${cells.join("")}</w:tr>`;
const cp = (t, o = {}) => para(run(t, o), { after: 0 }); // paragraph inside a table cell

/* ---------- the document ---------- */
const date = (t) => new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

function choice(label, t, correct) {
  return correct
    ? para([run(`${label}.  `, { b: true }), run(t, { b: true }), run("   ✓ Correct", { b: true, color: GREEN, size: 20 })], { fill: "E3F4EA", left: 540, hanging: 360, after: 40 })
    : para([run(`${label}.  `), run(t)], { left: 540, hanging: 360, after: 40 });
}
const answerLine = (label, value) => para([run(`${label}  `, { b: true, color: GREEN }), run(value, { b: true })], { before: 80, after: 60 });
const sub = (t) => para(run(t, { b: true, color: MUTED, size: 20 }), { before: 100, after: 40, keep: true });

function questionBlock(q, n) {
  const out = [];
  out.push(para([run(`Question ${n}`), run(`   ${typeLabel(q.type)}`, { color: MUTED, size: 22, b: false })], { style: "Heading2", keep: true }));
  if (q.objective.trim()) out.push(para(run(`Objective: ${q.objective}`, { color: MUTED, size: 20 }), { keep: true, after: 60 }));
  const problems = issues(q);
  if (problems.length) out.push(para(run(`Incomplete: ${problems.join(" ")}`, { color: RED, i: true, size: 20 }), { after: 60 }));
  out.push(text(q.text || "(No question text yet)", { keep: true, after: 100, run: { size: 23 } }));

  if (q.type === "single" || q.type === "multiple") {
    const shown = q.options.map((t, i) => ({ t, i })).filter((o) => o.t.trim());
    shown.forEach((o, k) => out.push(choice(letter(k), o.t, q.correct.includes(o.i))));
    const hit = shown.map((o, k) => ({ ...o, k })).filter((o) => q.correct.includes(o.i));
    out.push(answerLine(hit.length === 1 ? "Correct answer:" : "Correct answers:", hit.length ? hit.map((o) => `${letter(o.k)}. ${o.t}`).join("; ") : "Not set"));
  } else if (q.type === "truefalse") {
    out.push(choice("A", "True", q.answer === true), choice("B", "False", q.answer === false));
    out.push(answerLine("Correct answer:", q.answer === null ? "Not set" : q.answer ? "True" : "False"));
  } else if (q.type === "matching") {
    const pairs = q.pairs.filter((p) => p.left.trim() || p.right.trim());
    out.push(sub("Correct matches"));
    out.push(table([600, 4200, 5040], [
      row([cell(cp("#", { b: true, size: 20 }), 600, { fill: "EEF1F5" }), cell(cp("Item", { b: true, size: 20 }), 4200, { fill: "EEF1F5" }), cell(cp("Matches", { b: true, size: 20 }), 5040, { fill: "EEF1F5" })], true),
      ...pairs.map((p, i) => row([cell(cp(String(i + 1)), 600), cell(cp(p.left), 4200), cell(cp(p.right, { b: true, color: GREEN }), 5040, { fill: "E3F4EA" })])),
    ]));
    out.push(para(run("Shown in answer-key order. Shuffle the right-hand column when this is delivered.", { i: true, color: MUTED, size: 19 }), { before: 60, after: 60 }));
  } else if (q.type === "ordering") {
    out.push(sub("Correct order"));
    q.items.filter((t) => t.trim()).forEach((t, i) => out.push(para([run(`${i + 1}.  `, { b: true, color: GREEN }), run(t, { b: true })], { fill: "E3F4EA", left: 540, hanging: 360, after: 40 })));
    out.push(para(run("Shown in the correct sequence. Shuffle the items when this is delivered.", { i: true, color: MUTED, size: 19 }), { before: 60, after: 60 }));
  } else if (q.type === "blank") {
    const acc = q.accepted.filter((a) => a.trim());
    out.push(answerLine(acc.length === 1 ? "Accepted answer:" : "Accepted answers:", acc.length ? acc.join("  /  ") : "Not set"));
    if (acc.length > 1) out.push(para(run("Any one of these is correct.", { i: true, color: MUTED, size: 19 }), { after: 60 }));
  } else if (q.type === "open") {
    out.push(sub("Model answer / grading notes"));
    out.push(para(run(q.model.trim() || "Not set", { color: q.model.trim() ? undefined : RED }), { fill: "E3F4EA", left: 180, after: 80 }));
  }
  if (q.rationale.trim()) out.push(para([run("Rationale  ", { b: true, color: MUTED }), run(q.rationale, { i: true })], { before: 60, after: 120 }));
  return out.join("");
}

function documentXml(quiz, outlineTitle) {
  const body = [];
  body.push(para(run(quiz.title || "Untitled quiz"), { style: "Title" }));
  body.push(para(run(`${quiz.kind} blueprint · Answer key`, { color: ACCENT, b: true }), { style: "Subtitle" }));
  if (quiz.summary.trim()) body.push(text(quiz.summary, { after: 160 }));

  const types = typeCounts(quiz).map((t) => `${t.label} × ${t.n}`).join(", ");
  const detail = [
    ["Type", quiz.kind], ["Status", quiz.status], ["Version", `v${quiz.version}`],
    ["Linked outline", outlineTitle || "None"],
    ...(quiz.scope.trim() ? [["Day or topic", quiz.scope.trim()]] : []),
    ["Questions", `${quiz.questions.length}${types ? ` (${types})` : ""}`],
    ["Objectives", quiz.objectives.length ? quiz.objectives.join("\n") : "None listed"],
    ["Last updated", quiz.updatedAt ? `${date(quiz.updatedAt)}${quiz.updatedBy ? ` by ${quiz.updatedBy}` : ""}` : "Not saved yet"],
    ["Exported", date(Date.now())],
  ];
  body.push(table([2200, 7640], detail.map(([k, v]) => row([cell(cp(k, { b: true, size: 20, color: MUTED }), 2200, { fill: "EEF1F5" }), cell(cp(v), 7640)]))));
  body.push(para(run("This document contains the correct answers. Do not hand it to people taking the quiz.", { i: true, color: RED, size: 20 }), { before: 160, after: 60 }));

  body.push(para(run("Questions and answer key"), { style: "Heading1" }));
  if (!quiz.questions.length) body.push(text("This quiz has no questions yet.", { run: { i: true, color: MUTED } }));
  quiz.questions.forEach((q, i) => body.push(questionBlock(q, i + 1)));

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document ${NS}><w:body>${body.join("")}<w:sectPr><w:footerReference w:type="default" r:id="rId2"/><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1200" w:right="1200" w:bottom="1200" w:left="1200" w:header="708" w:footer="600" w:gutter="0"/></w:sectPr></w:body></w:document>`;
}

const footerXml = (title) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:ftr ${NS}><w:p><w:pPr><w:pStyle w:val="Footer"/><w:jc w:val="center"/></w:pPr>${run(`${title || "Quiz"} · Answer key · Page `, { color: MUTED, size: 18 })}<w:fldSimple w:instr=" PAGE "><w:r><w:rPr><w:color w:val="${MUTED}"/><w:sz w:val="18"/></w:rPr><w:t>1</w:t></w:r></w:fldSimple>${run(" of ", { color: MUTED, size: 18 })}<w:fldSimple w:instr=" NUMPAGES "><w:r><w:rPr><w:color w:val="${MUTED}"/><w:sz w:val="18"/></w:rPr><w:t>1</w:t></w:r></w:fldSimple></w:p></w:ftr>`;

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles ${NS}>
<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="Calibri" w:cs="Calibri"/><w:sz w:val="22"/><w:szCs w:val="22"/><w:lang w:val="en-US" w:eastAsia="en-US" w:bidi="ar-SA"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="264" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>
<w:style w:type="character" w:default="1" w:styleId="DefaultParagraphFont"><w:name w:val="Default Paragraph Font"/><w:uiPriority w:val="1"/><w:semiHidden/></w:style>
<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="0" w:after="40"/></w:pPr><w:rPr><w:b/><w:color w:val="17202C"/><w:sz w:val="52"/><w:szCs w:val="52"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtitle"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:after="200"/></w:pPr><w:rPr><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:keepLines/><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="4" w:color="DBE1E9"/></w:pBdr><w:spacing w:before="360" w:after="160"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:color w:val="17202C"/><w:sz w:val="32"/><w:szCs w:val="32"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:keepLines/><w:spacing w:before="280" w:after="60"/><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:color w:val="${ACCENT}"/><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Footer"><w:name w:val="footer"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="0"/></w:pPr></w:style>
<w:style w:type="table" w:default="1" w:styleId="TableNormal"><w:name w:val="Normal Table"/><w:uiPriority w:val="99"/><w:semiHidden/><w:tblPr><w:tblInd w:w="0" w:type="dxa"/><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="108" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="108" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style>
<w:style w:type="table" w:styleId="TableGrid"><w:name w:val="Table Grid"/><w:basedOn w:val="TableNormal"/><w:uiPriority w:val="59"/><w:tblPr><w:tblBorders><w:top w:val="single" w:sz="4" w:space="0" w:color="C9D1DC"/><w:left w:val="single" w:sz="4" w:space="0" w:color="C9D1DC"/><w:bottom w:val="single" w:sz="4" w:space="0" w:color="C9D1DC"/><w:right w:val="single" w:sz="4" w:space="0" w:color="C9D1DC"/><w:insideH w:val="single" w:sz="4" w:space="0" w:color="C9D1DC"/><w:insideV w:val="single" w:sz="4" w:space="0" w:color="C9D1DC"/></w:tblBorders></w:tblPr></w:style>
</w:styles>`;

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`;
const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`;
const DOC_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/></Relationships>`;
const coreXml = (title) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${x(title)}</dc:title><dc:creator>Trainer Runbook</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString().replace(/\.\d+Z$/, "Z")}</dcterms:created></cp:coreProperties>`;

// Returns a Blob of the finished .docx. `outlineTitle` is the title of the linked outline, if any.
export async function quizToDocx(quiz, { outlineTitle = "" } = {}) {
  return zip([
    { name: "[Content_Types].xml", data: CONTENT_TYPES },
    { name: "_rels/.rels", data: ROOT_RELS },
    { name: "docProps/core.xml", data: coreXml(quiz.title || "Quiz blueprint") },
    { name: "word/document.xml", data: documentXml(quiz, outlineTitle) },
    { name: "word/_rels/document.xml.rels", data: DOC_RELS },
    { name: "word/styles.xml", data: STYLES },
    { name: "word/footer1.xml", data: footerXml(quiz.title) },
  ]);
}

export { QUESTION_TYPES };
