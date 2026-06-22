"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Eraser, Trash2, Loader2, Check } from "lucide-react";
import { cn } from "@/lib/utils";

const COLORS = ["#0f172a", "#16a34a", "#ef4444", "#3b82f6", "#f59e0b", "#a855f7"];
const SIZE = 512; // canvas backing resolution (square)

/** A tiny doodle pad — draw a quick memory aid when no photo fits. Exports a PNG
 *  (white background) and hands it back as a File for upload. */
export function DrawCanvas({
  onSave,
  onClose,
  busy = false,
}: {
  onSave: (file: File) => Promise<void> | void;
  onClose: () => void;
  busy?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [color, setColor] = useState(COLORS[0]);
  const [erasing, setErasing] = useState(false);
  const [width, setWidth] = useState(6);

  // Prime a white canvas once (so the saved PNG isn't transparent).
  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, SIZE, SIZE);
  }, []);

  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * SIZE,
      y: ((e.clientY - r.top) / r.height) * SIZE,
    };
  }

  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    e.preventDefault();
    drawing.current = true;
    last.current = pos(e);
    canvasRef.current?.setPointerCapture(e.pointerId);
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx || !last.current) return;
    const p = pos(e);
    ctx.strokeStyle = erasing ? "#ffffff" : color;
    ctx.lineWidth = erasing ? width * 3 : width;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
  }

  function end() {
    drawing.current = false;
    last.current = null;
  }

  function clear() {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, SIZE, SIZE);
  }

  function save() {
    canvasRef.current?.toBlob((blob) => {
      if (blob) void onSave(new File([blob], "drawing.png", { type: "image/png" }));
    }, "image/png");
  }

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-4">
      <div className="flex w-full max-w-sm flex-col rounded-2xl border border-border bg-background p-4 shadow-2xl">
        <div className="mb-3 flex items-center gap-2">
          <span className="text-sm font-medium">Draw a memory aid</span>
          <button
            onClick={onClose}
            className="ml-auto rounded-lg p-1.5 transition-colors hover:bg-surface-2"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <canvas
          ref={canvasRef}
          width={SIZE}
          height={SIZE}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={end}
          className="aspect-square w-full touch-none rounded-xl border border-border bg-white"
        />

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {COLORS.map((c) => (
            <button
              key={c}
              onClick={() => {
                setColor(c);
                setErasing(false);
              }}
              aria-label={`Color ${c}`}
              className={cn(
                "h-6 w-6 rounded-full border-2 transition-transform",
                color === c && !erasing
                  ? "scale-110 border-foreground"
                  : "border-border",
              )}
              style={{ background: c }}
            />
          ))}
          <input
            type="range"
            min={2}
            max={28}
            value={width}
            onChange={(e) => setWidth(Number(e.target.value))}
            className="ml-1 w-20 accent-primary"
            aria-label="Brush size"
          />
          <button
            onClick={() => setErasing((v) => !v)}
            className={cn(
              "rounded-lg border p-1.5 transition-colors",
              erasing
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted hover:text-foreground",
            )}
            aria-label="Eraser"
          >
            <Eraser className="h-4 w-4" />
          </button>
          <button
            onClick={clear}
            className="rounded-lg border border-border p-1.5 text-muted transition-colors hover:text-foreground"
            aria-label="Clear"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>

        <button
          onClick={save}
          disabled={busy}
          className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white transition-opacity disabled:opacity-50"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Check className="h-4 w-4" />
          )}
          Save drawing
        </button>
      </div>
    </div>,
    document.body,
  );
}
