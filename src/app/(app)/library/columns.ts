// Columns fetched for every library item, shared by the initial server fetch
// (page.tsx) and the lazy-loaded pages (actions.ts) so they stay in sync.
// Kept out of actions.ts because a "use server" module may only export async
// functions.
export const LIBRARY_COLS =
  "id,type,term,reading,meaning,example,jlpt_level,image_path,srs_reps,srs_interval,srs_lapses,srs_stability,srs_difficulty,srs_due,times_seen,last_seen,created_at,source_type,collection_id,lesson_id,collections(title,kind)";

/** The same list plus `srs_suspended` (migration 0024). Naming a column that
 *  doesn't exist makes PostgREST fail the whole query, so callers must pick the
 *  variant based on `hasSuspendColumn()` rather than always asking for it. */
export function libraryCols(canPark: boolean): string {
  return canPark ? `${LIBRARY_COLS},srs_suspended` : LIBRARY_COLS;
}
