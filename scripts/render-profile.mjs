// Renders every README image (option 1c "spec-sheet bento") in light + dark.
// Static blocks (hero, experience, buttons) and live GitHub numbers (stats, languages).
// Run: GH_TOKEN=... GH_USER=kaveenhyacinth node scripts/render-profile.mjs
import { writeFile, mkdir } from "node:fs/promises";

const USER = process.env.GH_USER || "kaveenhyacinth";
const TOKEN = process.env.GH_TOKEN;
const OUT = "assets";

// ---------- content (edit freely) ----------
const CONTENT = {
  label: "// hello, folks",
  name: "Kaveen Hyacinth",
  highlight: "AI engineer",
  line1: "Five years building SaaS, across the stack —",
  line2a: "now taking LLM features from ",
  line2b: "prototype to production.",
  now: { title: ["Senior Software", "Engineer"], meta: "blott · uk · hybrid" },
  years: "5+",
  stack: [["LLM APIs", true], ["LoRA", true], ["TypeScript"], ["Next.js"], ["Nuxt"], ["NestJS"], ["Postgres"], ["AWS"]],
  xpNote: "2021 — present · 5 companies · 5 countries",
  xp: [
    { role: "Senior Software Engineer", co: "Blott", where: "uk · hybrid", when: "2025 — now", now: true },
    { role: "Frontend Team Lead", co: "Inisev", where: "switzerland · remote", when: "2023 — 2025" },
    { role: "Software Engineer", co: "Appspotr", where: "sweden · remote", when: "2022 — 2023" },
    { role: "Software Engineer", co: "CabbageApps", where: "sri lanka · hybrid", when: "2021 — 2022" },
  ],
  footer: "Wanna have a cup of coffee with me?",
  buttons: { email: "Email me →", linkedin: "LinkedIn →" },
};

// ---------- Kaveen Design System tokens (dark = derived inverse; marker constant) ----------
const THEMES = {
  light: { paper: "#F7F6F2", card: "#FFFFFF", ink: "#15171B", muted: "#686D74", faint: "#9AA0A6", line: "#E4E2DA", lineSoft: "#EDEBE4",
           markerSoft: "#FFF3B8", markerGhost: "#FFF9DE", markerBorder: "#D6BE3F",
           langs: ["#15171B", "#FFE24A", "#686D74", "#9AA0A6", "#C9C6BC", "#FFF3B8"] },
  dark:  { paper: "#141518", card: "#1C1E22", ink: "#F2F1EC", muted: "#A3A8AE", faint: "#6E747B", line: "#2E3035", lineSoft: "#24262A",
           markerSoft: "#3A3318", markerGhost: "#22211B", markerBorder: "#6B5E1E",
           langs: ["#F2F1EC", "#FFE24A", "#A3A8AE", "#6E747B", "#44474D", "#8A7A2A"] },
};
const MARKER = "#FFE24A", MARKER_INK = "#15171B", LIVE = "#17853B";

// 12-col grid at README width
const W = 832, GAP = 12, COL = (W - GAP * 11) / 12;
const span = (n) => n * COL + (n - 1) * GAP;

// ---------- data ----------
async function gql(query, variables) {
  const r = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: { Authorization: `bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  const j = await r.json();
  if (j.errors) throw new Error(JSON.stringify(j.errors));
  return j.data;
}
async function getData() {
  const q = `query($login:String!,$after:String){ user(login:$login){
    followers{ totalCount } pullRequests{ totalCount }
    repositories(ownerAffiliations:OWNER,isFork:false,first:100,after:$after){
      pageInfo{ hasNextPage endCursor }
      nodes{ stargazerCount languages(first:10,orderBy:{field:SIZE,direction:DESC}){ edges{ size node{ name } } } } } } }`;
  let after = null, repos = [], user;
  do {
    user = (await gql(q, { login: USER, after })).user;
    repos.push(...user.repositories.nodes);
    after = user.repositories.pageInfo.hasNextPage ? user.repositories.pageInfo.endCursor : null;
  } while (after);
  const stars = repos.reduce((s, r) => s + r.stargazerCount, 0);
  const bytes = {};
  for (const r of repos) for (const e of r.languages.edges) bytes[e.node.name] = (bytes[e.node.name] || 0) + e.size;
  const total = Object.values(bytes).reduce((a, b) => a + b, 0) || 1;
  const top = Object.entries(bytes).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, b]) => ({ name, pct: (b / total) * 100 }));
  const rest = 100 - top.reduce((s, l) => s + l.pct, 0);
  if (rest > 0.05) top.push({ name: "Other", pct: rest });
  return { followers: user.followers.totalCount, prs: user.pullRequests.totalCount, stars, langs: top };
}

// ---------- svg helpers (track glyphs per font so each SVG embeds a tiny subset) ----------
const FAM = { d: "Schibsted Grotesk", m: "JetBrains Mono", s: "Newsreader" };
const STACK = { d: "system-ui,sans-serif", m: "ui-monospace,monospace", s: "Georgia,serif" };
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
const fmt = (n) => (n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, "") + "k" : String(n));

function doc(w, h) {
  const used = {};
  const reg = (f, wt, it, s) => { const k = `${f}|${wt}|${it ? 1 : 0}`; used[k] = (used[k] || "") + s; };
  const font = (f, wt, size, it) => `font:${it ? "italic " : ""}${wt} ${size}px '${FAM[f]}',${STACK[f]}`;
  return {
    used,
    // text(x,y,str,{f,w,size,fill,anchor,ls,it,extra})
    text(x, y, s, o) {
      reg(o.f, o.w, o.it, s);
      return `<text x="${x}" y="${y}" fill="${o.fill}"${o.anchor ? ` text-anchor="${o.anchor}"` : ""}${o.extra || ""} style="${font(o.f, o.w, o.size, o.it)}${o.ls ? `;letter-spacing:${o.ls}` : ""}">${esc(s)}</text>`;
    },
    tspan(s, o) {
      reg(o.f, o.w, o.it, s);
      return `<tspan fill="${o.fill}" style="${font(o.f, o.w, o.size, o.it)}">${esc(s)}</tspan>`;
    },
    wrap: (body) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><style>/*FONTS*/</style>${body}</svg>`,
  };
}

async function fontFace(fam, wt, it, text) {
  const spec = it ? `ital,wght@1,${wt}` : `wght@${wt}`;
  const url = `https://fonts.googleapis.com/css2?family=${fam.replace(/ /g, "+")}:${spec}&text=${encodeURIComponent([...new Set(text)].join(""))}`;
  const css = await (await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 Chrome/120" } })).text();
  const src = css.match(/url\((https:[^)]+)\)/)?.[1];
  if (!src) throw new Error(`font fetch failed: ${fam} ${wt}`);
  const b64 = Buffer.from(await (await fetch(src)).arrayBuffer()).toString("base64");
  return `@font-face{font-family:'${fam}';font-style:${it ? "italic" : "normal"};font-weight:${wt};src:url(data:font/woff2;base64,${b64}) format('woff2');}`;
}
const fontCache = new Map();
async function finalize(d, body) {
  const faces = await Promise.all(Object.entries(d.used).map(async ([k, text]) => {
    const [fam, wt, it] = k.split("|");
    const key = k + "|" + [...new Set(text)].sort().join("");
    if (!fontCache.has(key)) fontCache.set(key, fontFace(fam, wt, it === "1", text));
    return fontCache.get(key);
  }));
  return d.wrap(body).replace("/*FONTS*/", faces.join(""));
}
const card = (x, y, w, h, t, fill = t.card, stroke = t.line) =>
  `<rect x="${x + 0.5}" y="${y + 0.5}" width="${w - 1}" height="${h - 1}" rx="16" fill="${fill}" stroke="${stroke}"/>`;
const sectionHead = (d, t, x, y, w, label, count) =>
  d.text(x, y, label.toUpperCase(), { f: "m", w: 600, size: 12, fill: t.muted, ls: ".13em" }) +
  d.text(x + w, y, count, { f: "m", w: 400, size: 12, fill: t.faint, anchor: "end" }) +
  `<line x1="${x}" y1="${y + 12}" x2="${x + w}" y2="${y + 12}" stroke="${t.line}" stroke-dasharray="4 4"/>`;

// ---------- blocks ----------
async function hero(t) {
  const H = 200, d = doc(W, H), a = span(8), bx = a + GAP, bw = span(4), C = CONTENT;
  const body = [
    card(0, 0, a, H, t),
    d.text(28, 44, C.label.toUpperCase(), { f: "m", w: 600, size: 12, fill: t.muted, ls: ".14em" }),
    d.text(28, 96, C.name, { f: "d", w: 800, size: 40, fill: t.ink, ls: "-.035em" }),
    `<rect x="24" y="119" width="100" height="23" fill="${MARKER}"/>`,
    d.text(30, 136, C.highlight, { f: "d", w: 600, size: 15.5, fill: MARKER_INK, extra: ` textLength="88" lengthAdjust="spacingAndGlyphs"` }),
    d.text(134, 136, C.line1, { f: "d", w: 400, size: 15.5, fill: t.muted }),
    `<text x="28" y="164">${d.tspan(C.line2a, { f: "d", w: 400, size: 15.5, fill: t.muted })}${d.tspan(C.line2b, { f: "s", w: 400, size: 17, it: true, fill: t.ink })}</text>`,
    card(bx, 0, bw, H, t, MARKER, "#D6BE3F"),
    `<circle cx="${bx + 27.5}" cy="40" r="3.5" fill="${LIVE}"/>`,
    d.text(bx + 40, 44, "NOW", { f: "m", w: 600, size: 12, fill: MARKER_INK, ls: ".14em" }),
    d.text(bx + 24, 128, C.now.title[0], { f: "d", w: 700, size: 20, fill: MARKER_INK, ls: "-.015em" }),
    d.text(bx + 24, 152, C.now.title[1], { f: "d", w: 700, size: 20, fill: MARKER_INK, ls: "-.015em" }),
    d.text(bx + 24, 178, C.now.meta, { f: "m", w: 400, size: 12.5, fill: MARKER_INK }),
  ].join("");
  return finalize(d, body);
}

async function stats(t, data) {
  const H = 88, d = doc(W, H), w = span(3);
  const cells = [[fmt(data.prs), "Pull requests"], [fmt(data.stars), "Stars earned"], [fmt(data.followers), "Followers"], [CONTENT.years, "Years shipping"]];
  const body = cells.map(([n, l], i) => {
    const x = i * (w + GAP);
    return card(x, 0, w, H, t) +
      d.text(x + 20, 46, n, { f: "d", w: 800, size: 30, fill: t.ink, ls: "-.02em" }) +
      d.text(x + 20, 70, l.toUpperCase(), { f: "m", w: 400, size: 11.5, fill: t.muted, ls: ".1em" });
  }).join("");
  return finalize(d, body);
}

async function langsStack(t, data) {
  const H = 176, d = doc(W, H), lw = span(7), sx = lw + GAP, sw = span(5), p = 22;
  const bw = lw - p * 2;
  let x = p;
  const segs = data.langs.map((l, i) => {
    const w = Math.max(2, (l.pct / 100) * bw - 2);
    const s = `<rect x="${x}" y="66" width="${w}" height="10" fill="${t.langs[i]}"/>`;
    x += w + 2; return s;
  }).join("");
  const col = bw / 3;
  const legend = data.langs.map((l, i) => {
    const lx = p + (i % 3) * col, ly = 110 + Math.floor(i / 3) * 26;
    const name = l.name.toLowerCase().slice(0, 14);
    return `<rect x="${lx}" y="${ly - 9}" width="8" height="8" rx="2" fill="${t.langs[i]}" stroke="${t.line}" stroke-width=".5"/>` +
      d.text(lx + 16, ly, `${name} ${l.pct.toFixed(1)}`, { f: "m", w: 400, size: 12, fill: t.muted });
  }).join("");

  // chips, wrapped
  const inner = sw - p * 2;
  let cx = 0, cy = 62, chips = "";
  for (const [label, ai] of CONTENT.stack) {
    const w = Math.round(label.length * 7.8 + 26);
    if (cx + w > inner) { cx = 0; cy += 36; }
    const X = sx + p + cx;
    chips += `<rect x="${X + 0.5}" y="${cy + 0.5}" width="${w - 1}" height="29" rx="14.5" fill="${ai ? t.markerSoft : t.paper}" stroke="${ai ? t.markerBorder : t.line}"/>` +
      d.text(X + w / 2, cy + 20, label, { f: "d", w: 500, size: 14, fill: t.ink, anchor: "middle" });
    cx += w + 6;
  }

  const body = [
    card(0, 0, lw, H, t),
    sectionHead(d, t, p, 36, bw, "Languages", String(data.langs.length).padStart(2, "0")),
    `<defs><clipPath id="bar"><rect x="${p}" y="66" width="${bw}" height="10" rx="5"/></clipPath></defs><g clip-path="url(#bar)">${segs}</g>`,
    legend,
    card(sx, 0, sw, H, t),
    sectionHead(d, t, sx + p, 36, inner, "Reach for", String(CONTENT.stack.length).padStart(2, "0")),
    chips,
  ].join("");
  return finalize(d, body);
}

async function experience(t) {
  const R = 48, H = R + CONTENT.xp.length * R, d = doc(W, H), p = 22, bw = 104;
  const rows = CONTENT.xp.map((r, i) => {
    const y = R + i * R;
    return (r.now ? `<rect x="0" y="${y}" width="${W}" height="${R}" fill="${t.markerGhost}"/>` : "") +
      (i ? `<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="${t.lineSoft}"/>` : "") +
      `<text x="${p}" y="${y + 30}">${d.tspan(r.role + " ", { f: "d", w: 600, size: 15, fill: t.ink })}${d.tspan("· " + r.co, { f: "d", w: 600, size: 15, fill: t.muted })}</text>` +
      d.text(W - p - bw - 18, y + 29, r.where, { f: "m", w: 400, size: 12, fill: t.faint, anchor: "end" }) +
      `<rect x="${W - p - bw + 0.5}" y="${y + 12.5}" width="${bw - 1}" height="23" rx="11.5" fill="${r.now ? t.markerSoft : t.paper}" stroke="${r.now ? t.markerBorder : t.line}"/>` +
      d.text(W - p - bw / 2, y + 28, r.when, { f: "m", w: 600, size: 11.5, fill: r.now ? t.ink : t.muted, anchor: "middle", ls: ".04em" });
  }).join("");
  const body = [
    `<defs><clipPath id="c"><rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="16"/></clipPath></defs>`,
    `<rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="16" fill="${t.card}"/>`,
    `<g clip-path="url(#c)">`,
    d.text(p, 30, "EXPERIENCE", { f: "m", w: 600, size: 12, fill: t.muted, ls: ".13em" }),
    d.text(W - p, 30, CONTENT.xpNote, { f: "m", w: 400, size: 12, fill: t.faint, anchor: "end" }),
    `<line x1="0" y1="${R}" x2="${W}" y2="${R}" stroke="${t.lineSoft}"/>`,
    rows, `</g>`,
    `<rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="16" fill="none" stroke="${t.line}"/>`,
  ].join("");
  return finalize(d, body);
}

async function footer(t) {
  const d = doc(W, 36);
  return finalize(d, d.text(4, 24, CONTENT.footer, { f: "s", w: 400, size: 18, it: true, fill: t.muted }));
}

async function button(t, label, solid) {
  const w = Math.round(label.length * 8.6 + 48), h = 44, d = doc(w, h);
  return finalize(d,
    `<rect x=".75" y=".75" width="${w - 1.5}" height="${h - 1.5}" rx="21.25" fill="${solid ? t.ink : t.card}" stroke="${t.ink}" stroke-width="1.5"/>` +
    d.text(w / 2, 27.5, label, { f: "d", w: 600, size: 15, fill: solid ? t.paper : t.ink, anchor: "middle" }));
}

// ---------- main ----------
const data = await getData();
await mkdir(OUT, { recursive: true });
for (const [name, t] of Object.entries(THEMES)) {
  const files = {
    hero: await hero(t),
    stats: await stats(t, data),
    "langs-stack": await langsStack(t, data),
    experience: await experience(t),
    footer: await footer(t),
    "btn-email": await button(t, CONTENT.buttons.email, true),
    "btn-linkedin": await button(t, CONTENT.buttons.linkedin, false),
  };
  for (const [f, svg] of Object.entries(files)) await writeFile(`${OUT}/${f}-${name}.svg`, svg);
}
console.log("rendered", { prs: data.prs, stars: data.stars, followers: data.followers, langs: data.langs.map((l) => `${l.name} ${l.pct.toFixed(1)}%`) });
