import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { pageMastery } from "@/lib/mastery";
import { BookDetail, type BookItem, type GridPage } from "./book-detail";
import type { Collection } from "@/lib/types";

export default async function BookDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: collRaw } = await supabase
    .from("collections")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!collRaw) notFound();
  const collection = collRaw as Collection;

  const [{ data: pagesRaw }, { data: lessonsRaw }, { data: itemsRaw }] =
    await Promise.all([
      supabase
        .from("collection_pages")
        .select("page_number,status,lesson_id,image_path")
        .eq("user_id", user!.id)
        .eq("collection_id", id)
        .order("page_number", { ascending: true }),
      supabase
        .from("lessons")
        .select("id,title")
        .eq("user_id", user!.id)
        .eq("collection_id", id),
      supabase
        .from("knowledge_items")
        .select(
          "id,type,term,reading,meaning,jlpt_level,lesson_id,srs_reps,srs_lapses,srs_stability,srs_difficulty,srs_interval",
        )
        .eq("user_id", user!.id)
        .eq("collection_id", id)
        .order("created_at", { ascending: false }),
    ]);

  const pageRows = (pagesRaw ?? []) as {
    page_number: number;
    status: string;
    lesson_id: string | null;
    image_path: string | null;
  }[];
  const lessons = (lessonsRaw ?? []) as { id: string; title: string | null }[];
  const items = (itemsRaw ?? []) as BookItem[];

  let coverUrl: string | null = null;
  if (collection.cover_path) {
    const { data: signed } = await supabase.storage
      .from("lesson-images")
      .createSignedUrl(collection.cover_path, 3600);
    coverUrl = signed?.signedUrl ?? null;
  }

  const lessonTitle: Record<string, string> = {};
  for (const l of lessons) lessonTitle[l.id] = l.title ?? "Untitled lesson";

  const itemsByLesson: Record<string, BookItem[]> = {};
  for (const it of items) {
    if (!it.lesson_id) continue;
    (itemsByLesson[it.lesson_id] ??= []).push(it);
  }

  // Build the grid metadata for each tracked page: its status, lesson, the
  // aggregate FSRS mastery of that lesson's items, and a short knowledge preview.
  const pages: GridPage[] = pageRows.map((p) => {
    const lessonItems = p.lesson_id ? (itemsByLesson[p.lesson_id] ?? []) : [];
    const m = pageMastery(lessonItems);
    return {
      page_number: p.page_number,
      status: p.status,
      lesson_id: p.lesson_id,
      lesson_title: p.lesson_id ? (lessonTitle[p.lesson_id] ?? null) : null,
      level: m?.level ?? null,
      item_count: lessonItems.length,
      image_path: p.image_path,
    };
  });

  return (
    <BookDetail
      collection={{
        id: collection.id,
        title: collection.title,
        author: collection.author,
        kind: collection.kind,
        total_pages: collection.total_pages,
        summary_md: collection.summary_md,
      }}
      coverUrl={coverUrl}
      pages={pages}
      itemsByLesson={itemsByLesson}
      items={items}
    />
  );
}
