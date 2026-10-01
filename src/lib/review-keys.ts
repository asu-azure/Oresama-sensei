// Keyboard grading for the flashcard screen — Anki-compatible on purpose, so
// muscle memory transfers: Space reveals and then answers Good (by far the
// most common answer), 1–4 map left-to-right onto the four rating buttons.

export interface ReviewKeyHandlers {
  reveal?: () => void;
  again?: () => void;
  hard?: () => void;
  good?: () => void;
  easy?: () => void;
  speak?: () => void;
  details?: () => void;
  note?: () => void;
  help?: () => void;
  escape?: () => void;
}

/** Shown in the on-screen cheatsheet. */
export const REVIEW_SHORTCUTS: { keys: string; what: string }[] = [
  { keys: "Space", what: "Show answer, then Good" },
  { keys: "1 2 3 4", what: "Again · Hard · Good · Easy" },
  { keys: "S", what: "Say the word" },
  { keys: "D", what: "Card details" },
  { keys: "N", what: "Write a note" },
  { keys: "?", what: "This list" },
  { keys: "Esc", what: "Close" },
];

/** The keystroke belongs to something being typed into. Not optional: the note
 *  editor takes focus on open and Ask Sensei's box can sit over any card, so
 *  without this a digit typed into a note would grade the card. */
function typing(e: KeyboardEvent): boolean {
  for (const node of [e.target, document.activeElement] as (HTMLElement | null)[]) {
    if (!node || !(node instanceof HTMLElement)) continue;
    const tag = node.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || node.isContentEditable) return true;
  }
  return false;
}

/** Attach the bindings to window. `get()` is read on every keystroke, so the
 *  handlers always see current state. Returns the detach function. */
export function bindReviewKeys(get: () => ReviewKeyHandlers): () => void {
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.repeat) return; // a held key must not grade once per repeat
    if (e.ctrlKey || e.metaKey || e.altKey) return; // leave browser chords alone
    if (e.isComposing) return;
    // A modal (picture search, drawing, lightbox) owns the keyboard.
    if (document.querySelector("dialog[open]")) return;
    const h = get();

    if (e.key === "Escape") {
      // An open Ask Sensei panel closes itself on Escape.
      if (document.querySelector("[data-overlay]")) return;
      if (h.escape) {
        e.preventDefault();
        h.escape();
      }
      return;
    }
    if (typing(e)) return;

    const run = (fn?: () => void) => {
      if (!fn) return;
      e.preventDefault(); // Space would also scroll
      fn();
    };
    switch (e.key) {
      case " ":
      case "Enter":
        // Enter on a focused button should press that button, not reveal.
        if (e.key === "Enter" && (e.target as HTMLElement | null)?.closest?.("button, a")) return;
        run(h.reveal);
        break;
      case "1":
        run(h.again);
        break;
      case "2":
        run(h.hard);
        break;
      case "3":
        run(h.good);
        break;
      case "4":
        run(h.easy);
        break;
      case "s":
      case "S":
        run(h.speak);
        break;
      case "d":
      case "D":
        run(h.details);
        break;
      case "n":
      case "N":
        run(h.note);
        break;
      case "?":
        run(h.help);
        break;
    }
  };
  window.addEventListener("keydown", onKeyDown);
  return () => window.removeEventListener("keydown", onKeyDown);
}
