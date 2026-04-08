"use client";

import { useState, useEffect } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Loader2, FileText } from "lucide-react";
import { subscribeToEvaluation, unsubscribe } from "@/lib/supabase/realtime";

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

  useEffect(() => {
    if (status === "completed") {
      const timer = setTimeout(() => {
        router.push(`/${locale}/evaluate/${evaluationId}/result`);
      }, 1500);
      return () => clearTimeout(timer);
    }

    const channel = subscribeToEvaluation(evaluationId, {
      onStatusChange: (newStatus) => {
        setStatus(newStatus);
      },
      onNewReview: (review) => {
        setCompletedIds((prev) => new Set([...prev, review.persona_id]));
      },
    });

    return () => {
      unsubscribe(channel);
    };
  }, [evaluationId, locale, router, status]);

  const allReviewsDone = completedIds.size >= personas.length;
  const progress = personas.length > 0 ? (completedIds.size / personas.length) * 100 : 0;

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="text-center">
        <h1 className="text-2xl font-bold">{t("progressTitle")}</h1>
        <div className="mt-4 h-2 rounded-full bg-muted">
          <motion.div
            className="h-full rounded-full bg-primary"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          {completedIds.size} / {personas.length}
        </p>
      </div>

      <div className="space-y-3">
        <AnimatePresence mode="popLayout">
          {personas.map((persona) => {
            const isDone = completedIds.has(persona.id);
            return (
              <motion.div
                key={persona.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex items-center gap-3 rounded-lg border p-3 ${
                  isDone ? "border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950" : "bg-card"
                }`}
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-base">
                  {persona.avatar}
                </div>
                <span className="flex-1 text-sm font-medium">{persona.name}</span>
                {isDone ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
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
          className="flex items-center justify-center gap-2 text-sm text-muted-foreground"
        >
          <FileText className="h-4 w-4 animate-pulse" />
          {t("generatingReport")}
        </motion.div>
      )}

      {status === "completed" && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center text-sm text-green-600"
        >
          {t("completed")}
        </motion.div>
      )}
    </div>
  );
}
