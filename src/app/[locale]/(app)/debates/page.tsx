"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, Loader2, ArrowRight, ChevronLeft } from "lucide-react";
import { PersonaAvatar } from "@/components/persona-avatar";
import { createClient } from "@/lib/supabase/client";

interface Evaluation {
  id: string;
  mode: string;
  created_at: string;
  project: { parsed_data: { name?: string } };
  persona_reviews: Array<{
    persona_id: string;
    review_text: string;
    overall_stance?: string | null;
  }>;
}

interface PersonaInfo {
  id: string;
  identity: { name: string; avatar: string; locale_variants?: Record<string, { name: string }> };
  demographics: { occupation: string };
}

export default function DebatesPage() {
  const locale = useLocale();
  const router = useRouter();
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [personas, setPersonas] = useState<Map<string, PersonaInfo>>(new Map());
  const [selected, setSelected] = useState<Evaluation | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: evals } = await supabase
        .from("evaluations")
        .select(`id, mode, created_at,
          project:projects!inner(parsed_data),
          persona_reviews(persona_id, review_text, overall_stance)`)
        .eq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(30);

      if (!evals) { setLoading(false); return; }
      setEvaluations(evals as unknown as Evaluation[]);

      const personaIds = new Set<string>();
      for (const e of evals as unknown as Array<{ persona_reviews?: Array<{ persona_id: string }> }>) {
        for (const r of e.persona_reviews || []) personaIds.add(r.persona_id);
      }

      if (personaIds.size > 0) {
        const { data: ps } = await supabase
          .from("personas")
          .select("id, identity, demographics")
          .in("id", Array.from(personaIds));
        if (ps) {
          setPersonas(new Map(ps.map((p: PersonaInfo) => [p.id, p])));
        }
      }
      setLoading(false);
    }
    load();
  }, []);

  async function startDebate(evaluationId: string, personaId: string) {
    setStarting(personaId);
    try {
      const res = await fetch("/api/debates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ evaluationId, personaId }),
      });
      if (res.ok) {
        const debate = await res.json();
        router.push(`/${locale}/debates/${debate.id}`);
      }
    } finally {
      setStarting(null);
    }
  }

  function getPersonaName(p: PersonaInfo): string {
    return p.identity.locale_variants?.[locale]?.name || p.identity.name;
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[color:var(--accent-warm)]" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="text-center mb-8">
        <MessageSquare className="mx-auto mb-2 h-6 w-6 text-[color:var(--accent-warm)]" />
        <h1 className="text-2xl font-semibold text-[color:var(--text-primary)] tracking-[-0.02em]">
          {locale === "zh" ? "1v1 辩论" : "1v1 Debate"}
        </h1>
        <p className="mt-2 text-sm text-[color:var(--text-tertiary)]">
          {locale === "zh"
            ? "选择一次评估，然后挑战某个 Persona 进行辩论"
            : "Pick an evaluation, then challenge a persona to debate"}
        </p>
      </div>

      <AnimatePresence mode="wait">
        {!selected ? (
          <motion.div
            key="list"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-2"
          >
            {evaluations.length === 0 && (
              <p className="text-center text-sm text-[color:var(--text-tertiary)] py-8">
                {locale === "zh" ? "没有已完成的评估" : "No completed evaluations yet"}
              </p>
            )}
            {evaluations.map((ev) => {
              const proj = ev.project as { parsed_data?: { name?: string } } | Array<{ parsed_data?: { name?: string } }> | null | undefined;
              const title = (Array.isArray(proj) ? proj[0]?.parsed_data?.name : proj?.parsed_data?.name)
                || "Untitled";
              return (
                <button
                  key={ev.id}
                  onClick={() => setSelected(ev)}
                  className="w-full flex items-center justify-between rounded-xl border border-[color:var(--border-default)] bg-[color:var(--bg-secondary)] px-4 py-3 text-left transition-colors hover:border-[rgb(var(--accent-warm-rgb)/0.30)] hover:bg-[rgb(var(--accent-warm-rgb)/0.05)]"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[color:var(--text-primary)] truncate">{title}</p>
                    <p className="text-[10px] text-[color:var(--text-tertiary)] mt-0.5">
                      {locale === "zh"
                        ? `${ev.persona_reviews.length} 个人格 · ${new Date(ev.created_at).toLocaleDateString("zh-CN")}`
                        : `${ev.persona_reviews.length} personas · ${new Date(ev.created_at).toLocaleDateString()}`}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-[color:var(--text-tertiary)]" />
                </button>
              );
            })}
          </motion.div>
        ) : (
          <motion.div
            key="personas"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <button
              onClick={() => setSelected(null)}
              className="flex items-center gap-1.5 text-xs text-[color:var(--text-tertiary)] hover:text-[color:var(--text-secondary)] mb-4 transition-colors"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              {locale === "zh" ? "返回" : "Back"}
            </button>

            <p className="text-xs font-medium text-[color:var(--text-tertiary)] uppercase tracking-wide mb-3">
              {locale === "zh" ? "选择 Persona 开始辩论" : "Choose a Persona to Debate"}
            </p>

            <div className="space-y-2">
              {selected.persona_reviews.map((review) => {
                const persona = personas.get(review.persona_id);
                if (!persona) return null;
                return (
                  <button
                    key={review.persona_id}
                    onClick={() => startDebate(selected.id, review.persona_id)}
                    disabled={starting === review.persona_id}
                    className="w-full flex items-center gap-3 rounded-xl border border-[color:var(--border-default)] bg-[color:var(--bg-secondary)] px-4 py-3 text-left transition-colors hover:border-[rgb(var(--accent-warm-rgb)/0.30)] hover:bg-[rgb(var(--accent-warm-rgb)/0.05)] disabled:opacity-50"
                  >
                    <PersonaAvatar avatar={persona.identity.avatar} size={36} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[color:var(--text-primary)]">{getPersonaName(persona)}</p>
                      <p className="text-[10px] text-[color:var(--text-tertiary)]">{persona.demographics.occupation}</p>
                      <p className="text-xs text-[color:var(--text-secondary)] mt-1 line-clamp-2">{review.review_text}</p>
                    </div>
                    {review.overall_stance && (
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        review.overall_stance.includes("positive")
                          ? "bg-[#4ADE80]/10 text-[#4ADE80]"
                          : review.overall_stance.includes("negative")
                          ? "bg-[#F87171]/10 text-[#F87171]"
                          : "bg-[rgb(var(--text-tertiary-rgb)/0.10)] text-[color:var(--text-tertiary)]"
                      }`}>
                        {review.overall_stance}
                      </span>
                    )}
                    {starting === review.persona_id ? (
                      <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[color:var(--accent-warm)]" />
                    ) : (
                      <ArrowRight className="h-4 w-4 shrink-0 text-[color:var(--text-tertiary)]" />
                    )}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
