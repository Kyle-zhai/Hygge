"use client";

import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, TrendingUp, Users, Sparkles } from "lucide-react";
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

interface ScenarioSimulation {
  summary: string;
  adoption_rate_shift: number;
  initial_adoption?: Array<{ persona_id: string; stance: string }>;
  final_adoption?: Array<{ persona_id: string; stance: string }>;
  influence_events?: Array<{
    influencer_id?: string;
    influenced_id?: string;
    shift?: string;
    reason?: string;
    description?: string;
    event?: string;
  }>;
}

interface ScenarioSimulationViewProps {
  simulation: ScenarioSimulation;
  personas: PersonaData[];
  locale: string;
  onBack: () => void;
}

const stanceColors: Record<string, string> = {
  positive: "border-[#4ADE80]/30 bg-[#4ADE80]/10 text-[#4ADE80]",
  neutral: "border-[#FBBF24]/30 bg-[#FBBF24]/10 text-[#FBBF24]",
  negative: "border-[#F87171]/30 bg-[#F87171]/10 text-[#F87171]",
};

const stanceDotColors: Record<string, string> = {
  positive: "bg-[#4ADE80]",
  neutral: "bg-[#FBBF24]",
  negative: "bg-[#F87171]",
};

function safeArray<T>(val: unknown): T[] {
  return Array.isArray(val) ? val : [];
}

export function ScenarioSimulationView({ simulation, personas, locale, onBack }: ScenarioSimulationViewProps) {
  const t = useTranslations("evaluation");
  const personaMap = new Map(personas.map((p) => [p.id, p]));

  function getPersonaName(id: string) {
    const p = personaMap.get(id);
    return p?.identity?.name || "Unknown";
  }

  function getPersonaAvatar(id: string) {
    const p = personaMap.get(id);
    return p?.identity?.avatar || "?";
  }

  const influenceEvents = safeArray<NonNullable<ScenarioSimulation["influence_events"]>[number]>(simulation.influence_events);

  // Build a combined stance transition map for the unified view
  const stanceTransitions = safeArray<NonNullable<ScenarioSimulation["initial_adoption"]>[number]>(simulation.initial_adoption).map((initial) => {
    const final = simulation.final_adoption?.find(
      (f) => f.persona_id === initial.persona_id
    );
    const changed = final && final.stance !== initial.stance;
    return {
      persona_id: initial.persona_id,
      initial_stance: initial.stance,
      final_stance: final?.stance || initial.stance,
      changed,
    };
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-8"
    >
      {/* Back button */}
      <Button
        variant="ghost"
        onClick={onBack}
        className="text-[#9B9594] hover:text-[#EAEAE8] hover:bg-[#1C1C1C] -ml-2"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Report
      </Button>

      {/* Header */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#C4A882]/30 bg-[#C4A882]/5 px-4 py-1.5">
          <TrendingUp className="h-4 w-4 text-[#C4A882]" />
          <span className="text-sm font-medium text-[#C4A882]">{t("scenarioSimulation")}</span>
        </div>
        <p className="text-sm text-[#9B9594] max-w-lg mx-auto">
          A simulation of how personas would influence each other when discussing this topic in a real-world setting.
        </p>
      </div>

      {/* Summary */}
      {simulation.summary && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-xl border border-[#2A2A2A] bg-[#141414] p-5"
        >
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-4 w-4 text-[#C4A882]" />
            <h3 className="text-xs font-semibold uppercase tracking-widest text-[#666462]">Summary</h3>
          </div>
          <p className="text-sm text-[#EAEAE8] leading-relaxed">{simulation.summary}</p>
        </motion.div>
      )}

      {/* Adoption Rate Shift */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.15 }}
        className="flex items-center justify-center gap-4 py-4"
      >
        <span className="text-sm text-[#666462]">{t("adoptionShift")}</span>
        <span className={`text-3xl font-bold ${simulation.adoption_rate_shift >= 0 ? "text-[#4ADE80]" : "text-[#F87171]"}`}>
          {simulation.adoption_rate_shift >= 0 ? "+" : ""}{simulation.adoption_rate_shift}%
        </span>
      </motion.div>

      {/* Persona Stance Transitions - Combined View */}
      {stanceTransitions.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-xl border border-[#2A2A2A] bg-[#141414] p-5"
        >
          <h3 className="text-xs font-semibold uppercase tracking-widest text-[#666462] mb-4">
            Stance Transitions
          </h3>
          <div className="space-y-3">
            {stanceTransitions.map((item, i) => (
              <motion.div
                key={item.persona_id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.25 + i * 0.05 }}
                className={`flex items-center gap-3 rounded-lg p-3 transition-colors ${
                  item.changed ? "bg-[#1C1C1C]" : "bg-transparent"
                }`}
              >
                <span className="text-lg shrink-0">{getPersonaAvatar(item.persona_id)}</span>
                <span className="text-sm text-[#EAEAE8] flex-1 min-w-0 truncate">
                  {getPersonaName(item.persona_id)}
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge className={`border text-xs ${stanceColors[item.initial_stance] || ""}`}>
                    {item.initial_stance}
                  </Badge>
                  <ArrowRight className={`h-3.5 w-3.5 ${item.changed ? "text-[#C4A882]" : "text-[#333]"}`} />
                  <Badge className={`border text-xs ${stanceColors[item.final_stance] || ""}`}>
                    {item.final_stance}
                  </Badge>
                  {item.changed && (
                    <div className={`h-2 w-2 rounded-full ${stanceDotColors[item.final_stance] || "bg-[#666]"} animate-pulse`} />
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Influence Events Timeline */}
      {influenceEvents.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-xl border border-[#2A2A2A] bg-[#141414] p-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <Users className="h-4 w-4 text-[#C4A882]" />
            <h3 className="text-sm font-semibold text-[#EAEAE8]">Influence Events</h3>
          </div>
          <div className="space-y-0">
            {influenceEvents.map((event, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.35 + i * 0.08 }}
                className="flex gap-4"
              >
                <div className="flex flex-col items-center">
                  <div className="h-3 w-3 rounded-full border-2 border-[#C4A882] bg-[#0C0C0C]" />
                  {i < influenceEvents.length - 1 && (
                    <div className="w-px flex-1 bg-[#2A2A2A]" />
                  )}
                </div>
                <div className="pb-5 flex-1 min-w-0">
                  {event.influencer_id && event.influenced_id && (
                    <p className="text-xs text-[#C4A882] mb-1 font-medium">
                      {getPersonaAvatar(event.influencer_id)} {getPersonaName(event.influencer_id)}{" "}
                      <span className="text-[#666462]">influenced</span>{" "}
                      {getPersonaAvatar(event.influenced_id)} {getPersonaName(event.influenced_id)}
                    </p>
                  )}
                  <p className="text-sm text-[#EAEAE8] leading-relaxed">
                    {event.shift || event.description || event.event || JSON.stringify(event)}
                  </p>
                  {event.reason && (
                    <p className="text-xs text-[#9B9594] mt-1 italic">{event.reason}</p>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
