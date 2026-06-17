// Deterministic "learner insights" derived purely from the live SRS state of a
// user's knowledge items. No extra storage, no LLM: because FSRS recomputes each
// item's stability/difficulty on every review, the strengths/weaknesses computed
// here are always current — a struggling item that improves drops out by itself.
//
// Used by the dashboard "Study next" widget and to feed a compact progress digest
// into the chat tutor's system prompt.

import { masteryLevel, type MasteryLevel } from "@/lib/mastery";

export interface InsightItem {
  type: string; // 'vocab' | 'grammar' | 'expression'
  jlpt_level: string | null;
  term: string;
  reading?: string | null;
  srs_reps?: number | null;
  srs_lapses?: number | null;
  srs_stability?: number | null;
  srs_difficulty?: number | null;
  srs_interval?: number | null;
  srs_due?: string | null;
  created_at?: string | null;
}

export type GroupStat = {
  key: string;
  label: string;
  total: number;
  tiers: Record<MasteryLevel, number>;
  masteredPct: number; // (young + mastered) / total, 0–100
};

export type WeakCluster = {
  key: string;
  label: string; // e.g. "N2 grammar"
  count: number;
  terms: string[]; // a few representative struggling terms
};

export type Priority = {
  kind: "due" | "struggling" | "new" | "weak";
  label: string;
  count: number;
  href: string;
};

export interface LearnerInsights {
  total: number;
  due: number;
  newCount: number;
  strugglingCount: number;
  byType: GroupStat[];
  byLevel: GroupStat[];
  weakClusters: WeakCluster[];
  priorities: Priority[];
  signature: string;
}

const TYPE_LABEL: Record<string, string> = {
  vocab: "Vocabulary",
  grammar: "Grammar",
  expression: "Expressions",
};

function emptyTiers(): Record<MasteryLevel, number> {
  return { new: 0, struggling: 0, learning: 0, young: 0, mastered: 0 };
}

function levelKey(jlpt: string | null | undefined): string {
  const lv = (jlpt ?? "").toUpperCase();
  return ["N1", "N2", "N3", "N4", "N5"].includes(lv) ? lv : "Other";
}

function groupStat(
  key: string,
  label: string,
  rows: { level: MasteryLevel }[],
): GroupStat {
  const tiers = emptyTiers();
  for (const r of rows) tiers[r.level] += 1;
  const total = rows.length;
  const strong = tiers.young + tiers.mastered;
  return {
    key,
    label,
    total,
    tiers,
    masteredPct: total ? Math.round((strong / total) * 100) : 0,
  };
}

// Small, stable string hash (djb2) so the coach-note cache can detect when the
// weakness picture has actually shifted.
function hash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (h * 33) ^ s.charCodeAt(i);
  return (h >>> 0).toString(36);
}

export function computeInsights(
  items: InsightItem[],
  now: Date = new Date(),
): LearnerInsights {
  const nowMs = now.getTime();

  // Annotate each item once with its live mastery tier.
  const tagged = items.map((it) => ({ it, level: masteryLevel(it).level }));

  const total = items.length;
  const due = items.filter(
    (i) => !i.srs_due || new Date(i.srs_due).getTime() <= nowMs,
  ).length;
  const newCount = tagged.filter((t) => t.level === "new").length;
  const struggling = tagged.filter((t) => t.level === "struggling");
  const strugglingCount = struggling.length;

  // Strength/weakness by type and by JLPT level.
  const byType: GroupStat[] = (["vocab", "grammar", "expression"] as const)
    .map((t) =>
      groupStat(
        t,
        TYPE_LABEL[t],
        tagged.filter((x) => x.it.type === t),
      ),
    )
    .filter((g) => g.total > 0);

  const byLevel: GroupStat[] = ["N1", "N2", "N3", "N4", "N5", "Other"]
    .map((lv) =>
      groupStat(
        lv,
        lv,
        tagged.filter((x) => levelKey(x.it.jlpt_level) === lv),
      ),
    )
    .filter((g) => g.total > 0);

  // Weak clusters: struggling items grouped by JLPT level + type.
  const clusterMap = new Map<string, InsightItem[]>();
  for (const { it } of struggling) {
    const key = `${levelKey(it.jlpt_level)} ${TYPE_LABEL[it.type] ?? it.type}`;
    const arr = clusterMap.get(key) ?? [];
    arr.push(it);
    clusterMap.set(key, arr);
  }
  const weakClusters: WeakCluster[] = [...clusterMap.entries()]
    .map(([label, arr]) => ({
      key: label,
      label,
      count: arr.length,
      terms: arr.slice(0, 4).map((i) => i.term),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 4);

  // Ranked, actionable "study next" priorities.
  const priorities: Priority[] = [];
  if (due > 0)
    priorities.push({
      kind: "due",
      label: "Review what's due",
      count: due,
      href: "/review",
    });
  if (strugglingCount > 0)
    priorities.push({
      kind: "struggling",
      label: "Drill your struggling items",
      count: strugglingCount,
      href: "/tests",
    });
  if (weakClusters[0])
    priorities.push({
      kind: "weak",
      label: `Focus on ${weakClusters[0].label}`,
      count: weakClusters[0].count,
      href: "/tests",
    });
  if (newCount > 0)
    priorities.push({
      kind: "new",
      label: "Lock in newly-learned items",
      count: newCount,
      href: "/tests",
    });

  // Signature: changes only when the weakness/strength picture materially shifts,
  // so the cached coach note regenerates then (and not on every page view).
  const sigParts = [
    `t${total}`,
    `d${Math.min(due, 99)}`,
    `s${strugglingCount}`,
    `n${newCount}`,
    ...byType.map((g) => `${g.key}:${g.masteredPct}`),
    ...byLevel.map((g) => `${g.key}:${g.masteredPct}`),
    ...weakClusters.map((c) => `${c.key}=${c.count}`),
  ];
  const signature = hash(sigParts.join("|"));

  return {
    total,
    due,
    newCount,
    strugglingCount,
    byType,
    byLevel,
    weakClusters,
    priorities,
    signature,
  };
}

/** Compact (<~250 token) text block summarizing strengths & weaknesses, for the
 *  chat tutor's system prompt and as input to the coach-note generator. */
export function statsDigest(ins: LearnerInsights): string {
  if (ins.total === 0) return "";
  const lines: string[] = [
    `Total saved items: ${ins.total}. Due now: ${ins.due}. New (not yet drilled): ${ins.newCount}. Struggling: ${ins.strugglingCount}.`,
  ];

  const fmt = (g: GroupStat) =>
    `${g.label} ${g.total} (${g.masteredPct}% solid${g.tiers.struggling ? `, ${g.tiers.struggling} struggling` : ""})`;
  if (ins.byType.length)
    lines.push(`By type: ${ins.byType.map(fmt).join("; ")}.`);
  if (ins.byLevel.length)
    lines.push(`By JLPT: ${ins.byLevel.map(fmt).join("; ")}.`);

  if (ins.weakClusters.length) {
    const wc = ins.weakClusters
      .map((c) => `${c.label} (${c.count}: ${c.terms.join("、")})`)
      .join("; ");
    lines.push(`Weakest areas: ${wc}.`);
  }
  return lines.join("\n");
}

/** Tailwind text-class for a mastered% (used by the dashboard read-out). */
export function strengthColor(pct: number): string {
  if (pct >= 70) return "text-emerald-600";
  if (pct >= 40) return "text-amber-600";
  return "text-accent";
}
