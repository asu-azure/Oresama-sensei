import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

type Sibling = { id: string; page: number } | null;

/**
 * Prev/next navigation between the lessons of the same collection (book), by
 * page order. Each side jumps to the nearest other page that has a lesson.
 */
export function LessonPager({ prev, next }: { prev: Sibling; next: Sibling }) {
  if (!prev && !next) return null;
  return (
    <div className="flex items-center justify-between gap-2">
      {prev ? (
        <Link
          href={`/lessons/${prev.id}`}
          className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" /> p.{prev.page}
        </Link>
      ) : (
        <span />
      )}
      {next ? (
        <Link
          href={`/lessons/${next.id}`}
          className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
        >
          p.{next.page} <ChevronRight className="h-4 w-4" />
        </Link>
      ) : (
        <span />
      )}
    </div>
  );
}
