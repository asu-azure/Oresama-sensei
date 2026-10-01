// Every /api route acts AS the signed-in user: the browser sends its Supabase
// access token, we verify it with Supabase Auth, and all reads/writes go through
// a client carrying that token — so RLS applies exactly as in the browser.
// There is no service-role key anywhere in this project.

import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_KEY } from "../lib/supabase";

export type Authed = { user: User; db: SupabaseClient };

export async function authed(request: Request): Promise<Authed | Response> {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return new Response("Unauthorized", { status: 401 });
  const db = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) return new Response("Unauthorized", { status: 401 });
  return { user: data.user, db };
}

export const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

export async function readJson<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}
