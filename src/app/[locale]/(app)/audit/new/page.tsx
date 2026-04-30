import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AuditIntake } from "@/components/audit/audit-intake";
import type { AuditTemplate } from "@/lib/audit/types";

export default async function AuditNewPage() {
  const locale = await getLocale();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/auth/login`);

  const t = await getTranslations("audit");

  const { data } = await supabase
    .from("audit_templates")
    .select("slug, name_en, name_zh, description_en, description_zh, regulation_refs, default_persona_ids, display_order, is_active, system_prompt_overlay, output_schema")
    .eq("is_active", true)
    .order("display_order");

  const templates = (data ?? []) as AuditTemplate[];

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2 text-muted-foreground">
          <ShieldCheck className="h-4 w-4" />
          <span className="text-xs uppercase tracking-wider">{t("navLabel")}</span>
        </div>
        <h1 className="text-3xl font-semibold tracking-tight mb-2">{t("newTitle")}</h1>
        <p className="text-muted-foreground">{t("newSubtitle")}</p>
      </div>

      <AuditIntake templates={templates} locale={locale} />
    </div>
  );
}
