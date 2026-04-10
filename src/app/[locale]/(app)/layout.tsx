import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/layout/sidebar";

interface ProjectRow {
  id: string;
  parsed_data: { name?: string } | null;
  raw_input: string;
  evaluations: { id: string; status: string }[];
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let history: { id: string; name: string; evaluationId: string | null; status: string | null }[] = [];

  if (user) {
    const { data: projects } = await supabase
      .from("projects")
      .select("id, raw_input, parsed_data, evaluations (id, status)")
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
        };
      });
    }
  }

  return (
    <div className="flex h-screen bg-[#0C0C0C]">
      <Sidebar userEmail={user?.email ?? null} history={history} />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-5xl px-4 py-8 pl-14 sm:px-6 md:pl-6 lg:px-8">
          {children}
        </div>
      </main>
    </div>
  );
}
