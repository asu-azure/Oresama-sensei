"use client";

import { useSyncExternalStore } from "react";

// Global "show pitch accent" preference, remembered per device. No effects
// (useSyncExternalStore) so it's lint-clean and syncs across components/tabs.

const KEY = "pitch-on";
const EVT = "pitch-toggle";

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
  return (
    typeof window !== "undefined" && window.localStorage.getItem(KEY) === "1"
  );
}

export function usePitch(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}

export function setPitch(on: boolean): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, on ? "1" : "0");
  window.dispatchEvent(new Event(EVT));
}
