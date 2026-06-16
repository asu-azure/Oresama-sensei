import { createClient } from "@/lib/supabase/server";

/** Fetch a saved test to replay (free — no generation) and bump its usage. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { data } = await supabase
    .from("review_tests")
    .select("id,title,scope,meta,exercises,used_count")
    .eq("id", id)
    .maybeSingle();
  if (!data) return new Response("Not found", { status: 404 });

  await supabase
    .from("review_tests")
    .update({
      used_count: (data.used_count ?? 0) + 1,
      last_used_at: new Date().toISOString(),
    })
    .eq("id", id);

  return Response.json({ test: data });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  await supabase.from("review_tests").delete().eq("id", id);
  return Response.json({ ok: true });
}
