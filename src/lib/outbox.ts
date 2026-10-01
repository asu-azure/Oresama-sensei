// Grades are written through a small persistent outbox instead of a bare fetch.
//
// The card has already moved on by the time a write lands, so a failed request
// used to lose that review silently (a flaky train connection was enough). Now
// every grade is appended to localStorage first and flushed in order; a network
// failure keeps it for the next flush (next grade, coming back online, or the
// next page load). A rejection from PostgREST itself (has an error code) is not
// retried — it would fail the same way forever.
//
// Two tabs must never flush the same entry twice: flushing runs under a Web
// Lock where the browser has them.

import { sb } from "./supabase";
import type { SrsUpdate } from "./srs";

const KEY = "oresama:outbox:v1";

export type GradeOp = {
  /** Client-generated id, so a retried entry can be recognised. */
  op: string;
  itemId: string;
  update: SrsUpdate & { last_seen: string };
  /** review_log row (best-effort history). */
  log: Record<string, unknown>;
  /** Set once the item update has landed, so a retry only redoes the log. */
  updated?: boolean;
};

function read(): GradeOp[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function write(ops: GradeOp[]) {
  try {
    if (ops.length) localStorage.setItem(KEY, JSON.stringify(ops));
    else localStorage.removeItem(KEY);
  } catch {}
}

export function pendingCount(): number {
  return read().length;
}

/** Items whose grade hasn't reached the database yet. A fresh queue must skip
 *  them: their srs_due there is still the old one. */
export function pendingItemIds(): Set<string> {
  return new Set(read().filter((o) => !o.updated).map((o) => o.itemId));
}

/** Network failure (no PostgREST code) → worth retrying. */
const retryable = (e: { code?: string } | null) => !!e && !e.code;

let running: Promise<void> | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;

/** Returns true when it stopped on a network failure (entries remain). */
async function flushNow(): Promise<boolean> {
  const client = sb();
  for (;;) {
    const op = read()[0];
    if (!op) return false;
    if (!op.updated) {
      const { error } = await client.from("knowledge_items").update(op.update).eq("id", op.itemId);
      if (retryable(error)) return true; // offline: keep it, stop here
      if (error) console.error("grade update rejected", error);
      // Re-read: a grade may have been queued while the request was in flight,
      // and writing back the stale array would drop it.
      const now = read();
      const mine = now.find((o) => o.op === op.op);
      if (mine) mine.updated = true;
      write(now);
    }
    const { error } = await client.from("review_log").insert(op.log);
    if (retryable(error)) return true;
    if (error) console.error("review_log insert rejected", error);
    write(read().filter((o) => o.op !== op.op));
  }
}

/** Push every pending grade, oldest first. Resolves when done (or when the
 *  network gives out — the rest stays queued). Safe to call often. */
export function flush(): Promise<void> {
  running ??= (async () => {
    let stalled = false;
    try {
      const locks = (navigator as Navigator & { locks?: LockManager }).locks;
      stalled = locks ? await locks.request("oresama-outbox", flushNow) : await flushNow();
    } catch (e) {
      console.error("outbox flush failed", e);
      stalled = true;
    } finally {
      running = null;
    }
    // Something queued after the loop's last read, or the network gave out:
    // go again now, or try again in a little while.
    if (read().length) {
      if (!stalled) void flush();
      else {
        if (retryTimer) clearTimeout(retryTimer);
        retryTimer = setTimeout(() => void flush(), 15_000);
      }
    }
  })();
  return running;
}

export function enqueue(op: Omit<GradeOp, "op">) {
  write([...read(), { ...op, op: crypto.randomUUID() }]);
  void flush();
}

if (typeof window !== "undefined") {
  window.addEventListener("online", () => void flush());
}
