// Build the bundled pitch-accent dictionary from kanjium (CC BY-SA 4.0).
//
// Source: data/source_files/raw/accents.txt — tab-separated
//   <word>\t<reading (hiragana)>\t<accent>
// where accent is the downstep mora (0 = heiban/flat). Variants are
// comma-separated, sometimes with POS tags, e.g. "0,2" or "(副)0,(名)3"; we take
// the first integer as the primary accent.
//
// Output (committed; lazy-loaded client-side only when pitch is enabled):
//   src/data/pitch/accents.json = { byWord: { "<word>\t<hiragana>": accent },
//                                   byReading: { "<hiragana>": accent } }
//
// Run: npm run pitch:build

import { mkdir, writeFile, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { toHiragana } from "wanakana";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "src", "data", "pitch");
const CACHE = path.join(__dirname, ".cache", "accents.txt");

const URL =
  "https://raw.githubusercontent.com/mifunetoshiro/kanjium/master/data/source_files/raw/accents.txt";

async function getRaw() {
  if (existsSync(CACHE)) return readFile(CACHE, "utf8");
  console.log("Downloading kanjium accents.txt…");
  const res = await fetch(URL);
  if (!res.ok) throw new Error(`${res.status} ${URL}`);
  const txt = await res.text();
  await mkdir(path.dirname(CACHE), { recursive: true });
  await writeFile(CACHE, txt);
  return txt;
}

/** First integer in an accent field, ignoring POS tags like "(副)". */
function primaryAccent(field) {
  const m = field.match(/\d+/);
  return m ? Number(m[0]) : null;
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const raw = await getRaw();

  const byWord = {};
  const byReading = {};
  let n = 0;

  for (const line of raw.split("\n")) {
    if (!line) continue;
    const [word, reading, accentField] = line.split("\t");
    if (!word || !reading || !accentField) continue;
    const accent = primaryAccent(accentField);
    if (accent == null) continue;
    const hira = toHiragana(reading.trim());
    byWord[`${word}\t${hira}`] = accent;
    // First occurrence wins for the reading-only fallback (entries are roughly
    // frequency/usefulness ordered upstream).
    if (!(hira in byReading)) byReading[hira] = accent;
    n++;
  }

  await writeFile(
    path.join(OUT, "accents.json"),
    JSON.stringify({ byWord, byReading }) + "\n",
  );
  console.log(
    `Done. ${n} entries · ${Object.keys(byWord).length} words · ${Object.keys(byReading).length} readings.`,
  );
  console.log(`Wrote ${path.relative(ROOT, path.join(OUT, "accents.json"))}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
