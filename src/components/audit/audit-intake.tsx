"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ChevronDown, Loader2, Sparkles, ShieldCheck, Upload, FileText, X } from "lucide-react";
import type { AuditTemplate, DecisionUrgency } from "@/lib/audit/types";
import { matchTemplate } from "@/lib/audit/template-match";
import { createClient } from "@/lib/supabase/client";

interface Props {
  templates: AuditTemplate[];
  locale: string;
}

const URGENCY_OPTIONS: DecisionUrgency[] = ["low", "medium", "high"];

const FILE_ACCEPT = ".pdf,.docx,.pptx,.xlsx,.odt,.odp,.ods,.rtf,.txt,.md";
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const MAX_FILES = 8;
const ALLOWED_UPLOAD_EXT = new Set([
  "pdf", "docx", "pptx", "xlsx", "odt", "odp", "ods", "rtf", "txt", "md",
]);

interface AttachedFile {
  fileId: string;
  filename: string;
  size: string;
  // sizeBytes for posting to /api/audit/sessions etc.
  sizeBytes: number;
  // Storage path so removeAttachedFile can also clean up the bucket
  // object instead of leaking a 10MB private blob per pre-submit cancel.
  storagePath: string;
}

const STORAGE_BUCKET = "audit-uploads";

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
  // Parsed file contents stay in state — not in the textarea. We support
  // attaching multiple files (memo + slides + spreadsheet); each gets a
  // small chip. submitText concatenates them server-bound.
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);

  // Upload directly to Supabase Storage from the browser, mirroring the
  // /evaluate flow. The Vercel function never touches the binary, so the
  // 90s timeout / officeparser bundle issues don't apply. The audit
  // pipeline worker (Railway) downloads + parses asynchronously when the
  // session runs, and caches extracted_text back onto audit_session_files.
  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (e.target) e.target.value = "";
    if (!file) return;

    setError(null);

    if (attachedFiles.length >= MAX_FILES) {
      setError(t("intakeFileErrorTooMany", { max: MAX_FILES }));
      return;
    }

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
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setError(t("intakeFileErrorGeneric"));
        return;
      }

      const fileId = crypto.randomUUID();
      const storagePath = `${user.id}/${fileId}.${ext || "bin"}`;
      const uploadRes = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(storagePath, file, {
          contentType: file.type || "application/octet-stream",
          upsert: false,
        });
      if (uploadRes.error) {
        console.error("audit upload failed", uploadRes.error);
        setError(t("intakeFileErrorGeneric"));
        return;
      }

      const { error: insertErr } = await supabase
        .from("audit_session_files")
        .insert({
          id: fileId,
          user_id: user.id,
          session_id: null,
          filename: file.name,
          mime_type: file.type || "application/octet-stream",
          size_bytes: file.size,
          storage_path: storagePath,
        });
      if (insertErr) {
        console.error("audit_session_files insert failed", insertErr);
        await supabase.storage.from(STORAGE_BUCKET).remove([storagePath]);
        setError(t("intakeFileErrorGeneric"));
        return;
      }

      setAttachedFiles((prev) => [
        ...prev,
        {
          fileId,
          filename: file.name,
          size: formatBytes(file.size),
          sizeBytes: file.size,
          storagePath,
        },
      ]);
    } catch (err) {
      console.error(err);
      setError(t("intakeFileErrorGeneric"));
    } finally {
      setIsParsingFile(false);
    }
  }

  async function removeAttachedFile(fileId: string) {
    const target = attachedFiles.find((f) => f.fileId === fileId);
    setAttachedFiles((prev) => prev.filter((f) => f.fileId !== fileId));
    if (!target) return;
    try {
      const supabase = createClient();
      // Best-effort cleanup of both the row AND the underlying storage
      // object. Without the storage.remove call, every cancelled upload
      // would leak a 10MB private object under the user's prefix.
      await Promise.all([
        supabase.from("audit_session_files").delete().eq("id", fileId),
        supabase.storage.from(STORAGE_BUCKET).remove([target.storagePath]),
      ]);
    } catch (err) {
      console.error("audit file cleanup failed", err);
    }
  }

  // decision_text contains only the user's narrative. File contents are
  // pulled from Storage by the audit pipeline worker and prepended at
  // run time (composeDecisionContext in worker/src/processors/audit-pipeline.ts).
  const submitText = decisionText.trim();

  const match = useMemo(() => {
    if (submitText.length < 30) return null;
    const m = matchTemplate(submitText);
    if (!m) return null;
    const validSlugs = new Set(templates.map((tpl) => tpl.slug));
    if (!validSlugs.has(m.primary_slug)) return null;
    return {
      ...m,
      alternates: m.alternates.filter((slug) => validSlugs.has(slug)),
    };
  }, [submitText, templates]);

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
    // Either a typed narrative OR at least one uploaded file is required —
    // the worker pulls extracted text from attached files at run time.
    if (submitText.length < 20 && attachedFiles.length === 0) {
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
            decision_text: submitText,
            template_slug: effectiveSelectedSlug,
            decision_meta: {
              owner: owner || undefined,
              urgency,
              language: locale,
              attached_filenames: attachedFiles.length
                ? attachedFiles.map((f) => f.filename)
                : undefined,
            },
            pending_file_ids: attachedFiles.map((f) => f.fileId),
          }),
        });

        const body = (await res.json().catch(() => ({}))) as {
          id?: string;
          error?: string;
        };

        if (!res.ok) {
          // Surface the server-side reason so users see what's actually
          // wrong (quota, bad template, payload too large, etc.) instead of
          // a generic "audit failed" wall.
          const serverMsg = body?.error?.toString().trim();
          setError(serverMsg ? serverMsg : t("errorRunFailed"));
          return;
        }

        if (!body.id) {
          setError(t("errorRunFailed"));
          return;
        }
        router.push(`/${locale}/audit/${body.id}`);
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
          placeholder={attachedFiles.length > 0 ? t("intakePlaceholderWithFile") : t("intakePlaceholder")}
          rows={attachedFiles.length > 0 ? 4 : 10}
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
          {attachedFiles.length === 0 && (
            <span className="text-xs text-[color:var(--text-tertiary)]">
              {t("intakeFileHint")}
            </span>
          )}
        </div>
        {attachedFiles.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-2">
            {attachedFiles.map((f) => (
              <span
                key={f.fileId}
                className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--border-default)] bg-[color:var(--bg-secondary)] px-2.5 py-1 text-xs text-[color:var(--text-primary)]"
              >
                <FileText className="h-3.5 w-3.5 text-[color:var(--accent-warm)]" />
                <span>
                  {t("intakeFileLoaded", { filename: f.filename, size: f.size })}
                </span>
                <button
                  type="button"
                  onClick={() => removeAttachedFile(f.fileId)}
                  aria-label={t("intakeFileRemove")}
                  className="text-[color:var(--text-tertiary)] hover:text-[color:var(--text-primary)] transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
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
