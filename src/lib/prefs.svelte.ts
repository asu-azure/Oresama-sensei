// Per-device preferences, remembered in localStorage and shared by every island
// on the page (and across tabs via the storage event). Keys are unchanged from
// the Next.js app, so a device keeps its settings.

function stored(key: string, fallback: boolean): boolean {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : v === "1";
  } catch {
    return fallback;
  }
}

class Prefs {
  /** Pitch-accent marks on readings. Off unless turned on. */
  pitch = $state(false);
  /** Soft UI ticks + haptics. On unless turned off. */
  sound = $state(true);

  constructor() {
    if (typeof window === "undefined") return;
    this.pitch = stored("pitch-on", false);
    this.sound = stored("sound-on", true);
    window.addEventListener("storage", (e) => {
      if (e.key === "pitch-on") this.pitch = e.newValue === "1";
      if (e.key === "sound-on") this.sound = e.newValue !== "0";
    });
  }

  setPitch(on: boolean) {
    this.pitch = on;
    try {
      localStorage.setItem("pitch-on", on ? "1" : "0");
    } catch {}
  }

  setSound(on: boolean) {
    this.sound = on;
    try {
      localStorage.setItem("sound-on", on ? "1" : "0");
    } catch {}
  }
}

export const prefs = new Prefs();
