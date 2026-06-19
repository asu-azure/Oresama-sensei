"use client";

import {
  useCallback,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";

/** An image can be a plain URL, or a {thumb, full} pair (small transform + the
 *  original) so the preview loads fast but the lightbox stays sharp. */
export type PreviewImg = string | { thumb: string; full: string };

const thumbOf = (i: PreviewImg) => (typeof i === "string" ? i : i.thumb);
const fullOf = (i: PreviewImg) =>
  typeof i === "string" ? i : i.full || i.thumb;

/** Wraps a trigger (a book page cell, a "view page" button, …) and reveals the
 *  source page photo on hover (desktop) or tap (mobile). The popover and the
 *  full-screen lightbox are rendered in a PORTAL so they escape any clipping /
 *  transformed ancestor (e.g. the page-range frame or the accordion). Images can
 *  be passed eagerly (`urls`) or loaded lazily on first reveal (`load`).
 *  `hoverOnly` keeps the trigger's own click intact (book grid: tap selects the
 *  page); `directLightbox` opens the lightbox straight from the trigger. */
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
  urls?: PreviewImg[];
  load?: () => Promise<PreviewImg[]>;
  hoverOnly?: boolean;
  directLightbox?: boolean;
  side?: "top" | "bottom";
  className?: string;
}) {
  const reduce = useReducedMotion();
  const wrapRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [lightbox, setLightbox] = useState(false);
  const [loaded, setLoaded] = useState<PreviewImg[] | null>(urls ?? null);
  const [loading, setLoading] = useState(false);
  const [anchor, setAnchor] = useState<{ x: number; top: number; bottom: number } | null>(
    null,
  );
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

  const measure = useCallback(() => {
    const r = wrapRef.current?.getBoundingClientRect();
    if (r) setAnchor({ x: r.left + r.width / 2, top: r.top, bottom: r.bottom });
  }, []);

  const show = useCallback(() => {
    measure();
    setOpen(true);
    void ensure();
  }, [measure, ensure]);

  const imgs = loaded ?? [];
  const canPortal = typeof document !== "undefined";

  return (
    <span
      ref={wrapRef}
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

      {canPortal &&
        createPortal(
          <AnimatePresence>
            {open && anchor && (loading || imgs.length > 0) && (
              <motion.div
                initial={reduce ? false : { opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={reduce ? undefined : { opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.12 }}
                style={{
                  position: "fixed",
                  left: anchor.x,
                  top: side === "top" ? anchor.top - 8 : anchor.bottom + 8,
                  transform: `translateX(-50%) ${
                    side === "top" ? "translateY(-100%)" : ""
                  }`,
                }}
                className="z-[90] rounded-xl border border-border bg-surface p-1 shadow-xl"
              >
                {loading ? (
                  <span className="flex h-24 w-24 items-center justify-center">
                    <Loader2 className="h-5 w-5 animate-spin text-muted" />
                  </span>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={thumbOf(imgs[0])}
                    alt="Source page preview"
                    decoding="async"
                    onError={(e) => {
                      const f = fullOf(imgs[0]);
                      if (f && e.currentTarget.src !== f) e.currentTarget.src = f;
                    }}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setLightbox(true);
                    }}
                    className="max-h-[70vh] max-w-[80vw] cursor-zoom-in rounded-lg object-contain"
                  />
                )}
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}

      {canPortal &&
        lightbox &&
        imgs.length > 0 &&
        createPortal(
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
                  key={fullOf(u) || i}
                  src={fullOf(u)}
                  alt={`Source page ${i + 1}`}
                  className="max-h-[90vh] max-w-full rounded-lg object-contain"
                />
              ))}
            </div>
          </div>,
          document.body,
        )}
    </span>
  );
}
