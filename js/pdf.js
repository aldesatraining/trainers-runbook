// Outline -> PDF for sharing. A small self-contained writer (no libraries): standard Helvetica fonts, wrapped text,
// clickable links, one day per page. Text widths are measured with a canvas (Arial/Helvetica share metrics), and the
// page streams are Flate-compressed with CompressionStream.
// The PDF carries the schedule and guide only: no logins, personal notes or progress.
import { isRest } from "./model.js";

const PW = 612, PH = 792, M = 54, W = PW - M * 2, BOTTOM = 56;
const COLOR = { text: [0.09, 0.125, 0.17], muted: [0.36, 0.41, 0.47], accent: [0.12, 0.37, 0.75], warn: [0.54, 0.33, 0], ok: [0.1, 0.5, 0.29], remind: [0.04, 0.35, 0.48], line: [0.86, 0.88, 0.91], rest: [0.92, 0.96, 0.93], mine: [0.42, 0.29, 0] };

// WinAnsi: the byte values for characters outside Latin-1 that standard PDF fonts can show.
const WIN = { 0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84, 0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87, 0x02c6: 0x88, 0x2030: 0x89, 0x0160: 0x8a, 0x2039: 0x8b, 0x0152: 0x8c, 0x017d: 0x8e, 0x2018: 0x91, 0x2019: 0x92, 0x201c: 0x93, 0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97, 0x02dc: 0x98, 0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b, 0x0153: 0x9c, 0x017e: 0x9e, 0x0178: 0x9f };
const FALLBACK = { 0x2192: "->", 0x2190: "<-", 0x2197: "", 0x2265: ">=", 0x2264: "<=", 0x2713: "", 0x00a0: " ", 0x2011: "-", 0x2012: "-", 0x2212: "-", 0x200b: "" };
const bytes = (s) => {
  let o = "";
  for (const ch of String(s)) {
    const c = ch.codePointAt(0);
    if (c < 32) o += " ";
    else if (c < 128 || (c >= 0xa1 && c < 256)) o += ch;
    else if (WIN[c]) o += String.fromCharCode(WIN[c]);
    else o += FALLBACK[c] ?? "?";
  }
  return o;
};
const lit = (s) => `(${bytes(s).replace(/[\\()]/g, "\\$&").replace(/[\u0080-\u00ff]/g, (c) => `\\${c.charCodeAt(0).toString(8)}`)})`;
const num = (n) => Math.round(n * 100) / 100;
const rg = (c) => `${c.map(num).join(" ")} rg`;

const ctx = document.createElement("canvas").getContext("2d");
const FONT = { r: "F1", b: "F2", i: "F3" };
const widthOf = (t, size, f = "r") => { ctx.font = `${f === "b" ? "bold " : f === "i" ? "italic " : ""}100px Arial, Helvetica, sans-serif`; return (ctx.measureText(t).width * size) / 100; };

function wrap(text, width, size, f) {
  const out = [];
  let line = "", lw = 0;
  const space = widthOf(" ", size, f);
  for (const word of String(text).split(/\s+/).filter(Boolean)) {
    const ww = widthOf(word, size, f);
    if (line && lw + space + ww > width) { out.push(line); line = ""; lw = 0; }
    if (!line && ww > width) { // a single long word (a URL): split by characters
      let chunk = "";
      for (const ch of word) { if (widthOf(chunk + ch, size, f) > width) { out.push(chunk); chunk = ""; } chunk += ch; }
      line = chunk; lw = widthOf(chunk, size, f); continue;
    }
    line = line ? `${line} ${word}` : word; lw = line === word ? ww : lw + space + ww;
  }
  if (line) out.push(line);
  return out.length ? out : [""];
}

export async function outlineToPdf(p) {
  const pages = [];
  let ops, annots, y;
  const newPage = () => { ops = []; annots = []; pages.push({ ops, annots }); y = PH - M; };
  const ensure = (h) => { if (y - h < BOTTOM) newPage(); };

  const text = (s, x, yy, size, f, color) => ops.push(`BT /${FONT[f]} ${size} Tf ${rg(color)} ${num(x)} ${num(yy)} Td ${lit(s)} Tj ET`);
  const rect = (x, yy, w, h, color) => ops.push(`${rg(color)} ${num(x)} ${num(yy)} ${num(w)} ${num(h)} re f`);
  const hline = (yy, color = COLOR.line) => ops.push(`${color.map(num).join(" ")} RG 0.6 w ${M} ${num(yy)} m ${PW - M} ${num(yy)} l S`);
  const box = (x, yy, size) => ops.push(`${COLOR.muted.map(num).join(" ")} RG 0.6 w ${num(x)} ${num(yy)} ${size} ${size} re S`);

  // A wrapped paragraph at x with the given width. `link` makes each line a clickable link.
  function para(s, { x = M, width = W - (x - M), size = 10.5, f = "r", color = COLOR.text, gap = 3, link = null, lead = 1.32, mark = null } = {}) {
    const lines = wrap(s, width, size, f), lh = size * lead;
    lines.forEach((ln, i) => {
      ensure(lh + (i === 0 ? 0 : 0));
      y -= lh;
      if (i === 0 && mark) { if (mark === "box") box(x - 12, y + 0.5, 7); else text(mark, x - 11, y, size, "r", color === COLOR.text ? COLOR.muted : color); }
      text(ln, x, y, size, f, color);
      if (link) {
        const w = widthOf(ln, size, f);
        ops.push(`${color.map(num).join(" ")} RG 0.5 w ${num(x)} ${num(y - 1.5)} m ${num(x + w)} ${num(y - 1.5)} l S`);
        annots.push({ rect: [x, y - 3, x + w, y + size], url: link });
      }
    });
    y -= gap;
  }
  const bullets = (items, x, depth = 0, opts = {}) => items.forEach((it, i, arr) => {
    if (Array.isArray(it)) return;
    para(it, { x: x + 12 + depth * 14, size: 10, gap: 1.5, mark: depth % 2 ? "-" : "•", ...opts });
    if (Array.isArray(arr[i + 1])) bullets(arr[i + 1], x, depth + 1, opts);
  });
  const label = (s, x, color) => { ensure(24); y -= 4; para(s.toUpperCase(), { x, size: 8, f: "b", color, gap: 1.5, lead: 1.2 }); };
  const textList = (title, color, list, x, mark) => {
    const items = list.map((t) => (typeof t === "string" ? t : t.text)).filter(Boolean);
    if (!items.length) return;
    label(title, x, color);
    items.forEach((t) => para(t, { x: x + 12, size: 10, gap: 1.5, mark: mark || "•" }));
  };
  const links = (title, rs, x) => {
    if (!rs?.length) return;
    label(title, x, COLOR.accent);
    rs.forEach((r) => para(r.url ? `${r.label}` : `${r.label} (link needed)`, { x: x + 12, size: 10, gap: 1.5, color: r.url ? COLOR.accent : COLOR.muted, link: r.url || null, mark: "•" }));
  };

  const hours = (mins) => `${Math.floor(mins / 60)}h${mins % 60 ? ` ${mins % 60}m` : ""}`;
  const work = (d) => d.blocks.filter((b) => !isRest(b)).reduce((n, b) => n + b.minutes, 0);

  /* ---- cover ---- */
  newPage();
  y -= 6;
  para(p.title, { size: 24, f: "b", gap: 6, lead: 1.2 });
  if (p.summary) para(p.summary, { size: 12, color: COLOR.muted, gap: 8, lead: 1.4 });
  const total = p.days.reduce((n, d) => n + work(d), 0);
  para([`${p.days.length} day${p.days.length === 1 ? "" : "s"}`, `${hours(total)} of training`, `v${p.version}`, p.status, p.audience && `For: ${p.audience}`, p.tags?.length && p.tags.join(", ")].filter(Boolean).join("  ·  "), { size: 9.5, color: COLOR.muted, gap: 14 });
  hline(y + 6); y -= 8;
  label("Contents", M, COLOR.muted);
  p.days.forEach((d) => para(`${d.title}${d.theme ? `  ·  ${d.theme}` : ""}`, { x: M + 6, size: 10.5, gap: 2.5 }));

  /* ---- one section per day ---- */
  for (const d of p.days) {
    newPage();
    para(`${d.title}`, { size: 20, f: "b", color: COLOR.accent, gap: 2, lead: 1.2 });
    if (d.theme) para(d.theme, { size: 12.5, f: "b", gap: 2 });
    para(`${d.start} – ${d.end}  ·  ${hours(work(d))} of training  ·  ${d.blocks.filter((b) => !isRest(b)).length} topics`, { size: 9.5, color: COLOR.muted, gap: 4 });
    hline(y + 2); y -= 4;

    const before = d.prep.length || d.reminders.length || d.resources.length;
    if (before) {
      textList("Before the day", COLOR.remind, d.prep, M, "box");
      textList("Remember", COLOR.remind, d.reminders, M);
      links("Links for today", d.resources, M);
      y -= 4;
    }

    for (const b of d.blocks) {
      const X = M + 82, tw = W - 82;
      const when = `${b.start}–${b.end}`;
      if (isRest(b)) {
        ensure(26);
        const h = 18;
        rect(M, y - h, W, h, COLOR.rest);
        text(when, M + 6, y - 12.5, 9, "r", COLOR.muted);
        text(`${b.title}  ·  ${b.minutes} min`, X, y - 12.5, 10, "b", COLOR.ok);
        y -= h + 3;
        if (b.summary) para(b.summary, { x: X, width: tw, size: 9, f: "i", color: COLOR.muted, gap: 3 });
        continue;
      }
      ensure(52);
      y -= 8;
      const first = y;
      text(when, M, first - 15.6, 9, "r", COLOR.muted);
      text(`${b.minutes} min${b.flex ? " · flexible" : ""}`, M, first - 26, 8, "r", COLOR.muted);
      para(b.title, { x: X, width: tw, size: 12.5, f: "b", gap: 2, lead: 1.25 });
      if (b.objective) para(b.objective, { x: X, width: tw, size: 10, f: "i", color: COLOR.muted, gap: 2 });
      if (b.summary) para(b.summary, { x: X, width: tw, size: 10, color: COLOR.muted, gap: 2 });
      if (b.warnings.length) textList("Watch out", COLOR.warn, b.warnings, X);
      textList("Remember", COLOR.remind, b.reminders, X);
      textList("Before you start", COLOR.remind, b.prep, X, "box");
      textList("Do", COLOR.ok, b.actions, X, "box");
      links("Links", b.resources, X);
      for (const s of b.sections) {
        ensure(30); y -= 4;
        const col = s.kind === "conduct" ? COLOR.mine : s.kind === "activity" ? COLOR.ok : s.kind === "note" ? COLOR.muted : COLOR.text;
        para(s.kind === "content" ? s.heading : `${s.heading}  ·  ${s.kind}`, { x: X, width: tw, size: 10.5, f: "b", color: col, gap: 1.5 });
        bullets(s.items, X - 12);
      }
      if (b.transition) para(`Next: ${b.transition}`, { x: X, width: tw, size: 9.5, f: "i", color: COLOR.muted, gap: 2 });
      y -= 5;
      hline(y + 3);
    }

    const close = d.close.map((c) => c.text).filter(Boolean);
    if (close.length) { ensure(40); y -= 6; textList("End of day", COLOR.ok, close, M, "box"); }
  }

  /* ---- footers, then assemble ---- */
  const n = pages.length;
  pages.forEach((pg, i) => {
    pg.ops.push(`BT /F1 8 Tf ${rg(COLOR.muted)} ${M} 32 Td ${lit(`${p.title}  ·  v${p.version}`)} Tj ET`);
    const label = `Page ${i + 1} of ${n}`;
    pg.ops.push(`BT /F1 8 Tf ${rg(COLOR.muted)} ${num(PW - M - widthOf(label, 8))} 32 Td ${lit(label)} Tj ET`);
  });

  const deflate = async (s) => {
    const u8 = Uint8Array.from(s, (c) => c.charCodeAt(0));
    const out = new Uint8Array(await new Response(new Blob([u8]).stream().pipeThrough(new CompressionStream("deflate"))).arrayBuffer());
    let r = "";
    for (let i = 0; i < out.length; i += 8192) r += String.fromCharCode(...out.subarray(i, i + 8192));
    return r;
  };

  // object ids: 1 catalog, 2 page tree, 3–5 fonts, 6 info, then page / content / annotations per page
  let next = 7;
  const objs = {};
  const kids = [];
  for (const pg of pages) {
    const pid = next++, cid = next++, aids = pg.annots.map(() => next++);
    kids.push(pid);
    objs[cid] = { stream: await deflate(pg.ops.join("\n")) };
    pg.annots.forEach((a, k) => { objs[aids[k]] = `<< /Type /Annot /Subtype /Link /Rect [${a.rect.map(num).join(" ")}] /Border [0 0 0] /A << /S /URI /URI ${lit(a.url)} >> >>`; });
    objs[pid] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PW} ${PH}] /Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >> >> /Contents ${cid} 0 R${aids.length ? ` /Annots [${aids.map((a) => `${a} 0 R`).join(" ")}]` : ""} >>`;
  }
  const font = (name) => `<< /Type /Font /Subtype /Type1 /BaseFont /${name} /Encoding /WinAnsiEncoding >>`;
  objs[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objs[2] = `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(" ")}] /Count ${n} >>`;
  objs[3] = font("Helvetica"); objs[4] = font("Helvetica-Bold"); objs[5] = font("Helvetica-Oblique");
  objs[6] = `<< /Title ${lit(p.title)} /Producer (Trainer Runbook) >>`;

  let out = "%PDF-1.4\n%\u00e2\u00e3\u00cf\u00d3\n";
  const offsets = [];
  for (let id = 1; id < next; id++) {
    offsets[id] = out.length;
    const o = objs[id];
    out += typeof o === "string" ? `${id} 0 obj\n${o}\nendobj\n` : `${id} 0 obj\n<< /Length ${o.stream.length} /Filter /FlateDecode >>\nstream\n${o.stream}\nendstream\nendobj\n`;
  }
  const xref = out.length;
  out += `xref\n0 ${next}\n0000000000 65535 f \n${offsets.slice(1).map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
  out += `trailer\n<< /Size ${next} /Root 1 0 R /Info 6 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new Blob([Uint8Array.from(out, (c) => c.charCodeAt(0))], { type: "application/pdf" });
}
