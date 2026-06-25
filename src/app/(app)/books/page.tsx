import Link from "next/link";
import { BookMarked } from "lucide-react";
import { PageHeading } from "@/components/motion/page-heading";
import { JpDisplay } from "@/components/motion/editorial";
import { createClient } from "@/lib/supabase/server";
import { collectionEmoji } from "@/lib/source";
import { AddBook } from "./add-book";
import type { Collection } from "@/lib/types";

export default async function BooksPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: collsRaw }, { data: pagesRaw }, { data: itemsRaw }] =
    await Promise.all([
      supabase
        .from("collections")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("collection_pages")
        .select("collection_id,status")
        .eq("user_id", user!.id),
      supabase
        .from("knowledge_items")
        .select("collection_id")
        .eq("user_id", user!.id)
        .not("collection_id", "is", null),
    ]);

  const colls = (collsRaw ?? []) as Collection[];
  const pages = (pagesRaw ?? []) as { collection_id: string; status: string }[];
  const items = (itemsRaw ?? []) as { collection_id: string }[];

  const pageCount: Record<string, number> = {};
  for (const p of pages)
    if (p.status === "content")
      pageCount[p.collection_id] = (pageCount[p.collection_id] ?? 0) + 1;
  const itemCount: Record<string, number> = {};
  for (const it of items)
    itemCount[it.collection_id] = (itemCount[it.collection_id] ?? 0) + 1;

  // Sign cover thumbnails (private bucket).
  const covers: Record<string, string> = {};
  await Promise.all(
    colls
      .filter((c) => c.cover_path)
      .map(async (c) => {
        const { data: signed } = await supabase.storage
          .from("lesson-images")
          .createSignedUrl(c.cover_path!, 3600);
        if (signed?.signedUrl) covers[c.id] = signed.signedUrl;
      }),
  );

  return (
    <div className="space-y-5 py-4">
      <div className="flex items-start justify-between gap-3">
        <PageHeading
          className="m-0"
          kicker="SOURCES — TRACKED"
          title="Books & collections"
          jp="本棚"
          subtitle="Your textbooks, games, and series — track pages, browse what you've studied, and see a summary."
        />
        {colls.length > 0 && <AddBook />}
      </div>

      <JpDisplay word="蔵書" label="THE COLLECTION — 読んだ証" flow className="py-1" />

      {colls.length === 0 ? (
        <div className="py-16 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <BookMarked className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-semibold">No collections yet</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
            Add a book/game/series here, or pick one on the Lessons upload form —
            either way it&apos;ll show up here.
          </p>
          <div className="mt-4 flex flex-col items-center gap-3">
            <AddBook />
            <Link href="/lessons" className="text-sm text-muted hover:text-foreground">
              or go to Lessons
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {colls.map((c) => {
            const pc = pageCount[c.id] ?? 0;
            const progress = c.total_pages
              ? `${pc}/${c.total_pages} pages`
              : `${pc} page${pc === 1 ? "" : "s"}`;
            return (
              <Link
                key={c.id}
                href={`/books/${c.id}`}
                className="flex gap-3 rounded-2xl border border-border bg-surface p-3 transition-colors hover:bg-surface-2"
              >
                <div className="flex h-24 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-surface-2 text-2xl">
                  {covers[c.id] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={covers[c.id]}
                      alt={c.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span>{collectionEmoji(c.kind)}</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 font-jp font-medium">{c.title}</p>
                  {c.author && (
                    <p className="mt-0.5 truncate text-xs text-muted">
                      {c.author}
                    </p>
                  )}
                  <p className="mt-2 text-xs text-muted">
                    {collectionEmoji(c.kind)} {progress}
                  </p>
                  <p className="text-xs text-muted">
                    {itemCount[c.id] ?? 0} saved items
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
