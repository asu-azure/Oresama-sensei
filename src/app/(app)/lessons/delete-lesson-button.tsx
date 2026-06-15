"use client";

import { Trash2 } from "lucide-react";
import { deleteLesson } from "./actions";
import { cn } from "@/lib/utils";

export function DeleteLessonButton({
  lessonId,
  variant = "icon",
}: {
  lessonId: string;
  variant?: "icon" | "full";
}) {
  return (
    <form
      action={deleteLesson}
      onSubmit={(e) => {
        if (!confirm("Delete this lesson? This can't be undone.")) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="lessonId" value={lessonId} />
      <button
        type="submit"
        title="Delete lesson"
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md text-sm text-muted transition-colors hover:bg-surface-2 hover:text-accent",
          variant === "icon" ? "h-8 w-8 justify-center" : "px-3 py-1.5",
        )}
      >
        <Trash2 className="h-4 w-4" />
        {variant === "full" && "Delete"}
      </button>
    </form>
  );
}
