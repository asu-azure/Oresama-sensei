"use client";

import { Volume2, VolumeX } from "lucide-react";
import { useSoundEnabled, setSoundEnabled, playTap } from "@/lib/use-sound";
import { cn } from "@/lib/utils";

/** Toggle UI sound effects + haptics (global, per-device). Default ON. */
export function SoundToggle({ className }: { className?: string }) {
  const on = useSoundEnabled();
  return (
    <button
      type="button"
      onClick={() => {
        const next = !on;
        setSoundEnabled(next);
        if (next) playTap(); // give immediate audible confirmation when enabling
      }}
      aria-pressed={on}
      title="Tap sounds & vibration"
      className={cn(
        "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
        on
          ? "border-primary bg-primary/10 text-primary"
          : "border-border bg-surface text-muted hover:bg-surface-2",
        className,
      )}
    >
      {on ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
      Sound &amp; haptics {on ? "on" : "off"}
    </button>
  );
}
