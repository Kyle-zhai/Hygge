import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/layout/sidebar";
import { PLANS } from "@/lib/stripe/plans";

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
  let plan = "free";
  let evaluationsUsed = 0;
  let evaluationsLimit = PLANS.free.evaluationsLimit;

  if (user) {
    const [{ data: projects }, { data: subscription }] = await Promise.all([
      supabase
        .from("projects")
        .select("id, raw_input, parsed_data, evaluations (id, status, mode)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("subscriptions")
        .select("plan, evaluations_used, evaluations_limit")
        .eq("user_id", user.id)
        .single(),
    ]);

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

    if (subscription) {
      plan = subscription.plan;
      evaluationsUsed = subscription.evaluations_used;
      evaluationsLimit = subscription.evaluations_limit;
    }
  }

  return (
    <div className="flex min-h-screen bg-[#0C0C0C]">
      <Sidebar
        userEmail={user?.email ?? null}
        history={history}
        plan={plan}
        evaluationsUsed={evaluationsUsed}
        evaluationsLimit={evaluationsLimit}
      />
      <main className="min-w-0 flex-1 md:ml-[260px] transition-[margin-left] duration-300">
        {children}
      </main>
    </div>
  );
}
