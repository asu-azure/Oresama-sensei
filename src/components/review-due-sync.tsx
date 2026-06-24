"use client";

import { useEffect } from "react";
import { setReviewDue } from "@/lib/use-review-due";

/** Seeds the live due-count store from the server-computed count on every
 *  navigation (the layout recomputes `count` each render). Renders nothing.
 *  `setReviewDue` is a plain store setter, not React state, so this effect is
 *  lint-clean (no set-state-in-effect). */
export function ReviewDueSync({ count }: { count: number }) {
  useEffect(() => {
    setReviewDue(count);
  }, [count]);
  return null;
}
