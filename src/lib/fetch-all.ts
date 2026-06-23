const PAGE = 1000;

/** Fetch every row of a query, paging past PostgREST's default 1000-row cap.
 *  `build(from, to)` must return the Supabase query for that slice (caller keeps
 *  its own table/columns/filters). Use a STABLE .order() inside build so ranges
 *  don't overlap or skip (add `id` as a tiebreaker when the sort isn't unique). */
export async function fetchAllRows<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null }>,
): Promise<T[]> {
  const all: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data } = await build(from, from + PAGE - 1);
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE) break;
  }
  return all;
}
