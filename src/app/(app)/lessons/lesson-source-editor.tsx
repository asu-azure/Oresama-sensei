"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  UPLOAD_MATERIAL_TYPES,
  collectionKindForMaterial,
  sourceMeta,
  sourceTypeForMaterial,
  pageRefLabel,
  type MaterialType,
} from "@/lib/source";
import type { CollectionOption } from "@/lib/collections";
import { updateLessonSource } from "./actions";

const NEW_COLLECTION = "__new__";

export function LessonSourceEditor({
  lessonId,
  materialType: initialMaterial,
  collectionId: initialCollectionId,
  collectionTitle,
  pageStart: initialPageStart,
  pageEnd: initialPageEnd,
  collections,
}: {
  lessonId: string;
  materialType: string;
  collectionId: string | null;
  collectionTitle: string | null;
  pageStart: number | null;
  pageEnd: number | null;
  collections: CollectionOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);

  const [materialType, setMaterialType] = useState<MaterialType>(
    (initialMaterial as MaterialType) || "textbook",
  );
  const [collectionId, setCollectionId] = useState<string>(
    initialCollectionId ?? NEW_COLLECTION,
  );
  const [newTitle, setNewTitle] = useState("");
  const [newAuthor, setNewAuthor] = useState("");
  const [pageStart, setPageStart] = useState(
    initialPageStart != null ? String(initialPageStart) : "",
  );
  const [pageEnd, setPageEnd] = useState(
    initialPageEnd != null ? String(initialPageEnd) : "",
  );

  const collectionKind = collectionKindForMaterial(materialType);
  const kindCollections = collections.filter((c) => c.kind === collectionKind);

  const meta = sourceMeta(sourceTypeForMaterial(materialType));
  const pageRef = pageRefLabel(initialPageStart, initialPageEnd);
  const currentLabel = `${meta.emoji} ${
    collectionTitle ?? meta.label
  }${pageRef ? ` · ${pageRef}` : ""}`;

  async function save() {
    setSaving(true);
    setSaved(null);
    const res = await updateLessonSource({
      lessonId,
      materialType,
      collectionId:
        collectionKind && collectionId !== NEW_COLLECTION ? collectionId : null,
      newCollectionTitle:
        collectionKind && collectionId === NEW_COLLECTION
          ? newTitle.trim() || null
          : null,
      newCollectionAuthor:
        collectionKind && collectionId === NEW_COLLECTION
          ? newAuthor.trim() || null
          : null,
      pageStart: pageStart.trim() ? parseInt(pageStart, 10) : null,
      pageEnd: pageEnd.trim() ? parseInt(pageEnd, 10) : null,
    });
    setSaving(false);
    if ("error" in res) {
      setSaved(res.error);
      return;
    }
    setSaved(
      res.tagged > 0
        ? `Saved · tagged ${res.tagged} item${res.tagged === 1 ? "" : "s"}`
        : "Saved",
    );
    setOpen(false);
    router.refresh();
  }

  return (
    <div className="rounded-xl border border-border bg-surface px-3 py-2 text-sm">
      <div className="flex items-center gap-2">
        <span className="text-muted">Source:</span>
        <span className="font-medium">{currentLabel}</span>
        <button
          onClick={() => setOpen((o) => !o)}
          className="ml-auto flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
        >
          <Pencil className="h-3 w-3" /> Edit
        </button>
      </div>
      {saved && !open && (
        <p className="mt-1 flex items-center gap-1 text-xs text-primary">
          <Check className="h-3 w-3" /> {saved}
        </p>
      )}

      {open && (
        <div className="mt-3 space-y-3 border-t border-border pt-3">
          <div className="flex flex-wrap gap-1.5">
            {UPLOAD_MATERIAL_TYPES.map((m) => (
              <button
                key={m.value}
                onClick={() => setMaterialType(m.value)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs transition-colors",
                  materialType === m.value
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-surface text-muted hover:bg-surface-2",
                )}
              >
                <span className="mr-1">{m.emoji}</span>
                {m.label}
              </button>
            ))}
          </div>

          {collectionKind && (
            <div className="space-y-2 rounded-lg border border-border bg-surface-2/50 p-2.5">
              <select
                value={collectionId}
                onChange={(e) => setCollectionId(e.target.value)}
                className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
              >
                {kindCollections.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
                <option value={NEW_COLLECTION}>➕ Add new…</option>
              </select>
              {collectionId === NEW_COLLECTION && (
                <div className="space-y-2">
                  <input
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="Title"
                    className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 font-jp text-sm outline-none focus:ring-2 focus:ring-ring"
                  />
                  <input
                    value={newAuthor}
                    onChange={(e) => setNewAuthor(e.target.value)}
                    placeholder="Author / studio (optional)"
                    className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              )}
              <div className="flex items-center gap-2">
                <span className="text-muted">Pages</span>
                <input
                  value={pageStart}
                  onChange={(e) => setPageStart(e.target.value)}
                  inputMode="numeric"
                  placeholder="from"
                  className="w-20 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
                <span className="text-muted">–</span>
                <input
                  value={pageEnd}
                  onChange={(e) => setPageEnd(e.target.value)}
                  inputMode="numeric"
                  placeholder="to (opt.)"
                  className="w-24 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={save}
              disabled={saving}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90 disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              Save
            </button>
            <button
              onClick={() => setOpen(false)}
              className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted transition-colors hover:bg-surface-2"
            >
              Cancel
            </button>
            {saved && (
              <span className="text-xs text-accent">{saved}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
