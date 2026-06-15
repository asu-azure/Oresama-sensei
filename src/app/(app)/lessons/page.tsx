import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { LessonUploader } from "./lesson-uploader";
import { formatDate } from "@/lib/utils";
import type { Lesson } from "@/lib/types";

export default async function LessonsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: lessons } = await supabase
    .from("lessons")
    .select("id,title,created_at,article_md")
    .eq("user_id", user!.id)
    .order("created_at", { ascending: false });

  const list = (lessons ?? []) as Pick<
    Lesson,
    "id" | "title" | "created_at" | "article_md"
  >[];

  return (
    <div className="space-y-8 py-4">
      <section>
        <h1 className="mb-1 text-xl font-semibold">Photo → Lesson</h1>
        <p className="mb-4 text-sm text-muted">
          Turn study material into a meaningful, personalized lesson.
        </p>
        <LessonUploader />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium text-muted">Your lessons</h2>
        {list.length === 0 ? (
          <p className="text-sm text-muted">No lessons yet.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {list.map((lesson) => (
              <Link
                key={lesson.id}
                href={`/lessons/${lesson.id}`}
                className="group rounded-2xl border border-border bg-surface p-4 transition-colors hover:bg-surface-2"
              >
                <p className="line-clamp-2 font-jp font-medium group-hover:text-primary">
                  {lesson.title || "Untitled lesson"}
                </p>
                <p className="mt-2 text-xs text-muted">
                  {formatDate(lesson.created_at)}
                  {!lesson.article_md && " · generating…"}
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
