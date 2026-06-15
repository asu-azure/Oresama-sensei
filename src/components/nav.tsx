"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageCircle, BookImage, Settings, LogOut } from "lucide-react";
import { signOut } from "@/app/login/actions";
import { cn } from "@/lib/utils";

const links = [
  { href: "/chat", label: "Chat", icon: MessageCircle },
  { href: "/lessons", label: "Lessons", icon: BookImage },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-surface/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-4xl items-center gap-1 px-4">
        <Link href="/chat" className="mr-3 font-jp text-lg font-bold tracking-tight">
          学びのへや
        </Link>
        <nav className="flex items-center gap-1">
          {links.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-surface-2 text-foreground"
                    : "text-muted hover:bg-surface-2 hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{label}</span>
              </Link>
            );
          })}
        </nav>
        <form action={signOut} className="ml-auto">
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
