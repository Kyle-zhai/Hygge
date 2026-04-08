"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ProjectInput } from "@/components/evaluation/project-input";
import { PersonaSelector } from "@/components/evaluation/persona-selector";

const personaLimits: Record<string, number> = { free: 3, pro: 10, max: 20 };

export default function NewEvaluationPage() {
  const t = useTranslations("evaluation");
  const locale = useLocale();
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [projectData, setProjectData] = useState<{
    rawInput: string;
    url: string | null;
    files: File[];
  } | null>(null);
  const [maxPersonas, setMaxPersonas] = useState(3);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleProjectSubmit(data: { rawInput: string; url: string | null; files: File[] }) {
    setProjectData(data);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: sub } = await supabase.from("subscriptions").select("plan").eq("user_id", user.id).single();
      if (sub) {
        setMaxPersonas(personaLimits[sub.plan] || 3);
      }
    }
    setStep(2);
  }

  async function handleConfirm(selectedPersonaIds: string[]) {
    if (!projectData) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/evaluations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rawInput: projectData.rawInput,
          url: projectData.url,
          selectedPersonaIds,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create evaluation");
      }
      const { evaluation } = await res.json();
      router.push(`/${locale}/evaluate/${evaluation.id}/progress`);
    } catch (e: any) {
      setError(e.message);
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Step indicator */}
      <div className="flex items-center gap-4">
        <div className={`flex items-center gap-2 ${step === 1 ? "text-foreground" : "text-muted-foreground"}`}>
          <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium ${step === 1 ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
            1
          </div>
          <span className="text-sm font-medium">{t("step1")}</span>
        </div>
        <div className="h-px flex-1 bg-border" />
        <div className={`flex items-center gap-2 ${step === 2 ? "text-foreground" : "text-muted-foreground"}`}>
          <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium ${step === 2 ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
            2
          </div>
          <span className="text-sm font-medium">{t("step2")}</span>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {step === 1 && (
        <>
          <h1 className="text-2xl font-bold">{t("step1")}</h1>
          <ProjectInput onSubmit={handleProjectSubmit} />
        </>
      )}

      {step === 2 && projectData && (
        <>
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">{t("selectPersonas")}</h1>
            <button
              onClick={() => setStep(1)}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              {t("step1")}
            </button>
          </div>
          <PersonaSelector
            projectDescription={projectData.rawInput}
            maxPersonas={maxPersonas}
            onConfirm={handleConfirm}
            disabled={submitting}
          />
        </>
      )}
    </div>
  );
}
