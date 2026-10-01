// MV motion helpers — the small JS half of src/styles/mv.css (ported from
// pressroom, minus GSAP: nothing here needs a tween library). Everything is
// ≤ 600 ms and a no-op under prefers-reduced-motion.

const reduced = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Re-trigger a one-shot CSS animation class on `el`. */
function replay(el: Element | null | undefined, cls: string) {
  if (!el || reduced()) return;
  el.classList.remove(cls);
  void (el as HTMLElement).offsetWidth;
  el.classList.add(cls);
}

/** A 180 ms scale kick. Inline elements need display:inline-block. */
export const punch = (el: Element | null | undefined) => replay(el, "mv-punch");

/** The RGB split converging onto `el` (a heading, a flashcard term). */
export const converge = (el: Element | null | undefined) => replay(el, "mv-converge");

/** A ring of light at viewport point (x, y), like a note hitting the playhead. */
export function strike(x: number, y: number, tone: "accent" | "amber" = "accent") {
  if (reduced()) return;
  const ring = document.createElement("span");
  ring.className = tone === "amber" ? "mv-strike mv-strike--amber" : "mv-strike";
  ring.style.left = `${x}px`;
  ring.style.top = `${y}px`;
  ring.setAttribute("aria-hidden", "true");
  ring.addEventListener("animationend", () => ring.remove(), { once: true });
  document.body.appendChild(ring);
  setTimeout(() => ring.remove(), 800); // animationend never fires in a background tab
}

/** Svelte action: converge once when the element mounts. */
export function arrive(node: HTMLElement) {
  converge(node);
  return {};
}

/** Page-wide wiring, called once from Base.astro: pressing a .btn, a .chip
 *  button or anything [data-strike] rings a strike at the pointer. */
export function initMv() {
  document.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    const hit = (e.target as Element | null)?.closest?.(".btn, button.chip, [data-strike]");
    if (hit && !(hit as HTMLButtonElement).disabled) strike(e.clientX, e.clientY);
  });
}
