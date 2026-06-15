import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Nav } from "@/components/nav";

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

  return (
    <div className="flex min-h-dvh flex-col">
      <Nav />
      <div className="mx-auto w-full max-w-4xl flex-1 px-4">{children}</div>
    </div>
  );
}
