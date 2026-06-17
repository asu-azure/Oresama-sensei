import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { LessonUploader } from "./lesson-uploader";
import { LessonTextGenerator } from "./lesson-text-generator";
import { SummaryGenerator } from "./summary-generator";
import { DeleteLessonButton } from "./delete-lesson-button";
import { formatDate } from "@/lib/utils";
import type { Lesson } from "@/lib/types";

export default async function LessonsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: lessons } = await supabase
    .from("lessons")
    .select("id,title,created_at,article_md,kind")
    .eq("user_id", user!.id)
    .order("created_at", { ascending: false });

  const list = (lessons ?? []) as Pick<
    Lesson,
    "id" | "title" | "created_at" | "article_md" | "kind"
  >[];

  return (
    <div className="space-y-8 py-4">
      <section>
        <h1 className="mb-1 text-xl font-semibold">Lessons</h1>
        <p className="mb-4 text-sm text-muted">
          Turn study material into a meaningful lesson, or review everything at once.
        </p>
        <div className="space-y-4">
          <LessonUploader />
          <LessonTextGenerator />
          <SummaryGenerator />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium text-muted">Your lessons</h2>
        {list.length === 0 ? (
          <p className="text-sm text-muted">No lessons yet.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {list.map((lesson) => (
              <div
                key={lesson.id}
                className="group relative rounded-2xl border border-border bg-surface p-4 transition-colors hover:bg-surface-2"
              >
                <Link href={`/lessons/${lesson.id}`} className="block pr-8">
                  <div className="mb-1 flex items-center gap-2">
                    <span
                      className={
                        "rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide " +
                        (lesson.kind === "summary"
                          ? "bg-accent/10 text-accent"
                          : "bg-primary/10 text-primary")
                      }
                    >
                      {lesson.kind === "summary"
                        ? "Summary"
                        : lesson.kind === "text"
                          ? "Text"
                          : lesson.kind === "chat"
                            ? "Chat"
                            : "Photo"}
                    </span>
                  </div>
                  <p className="line-clamp-2 font-jp font-medium group-hover:text-primary">
                    {lesson.title || "Untitled lesson"}
                  </p>
                  <p className="mt-2 text-xs text-muted">
                    {formatDate(lesson.created_at)}
                    {!lesson.article_md && " · generating…"}
                  </p>
                </Link>
                <div className="absolute right-2 top-2">
                  <DeleteLessonButton lessonId={lesson.id} />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
