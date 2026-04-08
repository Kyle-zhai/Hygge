import Link from "next/link";
import { useLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { UsageBar } from "@/components/dashboard/usage-bar";
import { ProjectList } from "@/components/dashboard/project-list";

export default async function DashboardPage() {
  const t = await getTranslations("dashboard");
  const tc = await getTranslations("common");
  const locale = useLocale();
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">{t("title")}</h1>
        <Button asChild>
          <Link href={`/${locale}/evaluate/new`}>{tc("startNew")}</Link>
        </Button>
      </div>
      {subscription && (
        <UsageBar used={subscription.evaluations_used} limit={subscription.evaluations_limit} plan={subscription.plan} />
      )}
      {projects && projects.length > 0 ? (
        <ProjectList projects={projects as any} />
      ) : (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16">
          <p className="mb-4 text-muted-foreground">{t("empty")}</p>
          <Button asChild>
            <Link href={`/${locale}/evaluate/new`}>{tc("startNew")}</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
