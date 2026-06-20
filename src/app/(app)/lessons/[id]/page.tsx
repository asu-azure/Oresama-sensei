import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Markdown } from "@/components/markdown";
import { DeleteLessonButton } from "../delete-lesson-button";
import { LessonPractice } from "../lesson-practice";
import { LessonSourceEditor } from "../lesson-source-editor";
import { LessonPager } from "../lesson-pager";
import { listUserCollections } from "@/lib/collections";
import { formatDate } from "@/lib/utils";
import type { Lesson, Exercise } from "@/lib/types";

export default async function LessonDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data } = await supabase
    .from("lessons")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();
  const lesson = data as Lesson;

  // Sign URLs for every stored page image (fall back to the single image_path).
  const imagePaths =
    lesson.image_paths && lesson.image_paths.length > 0
      ? lesson.image_paths
      : lesson.image_path
        ? [lesson.image_path]
        : [];
  const imageUrls = (
    await Promise.all(
      imagePaths.map(async (p) => {
        const { data: signed } = await supabase.storage
          .from("lesson-images")
          .createSignedUrl(p, 3600);
        return signed?.signedUrl ?? null;
      }),
    )
  ).filter((u): u is string => u !== null);

  // Source attribution: the collection title (if any) + the picker's options.
  const [{ data: coll }, collections] = await Promise.all([
    lesson.collection_id
      ? supabase
          .from("collections")
          .select("title")
          .eq("id", lesson.collection_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    user ? listUserCollections(supabase, user.id) : Promise.resolve([]),
  ]);

  // Prev/next lessons within the same collection, by page order. Walk the
  // collection's content pages and find the nearest DISTINCT lesson on either
  // side of this lesson's page range.
  let prevSibling: { id: string; page: number } | null = null;
  let nextSibling: { id: string; page: number } | null = null;
  if (lesson.collection_id) {
    const { data: cps } = await supabase
      .from("collection_pages")
      .select("page_number,lesson_id")
      .eq("collection_id", lesson.collection_id)
      .not("lesson_id", "is", null)
      .order("page_number", { ascending: true });
    const rows = (cps ?? []) as { page_number: number; lesson_id: string }[];
    // First page on which THIS lesson appears (fall back to its page_start).
    const myPages = rows.filter((r) => r.lesson_id === lesson.id);
    const myPage =
      myPages[0]?.page_number ?? lesson.page_start ?? Number.MAX_SAFE_INTEGER;
    for (const r of rows) {
      if (r.lesson_id === lesson.id) continue;
      if (r.page_number < myPage) {
        // Keep the closest-below (rows are ascending, so last one wins).
        prevSibling = { id: r.lesson_id, page: r.page_number };
      } else if (r.page_number > myPage && !nextSibling) {
        nextSibling = { id: r.lesson_id, page: r.page_number };
      }
    }
  }

  return (
    <article className="space-y-6 py-4">
      <div>
        <Link
          href="/lessons"
          className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> All lessons
        </Link>
        <div className="flex items-start justify-between gap-3">
          <h1 className="font-jp text-2xl font-bold">
            {lesson.title || "Untitled lesson"}
          </h1>
          <DeleteLessonButton lessonId={lesson.id} variant="full" />
        </div>
        <p className="mt-1 text-xs text-muted">{formatDate(lesson.created_at)}</p>
      </div>

      {lesson.kind !== "summary" && (
        <LessonSourceEditor
          lessonId={lesson.id}
          materialType={lesson.material_type}
          collectionId={lesson.collection_id}
          collectionTitle={(coll as { title: string } | null)?.title ?? null}
          pageStart={lesson.page_start}
          pageEnd={lesson.page_end}
          collections={collections}
        />
      )}

      {(prevSibling || nextSibling) && (
        <LessonPager prev={prevSibling} next={nextSibling} />
      )}

      {imageUrls.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {imageUrls.map((url, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={url}
              src={url}
              alt={`Source page ${i + 1}`}
              className="max-h-96 rounded-2xl border border-border object-contain"
            />
          ))}
        </div>
      )}

      {lesson.article_md ? (
        <div className="rounded-2xl border border-border bg-surface p-6">
          <Markdown>{lesson.article_md}</Markdown>
        </div>
      ) : (
        <p className="text-sm text-muted">
          This lesson is still being generated. Refresh in a moment.
        </p>
      )}

      {lesson.article_md && (
        <LessonPractice
          lessonId={lesson.id}
          lessonTitle={lesson.title}
          lessonExcerpt={lesson.article_md}
          initialExercises={(lesson.exercises ?? []) as Exercise[]}
        />
      )}

      {lesson.source_text && (
        <details className="rounded-2xl border border-border bg-surface p-4">
          <summary className="cursor-pointer text-sm font-medium text-muted">
            Original transcription
          </summary>
          <pre className="mt-3 whitespace-pre-wrap font-jp text-sm leading-relaxed">
            {lesson.source_text}
          </pre>
        </details>
      )}

      {(prevSibling || nextSibling) && (
        <LessonPager prev={prevSibling} next={nextSibling} />
      )}
    </article>
  );
}
