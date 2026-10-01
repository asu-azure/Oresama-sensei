// Shard layout for the offline data the app fetches at runtime (public/data/).
//
// The old app imported these as JS modules, so turning pitch accents on pulled
// one 4.4 MB chunk, and opening an N1 kanji pulled 1.3 MB of strokes. Here each
// lookup fetches only the shard it needs. The client side of each rule lives in
// src/lib/pitch.ts and src/lib/kanji.ts — change both together.
//
//   pitch/<xx>.json          FNV-1a(hiragana reading) % 256, two hex digits
//                            = { w: { "<word>\t<hira>": accent }, r: { "<hira>": accent } }
//                            (hashed, not by first kana: し alone was 320 KB)
//   kanji/info/n1..n5.json   char → { jlpt, strokes, grade, on[], kun[], meanings[] }
//   kanji/strokes/<nn>.json  codepoint % 64 bucket (two digits)
//                            = char → { strokes: [pathD…], components: [{ el, isRadical }] }

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export const STROKE_BUCKETS = 64;
export const PITCH_BUCKETS = 256;

/** 32-bit FNV-1a over UTF-16 code units. Mirrored in src/lib/pitch.ts. */
export function fnv1a(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

export const pitchShardKey = (hira) =>
  (fnv1a(hira) % PITCH_BUCKETS).toString(16).padStart(2, "0");
export const strokeBucket = (ch) =>
  String(ch.codePointAt(0) % STROKE_BUCKETS).padStart(2, "0");

async function writeJson(file, data) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(data) + "\n");
}

/** byWord: { "<word>\t<hira>": accent }, byReading: { "<hira>": accent } */
export async function writePitchShards(outDir, byWord, byReading) {
  const shards = new Map();
  const shard = (hira) => {
    const k = pitchShardKey(hira);
    if (!shards.has(k)) shards.set(k, { w: {}, r: {} });
    return shards.get(k);
  };
  for (const [key, accent] of Object.entries(byWord)) {
    const hira = key.split("\t")[1];
    if (hira) shard(hira).w[key] = accent;
  }
  for (const [hira, accent] of Object.entries(byReading)) {
    if (hira) shard(hira).r[hira] = accent;
  }
  for (const [k, data] of shards) {
    await writeJson(path.join(outDir, `${k}.json`), data);
  }
  return shards.size;
}

/** info: { N5: { char: info }, … }, strokes: { char: { strokes, components } } */
export async function writeKanjiShards(outDir, infoByLevel, strokes) {
  for (const [level, info] of Object.entries(infoByLevel)) {
    await writeJson(path.join(outDir, "info", `${level.toLowerCase()}.json`), info);
  }
  const buckets = new Map();
  for (const [ch, s] of Object.entries(strokes)) {
    const b = strokeBucket(ch);
    if (!buckets.has(b)) buckets.set(b, {});
    buckets.get(b)[ch] = s;
  }
  for (const [b, data] of buckets) {
    await writeJson(path.join(outDir, "strokes", `${b}.json`), data);
  }
  return buckets.size;
}
