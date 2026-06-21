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

/** A short blip: a quick upward frequency sweep with a fast decay. */
function blip(
  freq: number,
  dur: number,
  type: OscillatorType = "triangle",
  gain = 0.04,
) {
  const ac = audio();
  if (!ac) return;
  const now = ac.currentTime;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);
  osc.frequency.exponentialRampToValueAtTime(freq * 1.5, now + dur);
  g.gain.setValueAtTime(gain, now);
  g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  osc.connect(g).connect(ac.destination);
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

/** Soft click for taps/navigation. */
export function playTap() {
  if (!enabled()) return;
  blip(660, 0.05, "triangle", 0.035);
  vibrate(8);
}

/** Two-note rising chirp for revealing a flashcard answer. */
export function playReveal() {
  if (!enabled()) return;
  blip(420, 0.09, "sawtooth", 0.035);
  window.setTimeout(() => blip(880, 0.07, "triangle", 0.03), 45);
  vibrate(12);
}

/** Crisp confirm blip for grading a card. */
export function playGrade() {
  if (!enabled()) return;
  blip(520, 0.06, "square", 0.03);
  vibrate(10);
}
