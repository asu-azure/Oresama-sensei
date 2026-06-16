// Build the bundled, offline kanji dataset for the Kanji feature.
//
// Sources (both free/open):
//  - kanji-data (davidluzgouveia/kanji-data, MIT): readings, meanings, JLPT
//    levels (jlpt_new), stroke count, grade, frequency.
//  - KanjiVG (CC-BY-SA 3.0): per-kanji stroke paths + component/radical structure.
//
// Output (committed; split per JLPT level so the app lazy-loads only what it shows):
//  - src/data/kanji/levels.json          { N5:[…chars], …, N1:[…] }  (common-first)
//  - src/data/kanji/info/n{1..5}.json     char → { jlpt, strokes, grade, on[], kun[], meanings[] }
//  - src/data/kanji/strokes/n{1..5}.json  char → { strokes:[pathD…], components:[{el,isRadical}] }
//
// Re-runnable: fetched KanjiVG SVGs are cached under scripts/.cache (gitignored).
//
// Run: npm run kanji:build

import { mkdir, writeFile, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "src", "data", "kanji");
const CACHE = path.join(__dirname, ".cache", "kanjivg");

const KANJI_DATA_URL =
  "https://raw.githubusercontent.com/davidluzgouveia/kanji-data/master/kanji.json";
const KANJIVG_URL = (hex) =>
  `https://cdn.jsdelivr.net/gh/KanjiVG/kanjivg@master/kanji/${hex}.svg`;

const CONCURRENCY = 24;

/** 5-digit lowercase hex of a single-codepoint kanji (KanjiVG file naming). */
function hexOf(ch) {
  return ch.codePointAt(0).toString(16).padStart(5, "0");
}

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.text();
}

/** Cache-aware KanjiVG SVG fetch. Returns null if the character has no file. */
async function getSvg(ch) {
  const hex = hexOf(ch);
  const file = path.join(CACHE, `${hex}.svg`);
  if (existsSync(file)) return readFile(file, "utf8");
  try {
    const svg = await fetchText(KANJIVG_URL(hex));
    await writeFile(file, svg);
    return svg;
  } catch {
    return null;
  }
}

/** Pull ordered stroke paths and the top-level component list out of a KanjiVG SVG. */
function parseSvg(svg) {
  const strokes = [...svg.matchAll(/<path\b[^>]*\sd="([^"]+)"/g)].map((m) => m[1]);

  // Component scan: track <g> nesting; the first element-bearing group is the
  // kanji itself (root), its direct element children are the components.
  const components = [];
  let depth = 0;
  let rootDepth = null;
  for (const tk of svg.matchAll(/<g\b([^>]*)>|<\/g>/g)) {
    if (tk[0] === "</g>") {
      depth--;
      continue;
    }
    depth++;
    const attrs = tk[1] || "";
    const el = attrs.match(/kvg:element="([^"]+)"/);
    if (!el) continue;
    if (rootDepth === null) {
      rootDepth = depth;
    } else if (depth === rootDepth + 1) {
      components.push({ el: el[1], isRadical: /kvg:radical="/.test(attrs) });
    }
  }
  return { strokes, components };
}

async function pool(items, worker) {
  let i = 0;
  let done = 0;
  const total = items.length;
  async function run() {
    while (i < items.length) {
      const idx = i++;
      await worker(items[idx], idx);
      done++;
      if (done % 100 === 0 || done === total) {
        process.stdout.write(`\r  ${done}/${total}`);
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, run));
  process.stdout.write("\n");
}

async function main() {
  await mkdir(CACHE, { recursive: true });
  await mkdir(path.join(OUT, "info"), { recursive: true });
  await mkdir(path.join(OUT, "strokes"), { recursive: true });

  console.log("Downloading kanji-data…");
  const kanji = JSON.parse(await fetchText(KANJI_DATA_URL));

  // Group JLPT kanji by new level (jlpt_new: 5=N5 … 1=N1), common-first.
  const byLevel = { N5: [], N4: [], N3: [], N2: [], N1: [] };
  for (const [ch, d] of Object.entries(kanji)) {
    const n = d.jlpt_new;
    if (!n || n < 1 || n > 5) continue;
    byLevel[`N${n}`].push(ch);
  }
  for (const lvl of Object.keys(byLevel)) {
    byLevel[lvl].sort((a, b) => {
      const fa = kanji[a].freq ?? 99999;
      const fb = kanji[b].freq ?? 99999;
      if (fa !== fb) return fa - fb;
      return (kanji[a].strokes ?? 99) - (kanji[b].strokes ?? 99);
    });
  }

  await writeFile(
    path.join(OUT, "levels.json"),
    JSON.stringify(byLevel) + "\n",
  );

  const allChars = Object.values(byLevel).flat();
  console.log(`Fetching ${allChars.length} KanjiVG glyphs (cached in scripts/.cache)…`);

  const strokeMap = new Map();
  await pool(allChars, async (ch) => {
    const svg = await getSvg(ch);
    strokeMap.set(ch, svg ? parseSvg(svg) : { strokes: [], components: [] });
  });

  let missing = 0;
  for (const [level, chars] of Object.entries(byLevel)) {
    const n = level.toLowerCase(); // n5..n1
    const info = {};
    const strokes = {};
    for (const ch of chars) {
      const d = kanji[ch];
      info[ch] = {
        jlpt: level,
        strokes: d.strokes ?? null,
        grade: d.grade ?? null,
        on: d.readings_on ?? [],
        kun: d.readings_kun ?? [],
        meanings: d.meanings ?? [],
      };
      const sv = strokeMap.get(ch);
      if (!sv || sv.strokes.length === 0) missing++;
      strokes[ch] = sv;
    }
    await writeFile(
      path.join(OUT, "info", `${n}.json`),
      JSON.stringify(info) + "\n",
    );
    await writeFile(
      path.join(OUT, "strokes", `${n}.json`),
      JSON.stringify(strokes) + "\n",
    );
  }

  const counts = Object.entries(byLevel)
    .map(([l, c]) => `${l}:${c.length}`)
    .join("  ");
  console.log(`Done. ${counts}  (glyphs missing strokes: ${missing})`);
  console.log(`Wrote to ${path.relative(ROOT, OUT)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
