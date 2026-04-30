"use client";

import { Suspense, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ProjectInput } from "@/components/evaluation/project-input";
import { PersonaSelector } from "@/components/evaluation/persona-selector";
import { Paywall } from "@/components/evaluation/paywall";
import { PLANS } from "@/lib/stripe/plans";
import { track } from "@/lib/analytics/posthog";

function NewEvaluationContent() {
  const t = useTranslations("evaluation");
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const mode = searchParams.get("mode") === "product" ? "product" : "topic";

  const [step, setStep] = useState<1 | 2>(1);
  const [projectData, setProjectData] = useState<{
    rawInput: string;
    url: string | null;
    files: File[];
  } | null>(null);
  const [maxPersonas, setMaxPersonas] = useState(PLANS.free.maxPersonas);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [quotaExceeded, setQuotaExceeded] = useState(false);
  const [starterText, setStarterText] = useState("");
  const isZh = locale === "zh";

  const starters = isZh
    ? [
        {
          label: "AI 功能上线",
          text: "我们准备在下周给消费者 App 上线一个基于大模型的内容推荐功能,会用用户最近 30 天的行为数据训练偏好。我担心隐私、滥用、内容安全和监管风险——尤其是欧盟用户。",
        },
        {
          label: "招聘决策",
          text: "我在两个最终候选人之间犹豫:一个有十年经验但简历有跳槽痕迹,另一个是 5 年但是从顶级团队出来的内推。岗位是高级工程师,直接向 CTO 汇报。我想从公平、绩效预期、长期 fit 多个角度审视。",
        },
        {
          label: "战略转向",
          text: "我们 SaaS 公司增长放缓,在考虑从 PLG 转向 SLG (sales-led),需要砍掉 30% 自助流程预算转给销售团队。这是个大调整,我想做一次 pre-mortem 把所有失败模式找出来。",
        },
      ]
    : [
        {
          label: "AI feature launch",
          text: "Next week we ship an LLM-powered content recommendation feature in our consumer app. It uses 30 days of user behavior to train preferences. I'm worried about privacy, misuse, content safety, and regulatory exposure — especially for EU users.",
        },
        {
          label: "Hiring decision",
          text: "I'm choosing between two final candidates for a senior engineer role reporting to the CTO. One has 10 years of experience but a job-hopping pattern. The other has 5 years but came through a referral from a top team. I want a fairness, performance-fit, and long-term-retention review.",
        },
        {
          label: "Strategy pivot",
          text: "Our SaaS growth is flattening. We're considering pivoting from PLG to sales-led, which means cutting 30% of the self-serve budget and redirecting to a sales team. Big call. I want a pre-mortem to surface every failure mode before we commit.",
        },
      ];

  // Reset to step 1 when mode changes
  const [prevMode, setPrevMode] = useState(mode);
  if (mode !== prevMode) {
    setPrevMode(mode);
    setStep(1);
    setProjectData(null);
    setError("");
  }

  async function handleProjectSubmit(data: { rawInput: string; url: string | null; files: File[] }) {
    setProjectData(data);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: sub } = await supabase.from("subscriptions").select("plan").eq("user_id", user.id).single();
      if (sub) {
        const planConfig = PLANS[sub.plan as keyof typeof PLANS];
        setMaxPersonas(planConfig?.maxPersonas ?? PLANS.free.maxPersonas);
      }
    }
    setStep(2);
  }

  async function uploadFiles(files: File[]): Promise<string[]> {
    if (files.length === 0) return [];
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    const MAX_BYTES = 25 * 1024 * 1024;
    const ALLOWED_MIME = new Set([
      "application/pdf",
      "image/png", "image/jpeg", "image/webp", "image/gif",
      "text/plain", "text/markdown", "text/csv",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "video/mp4", "video/quicktime",
      "audio/mpeg", "audio/mp4", "audio/wav",
    ]);

    const urls: string[] = [];
    for (const file of files) {
      if (file.size > MAX_BYTES) {
        throw new Error(`${file.name} exceeds 25MB limit`);
      }
      if (!ALLOWED_MIME.has(file.type)) {
        throw new Error(`${file.name}: unsupported file type (${file.type || "unknown"})`);
      }
      const ext = file.name.split(".").pop() || "bin";
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("attachments").upload(path, file, {
        contentType: file.type,
      });
      if (error) throw new Error(`Upload failed: ${error.message}`);
      urls.push(path);
    }
    return urls;
  }

  async function handleConfirm(selectedPersonaIds: string[]) {
    if (!projectData) return;
    setSubmitting(true);
    setError("");
    setQuotaExceeded(false);
    try {
      const attachments = await uploadFiles(projectData.files);

      const res = await fetch("/api/evaluations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rawInput: projectData.rawInput,
          url: projectData.url,
          attachments,
          selectedPersonaIds,
          mode,
        }),
      });
      if (res.status === 429) {
        track("paywall_shown", { reason: "quota_exceeded" });
        setQuotaExceeded(true);
        setSubmitting(false);
        return;
      }
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create evaluation");
      }
      const { evaluation } = await res.json();
      track("first_evaluation_created", {
        evaluation_id: evaluation.id,
        mode,
        persona_count: selectedPersonaIds.length,
      });
      router.push(`/${locale}/evaluate/${evaluation.id}/progress`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      {quotaExceeded && (
        <Paywall locale={locale} onDismiss={() => setQuotaExceeded(false)} />
      )}

      {error && !quotaExceeded && (
        <div className="mx-auto mt-4 max-w-2xl rounded-lg border border-[#F87171]/30 bg-[#F87171]/10 px-4 py-3 text-sm text-[#F87171]">
          {error}
        </div>
      )}

      {/* Step 1: Topic input */}
      <div className={step === 1 ? "flex flex-1 flex-col" : "hidden"}>
        <div className="flex flex-1 flex-col items-center justify-center px-4 pb-8">
          <div className="mb-8 flex flex-col items-center">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="mb-4">
              <circle cx="10" cy="10" r="7" stroke="var(--accent-warm)" strokeWidth="1.2" opacity="0.4" />
              <circle cx="14" cy="10" r="7" stroke="var(--accent-primary)" strokeWidth="1.2" opacity="0.6" />
              <circle cx="12" cy="14" r="7" stroke="var(--accent-primary)" strokeWidth="1.2" opacity="0.8" />
            </svg>
            <h1 className="text-2xl font-semibold text-[color:var(--text-primary)] tracking-[-0.02em]">
              {mode === "product" ? t("modeProduct") : t("modeTopic")}
            </h1>
            <p className="mt-2 text-sm text-[color:var(--text-tertiary)]">
              {mode === "product" ? t("modeProductDesc") : t("modeTopicDesc")}
            </p>
          </div>

          <div className="w-full max-w-2xl">
            <ProjectInput key={starterText} onSubmit={handleProjectSubmit} initialText={starterText} />
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-[color:var(--text-tertiary)]">
                {isZh ? "试试这些场景" : "Try a starter"}
              </span>
              {starters.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => setStarterText(s.text)}
                  className="rounded-full border border-[color:var(--border-default)] bg-[color:var(--bg-secondary)] px-3 py-1.5 text-xs text-[color:var(--text-secondary)] transition-colors hover:border-[color:var(--border-hover)] hover:text-[color:var(--text-primary)]"
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Step 2: Persona selection */}
      {step === 2 && projectData && (
        <div className="mx-auto w-full max-w-3xl px-4 py-8">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-semibold text-[color:var(--text-primary)] tracking-[-0.02em]">
              {t("selectPersonas")}
            </h1>
            <button
              onClick={() => setStep(1)}
              className="text-sm text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)] transition-colors"
            >
              {t("step1")}
            </button>
          </div>
          <PersonaSelector
            projectDescription={projectData.rawInput}
            maxPersonas={maxPersonas}
            onConfirm={handleConfirm}
            disabled={submitting}
            mode={mode}
          />
        </div>
      )}
    </div>
  );
}

export default function NewEvaluationPage() {
  return (
    <Suspense>
      <NewEvaluationContent />
    </Suspense>
  );
}
