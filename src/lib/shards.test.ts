// The build scripts and the browser must agree on which shard holds what, or a
// lookup silently fetches the wrong file and finds nothing.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import * as build from "../../scripts/lib/shards.mjs";
import { fnv1a, pitchShardKey, pitchPattern, accentType, splitMora } from "./pitch";
import { strokeBucket, kanjiList, LEVELS } from "./kanji";

const DATA = join(process.cwd(), "public", "data");

describe("pitch shards", () => {
  it("hashes exactly like the build script", () => {
    for (const s of ["", "はし", "きょう", "がっこう", "ー", "𠮷"]) {
      expect(fnv1a(s)).toBe(build.fnv1a(s));
      expect(pitchShardKey(s)).toBe(build.pitchShardKey(s));
    }
  });

  it("stores every reading in the shard the browser will fetch", () => {
    const files = readdirSync(join(DATA, "pitch")).filter((f) => f.endsWith(".json"));
    expect(files.length).toBeGreaterThan(200);
    for (const f of files.slice(0, 24)) {
      const shard = JSON.parse(readFileSync(join(DATA, "pitch", f), "utf8")) as {
        w: Record<string, number>;
        r: Record<string, number>;
      };
      const key = f.replace(".json", "");
      for (const word of Object.keys(shard.w).slice(0, 50)) {
        expect(pitchShardKey(word.split("\t")[1])).toBe(key);
      }
      for (const hira of Object.keys(shard.r).slice(0, 50)) {
        expect(pitchShardKey(hira)).toBe(key);
      }
    }
  });

  it("knows the classic はし minimal set", () => {
    const shard = JSON.parse(readFileSync(join(DATA, "pitch", `${pitchShardKey("はし")}.json`), "utf8"));
    expect(shard.w["箸\tはし"]).toBe(1);
    expect(shard.w["橋\tはし"]).toBe(2);
  });
});

describe("pitch patterns", () => {
  it("splits small kana onto the previous mora", () => {
    expect(splitMora("きょう")).toEqual(["きょ", "う"]);
    expect(splitMora("がっこう")).toEqual(["が", "っ", "こ", "う"]);
  });

  it("draws the four accent types", () => {
    // 箸 はし [1]: high-low
    expect(pitchPattern("はし", 1).map((m) => m.high)).toEqual([true, false]);
    expect(accentType("はし", 1)).toBe("atamadaka");
    // 橋 はし [2]: low-high, drop after the last mora
    expect(pitchPattern("はし", 2)).toEqual([
      { mora: "は", high: false, drop: false },
      { mora: "し", high: true, drop: true },
    ]);
    expect(accentType("はし", 2)).toBe("odaka");
    // 端 はし [0]: low-high, no drop
    expect(pitchPattern("はし", 0).some((m) => m.drop)).toBe(false);
    expect(accentType("はし", 0)).toBe("heiban");
    // 心 こころ [2]: low-high-low
    expect(pitchPattern("こころ", 2).map((m) => m.high)).toEqual([false, true, false]);
    expect(accentType("こころ", 2)).toBe("nakadaka");
  });
});

describe("kanji stroke shards", () => {
  it("buckets exactly like the build script", () => {
    for (const ch of ["日", "語", "俺", "鬱"]) expect(strokeBucket(ch)).toBe(build.strokeBucket(ch));
  });

  it("has strokes for every JLPT kanji in the bucket the browser will fetch", () => {
    const cache = new Map<string, Record<string, unknown>>();
    let missing = 0;
    for (const lvl of LEVELS) {
      for (const ch of kanjiList(lvl)) {
        const b = strokeBucket(ch);
        if (!cache.has(b)) cache.set(b, JSON.parse(readFileSync(join(DATA, "kanji", "strokes", `${b}.json`), "utf8")));
        if (!cache.get(b)![ch]) missing++;
      }
    }
    // KanjiVG lacks a handful of variants; anything more means a broken build.
    expect(missing).toBeLessThan(10);
  });
});
