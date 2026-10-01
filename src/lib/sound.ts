// Tiny synthesized UI sounds (soft sine ticks through a low-pass filter) plus
// haptics. No asset files. Gated by the "sound-on" preference (default on).

function enabled(): boolean {
  try {
    return localStorage.getItem("sound-on") !== "0";
  } catch {
    return true;
  }
}

let ctx: AudioContext | null = null;
function audio(): AudioContext | null {
  const AC =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  ctx ??= new AC();
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

function tone(o: { freq: number; dur: number; gain?: number; glideTo?: number; cutoff?: number }) {
  const ac = audio();
  if (!ac) return;
  const { freq, dur, gain = 0.05, glideTo, cutoff = 1500 } = o;
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
  try {
    navigator.vibrate?.(ms);
  } catch {}
}

/** Gentle two-note swell for revealing a flashcard answer. */
export function playReveal() {
  if (!enabled()) return;
  tone({ freq: 392, dur: 0.12, gain: 0.045, cutoff: 1800 });
  setTimeout(() => tone({ freq: 523, dur: 0.13, gain: 0.04, cutoff: 1900 }), 70);
  vibrate(12);
}

/** Soft rounded "tock" for grading a card (sine + a faint higher partial). */
export function playGrade() {
  if (!enabled()) return;
  tone({ freq: 300, glideTo: 270, dur: 0.1, gain: 0.05, cutoff: 1400 });
  tone({ freq: 600, dur: 0.07, gain: 0.018, cutoff: 2200 });
  vibrate(10);
}

/** Short tick for small confirmations (saved, added). */
export function playTap() {
  if (!enabled()) return;
  tone({ freq: 240, glideTo: 200, dur: 0.07, gain: 0.05 });
  vibrate(8);
}
