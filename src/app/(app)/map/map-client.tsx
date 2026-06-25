"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
  type NodeMouseHandler,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  LayoutGrid,
  Workflow,
  RefreshCw,
  Loader2,
  Sparkles,
  X,
  Dumbbell,
  BookOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeading } from "@/components/motion/page-heading";
import { CostHint, MODEL_LABELS } from "@/components/cost-hint";
import { cn, formatDate } from "@/lib/utils";
import { showReading } from "@/lib/furigana";
import { sourceMeta } from "@/lib/source";
import type { MapData, MapScope } from "@/lib/types";
import {
  saveMapPositions,
  findLessonsForTerm,
  type LessonHit,
} from "./actions";

export type MapItem = {
  id: string;
  type: string;
  term: string;
  reading: string | null;
  meaning: string | null;
  example: string | null;
  jlpt_level: string | null;
  source_type: string | null;
  collection_id: string | null;
};

/** Normalize a messy jlpt_level ("N2/N1") to its highest single level. */
function primaryLevel(raw: string | null): string | null {
  const m = (raw ?? "").toUpperCase().match(/N[1-5]/g);
  if (!m) return null;
  return m.sort((a, b) => Number(a[1]) - Number(b[1]))[0];
}

/** Encode a scope as a "type:value" key (matches the <select> option values). */
function scopeToKey(s?: MapScope): string {
  if (!s || s.type === "all") return "all";
  return `${s.type}:${s.value ?? ""}`;
}

/** A search predicate over term/reading/meaning. Empty query → matches all. */
function makeMatch(q: string): (it: MapItem) => boolean {
  const t = q.trim().toLowerCase();
  if (!t) return () => true;
  return (it) =>
    it.term.toLowerCase().includes(t) ||
    (it.reading?.toLowerCase().includes(t) ?? false) ||
    (it.meaning?.toLowerCase().includes(t) ?? false);
}

const COLORS = [
  "#6366f1", "#e11d48", "#0891b2", "#16a34a", "#d97706",
  "#9333ea", "#db2777", "#0d9488", "#ca8a04", "#2563eb",
];

function Term({ term, reading }: { term: string; reading: string | null }) {
  if (showReading(term, reading)) {
    return (
      <ruby className="font-jp">
        {term}
        <rt>{reading}</rt>
      </ruby>
    );
  }
  return <span className="font-jp">{term}</span>;
}

/** Build React Flow nodes/edges from the generated map. Clusters items in a
 *  ring around each group label; ring size and grid spacing scale with the
 *  number of items so dense groups don't pile up. Honors any manually-dragged
 *  positions stored on `data.positions`. */
function buildGraph(
  data: MapData | null,
  itemsById: Map<string, MapItem>,
  match: (it: MapItem) => boolean = () => true,
): { nodes: Node[]; edges: Edge[] } {
  if (!data) return { nodes: [], edges: [] };
  const pos = data.positions ?? {};
  const dimmed = new Set<string>();

  const radii = data.groups.map((g) => Math.max(150, 26 * g.item_ids.length));
  const maxRadius = Math.max(150, ...radii);
  const cell = 2 * maxRadius + 140;
  const cols = Math.max(1, Math.ceil(Math.sqrt(data.groups.length)));

  const nodes: Node[] = [];

  data.groups.forEach((g, gi) => {
    const color = COLORS[gi % COLORS.length];
    const cx = (gi % cols) * cell + cell / 2;
    const cy = Math.floor(gi / cols) * cell + cell / 2;

    const gid = `group-${g.id}`;
    nodes.push({
      id: gid,
      position: pos[gid] ?? { x: cx - 100, y: cy - radii[gi] - 70 },
      data: { label: g.label },
      style: {
        background: color,
        color: "#fff",
        border: "none",
        borderRadius: 10,
        fontWeight: 600,
        fontSize: 13,
        padding: "6px 10px",
        width: 200,
        textAlign: "center",
      },
    });

    const n = g.item_ids.length;
    const r = n <= 1 ? 0 : radii[gi];
    g.item_ids.forEach((id, idx) => {
      const it = itemsById.get(id);
      if (!it) return;
      const isMatch = match(it);
      if (!isMatch) dimmed.add(id);
      const angle = (2 * Math.PI * idx) / Math.max(1, n) - Math.PI / 2;
      nodes.push({
        id,
        position: pos[id] ?? {
          x: cx + r * Math.cos(angle) - 70,
          y: cy + r * Math.sin(angle) - 20,
        },
        data: {
          label: showReading(it.term, it.reading)
            ? `${it.term}\n${it.reading}`
            : it.term,
        },
        style: {
          background: "var(--surface, #fff)",
          color: "var(--foreground, #111)",
          border: `2px solid ${color}`,
          borderRadius: 10,
          fontSize: 12,
          padding: "6px 10px",
          maxWidth: 180,
          whiteSpace: "pre-line",
          textAlign: "center",
          cursor: "pointer",
          opacity: isMatch ? 1 : 0.12,
        },
      });
    });
  });

  const present = new Set(nodes.map((nd) => nd.id));
  const edges: Edge[] = data.edges
    .filter((e) => present.has(e.source) && present.has(e.target))
    .map((e, i) => ({
      id: `e${i}`,
      source: e.source,
      target: e.target,
      label: e.relation,
      labelStyle: { fontSize: 10, fill: "var(--muted, #666)" },
      style: {
        stroke: "var(--border, #ccc)",
        opacity: dimmed.has(e.source) || dimmed.has(e.target) ? 0.1 : 1,
      },
    }));

  return { nodes, edges };
}

export function MapClient({
  initialData,
  generatedCount,
  generatedAt,
  totalItems,
  items,
  collections,
}: {
  initialData: MapData | null;
  generatedCount: number | null;
  generatedAt: string | null;
  totalItems: number;
  items: MapItem[];
  collections: { id: string; title: string }[];
}) {
  const [data, setData] = useState<MapData | null>(initialData);
  const [view, setView] = useState<"board" | "graph">("board");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Bumped only on regenerate, to remount React Flow with a fresh layout.
  const [version, setVersion] = useState(0);

  // What subset to (re)generate the map from.
  const [scope, setScope] = useState<MapScope>(
    initialData?.scope ?? { type: "all" },
  );
  // Search overlay: `query` is live (board); `appliedQuery` is debounced and
  // drives the graph (so typing doesn't remount React Flow every keystroke).
  const [query, setQuery] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const qTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onQuery = useCallback((v: string) => {
    setQuery(v);
    if (qTimer.current) clearTimeout(qTimer.current);
    qTimer.current = setTimeout(() => setAppliedQuery(v), 300);
  }, []);
  const match = useMemo(() => makeMatch(query), [query]);

  // Scope options derived from the user's items (only show levels/sources/books
  // that actually have items).
  const scopeOptions = useMemo(() => {
    const collTitle = new Map(collections.map((c) => [c.id, c.title]));
    const books = new Map<string, string>();
    const levels = new Set<string>();
    const sources = new Set<string>();
    for (const it of items) {
      if (it.collection_id && collTitle.has(it.collection_id))
        books.set(it.collection_id, collTitle.get(it.collection_id)!);
      const lv = primaryLevel(it.jlpt_level);
      if (lv) levels.add(lv);
      if (it.source_type) sources.add(it.source_type);
    }
    return {
      books: [...books.entries()].map(([id, title]) => ({ id, title })),
      levels: [...levels].sort(),
      sources: [...sources].sort(),
    };
  }, [items, collections]);

  // Encode/decode the scope as a "type:value" string for the <select>.
  const scopeKey =
    scope.type === "all" ? "all" : `${scope.type}:${scope.value ?? ""}`;
  function pickScope(key: string) {
    if (key === "all") return setScope({ type: "all" });
    const idx = key.indexOf(":");
    const type = key.slice(0, idx);
    const value = key.slice(idx + 1);
    let label = value;
    if (type === "collection")
      label = scopeOptions.books.find((b) => b.id === value)?.title ?? value;
    else if (type === "source") label = sourceMeta(value).label;
    setScope({ type: type as MapScope["type"], value, label });
  }

  // Selected item detail panel + its "lessons mentioning this" results.
  const [selected, setSelected] = useState<MapItem | null>(null);
  const [lessons, setLessons] = useState<LessonHit[] | null>(null);
  const [lessonsLoading, setLessonsLoading] = useState(false);
  const lessonReq = useRef(0);

  const itemsById = useMemo(() => {
    const m = new Map<string, MapItem>();
    for (const it of items) m.set(it.id, it);
    return m;
  }, [items]);

  const graphMatch = useMemo(() => makeMatch(appliedQuery), [appliedQuery]);
  const { nodes, edges } = useMemo(
    () => buildGraph(data, itemsById, graphMatch),
    [data, itemsById, graphMatch],
  );

  // Live snapshot of node positions, kept in sync with the latest layout and
  // updated as nodes are dragged. Seeded (not setState) so no render churn.
  const positionsRef = useRef<Record<string, { x: number; y: number }>>({});
  useEffect(() => {
    positionsRef.current = Object.fromEntries(
      nodes.map((n) => [n.id, n.position]),
    );
  }, [nodes]);

  // Debounced persistence of dragged positions.
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleSave = useCallback(
    (positions: Record<string, { x: number; y: number }>) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        saveMapPositions(positions);
      }, 800);
    },
    [],
  );
  useEffect(
    () => () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    },
    [],
  );

  const onNodeDragStop = useCallback(
    (_: unknown, node: Node) => {
      const next = { ...positionsRef.current, [node.id]: node.position };
      positionsRef.current = next;
      // Keep local data in sync so toggling Board<->Graph preserves the layout.
      setData((prev) => (prev ? { ...prev, positions: next } : prev));
      scheduleSave(next);
    },
    [scheduleSave],
  );

  const openItem = useCallback((it: MapItem) => {
    const req = ++lessonReq.current;
    setSelected(it);
    setLessons(null);
    setLessonsLoading(true);
    findLessonsForTerm(it.term)
      .then((res) => {
        if (lessonReq.current === req) {
          setLessons(res);
          setLessonsLoading(false);
        }
      })
      .catch(() => {
        if (lessonReq.current === req) {
          setLessons([]);
          setLessonsLoading(false);
        }
      });
  }, []);

  const onNodeClick: NodeMouseHandler = useCallback(
    (_, node) => {
      const it = itemsById.get(node.id);
      if (it) openItem(it);
    },
    [itemsById, openItem],
  );

  async function regenerate() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/map", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope }),
      });
      if (!res.ok) throw new Error(await res.text().catch(() => "Failed."));
      const json = (await res.json()) as { data: MapData; empty?: boolean };
      setData(json.empty ? null : json.data);
      setVersion((v) => v + 1);
      if (json.empty) setError("No items in that scope yet.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  // Clean up the debounce timer on unmount.
  useEffect(
    () => () => {
      if (qTimer.current) clearTimeout(qTimer.current);
    },
    [],
  );

  // --- Empty states ---
  if (totalItems === 0) {
    return (
      <div className="py-16 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Sparkles className="h-6 w-6" />
        </div>
        <h1 className="text-xl font-semibold">Your map is empty (for now)</h1>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
          As you chat and turn photos into lessons, saved vocabulary, grammar,
          and expressions collect here — then I&apos;ll organize them into a map.
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <Link href="/chat">
            <Button>Start a chat</Button>
          </Link>
          <Link href="/lessons">
            <Button variant="outline">Upload a page</Button>
          </Link>
        </div>
      </div>
    );
  }

  const stale = generatedCount !== null && generatedCount !== totalItems;

  return (
    <div className="py-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <PageHeading
          className="m-0"
          kicker="CONNECTED — VECTOR-MINED"
          title="Knowledge Map"
          jp="知識マップ"
          subtitle={
            <>
              {data?.scope && data.scope.type !== "all"
                ? `Map of ${data.scope.label ?? data.scope.value}`
                : `${totalItems} saved items`}
              {generatedAt && ` · mapped ${formatDate(generatedAt)}`}
              {stale &&
                (!data?.scope || data.scope.type === "all") &&
                " · new items since — regenerate to include them"}
            </>
          }
        />
        <div className="flex items-center gap-2">
          {data && (
            <div className="flex rounded-lg border border-border p-0.5">
              <button
                onClick={() => setView("board")}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm",
                  view === "board" ? "bg-surface-2 font-medium" : "text-muted",
                )}
              >
                <LayoutGrid className="h-4 w-4" /> Board
              </button>
              <button
                onClick={() => setView("graph")}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm",
                  view === "graph" ? "bg-surface-2 font-medium" : "text-muted",
                )}
              >
                <Workflow className="h-4 w-4" /> Graph
              </button>
            </div>
          )}
          <div className="flex flex-col items-end gap-1">
            <Button onClick={regenerate} disabled={busy} variant="outline">
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              {data ? "Regenerate" : "Generate map"}
            </Button>
            <CostHint model={MODEL_LABELS.sonnet} />
          </div>
        </div>
      </div>

      {/* Scope picker + search overlay */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1.5 text-sm text-muted">
          Map of
          <select
            value={scopeKey}
            onChange={(e) => pickScope(e.target.value)}
            className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="all">All items</option>
            {scopeOptions.books.length > 0 && (
              <optgroup label="Book / series">
                {scopeOptions.books.map((b) => (
                  <option key={b.id} value={`collection:${b.id}`}>
                    {b.title}
                  </option>
                ))}
              </optgroup>
            )}
            {scopeOptions.levels.length > 0 && (
              <optgroup label="JLPT level">
                {scopeOptions.levels.map((lv) => (
                  <option key={lv} value={`level:${lv}`}>
                    {lv}
                  </option>
                ))}
              </optgroup>
            )}
            {scopeOptions.sources.length > 0 && (
              <optgroup label="Source">
                {scopeOptions.sources.map((s) => (
                  <option key={s} value={`source:${s}`}>
                    {sourceMeta(s).label}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </label>
        {scopeKey !== scopeToKey(data?.scope) && (
          <span className="text-xs text-muted">— regenerate to apply</span>
        )}
        {data && (
          <div className="relative ml-auto">
            <input
              value={query}
              onChange={(e) => onQuery(e.target.value)}
              placeholder="Search to highlight…"
              className="w-44 rounded-lg border border-border bg-surface py-1.5 pl-3 pr-7 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            {query && (
              <button
                onClick={() => onQuery("")}
                aria-label="Clear search"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {error && <p className="mb-3 text-sm text-accent">{error}</p>}

      {!data && !busy && (
        <div className="rounded-2xl border border-dashed border-border bg-surface p-10 text-center">
          <p className="text-sm text-muted">
            Generate a map to see your {totalItems} items grouped by theme with
            their relationships.
          </p>
        </div>
      )}

      {busy && !data && (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-surface p-10 text-sm text-muted">
          <Loader2 className="h-4 w-4 animate-spin" /> Organizing your items…
        </div>
      )}

      {/* Board view */}
      {data && view === "board" && (
        <div className="grid gap-4 sm:grid-cols-2">
          {data.groups.map((g, gi) => {
            const color = COLORS[gi % COLORS.length];
            // When searching, hide items (and whole groups) that don't match.
            const shownIds = g.item_ids.filter((id) => {
              const it = itemsById.get(id);
              return it && match(it);
            });
            if (query.trim() && shownIds.length === 0) return null;
            return (
              <div
                key={g.id}
                className="rounded-2xl border border-border bg-surface p-4"
                style={{ borderTopColor: color, borderTopWidth: 3 }}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <h2 className="font-semibold">{g.label}</h2>
                  <span className="text-xs text-muted">{g.theme}</span>
                </div>
                {g.register && (
                  <span className="mt-1 inline-block rounded-full bg-surface-2 px-2 py-0.5 text-xs text-muted">
                    {g.register}
                  </span>
                )}
                {g.note && <p className="mt-2 text-sm text-muted">{g.note}</p>}
                <ul className="mt-3 space-y-1">
                  {(query.trim() ? shownIds : g.item_ids).map((id) => {
                    const it = itemsById.get(id);
                    if (!it) return null;
                    return (
                      <li key={id}>
                        <button
                          onClick={() => openItem(it)}
                          className="-mx-2 flex w-full rounded-md px-2 py-1 text-left text-sm transition-colors hover:bg-surface-2"
                        >
                          <span>
                            <Term term={it.term} reading={it.reading} />
                            {it.meaning && (
                              <span className="text-muted"> — {it.meaning}</span>
                            )}
                            {it.jlpt_level && (
                              <span className="ml-1 text-xs text-primary">
                                {it.jlpt_level}
                              </span>
                            )}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      )}

      {/* Graph view */}
      {data && view === "graph" && (
        <div className="h-[70dvh] overflow-hidden rounded-2xl border border-border bg-surface">
          <ReactFlow
            key={`${version}:${appliedQuery}`}
            defaultNodes={nodes}
            defaultEdges={edges}
            onNodeClick={onNodeClick}
            onNodeDragStop={onNodeDragStop}
            fitView
            minZoom={0.2}
          >
            <Background />
            <Controls />
          </ReactFlow>
        </div>
      )}

      {/* Item detail panel (both views) */}
      {selected && (
        <div className="fixed inset-x-4 bottom-4 z-30 mx-auto max-w-sm rounded-2xl border border-border bg-surface p-4 shadow-xl sm:left-auto sm:right-6 sm:mx-0 sm:w-80">
          <button
            onClick={() => setSelected(null)}
            aria-label="Close"
            className="absolute right-3 top-3 rounded-md p-1 text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>

          <h3 className="pr-6 text-lg font-semibold leading-tight">
            <Term term={selected.term} reading={selected.reading} />
          </h3>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px]">
            <span className="rounded-full bg-surface-2 px-2 py-0.5 text-muted">
              {selected.type}
            </span>
            {selected.jlpt_level && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary">
                {selected.jlpt_level}
              </span>
            )}
          </div>
          {selected.meaning && <p className="mt-2 text-sm">{selected.meaning}</p>}
          {selected.example && (
            <p className="mt-1 font-jp text-xs text-muted">{selected.example}</p>
          )}

          <div className="mt-3">
            <Link href={`/review?item=${selected.id}`}>
              <Button size="sm" className="w-full">
                <Dumbbell className="h-4 w-4" /> Practice this
              </Button>
            </Link>
          </div>

          <div className="mt-3 border-t border-border pt-3">
            <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted">
              <BookOpen className="h-3.5 w-3.5" /> Lessons mentioning this
            </p>
            {lessonsLoading ? (
              <p className="flex items-center gap-1.5 text-xs text-muted">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> searching…
              </p>
            ) : lessons && lessons.length > 0 ? (
              <ul className="max-h-40 space-y-1 overflow-y-auto">
                {lessons.map((l) => (
                  <li key={l.id}>
                    <Link
                      href={`/lessons/${l.id}`}
                      className="block truncate rounded-md px-2 py-1 text-sm transition-colors hover:bg-surface-2"
                    >
                      {l.title || "Untitled lesson"}
                      <span className="ml-1 text-xs text-muted">
                        {formatDate(l.created_at)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted">No lessons mention this yet.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
