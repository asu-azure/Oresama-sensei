"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  LEVELS,
  kanjiList,
  levelOf,
  uniqueKanji,
  loadInfo,
  type Level,
  type KanjiInfo,
} from "@/lib/kanji";

export function KanjiBrowser({ seen }: { seen: string[] }) {
  const seenSet = useMemo(() => new Set(seen), [seen]);
  const [level, setLevel] = useState<Level>("N5");
  const [q, setQ] = useState("");
  // Info for the active level (lazy) — used for English/reading search + tooltips.
  const [info, setInfo] = useState<{ level: Level; data: Record<string, KanjiInfo> } | null>(
    null,
  );

  useEffect(() => {
    let alive = true;
    loadInfo(level).then((data) => {
      if (alive) setInfo({ level, data });
    });
    return () => {
      alive = false;
    };
  }, [level]);

  const ready = info && info.level === level ? info.data : null;

  const list = useMemo(() => {
    const query = q.trim();
    if (!query) return kanjiList(level);
    // Pasted kanji → jump to them across any level.
    const ks = uniqueKanji(query).filter((k) => levelOf(k));
    if (ks.length) return ks;
    // Otherwise filter the current level by meaning / reading.
    if (!ready) return [];
    const needle = query.toLowerCase();
    return kanjiList(level).filter((ch) => {
      const i = ready[ch];
      if (!i) return false;
      return (
        i.meanings.some((m) => m.toLowerCase().includes(needle)) ||
        i.on.some((r) => r.includes(query)) ||
        i.kun.some((r) => r.includes(query))
      );
    });
  }, [q, level, ready]);

  return (
    <div className="space-y-5 py-4">
      <div>
        <h1 className="text-2xl font-bold">Kanji</h1>
        <p className="mt-1 text-sm text-muted">
          Stroke order, readings, and the parts each kanji is built from. Ones
          you&apos;ve already met are marked.
        </p>
      </div>

      {/* Level tabs */}
      <div className="flex flex-wrap gap-2">
        {LEVELS.map((lv) => (
          <button
            key={lv}
            onClick={() => setLevel(lv)}
            className={cn(
              "rounded-full border px-3 py-1 text-sm font-medium transition-colors",
              level === lv
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-surface text-muted hover:bg-surface-2",
            )}
          >
            {lv}
            <span className="ml-1.5 text-xs opacity-60">
              {kanjiList(lv).length}
            </span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Paste a kanji, or search by meaning / reading…"
          className="w-full rounded-xl border border-border bg-surface py-2.5 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <p className="text-xs text-muted">{list.length} kanji</p>

      <div className="grid grid-cols-6 gap-2 sm:grid-cols-8">
        {list.map((ch) => (
          <Link
            key={ch}
            href={`/kanji/${encodeURIComponent(ch)}`}
            title={ready?.[ch]?.meanings.slice(0, 3).join(", ")}
            className={cn(
              "relative flex aspect-square items-center justify-center rounded-xl border bg-surface font-jp text-2xl transition-colors hover:bg-surface-2",
              seenSet.has(ch) ? "border-primary/50" : "border-border",
            )}
          >
            {ch}
            {seenSet.has(ch) && (
              <span
                className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-primary"
                title="In your saved words"
              />
            )}
          </Link>
        ))}
      </div>

      {list.length === 0 && (
        <p className="py-8 text-center text-sm text-muted">No kanji match.</p>
      )}

      <p className="pt-2 text-center text-[11px] text-muted">
        Stroke &amp; component data:{" "}
        <a
          href="https://kanjivg.tagaini.net/"
          className="underline"
          target="_blank"
          rel="noreferrer"
        >
          KanjiVG
        </a>{" "}
        (CC BY-SA 3.0) · readings/meanings:{" "}
        <a
          href="https://github.com/davidluzgouveia/kanji-data"
          className="underline"
          target="_blank"
          rel="noreferrer"
        >
          kanji-data
        </a>{" "}
        (MIT).
      </p>
    </div>
  );
}
