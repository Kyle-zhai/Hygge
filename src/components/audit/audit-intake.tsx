"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ChevronDown, Loader2, Sparkles, ShieldCheck, Upload, FileText } from "lucide-react";
import type { AuditTemplate, DecisionUrgency } from "@/lib/audit/types";
import { matchTemplate } from "@/lib/audit/template-match";

interface Props {
  templates: AuditTemplate[];
  locale: string;
}

const URGENCY_OPTIONS: DecisionUrgency[] = ["low", "medium", "high"];

const FILE_ACCEPT = ".pdf,.docx,.pptx,.xlsx,.odt,.odp,.ods,.rtf,.txt,.md";
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const ALLOWED_UPLOAD_EXT = new Set([
  "pdf", "docx", "pptx", "xlsx", "odt", "odp", "ods", "rtf", "txt", "md",
]);

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isParsingFile, setIsParsingFile] = useState(false);
  const [fileStatus, setFileStatus] = useState<{ filename: string; truncated: boolean; size: string } | null>(null);

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (e.target) e.target.value = "";
    if (!file) return;

    setError(null);
    setFileStatus(null);

    const ext = (file.name.split(".").pop() || "").toLowerCase();
    if (!ALLOWED_UPLOAD_EXT.has(ext)) {
      setError(t("intakeFileErrorUnsupported"));
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setError(t("intakeFileErrorTooLarge"));
      return;
    }

    setIsParsingFile(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/audit/parse-file", { method: "POST", body: fd });
      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        const code = body?.error ?? "";
        if (res.status === 413) setError(t("intakeFileErrorTooLarge"));
        else if (res.status === 415) setError(t("intakeFileErrorUnsupported"));
        else if (res.status === 422 && /No readable/i.test(code)) setError(t("intakeFileErrorEmpty"));
        else if (res.status === 422) setError(t("intakeFileErrorParse"));
        else setError(code || t("intakeFileErrorGeneric"));
        return;
      }

      const text = String(body.text ?? "");
      if (!text.trim()) {
        setError(t("intakeFileErrorEmpty"));
        return;
      }

      setDecisionText(text);
      setFileStatus({
        filename: file.name,
        truncated: Boolean(body.truncated),
        size: formatBytes(Number(body.extractedSize ?? new Blob([text]).size)),
      });
    } catch (err) {
      console.error(err);
      setError(t("intakeFileErrorGeneric"));
    } finally {
      setIsParsingFile(false);
    }
  }

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
          onChange={(e) => {
            setDecisionText(e.target.value);
            if (fileStatus) setFileStatus(null);
          }}
          placeholder={t("intakePlaceholder")}
          rows={10}
          className="w-full rounded-xl border border-[color:var(--border-default)] bg-[color:var(--bg-primary)] px-4 py-3 text-sm font-mono leading-relaxed text-[color:var(--text-primary)] transition-colors focus:outline-none focus:border-[color:var(--accent-warm)] focus:ring-2 focus:ring-[rgb(var(--accent-warm-rgb)/0.10)] resize-y"
        />

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <input
            ref={fileInputRef}
            type="file"
            accept={FILE_ACCEPT}
            onChange={onFileChange}
            className="hidden"
            disabled={isParsingFile || isPending}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isParsingFile || isPending}
            className="inline-flex items-center gap-2 rounded-md border border-[color:var(--border-default)] bg-[color:var(--bg-secondary)] px-3 py-1.5 text-xs text-[color:var(--text-primary)] transition-colors hover:border-[color:var(--border-hover)] disabled:opacity-50"
          >
            {isParsingFile ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {t("intakeFileParsing")}
              </>
            ) : (
              <>
                <Upload className="h-3.5 w-3.5" />
                {t("intakeFileButton")}
              </>
            )}
          </button>
          {fileStatus ? (
            <span className="inline-flex items-center gap-1.5 text-xs text-[color:var(--text-tertiary)]">
              <FileText className="h-3.5 w-3.5" />
              {fileStatus.truncated
                ? t("intakeFileLoadedTruncated", { filename: fileStatus.filename })
                : t("intakeFileLoaded", { filename: fileStatus.filename, size: fileStatus.size })}
            </span>
          ) : (
            <span className="text-xs text-[color:var(--text-tertiary)]">
              {t("intakeFileHint")}
            </span>
          )}
        </div>
      </div>

      <div>
        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          className="inline-flex items-center gap-2 text-sm text-[color:var(--text-tertiary)] hover:text-[color:var(--text-primary)]"
        >
          <ChevronDown
            className={`h-4 w-4 transition-transform ${showAdvanced ? "rotate-180" : ""}`}
          />
          {t("intakeAdvancedToggle")}
        </button>
        {showAdvanced && (
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-md border border-[color:var(--border-default)] bg-[color:var(--bg-secondary)] p-4">
            <div>
              <label className="block text-xs text-[color:var(--text-tertiary)] mb-1">{t("intakeFieldOwner")}</label>
              <input
                type="text"
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
                className="w-full rounded-md border border-[color:var(--border-default)] bg-[color:var(--bg-primary)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20"
              />
            </div>
            <div>
              <label className="block text-xs text-[color:var(--text-tertiary)] mb-1">{t("intakeFieldUrgency")}</label>
              <select
                value={urgency}
                onChange={(e) => setUrgency(e.target.value as DecisionUrgency)}
                className="w-full rounded-md border border-[color:var(--border-default)] bg-[color:var(--bg-primary)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20"
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
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-[color:var(--text-tertiary)] mb-2">
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
            <div className="text-xs uppercase tracking-wider text-[color:var(--text-tertiary)] mb-2">
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
        <div className="rounded-xl border border-[#F87171]/40 bg-[#F87171]/10 px-4 py-3 text-sm text-[#F87171]">
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={onSubmit}
        disabled={isPending}
        className="inline-flex items-center gap-2 rounded-full bg-[color:var(--text-primary)] px-6 py-2.5 text-sm font-medium text-[color:var(--bg-primary)] transition-transform hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0"
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
      className={`text-left rounded-xl border bg-[color:var(--bg-secondary)] px-4 py-3 transition-all ${
        selected
          ? "border-[color:var(--accent-warm)] ring-2 ring-[rgb(var(--accent-warm-rgb)/0.20)]"
          : highlight
          ? "border-[color:var(--border-hover)] hover:border-[color:var(--accent-warm)]"
          : "border-[color:var(--border-default)] hover:border-[color:var(--border-hover)]"
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="font-medium text-sm text-[color:var(--text-primary)]">{name}</div>
        {selected && (
          <span className="text-[10px] uppercase tracking-wider text-[color:var(--accent-warm)] shrink-0 mt-0.5">
            {t("templatePickerSelected")}
          </span>
        )}
      </div>
      <p className="text-xs text-[color:var(--text-tertiary)] leading-relaxed mb-2">{desc}</p>
      {template.regulation_refs.length > 0 && template.regulation_refs[0] !== "(general)" && (
        <div className="flex flex-wrap gap-1 mt-2">
          {template.regulation_refs.slice(0, 3).map((ref) => (
            <span
              key={ref}
              className="text-[10px] rounded-full border border-[color:var(--border-default)] bg-[color:var(--bg-primary)] px-2 py-0.5 text-[color:var(--text-tertiary)]"
            >
              {ref}
            </span>
          ))}
        </div>
      )}
    </button>
  );
}
