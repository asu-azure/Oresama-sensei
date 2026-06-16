import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Nav } from "@/components/nav";
import { SplashScreen } from "@/components/splash-screen";

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
    <div className="flex min-h-dvh flex-col">
      <SplashScreen />
      <Nav reviewDue={count ?? 0} />
      <div className="mx-auto w-full max-w-4xl flex-1 px-4 pb-[env(safe-area-inset-bottom)]">
        {children}
      </div>
    </div>
  );
}