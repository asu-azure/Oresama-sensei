import Link from "next/link";
import { cookies } from "next/headers";
import { PageHeading } from "@/components/motion/page-heading";
import { JpDisplay } from "@/components/motion/editorial";
import { createClient } from "@/lib/supabase/server";
import { LessonUploader } from "./lesson-uploader";
import { LessonTextGenerator } from "./lesson-text-generator";
import { SummaryGenerator } from "./summary-generator";
import { DeleteLessonButton } from "./delete-lesson-button";
import { listUserCollections } from "@/lib/collections";
import { formatDate } from "@/lib/utils";
import { sourceMeta, sourceTypeForMaterial, pageRefLabel } from "@/lib/source";
import type { MaterialType } from "@/lib/source";

export default async function LessonsPage({
  searchParams,
}: {
  searchParams: Promise<{
    collection?: string;
    page?: string;
    material?: string;
  }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Collections for the uploader's picker (so a prefilled/remembered book shows
  // its name without a client round-trip), plus the prefill itself.
  const collections = user ? await listUserCollections(supabase, user.id) : [];

  // Last-used book, remembered in a cookie by the uploader. URL params (from a
  // book page's blank-page link) take precedence.
  let lastMaterial: MaterialType | null = null;
  let lastCollectionId: string | null = null;
  const lastRaw = (await cookies()).get("lastBook")?.value;
  if (lastRaw) {
    try {
      const o = JSON.parse(decodeURIComponent(lastRaw));
      lastMaterial = (o.material as MaterialType) ?? null;
      lastCollectionId = (o.collectionId as string) ?? null;
    } catch {
      /* ignore a malformed cookie */
    }
  }
  const initialMaterial = (sp.material as MaterialType) || lastMaterial || null;
  const wantCollectionId = sp.collection || lastCollectionId || null;
  // Only keep a collection id that still exists (avoids a stale cookie/URL).
  const initialCollectionId =
    wantCollectionId && collections.some((c) => c.id === wantCollectionId)
      ? wantCollectionId
      : null;
  const initialPage = sp.page || null;

  const { data: lessons } = await supabase
    .from("lessons")
    .select(
      "id,title,created_at,article_md,kind,material_type,page_start,page_end,collections(title)",
    )
    .eq("user_id", user!.id)
    .order("created_at", { ascending: false });

  type LessonCard = {
    id: string;
    title: string | null;
    created_at: string;
    article_md: string | null;
    kind: string;
    material_type: string;
    page_start: number | null;
    page_end: number | null;
    collections: { title: string } | null;
  };
  const list = (lessons ?? []) as unknown as LessonCard[];

  return (
    <div className="space-y-8 py-4">
      <section>
        <PageHeading
          kicker="STUDY MATERIAL → LESSON"
          title="Lessons"
          jp="授業"
          vtext="教材から学ぶ"
          subtitle="Turn study material into a meaningful lesson, or review everything at once."
        />
        <JpDisplay word="学び" label="TURN MATERIAL INTO — 学び" flow className="mb-6" />
        <div className="space-y-4">
          <LessonUploader
            initialMaterial={initialMaterial}
            initialCollectionId={initialCollectionId}
            initialPage={initialPage}
            initialCollections={collections}
          />
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
                  <div className="mb-1 flex flex-wrap items-center gap-1.5">
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
                    {lesson.kind !== "summary" &&
                      (() => {
                        const meta = sourceMeta(
                          sourceTypeForMaterial(
                            lesson.material_type as MaterialType,
                          ),
                        );
                        const pageRef = pageRefLabel(
                          lesson.page_start,
                          lesson.page_end,
                        );
                        const label = lesson.collections?.title ?? meta.label;
                        return (
                          <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-medium text-muted">
                            {meta.emoji} {label}
                            {pageRef ? ` · ${pageRef}` : ""}
                          </span>
                        );
                      })()}
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
