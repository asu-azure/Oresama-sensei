import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Markdown } from "@/components/markdown";
import { formatDate } from "@/lib/utils";
import type { Lesson } from "@/lib/types";

export default async function LessonDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data } = await supabase
    .from("lessons")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();
  const lesson = data as Lesson;

  let imageUrl: string | null = null;
  if (lesson.image_path) {
    const { data: signed } = await supabase.storage
      .from("lesson-images")
      .createSignedUrl(lesson.image_path, 3600);
    imageUrl = signed?.signedUrl ?? null;
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
        <h1 className="font-jp text-2xl font-bold">
          {lesson.title || "Untitled lesson"}
        </h1>
        <p className="mt-1 text-xs text-muted">{formatDate(lesson.created_at)}</p>
      </div>

      {imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt="Source page"
          className="max-h-96 rounded-2xl border border-border object-contain"
        />
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
    </article>
  );
}
