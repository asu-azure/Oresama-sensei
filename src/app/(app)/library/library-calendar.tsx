"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

// GitHub-style contribution heat-map: one square per day, columns = weeks,
// rows = weekdays (Sun..Sat), tinted by how many items were added that day.
// Tapping a day with items filters the library list to that day.

const WEEKS = 53;
const DAY_MS = 86_400_000;

// Indigo ramp from empty -> most. Index by `level()` below.
const LEVELS = [
  "bg-surface-2",
  "bg-primary/30",
  "bg-primary/50",
  "bg-primary/75",
  "bg-primary",
];

type Cell = { key: string; count: number } | null;

export function LibraryCalendar({
  dayCounts,
  selectedDate,
  onSelect,
}: {
  dayCounts: Record<string, number>;
  selectedDate: string | null;
  onSelect: (day: string | null) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Default the strip scrolled to the most recent weeks (right edge).
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, []);

  const now = new Date();
  const todayUTC = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  const todayDow = new Date(todayUTC).getUTCDay();
  // Start at the Sunday of the week WEEKS-1 weeks ago.
  const startUTC = todayUTC - ((WEEKS - 1) * 7 + todayDow) * DAY_MS;

  const weeks: Cell[][] = [];
  let max = 1;
  for (let w = 0; w < WEEKS; w++) {
    const col: Cell[] = [];
    for (let d = 0; d < 7; d++) {
      const cellUTC = startUTC + (w * 7 + d) * DAY_MS;
      if (cellUTC > todayUTC) {
        col.push(null); // future day in the current week
        continue;
      }
      const key = new Date(cellUTC).toISOString().slice(0, 10);
      const count = dayCounts[key] ?? 0;
      if (count > max) max = count;
      col.push({ key, count });
    }
    weeks.push(col);
  }

  const level = (c: number) => (c === 0 ? 0 : Math.min(4, Math.ceil((c / max) * 4)));

  return (
    <div className="rounded-2xl border border-border bg-surface p-3">
      <div ref={scrollRef} className="no-scrollbar overflow-x-auto">
        <div className="flex gap-1">
          {weeks.map((col, wi) => (
            <div key={wi} className="flex flex-col gap-1">
              {col.map((cell, di) =>
                cell === null ? (
                  <div key={di} className="h-3 w-3" />
                ) : (
                  <button
                    key={di}
                    type="button"
                    disabled={cell.count === 0}
                    onClick={() =>
                      onSelect(selectedDate === cell.key ? null : cell.key)
                    }
                    title={`${cell.key} · ${cell.count} added`}
                    className={cn(
                      "h-3 w-3 rounded-sm transition-transform",
                      LEVELS[level(cell.count)],
                      cell.count > 0 && "cursor-pointer hover:scale-125",
                      selectedDate === cell.key &&
                        "ring-2 ring-ring ring-offset-1 ring-offset-surface",
                    )}
                  />
                ),
              )}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-2 flex items-center justify-end gap-1 text-[10px] text-muted">
        <span>less</span>
        {LEVELS.map((c, i) => (
          <span key={i} className={cn("h-3 w-3 rounded-sm", c)} />
        ))}
        <span>more</span>
      </div>
    </div>
  );
}
