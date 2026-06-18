"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  findOrCreateCollection,
  upsertCollectionPages,
} from "@/lib/collections";
import {
  sourceTypeForMaterial,
  collectionKindForMaterial,
  type MaterialType,
} from "@/lib/source";

export async function deleteLesson(formData: FormData) {
  const id = String(formData.get("lessonId") ?? "");
  if (!id) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  // Fetch first so we can remove the stored image(s) too (RLS scopes to the user).
  const { data: lesson } = await supabase
    .from("lessons")
    .select("image_path,image_paths")
    .eq("id", id)
    .maybeSingle();

  const paths = new Set<string>();
  if (lesson?.image_path) paths.add(lesson.image_path);
  for (const p of (lesson?.image_paths ?? []) as string[]) paths.add(p);
  if (paths.size > 0) {
    await supabase.storage.from("lesson-images").remove([...paths]);
  }
  await supabase.from("lessons").delete().eq("id", id);

  revalidatePath("/lessons");
  redirect("/lessons");
}

export type UpdateLessonSourceInput = {
  lessonId: string;
  materialType: MaterialType;
  collectionId?: string | null;
  newCollectionTitle?: string | null;
  newCollectionAuthor?: string | null;
  pageStart?: number | null;
  pageEnd?: number | null;
};

/** Backfill / edit a lesson's source attribution, and stamp the same attribution
 *  onto its knowledge items. New items link by `lesson_id`; legacy items (no link)
 *  are matched heuristically by whether their term appears in the lesson text. */
export async function updateLessonSource(
  input: UpdateLessonSourceInput,
): Promise<{ ok: true; tagged: number } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const sourceType = sourceTypeForMaterial(input.materialType);
  const collectionKind = collectionKindForMaterial(input.materialType);

  let collectionId: string | null = null;
  if (collectionKind) {
    collectionId = await findOrCreateCollection(supabase, user.id, {
      collectionId: input.collectionId,
      title: input.newCollectionTitle,
      kind: collectionKind,
      author: input.newCollectionAuthor,
    });
  }

  const { error: lessonErr } = await supabase
    .from("lessons")
    .update({
      material_type: input.materialType,
      collection_id: collectionId,
      page_start: input.pageStart ?? null,
      page_end: input.pageEnd ?? null,
    })
    .eq("id", input.lessonId)
    .eq("user_id", user.id);
  if (lessonErr) return { error: "Couldn't update the lesson." };

  // Record the page range for the books grid.
  if (collectionId && input.pageStart != null) {
    await upsertCollectionPages(supabase, user.id, {
      collectionId,
      lessonId: input.lessonId,
      pageStart: input.pageStart,
      pageEnd: input.pageEnd ?? null,
      imagePaths: [],
    });
  }

  const patch = { source_type: sourceType, collection_id: collectionId };

  // 1) Items already linked to this lesson.
  const { data: linked } = await supabase
    .from("knowledge_items")
    .update(patch)
    .eq("user_id", user.id)
    .eq("lesson_id", input.lessonId)
    .select("id");
  let tagged = linked?.length ?? 0;

  // 2) Legacy items (no lesson_id): match by term appearing in the lesson text.
  if (tagged === 0) {
    const { data: lesson } = await supabase
      .from("lessons")
      .select("source_text,article_md")
      .eq("id", input.lessonId)
      .maybeSingle();
    const hay = `${lesson?.source_text ?? ""}\n${lesson?.article_md ?? ""}`;
    if (hay.trim()) {
      const { data: untagged } = await supabase
        .from("knowledge_items")
        .select("id,term")
        .eq("user_id", user.id)
        .is("lesson_id", null)
        .is("source_type", null);
      const matchIds = (untagged ?? [])
        .filter((it) => it.term && hay.includes(it.term))
        .map((it) => it.id);
      if (matchIds.length > 0) {
        await supabase
          .from("knowledge_items")
          .update({ ...patch, lesson_id: input.lessonId })
          .in("id", matchIds);
        tagged = matchIds.length;
      }
    }
  }

  revalidatePath(`/lessons/${input.lessonId}`);
  revalidatePath("/lessons");
  revalidatePath("/library");
  return { ok: true, tagged };
}
