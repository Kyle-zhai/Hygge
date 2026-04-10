"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ProjectInput } from "@/components/evaluation/project-input";
import { PersonaSelector } from "@/components/evaluation/persona-selector";
import { Package, MessageCircle } from "lucide-react";

const personaLimits: Record<string, number> = { free: 3, pro: 10, max: 20 };

export default function NewEvaluationPage() {
  const t = useTranslations("evaluation");
  const locale = useLocale();
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [mode, setMode] = useState<"product" | "topic">("product");
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

  const stepLabels = [
    t("step1"),
    t("selectPersonas"),
    locale === "zh" ? "讨论进行中" : "Discussion",
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* 3-Step indicator */}
      <div className="flex items-center gap-3">
        {stepLabels.map((label, i) => {
          const stepNum = i + 1;
          const isActive = step === stepNum;
          const isPast = step > stepNum;
          return (
            <div key={i} className="flex items-center gap-3 flex-1 last:flex-none">
              <div className={`flex items-center gap-2 shrink-0 ${isActive ? "text-[#EAEAE8]" : isPast ? "text-[#9B9594]" : "text-[#666462]"}`}>
                <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium ${isActive ? "bg-[#E2DDD5] text-[#0C0C0C]" : isPast ? "bg-[#E2DDD5]/20 text-[#E2DDD5]" : "bg-[#1C1C1C] text-[#666462]"}`}>
                  {stepNum}
                </div>
                <span className="text-sm font-medium hidden sm:inline">{label}</span>
              </div>
              {i < stepLabels.length - 1 && <div className="h-px flex-1 bg-[#2A2A2A]" />}
            </div>
          );
        })}
      </div>

      {error && (
        <div className="rounded-lg border border-[#F87171]/30 bg-[#F87171]/10 p-3 text-sm text-[#F87171]">
          {error}
        </div>
      )}

      {/* Always mounted to preserve input state + file refs on back navigation */}
      <div className={step === 1 ? "" : "hidden"}>
        <div className="flex flex-col items-center pt-8">
          <h1 className="text-2xl font-semibold text-[#EAEAE8] tracking-[-0.02em] mb-6">
            {t("step1")}
          </h1>

          {/* Mode selector */}
          <div className="flex gap-3 mb-6 w-full max-w-2xl">
            <button
              onClick={() => setMode("product")}
              className={`flex-1 flex items-center gap-3 rounded-xl border p-4 transition-all duration-200 ${
                mode === "product"
                  ? "border-[#E2DDD5]/40 bg-[#E2DDD5]/5"
                  : "border-[#2A2A2A] bg-transparent hover:border-[#3A3A3A]"
              }`}
            >
              <Package className={`h-5 w-5 shrink-0 ${mode === "product" ? "text-[#E2DDD5]" : "text-[#666462]"}`} />
              <div className="text-left">
                <div className={`text-sm font-medium ${mode === "product" ? "text-[#EAEAE8]" : "text-[#9B9594]"}`}>
                  {t("modeProduct")}
                </div>
                <div className="text-xs text-[#666462] mt-0.5">{t("modeProductDesc")}</div>
              </div>
            </button>
            <button
              onClick={() => setMode("topic")}
              className={`flex-1 flex items-center gap-3 rounded-xl border p-4 transition-all duration-200 ${
                mode === "topic"
                  ? "border-[#E2DDD5]/40 bg-[#E2DDD5]/5"
                  : "border-[#2A2A2A] bg-transparent hover:border-[#3A3A3A]"
              }`}
            >
              <MessageCircle className={`h-5 w-5 shrink-0 ${mode === "topic" ? "text-[#E2DDD5]" : "text-[#666462]"}`} />
              <div className="text-left">
                <div className={`text-sm font-medium ${mode === "topic" ? "text-[#EAEAE8]" : "text-[#9B9594]"}`}>
                  {t("modeTopic")}
                </div>
                <div className="text-xs text-[#666462] mt-0.5">{t("modeTopicDesc")}</div>
              </div>
            </button>
          </div>

          <div className="w-full max-w-2xl">
            <ProjectInput onSubmit={handleProjectSubmit} />
          </div>
        </div>
      </div>

      {step === 2 && projectData && (
        <>
          <div className="flex items-center justify-between">
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
        </>
      )}
    </div>
  );
}
