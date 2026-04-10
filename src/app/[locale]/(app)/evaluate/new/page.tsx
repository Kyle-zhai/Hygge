"use client";

import { Suspense, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ProjectInput } from "@/components/evaluation/project-input";
import { PersonaSelector } from "@/components/evaluation/persona-selector";

const personaLimits: Record<string, number> = { free: 3, pro: 10, max: 20 };

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

  async function uploadFiles(files: File[]): Promise<string[]> {
    if (files.length === 0) return [];
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    const urls: string[] = [];
    for (const file of files) {
      const ext = file.name.split(".").pop() || "bin";
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("attachments").upload(path, file);
      if (error) throw new Error(`Upload failed: ${error.message}`);
      urls.push(path);
    }
    return urls;
  }

  async function handleConfirm(selectedPersonaIds: string[]) {
    if (!projectData) return;
    setSubmitting(true);
    setError("");
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
    <div className="flex min-h-screen flex-col">
      {error && (
        <div className="mx-auto mt-4 max-w-2xl rounded-lg border border-[#F87171]/30 bg-[#F87171]/10 px-4 py-3 text-sm text-[#F87171]">
          {error}
        </div>
      )}

      {/* Step 1: Topic input */}
      <div className={step === 1 ? "flex flex-1 flex-col" : "hidden"}>
        <div className="flex flex-1 flex-col items-center justify-center px-4 pb-8">
          <div className="mb-8 flex flex-col items-center">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="mb-4">
              <circle cx="10" cy="10" r="7" stroke="#C4A882" strokeWidth="1.2" opacity="0.4" />
              <circle cx="14" cy="10" r="7" stroke="#E2DDD5" strokeWidth="1.2" opacity="0.6" />
              <circle cx="12" cy="14" r="7" stroke="#E2DDD5" strokeWidth="1.2" opacity="0.8" />
            </svg>
            <h1 className="text-2xl font-semibold text-[#EAEAE8] tracking-[-0.02em]">
              {mode === "product" ? t("modeProduct") : t("modeTopic")}
            </h1>
            <p className="mt-2 text-sm text-[#666462]">
              {mode === "product" ? t("modeProductDesc") : t("modeTopicDesc")}
            </p>
          </div>

          <div className="w-full max-w-2xl">
            <ProjectInput onSubmit={handleProjectSubmit} />
          </div>
        </div>
      </div>

      {/* Step 2: Persona selection */}
      {step === 2 && projectData && (
        <div className="mx-auto w-full max-w-3xl px-4 py-8">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-semibold text-[#EAEAE8] tracking-[-0.02em]">
              {t("selectPersonas")}
            </h1>
            <button
              onClick={() => setStep(1)}
              className="text-sm text-[#9B9594] hover:text-[#EAEAE8] transition-colors"
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
