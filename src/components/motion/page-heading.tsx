"use client";

import type { ReactNode } from "react";
import { Reveal } from "@/components/motion/reveal";
import { Gline, FlowText } from "@/components/motion/editorial";
import { cn } from "@/lib/utils";

/**
 * Editorial page header — a mono kicker, an optional Japanese accent, the
 * signature gradient draw-line, and a display title that rises in on a mask
 * reveal. `jp` prints a serif-JP word beside the title; `vtext` pins a vertical
 * Japanese column to the right of the header (decorative, desktop only).
 */
export function PageHeading({
  kicker,
  title,
  jp,
  vtext,
  subtitle,
  flow = false,
  serif = false,
  className,
}: {
  kicker?: string;
  title: ReactNode;
  jp?: string;
  vtext?: string;
  subtitle?: ReactNode;
  flow?: boolean;
  serif?: boolean;
  className?: string;
}) {
  return (
    <header className={cn("relative mb-6 mt-2", className)}>
      {vtext && (
        <span
          className="vtext absolute right-0 top-1 hidden text-[0.7rem] sm:block"
          aria-hidden="true"
        >
          {vtext}
        </span>
      )}
      {kicker && (
        <Reveal className="mb-2" delay={0}>
          <span className="mono">{kicker}</span>
        </Reveal>
      )}
      <Gline className="mb-3" />
      <Reveal as="h1" delay={0.05}>
        <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          {flow ? (
            <FlowText
              className={cn(
                "text-3xl font-bold uppercase tracking-tight sm:text-4xl",
                serif && "!normal-case",
              )}
            >
              {title}
            </FlowText>
          ) : (
            <span
              className={cn(
                "text-3xl font-semibold tracking-tight sm:text-4xl",
                serif && "serif font-medium",
              )}
            >
              {title}
            </span>
          )}
          {jp && (
            <span
              className="text-lg text-muted sm:text-xl"
              style={{ fontFamily: "var(--font-serif-jp)" }}
            >
              {jp}
            </span>
          )}
        </span>
      </Reveal>
      {subtitle && (
        <Reveal className="mt-2 max-w-2xl text-sm text-muted" delay={0.12}>
          <span>{subtitle}</span>
        </Reveal>
      )}
    </header>
  );
}
