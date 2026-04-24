import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/layout/sidebar";
import { PLANS } from "@/lib/stripe/plans";

interface ProjectRow {
  id: string;
  parsed_data: { name?: string } | null;
  raw_input: string;
  created_at: string;
  evaluations: { id: string; status: string; mode: string; comparison_base_id: string | null }[];
}

interface DebateRow {
  id: string;
  evaluation_id: string | null;
  persona_id: string;
  title: string | null;
  updated_at: string;
}

interface PersonaIdentity {
  name?: string;
  locale_variants?: Record<string, { name?: string } | undefined>;
}

function resolvePersonaName(identity: PersonaIdentity | null | undefined, locale: string): string {
  if (!identity) return "";
  return identity.locale_variants?.[locale]?.name || identity.name || "";
}

function buildDebateLabel(topic: string, personaName: string, locale: string): string {
  const topicQuoted = topic ? (locale === "zh" ? `「${topic}」` : `"${topic}"`) : "";
  if (locale === "zh") {
    if (topic && personaName) return `就${topicQuoted}与${personaName}的辩论`;
    if (personaName) return `与${personaName}的辩论`;
    if (topic) return `关于${topicQuoted}的辩论`;
    return "辩论";
  }
  if (topic && personaName) return `Debate with ${personaName} on ${topicQuoted}`;
  if (personaName) return `Debate with ${personaName}`;
  if (topic) return `Debate on ${topicQuoted}`;
  return "Debate";
}

export default async function AppLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let history: { id: string; name: string; evaluationId: string | null; status: string | null; mode: string; isCompare: boolean; isDebate?: boolean; debateId?: string; createdAt?: string }[] = [];
  let plan = "free";
  let evaluationsUsed = 0;
  let evaluationsLimit = PLANS.free.evaluationsLimit;

  let isBYOK = false;
  if (user) {
    const [{ data: projects }, { data: subscription }, { data: debates }, { data: llm }] = await Promise.all([
      supabase
        .from("projects")
        .select("id, raw_input, parsed_data, created_at, evaluations (id, status, mode, comparison_base_id)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("subscriptions")
        .select("plan, evaluations_used, evaluations_limit")
        .eq("user_id", user.id)
        .single(),
      supabase
        .from("debates")
        .select("id, evaluation_id, persona_id, title, updated_at")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(10),
      supabase
        .from("user_llm_chain_entries")
        .select("id")
        .eq("user_id", user.id)
        .eq("enabled", true)
        .limit(1),
    ]);
    isBYOK = Array.isArray(llm) && llm.length > 0;

    if (projects) {
      history = (projects as unknown as ProjectRow[]).map((p) => {
        const eval0 = Array.isArray(p.evaluations) ? p.evaluations[0] : p.evaluations;
        return {
          id: p.id,
          name: p.parsed_data?.name || p.raw_input.slice(0, 40),
          evaluationId: eval0?.id ?? null,
          status: eval0?.status ?? null,
          mode: eval0?.mode ?? "topic",
          isCompare: !!eval0?.comparison_base_id,
          createdAt: p.created_at,
        };
      });
    }

    const debateRows = (debates || []) as DebateRow[];
    if (debateRows.length > 0) {
      const personaIds = Array.from(new Set(debateRows.map((d) => d.persona_id).filter(Boolean)));
      const evalIds = Array.from(new Set(debateRows.map((d) => d.evaluation_id).filter((id): id is string => !!id)));

      const [{ data: personaRows }, { data: evalRows }] = await Promise.all([
        personaIds.length > 0
          ? supabase.from("personas").select("id, identity").in("id", personaIds)
          : Promise.resolve({ data: [] as { id: string; identity: PersonaIdentity }[] }),
        evalIds.length > 0
          ? supabase.from("evaluations").select("id, project_id").in("id", evalIds)
          : Promise.resolve({ data: [] as { id: string; project_id: string }[] }),
      ]);

      const projectIds = Array.from(
        new Set((evalRows || []).map((e) => e.project_id).filter((id): id is string => !!id))
      );
      const { data: projectRows } = projectIds.length > 0
        ? await supabase.from("projects").select("id, parsed_data, raw_input").in("id", projectIds)
        : { data: [] as { id: string; parsed_data: { name?: string } | null; raw_input: string }[] };

      const personaMap = new Map(
        (personaRows || []).map((p) => [p.id, p.identity as PersonaIdentity])
      );
      const evalToProject = new Map(
        (evalRows || []).map((e) => [e.id, e.project_id])
      );
      const projectMap = new Map(
        (projectRows || []).map((p) => [p.id, p as { parsed_data: { name?: string } | null; raw_input: string }])
      );

      for (const d of debateRows) {
        const personaName = resolvePersonaName(personaMap.get(d.persona_id), locale);
        const projectId = d.evaluation_id ? evalToProject.get(d.evaluation_id) : undefined;
        const project = projectId ? projectMap.get(projectId) : undefined;
        const topic = project?.parsed_data?.name || project?.raw_input?.slice(0, 40) || "";
        history.push({
          id: `debate-${d.id}`,
          name: d.title || buildDebateLabel(topic, personaName, locale),
          evaluationId: null,
          status: "completed",
          mode: "debate",
          isCompare: false,
          isDebate: true,
          debateId: d.id,
          createdAt: d.updated_at,
        });
      }
    }

    history.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

    if (subscription) {
      plan = subscription.plan;
      evaluationsUsed = subscription.evaluations_used;
      evaluationsLimit = subscription.evaluations_limit;
    }
  }

  return (
    <div className="flex min-h-screen bg-[color:var(--bg-primary)]">
      <Sidebar
        userEmail={user?.email ?? null}
        history={history}
        plan={isBYOK ? "byok" : plan}
        evaluationsUsed={evaluationsUsed}
        evaluationsLimit={evaluationsLimit}
        isBYOK={isBYOK}
      />
      <main className="min-w-0 flex-1 md:ml-[260px] transition-[margin-left] duration-300">
        {children}
      </main>
    </div>
  );
}
