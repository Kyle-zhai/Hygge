"use client";

import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import { ArrowLeft, Users, Lightbulb, AlertTriangle, MessageSquare, Swords } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface PersonaIdentityLike {
  name?: string;
  avatar?: string;
  locale_variants?: Record<string, { name?: string; tagline?: string }>;
  [key: string]: unknown;
}

interface PersonaDemographicsLike {
  occupation?: string;
  [key: string]: unknown;
}

interface PersonaData {
  id: string;
  identity: PersonaIdentityLike;
  demographics: PersonaDemographicsLike;
  category: string;
}

interface RoundTableDebate {
  selected_persona_ids: string[];
  topic_focus: string;
  rounds: Array<{
    round: number;
    theme: string;
    messages: Array<{
      persona_id: string;
      content: string;
      responding_to?: string;
      stance_shift?: string;
    }>;
  }>;
  outcome: {
    consensus_reached: boolean;
    key_insights: string[];
    remaining_disagreements: string[];
  };
}

interface RoundTableDebateViewProps {
  debate: RoundTableDebate;
  personas: PersonaData[];
  locale: string;
  onBack: () => void;
  onStartDebate?: (personaId: string) => void;
}

function safeArray<T>(val: unknown): T[] {
  return Array.isArray(val) ? val : [];
}

export function RoundTableDebateView({ debate, personas, locale, onBack, onStartDebate }: RoundTableDebateViewProps) {
  const t = useTranslations("evaluation");
  const personaMap = new Map(personas.map((p) => [p.id, p]));

  function getName(id: string) {
    return personaMap.get(id)?.identity?.name || "Unknown";
  }
  function getAvatar(id: string) {
    return personaMap.get(id)?.identity?.avatar || "?";
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-8"
    >
      <Button
        variant="ghost"
        onClick={onBack}
        className="text-[#9B9594] hover:text-[#EAEAE8] hover:bg-[#1C1C1C] -ml-2"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        {locale === "zh" ? "返回报告" : "Back to Report"}
      </Button>

      {/* Header */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#C4A882]/30 bg-[#C4A882]/5 px-4 py-1.5">
          <Users className="h-4 w-4 text-[#C4A882]" />
          <span className="text-sm font-medium text-[#C4A882]">{t("roundTable")}</span>
        </div>
        <p className="text-sm text-[#9B9594] max-w-lg mx-auto">{debate.topic_focus}</p>
      </div>

      {/* Participants */}
      <div className="flex flex-wrap justify-center gap-3">
        {safeArray<string>(debate.selected_persona_ids).map((pid) => (
          <div
            key={pid}
            className="inline-flex items-center gap-2 rounded-full border border-[#2A2A2A] bg-[#141414] px-3 py-1.5"
          >
            <span className="text-base">{getAvatar(pid)}</span>
            <span className="text-xs font-medium text-[#EAEAE8]">{getName(pid)}</span>
          </div>
        ))}
      </div>

      {/* Rounds */}
      <div className="space-y-8">
        {safeArray<RoundTableDebate["rounds"][number]>(debate.rounds).map((round, ri) => (
          <motion.div
            key={round.round}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + ri * 0.1 }}
          >
            <div className="flex items-center gap-3 mb-4">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#C4A882]/15 text-xs font-bold text-[#C4A882]">
                {round.round}
              </span>
              <span className="text-sm font-medium text-[#EAEAE8]">{round.theme}</span>
            </div>

            <div className="space-y-3 ml-3 border-l-2 border-[#2A2A2A] pl-5">
              {safeArray<RoundTableDebate["rounds"][number]["messages"][number]>(round.messages).map((msg, mi) => {
                const respondingTo = msg.responding_to ? getName(msg.responding_to) : null;
                return (
                  <motion.div
                    key={`${round.round}-${mi}`}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.15 + ri * 0.1 + mi * 0.04 }}
                    className="rounded-xl border border-[#2A2A2A] bg-[#141414] p-4"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">{getAvatar(msg.persona_id)}</span>
                      <span className="text-sm font-medium text-[#EAEAE8]">{getName(msg.persona_id)}</span>
                      {respondingTo && (
                        <span className="text-xs text-[#666462]">
                          → {respondingTo}
                        </span>
                      )}
                      {msg.stance_shift && (
                        <Badge variant="secondary" className="ml-auto text-[10px] bg-[#C4A882]/10 text-[#C4A882] border-0">
                          {msg.stance_shift}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-[#9B9594] leading-relaxed pl-8">
                      {msg.content}
                    </p>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Outcome */}
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.4 }}
        className="rounded-xl border border-[#C4A882]/20 bg-[#C4A882]/5 p-5"
      >
        <div className="flex items-center gap-2 mb-4">
          <div className={`h-2.5 w-2.5 rounded-full ${debate.outcome?.consensus_reached ? "bg-[#4ADE80]" : "bg-[#F87171]"}`} />
          <span className="text-sm font-semibold text-[#EAEAE8]">
            {debate.outcome?.consensus_reached
              ? (locale === "zh" ? "达成共识" : "Consensus Reached")
              : (locale === "zh" ? "分歧未消" : "Disagreements Remain")}
          </span>
        </div>

        {safeArray(debate.outcome?.key_insights).length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-medium text-[#666462] uppercase tracking-wide mb-2">
              {locale === "zh" ? "关键洞见" : "Key Insights"}
            </p>
            <ul className="space-y-2">
              {safeArray<string>(debate.outcome?.key_insights).map((insight, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-[#EAEAE8]">
                  <Lightbulb className="h-3.5 w-3.5 shrink-0 mt-0.5 text-[#C4A882]" />
                  <span>{insight}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {safeArray(debate.outcome?.remaining_disagreements).length > 0 && (
          <div>
            <p className="text-xs font-medium text-[#666462] uppercase tracking-wide mb-2">
              {locale === "zh" ? "未解决分歧" : "Unresolved"}
            </p>
            <ul className="space-y-2">
              {safeArray<string>(debate.outcome?.remaining_disagreements).map((d, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-[#9B9594]">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-[#F87171]/70" />
                  <span>{d}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </motion.div>

      {/* 1v1 Debate CTAs */}
      {onStartDebate && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="rounded-xl border border-[#2A2A2A] bg-[#141414] p-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <Swords className="h-4 w-4 text-[#C4A882]" />
            <h3 className="text-sm font-semibold text-[#EAEAE8]">
              {locale === "zh" ? "发起 1v1 辩论" : "Challenge to 1v1 Debate"}
            </h3>
          </div>
          <p className="text-xs text-[#9B9594] mb-4">
            {locale === "zh"
              ? "选择一位参与者，尝试说服对方改变立场"
              : "Pick a participant and try to change their mind"}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {safeArray<string>(debate.selected_persona_ids).map((pid) => {
              const p = personaMap.get(pid);
              if (!p) return null;
              return (
                <button
                  key={pid}
                  onClick={() => onStartDebate(pid)}
                  className="flex items-center gap-3 rounded-lg border border-[#2A2A2A] bg-[#1C1C1C] px-4 py-3 text-left transition-all hover:border-[#C4A882]/40 hover:bg-[#C4A882]/5"
                >
                  <span className="text-lg">{getAvatar(pid)}</span>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-[#EAEAE8] block truncate">{getName(pid)}</span>
                  </div>
                  <MessageSquare className="h-4 w-4 text-[#C4A882] shrink-0" />
                </button>
              );
            })}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
