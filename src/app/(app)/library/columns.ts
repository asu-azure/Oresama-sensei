// Columns fetched for every library item, shared by the initial server fetch
// (page.tsx) and the lazy-loaded pages (actions.ts) so they stay in sync.
// Kept out of actions.ts because a "use server" module may only export async
// functions.
export const LIBRARY_COLS =
  "id,type,term,reading,meaning,example,jlpt_level,srs_reps,srs_interval,srs_lapses,srs_stability,srs_difficulty,srs_due,times_seen,last_seen,created_at,source_type,collection_id,collections(title,kind)";
