"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function deleteLesson(formData: FormData) {
  const id = String(formData.get("lessonId") ?? "");
  if (!id) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  // Fetch first so we can remove the stored image too (RLS scopes to the user).
  const { data: lesson } = await supabase
    .from("lessons")
    .select("image_path")
    .eq("id", id)
    .maybeSingle();

  if (lesson?.image_path) {
    await supabase.storage.from("lesson-images").remove([lesson.image_path]);
  }
  await supabase.from("lessons").delete().eq("id", id);

  revalidatePath("/lessons");
  redirect("/lessons");
}
