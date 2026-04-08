import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "@/components/settings/profile-form";

export default async function SettingsPage() {
  const t = await getTranslations("settings");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("plan, evaluations_used, evaluations_limit")
    .eq("user_id", user!.id)
    .single();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-3xl font-bold">{t("title")}</h1>
      <ProfileForm
        email={user!.email ?? ""}
        plan={subscription?.plan ?? "free"}
        evaluationsUsed={subscription?.evaluations_used ?? 0}
        evaluationsLimit={subscription?.evaluations_limit ?? 1}
      />
    </div>
  );
}
