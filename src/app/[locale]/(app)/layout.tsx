import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/layout/sidebar";

interface ProjectRow {
  id: string;
  parsed_data: { name?: string } | null;
  raw_input: string;
  evaluations: { id: string; status: string; mode: string }[];
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let history: { id: string; name: string; evaluationId: string | null; status: string | null; mode: string }[] = [];

  if (user) {
    const { data: projects } = await supabase
      .from("projects")
      .select("id, raw_input, parsed_data, evaluations (id, status, mode)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);

    if (projects) {
      history = (projects as unknown as ProjectRow[]).map((p) => {
        const eval0 = Array.isArray(p.evaluations) ? p.evaluations[0] : p.evaluations;
        return {
          id: p.id,
          name: p.parsed_data?.name || p.raw_input.slice(0, 40),
          evaluationId: eval0?.id ?? null,
          status: eval0?.status ?? null,
          mode: eval0?.mode ?? "topic",
        };
      });
    }
  }

  return (
    <div className="flex min-h-screen bg-[#0C0C0C]">
      <Sidebar userEmail={user?.email ?? null} history={history} />
      <main className="min-w-0 flex-1 pl-12 md:ml-[260px] md:pl-0">
        {children}
      </main>
    </div>
  );
}
