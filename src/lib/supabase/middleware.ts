import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refreshes the Supabase auth session on every request and enforces login.
 * Called from the root `proxy.ts` (Next.js 16's renamed middleware).
 *
 * IMPORTANT: returns the `supabaseResponse` object as-is so the refreshed
 * auth cookies are propagated to the browser.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Do not run code between createServerClient and getUser() — it can cause
  // hard-to-debug session refresh issues.
  let user: import("@supabase/supabase-js").User | null = null;
  try {
    const result = await supabase.auth.getUser();
    user = result.data.user;
  } catch (e) {
    // Treat transient auth/network errors as "not signed in" rather than
    // 500-ing every route.
    console.error("proxy getUser failed:", e);
  }

  const path = request.nextUrl.pathname;
  const isAuthRoute = path.startsWith("/login") || path.startsWith("/auth");

  if (!user && !isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && path === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/chat";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
