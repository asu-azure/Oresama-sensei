import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getStudyPace } from "@/lib/study-pace";
import { getTodayLoad } from "@/lib/review-queue";
import { Nav } from "@/components/nav";
import { ReviewDueSync } from "@/components/review-due-sync";
import { SplashScreen } from "@/components/splash-screen";
import { BackgroundParticles } from "@/components/background-particles";
import { PageTransition } from "@/components/page-transition";
import { SmoothScroll } from "@/components/motion/smooth-scroll";
import { Cursor } from "@/components/motion/cursor";
import { RunningLine } from "@/components/motion/editorial";

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

  // The badge shows what is left to do TODAY, not the lifetime pile. Showing
  // the raw uncapped total on every page is what made a few skipped days feel
  // unrecoverable — and most of that number was never-seen new words, which
  // land with srs_due = NULL and so counted as "due" the moment they appeared.
  const pace = await getStudyPace(supabase, user.id);
  const load = await getTodayLoad(supabase, user.id, pace);
  const count = load.plannedToday.total;

  return (
    <div className="relative flex min-h-dvh flex-col md:flex-row">
      <RunningLine fixedTop />
      <SmoothScroll />
      <Cursor />
      <BackgroundParticles />
      <SplashScreen />
      <ReviewDueSync count={count} />
      <Nav reviewDue={count} />
      <main className="relative z-10 mx-auto w-full max-w-4xl flex-1 px-4 pb-[var(--bottom-nav)]">
        <PageTransition>{children}</PageTransition>
      </main>
    </div>
  );
}