import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/fetch-all";
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

  const [{ data: pagesRaw }, { data: lessonsRaw }, items] = await Promise.all([
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
    // Paged past the 1000-row cap so a large collection shows all its items.
    fetchAllRows<BookItem>((from, to) =>
      supabase
        .from("knowledge_items")
        .select(
          "id,type,term,reading,meaning,jlpt_level,lesson_id,srs_reps,srs_lapses,srs_stability,srs_difficulty,srs_interval",
        )
        .eq("user_id", user!.id)
        .eq("collection_id", id)
        .order("created_at", { ascending: false })
        .order("id")
        .range(from, to),
    ),
  ]);

  const pageRows = (pagesRaw ?? []) as {
    page_number: number;
    status: string;
    lesson_id: string | null;
    image_path: string | null;
  }[];
  const lessons = (lessonsRaw ?? []) as { id: string; title: string | null }[];

  // Chapter info per lesson — best-effort: if migration 0023 isn't applied yet,
  // this query errors and we simply fall back to ungrouped pages.
  const chapterByLesson: Record<
    string,
    { chapter: string | null; chapter_page: number | null }
  > = {};
  const { data: chapterRows } = await supabase
    .from("lessons")
    .select("id,chapter,chapter_page")
    .eq("user_id", user!.id)
    .eq("collection_id", id);
  for (const r of (chapterRows ?? []) as {
    id: string;
    chapter: string | null;
    chapter_page: number | null;
  }[]) {
    chapterByLesson[r.id] = { chapter: r.chapter, chapter_page: r.chapter_page };
  }

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
    const ch = p.lesson_id ? chapterByLesson[p.lesson_id] : undefined;
    return {
      page_number: p.page_number,
      status: p.status,
      lesson_id: p.lesson_id,
      lesson_title: p.lesson_id ? (lessonTitle[p.lesson_id] ?? null) : null,
      level: m?.level ?? null,
      item_count: lessonItems.length,
      image_path: p.image_path,
      chapter: ch?.chapter ?? null,
      chapter_page: ch?.chapter_page ?? null,
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
