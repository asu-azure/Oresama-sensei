"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
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
  Menu,
  X,
} from "lucide-react";
import { signOut } from "@/app/login/actions";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

const links = [
  { href: "/chat", label: "Chat", icon: MessageCircle },
  { href: "/lessons", label: "Lessons", icon: BookImage },
  { href: "/books", label: "Books", icon: BookMarked },
  { href: "/review", label: "Review", icon: Brain },
  { href: "/tests", label: "Tests", icon: GraduationCap },
  { href: "/search", label: "Search", icon: Search },
  { href: "/library", label: "Vocab", icon: Library },
  { href: "/kanji", label: "Kanji", icon: PenLine },
  { href: "/map", label: "Map", icon: Network },
  { href: "/dashboard", label: "Progress", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Nav({ reviewDue = 0 }: { reviewDue?: number }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const current = links.find((l) => pathname.startsWith(l.href));

  return (
    <header className="sticky top-0 z-30 border-b-2 border-border bg-surface/80 backdrop-blur-md [padding-top:env(safe-area-inset-top)]">
      {/* Pop-art accent bar */}
      <div
        aria-hidden="true"
        className="h-1 w-full"
        style={{
          background:
            "linear-gradient(90deg, var(--pop-pink) 0%, var(--pop-yellow) 25%, var(--primary) 50%, var(--pop-cyan) 75%, var(--pop-purple) 100%)",
        }}
      />
      <div className="mx-auto flex min-h-14 max-w-4xl items-center gap-2 py-1.5 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]">
        <Link
          href="/chat"
          className="shrink-0 whitespace-nowrap font-jp text-base font-bold tracking-tight sm:text-lg"
          onClick={() => setOpen(false)}
        >
          俺様先生
        </Link>

        {/* Mobile: show the current page's name so you always know where you are. */}
        <span className="flex min-w-0 flex-1 items-center gap-1.5 truncate text-sm font-medium text-muted md:hidden">
          {current && <current.icon className="h-4 w-4 shrink-0 text-primary" />}
          <span className="truncate">{current?.label ?? ""}</span>
        </span>

        {/* Desktop: the full labeled tab strip (wraps onto rows on md+). */}
        <nav className="-mx-1 hidden min-w-0 flex-1 flex-wrap items-center gap-1 px-1 md:flex">
          {links.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href);
            const showBadge = href === "/review" && reviewDue > 0;
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "relative flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  active ? "text-foreground" : "text-muted hover:text-foreground",
                )}
              >
                {active && (
                  <motion.span
                    layoutId="nav-active"
                    transition={{ type: "spring", stiffness: 400, damping: 32 }}
                    className="absolute inset-0 -z-10 rounded-md bg-surface-2"
                  />
                )}
                <Icon className="h-4 w-4" />
                <span>{label}</span>
                {showBadge && <Badge value={reviewDue} />}
              </Link>
            );
          })}
        </nav>

        <ThemeToggle />

        {/* Desktop sign-out */}
        <form action={signOut} className="hidden shrink-0 md:block">
          <button
            type="submit"
            className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </form>

        {/* Mobile menu button */}
        <button
          onClick={() => setOpen((o) => !o)}
          className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-foreground transition-colors hover:bg-surface-2 md:hidden"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          {!open && reviewDue > 0 && (
            <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-primary" />
          )}
        </button>
      </div>

      {/* Mobile dropdown menu — overlays content (absolute) so nothing shifts. */}
      {open && (
        <>
          {/* Backdrop closes the menu */}
          <button
            aria-hidden="true"
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-10 cursor-default md:hidden"
          />
          <motion.nav
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
            className="absolute inset-x-0 top-full z-20 mx-auto max-w-4xl px-2 pb-2 md:hidden"
          >
            <div className="grid grid-cols-2 gap-1 rounded-2xl border border-border bg-surface p-2 shadow-lg">
              {links.map(({ href, label, icon: Icon }) => {
                const active = pathname.startsWith(href);
                const showBadge = href === "/review" && reviewDue > 0;
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                      active
                        ? "bg-primary/10 text-primary"
                        : "text-foreground hover:bg-surface-2",
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="flex-1 truncate">{label}</span>
                    {showBadge && <Badge value={reviewDue} />}
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
          </motion.nav>
        </>
      )}
    </header>
  );
}

function Badge({ value }: { value: number }) {
  return (
    <span className="ml-0.5 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground">
      {value > 99 ? "99+" : value}
    </span>
  );
}
