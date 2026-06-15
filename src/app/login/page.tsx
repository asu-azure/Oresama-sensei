"use client";

import { useActionState, useState } from "react";
import { motion } from "framer-motion";
import { BookOpenText, Loader2 } from "lucide-react";
import { signIn, signUp, type AuthState } from "./actions";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const action = mode === "signin" ? signIn : signUp;
  const [state, formAction, pending] = useActionState<AuthState, FormData>(
    action,
    undefined,
  );

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background p-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="w-full max-w-sm"
      >
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
            <BookOpenText className="h-7 w-7" />
          </div>
          <h1 className="font-jp text-2xl font-bold tracking-tight">俺様先生</h1>
          <p className="mt-1 text-sm text-muted">
            Your personal Japanese tutor · JLPT N2–N1
          </p>
        </div>

        <form
          action={formAction}
          className="space-y-4 rounded-2xl border border-border bg-surface p-6 shadow-sm"
        >
          <div className="space-y-1.5">
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="password" className="text-sm font-medium">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete={
                mode === "signin" ? "current-password" : "new-password"
              }
              required
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {state?.error && (
            <p className="text-sm text-accent">{state.error}</p>
          )}
          {state?.message && (
            <p className="text-sm text-primary">{state.message}</p>
          )}

          <Button type="submit" disabled={pending} className="w-full" size="lg">
            {pending && <Loader2 className="animate-spin" />}
            {mode === "signin" ? "Sign in" : "Create account"}
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-muted">
          {mode === "signin" ? "No account yet?" : "Already have an account?"}{" "}
          <button
            type="button"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="font-medium text-primary hover:underline"
          >
            {mode === "signin" ? "Sign up" : "Sign in"}
          </button>
        </p>
      </motion.div>
    </main>
  );
}
