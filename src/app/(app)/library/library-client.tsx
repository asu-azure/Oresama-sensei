"use client";

import { useMemo, useState } from "react";
import { Search, Library as LibraryIcon } from "lucide-react";
import {
  masteryLevel,
  masteryInfo,
  MASTERY_ORDER,
  type MasteryLevel,
} from "@/lib/mastery";
import { cn } from "@/lib/utils";

export type LibraryItem = {
  id: string;
  type: string;
  term: string;
  reading: string | null;
  meaning: string | null;
  example: string | null;
  jlpt_level: string | null;
  srs_reps: number | null;
  srs_interval: number | null;
  srs_ease: number | null;
  srs_lapses: number | null;
  srs_due: string | null;
  times_seen: number | null;
  last_seen: string;
};

const TYPES = ["all", "vocab", "grammar", "expression"];

export function LibraryClient({ items }: { items: LibraryItem[] }) {
  const [q, setQ] = useState("");
  const [type, setType] = useState("all");
  const [jlpt, setJlpt] = useState("all");
  const [mastery, setMastery] = useState<MasteryLevel | "all">("all");

  const jlptLevels = useMemo(() => {
    const s = new Set<string>();
    for (const it of items) if (it.jlpt_level) s.add(it.jlpt_level);
    return ["all", ...Array.from(s).sort()];
  }, [items]);

  const withMastery = useMemo(
    () => items.map((it) => ({ it, m: masteryLevel(it) })),
    [items],
  );

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const { m } of withMastery) c[m.level] = (c[m.level] ?? 0) + 1;
    return c;
  }, [withMastery]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return withMastery.filter(({ it, m }) => {
      if (type !== "all" && it.type !== type) return false;
      if (jlpt !== "all" && it.jlpt_level !== jlpt) return false;
      if (mastery !== "all" && m.level !== mastery) return false;
      if (needle) {
        const hay = `${it.term} ${it.reading ?? ""} ${
          it.meaning ?? ""
        }`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [withMastery, q, type, jlpt, mastery]);

  if (items.length === 0) {
    return (
      <div className="py-16 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <LibraryIcon className="h-6 w-6" />
        </div>
        <h1 className="text-xl font-semibold">Your vocab library is empty</h1>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
          Chat with the tutor or make a lesson from a photo. Everything you learn
          is saved here and color-coded by how well you have practiced it.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5 py-4">
      <div>
        <h1 className="text-2xl font-bold">Vocab &amp; grammar</h1>
        <p className="mt-1 text-sm text-muted">
          {items.length} saved {items.length === 1 ? "item" : "items"}, colored
          by how well you have practiced them.
        </p>
      </div>

      {/* Mastery legend doubles as a filter */}
      <div className="flex flex-wrap gap-2">
        {MASTERY_ORDER.map((lvl) => {
          const info = masteryInfo(lvl);
          const active = mastery === lvl;
          return (
            <button
              key={lvl}
              onClick={() => setMastery(active ? "all" : lvl)}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                active ? info.chip : "border-border bg-surface text-muted hover:bg-surface-2",
              )}
            >
              <span className={cn("h-2 w-2 rounded-full", info.dot)} />
              {info.label}
              <span className="opacity-60">{counts[lvl] ?? 0}</span>
            </button>
          );
        })}
      </div>

      {/* Search + filters */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search term, reading, or meaning…"
            className="w-full rounded-xl border border-border bg-surface py-2.5 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {TYPES.map((t) => (
            <FilterChip key={t} active={type === t} onClick={() => setType(t)}>
              {t}
            </FilterChip>
          ))}
          <span className="mx-1 w-px self-stretch bg-border" />
          {jlptLevels.map((l) => (
            <FilterChip key={l} active={jlpt === l} onClick={() => setJlpt(l)}>
              {l === "all" ? "all JLPT" : l}
            </FilterChip>
          ))}
        </div>
      </div>

      <p className="text-xs text-muted">
        Showing {filtered.length} of {items.length}
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        {filtered.map(({ it, m }) => (
          <div
            key={it.id}
            className={cn(
              "rounded-2xl border bg-surface p-4",
              m.ring,
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-jp text-lg font-semibold leading-tight">
                  {it.term}
                </p>
                {it.reading && (
                  <p className="font-jp text-sm text-muted">{it.reading}</p>
                )}
              </div>
              <span
                className={cn(
                  "flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
                  m.chip,
                )}
              >
                <span className={cn("h-1.5 w-1.5 rounded-full", m.dot)} />
                {m.label}
              </span>
            </div>

            {it.meaning && <p className="mt-2 text-sm">{it.meaning}</p>}
            {it.example && (
              <p className="mt-1 font-jp text-xs text-muted">{it.example}</p>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px]">
              <span className="rounded-full bg-surface-2 px-2 py-0.5 text-muted">
                {it.type}
              </span>
              {it.jlpt_level && (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary">
                  {it.jlpt_level}
                </span>
              )}
              {(it.times_seen ?? 0) > 1 && (
                <span className="text-muted">seen {it.times_seen}x</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="py-10 text-center text-sm text-muted">
          No items match these filters.
        </p>
      )}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-medium capitalize transition-colors",
        active
          ? "border-primary bg-primary/10 text-primary"
          : "border-border bg-surface text-muted hover:bg-surface-2",
      )}
    >
      {children}
    </button>
  );
}