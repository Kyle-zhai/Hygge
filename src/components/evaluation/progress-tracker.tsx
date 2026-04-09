"use client";

import { useState, useEffect, useCallback } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Loader2, FileText, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

interface PersonaInfo {
  id: string;
  name: string;
  avatar: string;
}

interface ProgressTrackerProps {
  evaluationId: string;
  personas: PersonaInfo[];
  initialCompletedIds: string[];
  initialStatus: string;
}

export function ProgressTracker({
  evaluationId,
  personas,
  initialCompletedIds,
  initialStatus,
}: ProgressTrackerProps) {
  const t = useTranslations("evaluation");
  const locale = useLocale();
  const router = useRouter();
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set(initialCompletedIds));
  const [status, setStatus] = useState(initialStatus);

  const poll = useCallback(async () => {
    const supabase = createClient();
    const { data: evaluation } = await supabase
      .from("evaluations")
      .select("status, persona_reviews(persona_id)")
      .eq("id", evaluationId)
      .single();

    if (!evaluation) return;

    const reviewIds = (evaluation.persona_reviews || []).map((r: any) => r.persona_id);
    setCompletedIds(new Set(reviewIds));
    setStatus(evaluation.status);
  }, [evaluationId]);

  useEffect(() => {
    if (status === "completed" || status === "failed") return;

    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, [evaluationId, status, poll]);

  const allReviewsDone = completedIds.size >= personas.length;
  const progress = personas.length > 0 ? (completedIds.size / personas.length) * 100 : 0;

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-[#EAEAE8] tracking-[-0.02em]">
          {t("progressTitle")}
        </h1>
        <div className="mt-6 h-2 rounded-full bg-[#1C1C1C]">
          <motion.div
            className="h-full rounded-full"
            style={{ background: "linear-gradient(90deg, #E2DDD5, #C4A882)" }}
            initial={{ width: 0 }}
            animate={{ width: `${status === "completed" ? 100 : progress}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
        <p className="mt-2 text-sm text-[#666462]">
          {completedIds.size} / {personas.length}
        </p>
      </div>

      <div className="space-y-3">
        <AnimatePresence mode="popLayout">
          {personas.map((persona, index) => {
            const isDone = completedIds.has(persona.id);
            const isProcessing = !isDone && index <= completedIds.size;
            return (
              <motion.div
                key={persona.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className={`flex items-center gap-3 rounded-xl border p-4 transition-all duration-300 ${
                  isDone
                    ? "border-[#4ADE80]/30 bg-[#4ADE80]/5"
                    : isProcessing
                    ? "animate-breathe border-[#E2DDD5]/30 bg-[#E2DDD5]/5"
                    : "border-[#2A2A2A] bg-[#141414]"
                }`}
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1C1C1C] text-base">
                  {persona.avatar}
                </div>
                <span className="flex-1 text-sm font-medium text-[#EAEAE8]">{persona.name}</span>
                {isDone ? (
                  <Check className="h-4 w-4 text-[#4ADE80]" />
                ) : isProcessing ? (
                  <Loader2 className="h-4 w-4 animate-spin text-[#E2DDD5]" />
                ) : (
                  <div className="h-4 w-4 rounded-full border border-[#2A2A2A]" />
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Generating report state */}
      {allReviewsDone && status !== "completed" && status !== "failed" && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center justify-center gap-2 text-sm text-[#9B9594]"
        >
          <FileText className="h-4 w-4 animate-pulse text-[#E2DDD5]" />
          {t("generatingReport")}
        </motion.div>
      )}

      {/* View Report button */}
      {status === "completed" && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center gap-3"
        >
          <p className="text-sm font-medium text-[#4ADE80]">{t("completed")}</p>
          <Button
            onClick={() => router.push(`/${locale}/evaluate/${evaluationId}/result`)}
            className="bg-[#E2DDD5] hover:bg-[#D4CFC7] text-[#0C0C0C] font-semibold px-6"
          >
            {locale === "zh" ? "查看报告" : "View Report"}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </motion.div>
      )}

      {/* Failed state */}
      {status === "failed" && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center text-sm text-[#F87171]"
        >
          {locale === "zh" ? "生成报告时出现错误，请重试" : "An error occurred while generating the report. Please try again."}
        </motion.div>
      )}
    </div>
  );
}
