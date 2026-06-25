"use client";

import { useState } from "react";
import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageCircle,
  BookImage,
  BookMarked,
  Brain,
  Network,
  Library,
  BarChart3,
  Settings,
  LogOut,
  Search,
  GraduationCap,
  PenLine,
  AtSign,
  LineChart,
  MoreHorizontal,
  Loader2,
  X,
} from "lucide-react";
import { signOut } from "@/app/login/actions";
import { ThemeToggle } from "@/components/theme-toggle";
import { playTap } from "@/lib/use-sound";
import { useReviewDue } from "@/lib/use-review-due";
import { cn } from "@/lib/utils";

/** Shows a spinner while THIS link's navigation is pending, so a tap registers
 *  immediately even when the next page is still fetching. Must render inside a
 *  <Link> (useLinkStatus reads that link's transition state). */
function NavLinkSpinner({ className }: { className?: string }) {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return (
    <Loader2
      className={cn("h-3.5 w-3.5 animate-spin text-primary", className)}
    />
  );
}

const links = [
  { href: "/chat", label: "Chat", icon: MessageCircle },
  { href: "/sns", label: "SNS", icon: AtSign },
  { href: "/lessons", label: "Lessons", icon: BookImage },
  { href: "/books", label: "Books", icon: BookMarked },
  { href: "/review", label: "Review", icon: Brain },
  { href: "/tests", label: "Tests", icon: GraduationCap },
  { href: "/search", label: "Search", icon: Search },
  { href: "/library", label: "Vocab", icon: Library },
  { href: "/kanji", label: "Kanji", icon: PenLine },
  { href: "/map", label: "Map", icon: Network },
  { href: "/dashboard", label: "Progress", icon: BarChart3 },
  { href: "/insights", label: "Insights", icon: LineChart },
  { href: "/settings", label: "Settings", icon: Settings },
];

// The four destinations that get prime spots in the mobile bottom bar; the rest
// live in the "More" sheet. (Desktop shows all of `links` in the sidebar.)
const PRIMARY_HREFS = ["/chat", "/review", "/books", "/dashboard"];
const primaryLinks = PRIMARY_HREFS.map(
  (h) => links.find((l) => l.href === h)!,
);
const moreLinks = links.filter((l) => !PRIMARY_HREFS.includes(l.href));

// Thin iridescent cobalt rule along the nav edge (editorial FUI).
const ACCENT =
  "linear-gradient(90deg, transparent 0%, var(--accent) 25%, #18c4d6 50%, var(--accent) 75%, transparent 100%)";

export function Nav({ reviewDue = 0 }: { reviewDue?: number }) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  // Live due count (updates the instant a card is graded); falls back to the
  // server-seeded prop before the store is seeded.
  const liveDue = useReviewDue();
  const dueCount = liveDue ?? reviewDue;

  const current = links.find((l) => pathname.startsWith(l.href));
  const moreActive = moreLinks.some((l) => pathname.startsWith(l.href));

  return (
    <>
      {/* ===== Desktop: left sidebar ===== */}
      <aside className="sticky top-0 z-30 hidden h-dvh w-60 shrink-0 flex-col border-r border-border bg-surface/80 backdrop-blur-md md:flex">
        <div aria-hidden="true" className="h-px w-full shrink-0" style={{ background: ACCENT }} />
        <div className="flex min-h-0 flex-1 flex-col px-3 py-4">
          <Link
            href="/chat"
            className="mb-4 px-2 text-xl font-medium tracking-tight"
            style={{ fontFamily: "var(--font-serif-jp)" }}
          >
            俺様先生
          </Link>
          <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto">
            {links.map(({ href, label, icon: Icon }) => {
              const active = pathname.startsWith(href);
              const showBadge = href === "/review" && dueCount > 0;
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={playTap}
                  className={cn(
                    "relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    active ? "text-foreground" : "text-muted hover:text-foreground",
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="nav-active-side"
                      transition={{ type: "spring", stiffness: 400, damping: 32 }}
                      className="absolute inset-0 -z-10 rounded-lg bg-surface-2"
                    />
                  )}
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="flex-1">{label}</span>
                  <NavLinkSpinner />
                  {showBadge && <Badge value={dueCount} />}
                </Link>
              );
            })}
          </nav>
          <div className="mt-2 flex items-center justify-between border-t border-border pt-3">
            <form action={signOut}>
              <button
                type="submit"
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
                title="Sign out"
              >
                <LogOut className="h-4 w-4" /> Sign out
              </button>
            </form>
            <ThemeToggle />
          </div>
        </div>
      </aside>

      {/* ===== Mobile: slim top bar (brand + page title + theme) ===== */}
      <header className="sticky top-0 z-30 border-b border-border bg-surface backdrop-blur-md [padding-top:env(safe-area-inset-top)] md:hidden">
        <div aria-hidden="true" className="h-px w-full" style={{ background: ACCENT }} />
        <div className="flex h-12 items-center gap-2 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]">
          <Link
            href="/chat"
            className="shrink-0 whitespace-nowrap text-base font-medium tracking-tight"
            style={{ fontFamily: "var(--font-serif-jp)" }}
          >
            俺様先生
          </Link>
          <span className="flex min-w-0 flex-1 items-center gap-1.5 truncate text-sm font-medium text-muted">
            {current && <current.icon className="h-4 w-4 shrink-0 text-primary" />}
            <span className="truncate">{current?.label ?? ""}</span>
          </span>
          <ThemeToggle />
        </div>
      </header>

      {/* ===== Mobile: fixed bottom tab bar ===== */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/90 backdrop-blur-md md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="mx-auto flex h-15 max-w-lg items-stretch">
          {primaryLinks.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href);
            const showBadge = href === "/review" && dueCount > 0;
            return (
              <Link
                key={href}
                href={href}
                onClick={() => {
                  playTap();
                  setMoreOpen(false);
                }}
                className={cn(
                  "relative flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-colors",
                  active ? "text-primary" : "text-muted",
                )}
              >
                {active && (
                  <motion.span
                    layoutId="nav-active-bottom"
                    transition={{ type: "spring", stiffness: 400, damping: 32 }}
                    className="absolute inset-x-3 top-1 h-0.5 rounded-full bg-primary"
                  />
                )}
                <span className="relative">
                  <Icon className="h-5 w-5" />
                  {showBadge && (
                    <span className="absolute -right-2 -top-1.5">
                      <Badge value={dueCount} />
                    </span>
                  )}
                  <NavLinkSpinner className="absolute -right-2.5 -top-2" />
                </span>
                {label}
              </Link>
            );
          })}
          <button
            onClick={() => setMoreOpen((o) => !o)}
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-colors",
              moreOpen || moreActive ? "text-primary" : "text-muted",
            )}
            aria-expanded={moreOpen}
          >
            <MoreHorizontal className="h-5 w-5" />
            More
          </button>
        </div>
      </nav>

      {/* ===== Mobile: "More" sheet ===== */}
      <AnimatePresence>
        {moreOpen && (
          <>
            <motion.button
              aria-hidden="true"
              tabIndex={-1}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMoreOpen(false)}
              className="fixed inset-0 z-40 cursor-default bg-black/30 md:hidden"
            />
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 24 }}
              transition={{ type: "spring", stiffness: 360, damping: 32 }}
              className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl border border-border bg-background shadow-2xl md:hidden"
              style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
            >
              <div className="flex items-center gap-2 border-b border-border px-4 py-3">
                <span className="text-sm font-medium">More</span>
                <button
                  onClick={() => setMoreOpen(false)}
                  className="ml-auto rounded-lg p-1.5 transition-colors hover:bg-surface-2"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-1 p-3">
                {moreLinks.map(({ href, label, icon: Icon }) => {
                  const active = pathname.startsWith(href);
                  return (
                    <Link
                      key={href}
                      href={href}
                      onClick={() => {
                        playTap();
                        setMoreOpen(false);
                      }}
                      className={cn(
                        "flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                        active
                          ? "bg-primary/10 text-primary"
                          : "text-foreground hover:bg-surface-2",
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="flex-1 truncate">{label}</span>
                      <NavLinkSpinner />
                    </Link>
                  );
                })}
                <form action={signOut} className="col-span-2 mt-1">
                  <button
                    type="submit"
                    className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
                  >
                    <LogOut className="h-4 w-4" /> Sign out
                  </button>
                </form>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

function Badge({ value }: { value: number }) {
  return (
    <span className="inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground">
      {value}
    </span>
  );
}
