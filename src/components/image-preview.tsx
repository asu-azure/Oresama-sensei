"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";

/** Wraps a trigger (a book page cell, a "view page" button, …) and reveals the
 *  source page photo on hover (desktop) or tap (mobile). Clicking the thumbnail
 *  opens a full-screen lightbox. Images can be passed eagerly (`urls`) or loaded
 *  lazily on first reveal (`load`) so long lists don't sign hundreds of URLs up
 *  front. `hoverOnly` leaves the trigger's own click intact (used for the book
 *  grid, where tapping a cell still selects the page). */
export function ImagePreview({
  children,
  urls,
  load,
  hoverOnly = false,
  directLightbox = false,
  side = "top",
  className,
}: {
  children: ReactNode;
  urls?: string[];
  load?: () => Promise<string[]>;
  hoverOnly?: boolean;
  /** Clicking the trigger opens the full-screen lightbox directly (no hover
   *  popover) — for an already-visible inline thumbnail. */
  directLightbox?: boolean;
  side?: "top" | "bottom";
  className?: string;
}) {
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [lightbox, setLightbox] = useState(false);
  const [loaded, setLoaded] = useState<string[] | null>(urls ?? null);
  const [loading, setLoading] = useState(false);
  const fetchedRef = useRef(false);

  const ensure = useCallback(async () => {
    if (urls || fetchedRef.current || !load) return;
    fetchedRef.current = true;
    setLoading(true);
    try {
      setLoaded(await load());
    } catch {
      setLoaded([]);
    } finally {
      setLoading(false);
    }
  }, [urls, load]);

  const show = useCallback(() => {
    setOpen(true);
    void ensure();
  }, [ensure]);

  const imgs = loaded ?? [];

  return (
    <span
      className={cn("relative inline-flex", className)}
      onMouseEnter={directLightbox ? undefined : show}
      onMouseLeave={directLightbox ? undefined : () => setOpen(false)}
      onClick={
        hoverOnly
          ? undefined
          : (e) => {
              e.preventDefault();
              e.stopPropagation();
              if (directLightbox) {
                void ensure();
                setLightbox(true);
              } else if (open) {
                setOpen(false);
              } else {
                show();
              }
            }
      }
    >
      {children}

      <AnimatePresence>
        {open && (loading || imgs.length > 0) && (
          <motion.span
            initial={reduce ? false : { opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={reduce ? undefined : { opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.12 }}
            className={cn(
              "absolute left-1/2 z-50 -translate-x-1/2 rounded-xl border border-border bg-surface p-1 shadow-lg",
              side === "top" ? "bottom-full mb-2" : "top-full mt-2",
            )}
          >
            {loading ? (
              <span className="flex h-24 w-24 items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-muted" />
              </span>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imgs[0]}
                alt="Source page preview"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setLightbox(true);
                }}
                className="max-h-56 max-w-[60vw] cursor-zoom-in rounded-lg object-contain"
              />
            )}
          </motion.span>
        )}
      </AnimatePresence>

      {lightbox && imgs.length > 0 && (
        <div
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setLightbox(false);
          }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4"
        >
          <button
            aria-label="Close"
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="flex max-h-full max-w-full flex-wrap justify-center gap-2 overflow-auto">
            {imgs.map((u, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={u}
                src={u}
                alt={`Source page ${i + 1}`}
                className="max-h-[90vh] max-w-full rounded-lg object-contain"
              />
            ))}
          </div>
        </div>
      )}
    </span>
  );
}
