import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';

// Publishable key only — RLS is the security boundary (see CLAUDE.md). Either
// env naming works: NEXT_PUBLIC_* is what the Vercel project already had.
export const SUPABASE_URL =
  import.meta.env.PUBLIC_SUPABASE_URL ?? import.meta.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_KEY =
  import.meta.env.PUBLIC_SUPABASE_ANON_KEY ??
  import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  '';

let client: SupabaseClient | null = null;

/** The browser client, created on first use (never at import time, so nothing
 *  touches localStorage while Astro prerenders a page). */
export function sb(): SupabaseClient {
  client ??= createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  });
  return client;
}

let userPromise: Promise<User> | null = null;

/** The signed-in user, or a redirect to /login. Every island starts here. The
 *  inline guard in Base.astro has usually redirected before this runs; this
 *  catches an expired session that could not be refreshed. */
export function requireUser(): Promise<User> {
  userPromise ??= sb()
    .auth.getSession()
    .then(({ data }) => {
      const user = data.session?.user;
      if (!user) {
        const next = location.pathname + location.search;
        location.replace(`/login?next=${encodeURIComponent(next)}`);
        return new Promise<User>(() => {}); // the page is going away
      }
      return user;
    });
  return userPromise;
}

/** fetch() to this app's own /api routes with the session's access token. The
 *  server verifies it with Supabase and acts as the user under RLS. */
export async function api(path: string, init: RequestInit = {}): Promise<Response> {
  const { data } = await sb().auth.getSession();
  const headers = new Headers(init.headers);
  if (data.session) headers.set('Authorization', `Bearer ${data.session.access_token}`);
  if (init.body && typeof init.body === 'string') headers.set('Content-Type', 'application/json');
  return fetch(path, { ...init, headers });
}

const PAGE = 1000;

/** Every row of a query, paging past PostgREST's 1000-row cap. `build` must
 *  apply a STABLE order (add `id` as a tiebreaker on non-unique sorts). */
export async function fetchAllRows<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const all: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE) break;
  }
  return all;
}
