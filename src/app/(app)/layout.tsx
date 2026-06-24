import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Nav } from "@/components/nav";
import { ReviewDueSync } from "@/components/review-due-sync";
import { SplashScreen } from "@/components/splash-screen";
import { BackgroundParticles } from "@/components/background-particles";
import { PixelBuddies } from "@/components/pixel-buddies";
import { PageTransition } from "@/components/page-transition";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const nowIso = new Date().toISOString();
  const { count } = await supabase
    .from("knowledge_items")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .or(`srs_due.is.null,srs_due.lte.${nowIso}`);

  return (
    <div className="relative flex min-h-dvh flex-col md:flex-row">
      <BackgroundParticles />
      <PixelBuddies />
      <SplashScreen />
      <ReviewDueSync count={count ?? 0} />
      <Nav reviewDue={count ?? 0} />
      <main className="relative z-10 mx-auto w-full max-w-4xl flex-1 px-4 pb-[var(--bottom-nav)]">
        <PageTransition>{children}</PageTransition>
      </main>
    </div>
  );
}