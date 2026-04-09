"use client";

import { useState, useEffect, useCallback } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Loader2, FileText } from "lucide-react";
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
    if (status === "completed") {
      const timer = setTimeout(() => {
        router.push(`/${locale}/evaluate/${evaluationId}/result`);
      }, 1500);
      return () => clearTimeout(timer);
    }

    // Poll every 3 seconds
    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, [evaluationId, locale, router, status, poll]);

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
            animate={{ width: `${progress}%` }}
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
                ) : (
                  <Loader2 className="h-4 w-4 animate-spin text-[#E2DDD5]" />
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {allReviewsDone && status !== "completed" && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center justify-center gap-2 text-sm text-[#9B9594]"
        >
          <FileText className="h-4 w-4 animate-pulse text-[#E2DDD5]" />
          {t("generatingReport")}
        </motion.div>
      )}

      {status === "completed" && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center text-sm font-medium text-[#4ADE80]"
        >
          {t("completed")}
        </motion.div>
      )}
    </div>
  );
}
