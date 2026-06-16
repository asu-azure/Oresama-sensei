"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  MessageCircle,
  BookImage,
  Brain,
  Network,
  Library,
  BarChart3,
  Settings,
  LogOut,
} from "lucide-react";
import { signOut } from "@/app/login/actions";
import { cn } from "@/lib/utils";

const links = [
  { href: "/chat", label: "Chat", icon: MessageCircle },
  { href: "/lessons", label: "Lessons", icon: BookImage },
  { href: "/review", label: "Review", icon: Brain },
  { href: "/library", label: "Vocab", icon: Library },
  { href: "/map", label: "Map", icon: Network },
  { href: "/dashboard", label: "Progress", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Nav({ reviewDue = 0 }: { reviewDue?: number }) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-surface/80 backdrop-blur-md [padding-top:env(safe-area-inset-top)]">
      <div className="mx-auto flex h-14 max-w-4xl items-center gap-2 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]">
        <Link
          href="/chat"
          className="shrink-0 whitespace-nowrap font-jp text-base font-bold tracking-tight sm:text-lg"
        >
          俺様先生
        </Link>
        <nav className="no-scrollbar -mx-1 flex min-w-0 flex-1 items-center gap-1 overflow-x-auto px-1">
          {links.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href);
            const showBadge = href === "/review" && reviewDue > 0;
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "relative flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  active
                    ? "text-foreground"
                    : "text-muted hover:text-foreground",
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
                <span className="hidden sm:inline">{label}</span>
                {showBadge && (
                  <span className="ml-0.5 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground">
                    {reviewDue > 99 ? "99+" : reviewDue}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
        <form action={signOut} className="shrink-0">
          <button
            type="submit"
            className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </form>
      </div>
    </header>
  );
}