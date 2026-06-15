"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { LayoutGrid, Workflow, RefreshCw, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, formatDate } from "@/lib/utils";
import { showReading } from "@/lib/furigana";
import type { MapData } from "@/lib/types";

export type MapItem = {
  id: string;
  type: string;
  term: string;
  reading: string | null;
  meaning: string | null;
  jlpt_level: string | null;
};

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

export function MapClient({
  initialData,
  generatedCount,
  generatedAt,
  totalItems,
  items,
}: {
  initialData: MapData | null;
  generatedCount: number | null;
  generatedAt: string | null;
  totalItems: number;
  items: MapItem[];
}) {
  const [data, setData] = useState<MapData | null>(initialData);
  const [view, setView] = useState<"board" | "graph">("board");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const itemsById = useMemo(() => {
    const m = new Map<string, MapItem>();
    for (const it of items) m.set(it.id, it);
    return m;
  }, [items]);

  const stale = generatedCount !== null && generatedCount !== totalItems;

  async function regenerate() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/map", { method: "POST" });
      if (!res.ok) throw new Error(await res.text().catch(() => "Failed."));
      const json = (await res.json()) as { data: MapData };
      setData(json.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  // Build graph nodes/edges with a simple clustered layout.
  const { nodes, edges } = useMemo<{ nodes: Node[]; edges: Edge[] }>(() => {
    if (!data) return { nodes: [], edges: [] };
    const nodes: Node[] = [];
    const cols = Math.max(1, Math.ceil(Math.sqrt(data.groups.length)));
    const cellW = 420;
    const cellH = 380;

    data.groups.forEach((g, gi) => {
      const color = COLORS[gi % COLORS.length];
      const cx = (gi % cols) * cellW + 200;
      const cy = Math.floor(gi / cols) * cellH + 160;

      nodes.push({
        id: `group-${g.id}`,
        position: { x: cx - 80, y: cy - 150 },
        data: { label: g.label },
        draggable: false,
        selectable: false,
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
      g.item_ids.forEach((id, idx) => {
        const it = itemsById.get(id);
        if (!it) return;
        const angle = (2 * Math.PI * idx) / Math.max(1, n) - Math.PI / 2;
        const radius = n <= 1 ? 0 : 120;
        nodes.push({
          id,
          position: {
            x: cx + radius * Math.cos(angle) - 70,
            y: cy + radius * Math.sin(angle),
          },
          data: { label: showReading(it.term, it.reading) ? `${it.term}\n${it.reading}` : it.term },
          style: {
            background: "var(--surface, #fff)",
            color: "var(--foreground, #111)",
            border: `2px solid ${color}`,
            borderRadius: 10,
            fontSize: 12,
            padding: "6px 8px",
            width: 140,
            whiteSpace: "pre-line",
            textAlign: "center",
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
        style: { stroke: "var(--border, #ccc)" },
      }));

    return { nodes, edges };
  }, [data, itemsById]);

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

  return (
    <div className="py-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Knowledge Map</h1>
          <p className="text-sm text-muted">
            {totalItems} saved items
            {generatedAt && ` · mapped ${formatDate(generatedAt)}`}
            {stale && " · new items since — regenerate to include them"}
          </p>
        </div>
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
          <Button onClick={regenerate} disabled={busy} variant="outline">
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            {data ? "Regenerate" : "Generate map"}
          </Button>
        </div>
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
                <ul className="mt-3 space-y-1.5">
                  {g.item_ids.map((id) => {
                    const it = itemsById.get(id);
                    if (!it) return null;
                    return (
                      <li key={id} className="text-sm">
                        <Term term={it.term} reading={it.reading} />
                        {it.meaning && (
                          <span className="text-muted"> — {it.meaning}</span>
                        )}
                        {it.jlpt_level && (
                          <span className="ml-1 text-xs text-primary">
                            {it.jlpt_level}
                          </span>
                        )}
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
      {data && view === "graph" && mounted && (
        <div className="h-[70dvh] overflow-hidden rounded-2xl border border-border bg-surface">
          <ReactFlow nodes={nodes} edges={edges} fitView minZoom={0.2}>
            <Background />
            <Controls />
          </ReactFlow>
        </div>
      )}
    </div>
  );
}
