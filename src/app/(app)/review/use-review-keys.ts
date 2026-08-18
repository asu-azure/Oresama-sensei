"use client";

import { useEffect, useInsertionEffect, useRef } from "react";

/** One handler per bound key. Every one is optional so a screen can bind a
 *  subset. */
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

/** The bindings, also rendered in the on-screen cheatsheet. */
export const REVIEW_SHORTCUTS: { keys: string; what: string }[] = [
  { keys: "Space", what: "Show answer, then Good" },
  { keys: "1 / 2 / 3 / 4", what: "Again / Hard / Good / Easy" },
  { keys: "S", what: "Say the word" },
  { keys: "D", what: "Card details" },
  { keys: "N", what: "Add a note" },
  { keys: "?", what: "This list" },
  { keys: "Esc", what: "Close" },
];

/** True when the keystroke belongs to something the user is typing into.
 *
 *  This is not optional. The note editor is autoFocus'd, Ask-Sensei's textarea
 *  can be open over any card, and the image search renders through a portal to
 *  document.body — so a window listener without this guard would type digits
 *  into a note instead of grading the card. */
function isTypingTarget(e: KeyboardEvent): boolean {
  const el = (e.target as HTMLElement | null) ?? null;
  const active = document.activeElement as HTMLElement | null;
  for (const node of [el, active]) {
    if (!node) continue;
    const tag = node.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
    if (node.isContentEditable) return true;
  }
  return false;
}

/**
 * Global keyboard shortcuts for the flashcard screen.
 *
 * Anki-compatible on purpose, so existing muscle memory transfers: Space
 * reveals and then answers Good (much the most common answer), 1-4 map
 * left-to-right onto the four rating buttons.
 *
 * `handlers` is read through a ref so the listener is attached exactly once and
 * never restarts on re-render — which matters because it must not miss a
 * keystroke between renders.
 */
export function useReviewKeys(
  handlers: ReviewKeyHandlers,
  enabled = true,
): void {
  const ref = useRef(handlers);
  // Written in an insertion effect rather than during render: refs must not be
  // mutated while rendering, and this runs before any layout effect or paint,
  // so the listener can never observe a stale handler set.
  useInsertionEffect(() => {
    ref.current = handlers;
  });

  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (e: KeyboardEvent) => {
      // Key-repeat would otherwise fire a grade per repeat from one held key.
      if (e.repeat) return;
      // Leave browser/OS chords alone (Cmd+R, Ctrl+F, …). Shift is allowed
      // because "?" needs it.
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const h = ref.current;

      // Escape is the one key that must work while typing — it is how you get
      // out of the note editor.
      if (e.key === "Escape") {
        if (h.escape) {
          e.preventDefault();
          h.escape();
        }
        return;
      }

      if (isTypingTarget(e)) return;

      const run = (fn?: () => void) => {
        if (!fn) return;
        e.preventDefault(); // Space would also scroll the page.
        fn();
      };

      switch (e.key) {
        case " ":
        case "Spacebar":
        case "Enter":
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
        default:
          break;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled]);
}
