import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { UsageBar } from "@/components/dashboard/usage-bar";
import { ProjectList } from "@/components/dashboard/project-list";
import { Plus } from "lucide-react";

export default async function DashboardPage() {
  const t = await getTranslations("dashboard");
  const tc = await getTranslations("common");
  const locale = await getLocale();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: subscription }, { data: projects }] = await Promise.all([
    supabase.from("subscriptions").select("*").eq("user_id", user!.id).single(),
    supabase
      .from("projects")
      .select("id, raw_input, parsed_data, url, created_at, evaluations (id, status, selected_persona_ids, created_at, completed_at)")
      .eq("user_id", user!.id)
      .order("created_at", { ascending: false }),
  ]);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold text-[#EAEAE8] tracking-[-0.02em]">
          {t("title")}
        </h1>
        <Button
          asChild
          className="bg-[#E2DDD5] hover:bg-[#D4CFC7] text-[#0C0C0C] btn-glow rounded-lg font-semibold"
        >
          <Link href={`/${locale}/evaluate/new`}>
            <Plus className="mr-2 h-4 w-4" />
            {tc("startNew")}
          </Link>
        </Button>
      </div>
      {subscription && (
        <UsageBar used={subscription.evaluations_used} limit={subscription.evaluations_limit} plan={subscription.plan} />
      )}
      {projects && projects.length > 0 ? (
        <ProjectList projects={projects as any} />
      ) : (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#2A2A2A] bg-[#141414] py-16">
          <p className="mb-4 text-[#666462]">{t("empty")}</p>
          <Button
            asChild
            className="bg-[#E2DDD5] hover:bg-[#D4CFC7] text-[#0C0C0C] btn-glow rounded-lg font-semibold"
          >
            <Link href={`/${locale}/evaluate/new`}>
              <Plus className="mr-2 h-4 w-4" />
              {tc("startNew")}
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}
