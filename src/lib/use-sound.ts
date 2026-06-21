"use client";

import { useSyncExternalStore } from "react";

// Global "UI sound + haptics" preference, remembered per device. Mirrors
// use-pitch.ts (useSyncExternalStore → lint-clean, no effects). Sounds are tiny
// synthesized Web Audio blips (no asset files); haptics use navigator.vibrate.
// Default ON: only an explicit "0" turns it off.

const KEY = "sound-on";
const EVT = "sound-toggle";

function subscribe(cb: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", cb);
  window.addEventListener(EVT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(EVT, cb);
  };
}

function getSnapshot(): boolean {
  return typeof window === "undefined" || window.localStorage.getItem(KEY) !== "0";
}

export function useSoundEnabled(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => true);
}

export function setSoundEnabled(on: boolean): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, on ? "1" : "0");
  window.dispatchEvent(new Event(EVT));
}

function enabled(): boolean {
  return (
    typeof window !== "undefined" && window.localStorage.getItem(KEY) !== "0"
  );
}

// --- Web Audio synth (lazy; resumed inside the triggering user gesture) ---

let ctx: AudioContext | null = null;
function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AC =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

// A rounded "soft sine tick" — a pure sine through a low-pass filter with a
// smooth (click-free) attack/release. Modern and lowkey, not chiptune.
// Tunables: cutoff (warmth) and the per-sound freq/gain/dur below.
function tone(opts: {
  freq: number;
  dur: number;
  gain?: number;
  glideTo?: number; // gentle downward glide reads softer than a rise
  cutoff?: number;
}) {
  const ac = audio();
  if (!ac) return;
  const { freq, dur, gain = 0.05, glideTo, cutoff = 1500 } = opts;
  const now = ac.currentTime;

  const osc = ac.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(freq, now);
  if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, now + dur);

  const lp = ac.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.setValueAtTime(cutoff, now);

  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(gain, now + 0.008); // soft attack
  g.gain.exponentialRampToValueAtTime(0.0001, now + dur); // smooth release

  osc.connect(lp).connect(g).connect(ac.destination);
  osc.start(now);
  osc.stop(now + dur + 0.02);
}

function vibrate(ms: number) {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate(ms);
    } catch {
      // ignore — unsupported or blocked
    }
  }
}

/** Soft sine tick for taps/navigation. */
export function playTap() {
  if (!enabled()) return;
  tone({ freq: 240, glideTo: 200, dur: 0.07, gain: 0.05, cutoff: 1500 });
  vibrate(8);
}

/** Gentle two-note swell for revealing a flashcard answer. */
export function playReveal() {
  if (!enabled()) return;
  tone({ freq: 392, dur: 0.12, gain: 0.045, cutoff: 1800 });
  window.setTimeout(
    () => tone({ freq: 523, dur: 0.13, gain: 0.04, cutoff: 1900 }),
    70,
  );
  vibrate(12);
}

/** Soft rounded "tock" for grading a card (sine + a faint higher partial). */
export function playGrade() {
  if (!enabled()) return;
  tone({ freq: 300, glideTo: 270, dur: 0.1, gain: 0.05, cutoff: 1400 });
  tone({ freq: 600, dur: 0.07, gain: 0.018, cutoff: 2200 });
  vibrate(10);
}
