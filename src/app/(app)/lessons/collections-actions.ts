"use server";

import { createClient } from "@/lib/supabase/server";
import { listUserCollections, type CollectionOption } from "@/lib/collections";

/** Collections for the upload form's "select or add" picker. */
export async function listCollections(): Promise<CollectionOption[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  return listUserCollections(supabase, user.id);
}
