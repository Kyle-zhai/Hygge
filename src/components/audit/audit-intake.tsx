"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ChevronDown, Loader2, Sparkles, ShieldCheck } from "lucide-react";
import type { AuditTemplate, DecisionUrgency } from "@/lib/audit/types";
import { matchTemplate } from "@/lib/audit/template-match";

interface Props {
  templates: AuditTemplate[];
  locale: string;
}

const URGENCY_OPTIONS: DecisionUrgency[] = ["low", "medium", "high"];

const TEMPLATE_I18N_KEY: Record<string, { name: string; desc: string }> = {
  "eu-aia-art14": { name: "templateEuAia14Name", desc: "templateEuAia14Desc" },
  "product-launch-premortem": { name: "templateProductLaunchName", desc: "templateProductLaunchDesc" },
  "hiring-decision-audit": { name: "templateHiringName", desc: "templateHiringDesc" },
  "ai-feature-release": { name: "templateAiFeatureName", desc: "templateAiFeatureDesc" },
  "strategy-premortem": { name: "templateStrategyName", desc: "templateStrategyDesc" },
};

function templateLabels(template: AuditTemplate, locale: string, t: ReturnType<typeof useTranslations>) {
  const i18nKeys = TEMPLATE_I18N_KEY[template.slug];
  if (i18nKeys) {
    return { name: t(i18nKeys.name as never), desc: t(i18nKeys.desc as never) };
  }
  return {
    name: locale === "zh" ? template.name_zh : template.name_en,
    desc: locale === "zh" ? template.description_zh : template.description_en,
  };
}

export function AuditIntake({ templates, locale }: Props) {
  const t = useTranslations("audit");
  const router = useRouter();
  const [decisionText, setDecisionText] = useState("");
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [owner, setOwner] = useState("");
  const [urgency, setUrgency] = useState<DecisionUrgency>("medium");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const match = useMemo(() => {
    if (decisionText.trim().length < 30) return null;
    const m = matchTemplate(decisionText);
    if (!m) return null;
    const validSlugs = new Set(templates.map((tpl) => tpl.slug));
    if (!validSlugs.has(m.primary_slug)) return null;
    return {
      ...m,
      alternates: m.alternates.filter((slug) => validSlugs.has(slug)),
    };
  }, [decisionText, templates]);

  const effectiveSelectedSlug = selectedSlug ?? match?.primary_slug ?? null;

  const recommended = useMemo(
    () => templates.find((tpl) => tpl.slug === match?.primary_slug),
    [templates, match]
  );

  const alternateTemplates = useMemo(() => {
    const altSet = new Set(match?.alternates ?? []);
    return templates.filter((tpl) => {
      if (recommended && tpl.slug === recommended.slug) return false;
      return altSet.has(tpl.slug) || !match;
    });
  }, [templates, match, recommended]);

  function onSubmit() {
    setError(null);
    if (decisionText.trim().length < 20) {
      setError(t("errorTextRequired"));
      return;
    }
    if (!effectiveSelectedSlug) {
      setError(t("errorTemplateRequired"));
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch("/api/audit/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            decision_text: decisionText,
            template_slug: effectiveSelectedSlug,
            decision_meta: {
              owner: owner || undefined,
              urgency,
              language: locale,
            },
          }),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? "create_failed");
        }

        const { id } = await res.json();
        router.push(`/${locale}/audit/${id}`);
      } catch (err) {
        console.error(err);
        setError(t("errorRunFailed"));
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <label htmlFor="decision-text" className="text-sm font-medium">
          {t("intakeLabel")}
        </label>
        <textarea
          id="decision-text"
          value={decisionText}
          onChange={(e) => setDecisionText(e.target.value)}
          placeholder={t("intakePlaceholder")}
          rows={10}
          className="w-full rounded-md border border-border bg-background px-4 py-3 text-sm font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-foreground/20 resize-y"
        />
      </div>

      <div>
        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronDown
            className={`h-4 w-4 transition-transform ${showAdvanced ? "rotate-180" : ""}`}
          />
          {t("intakeAdvancedToggle")}
        </button>
        {showAdvanced && (
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-md border border-border bg-card/30 p-4">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">{t("intakeFieldOwner")}</label>
              <input
                type="text"
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">{t("intakeFieldUrgency")}</label>
              <select
                value={urgency}
                onChange={(e) => setUrgency(e.target.value as DecisionUrgency)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20"
              >
                {URGENCY_OPTIONS.map((u) => (
                  <option key={u} value={u}>
                    {t(`intakeFieldUrgency${u[0].toUpperCase() + u.slice(1)}` as never)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      <div>
        <h2 className="text-sm font-medium mb-3">{t("templatePickerTitle")}</h2>

        {recommended && (
          <div className="mb-4">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground mb-2">
              <Sparkles className="h-3.5 w-3.5" />
              {t("templatePickerAutoMatch")}
            </div>
            <TemplateCard
              template={recommended}
              selected={effectiveSelectedSlug === recommended.slug}
              onSelect={() => setSelectedSlug(recommended.slug)}
              locale={locale}
              t={t}
              highlight
            />
          </div>
        )}

        <div>
          {recommended && (
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
              {t("templatePickerAlternates")}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {alternateTemplates.map((tpl) => (
              <TemplateCard
                key={tpl.slug}
                template={tpl}
                selected={effectiveSelectedSlug === tpl.slug}
                onSelect={() => setSelectedSlug(tpl.slug)}
                locale={locale}
                t={t}
              />
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={onSubmit}
        disabled={isPending}
        className="inline-flex items-center gap-2 rounded-md bg-foreground text-background px-5 py-2.5 text-sm font-medium hover:opacity-90 disabled:opacity-50"
      >
        {isPending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            {t("submitRunning")}
          </>
        ) : (
          <>
            <ShieldCheck className="h-4 w-4" />
            {t("submitRunButton")}
          </>
        )}
      </button>
    </div>
  );
}

function TemplateCard({
  template,
  selected,
  onSelect,
  locale,
  t,
  highlight = false,
}: {
  template: AuditTemplate;
  selected: boolean;
  onSelect: () => void;
  locale: string;
  t: ReturnType<typeof useTranslations>;
  highlight?: boolean;
}) {
  const { name, desc } = templateLabels(template, locale, t);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`text-left rounded-md border bg-card/40 px-4 py-3 transition-all ${
        selected
          ? "border-foreground ring-2 ring-foreground/20"
          : highlight
          ? "border-foreground/40 hover:border-foreground"
          : "border-border hover:border-foreground/50"
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="font-medium text-sm">{name}</div>
        {selected && (
          <span className="text-[10px] uppercase tracking-wider text-foreground/70 shrink-0 mt-0.5">
            {t("templatePickerSelected")}
          </span>
        )}
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed mb-2">{desc}</p>
      {template.regulation_refs.length > 0 && template.regulation_refs[0] !== "(general)" && (
        <div className="flex flex-wrap gap-1 mt-2">
          {template.regulation_refs.slice(0, 3).map((ref) => (
            <span
              key={ref}
              className="text-[10px] rounded border border-border bg-background/40 px-1.5 py-0.5 text-muted-foreground"
            >
              {ref}
            </span>
          ))}
        </div>
      )}
    </button>
  );
}
