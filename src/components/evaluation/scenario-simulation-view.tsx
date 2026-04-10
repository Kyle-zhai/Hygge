"use client";

import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import { ArrowLeft, TrendingUp, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface PersonaData {
  id: string;
  identity: any;
  demographics: any;
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
        <div className="rounded-xl border border-[#2A2A2A] bg-[#141414] p-5">
          <p className="text-sm text-[#EAEAE8] leading-relaxed">{simulation.summary}</p>
        </div>
      )}

      {/* Adoption Rate Shift */}
      <div className="flex items-center justify-center gap-4 py-4">
        <span className="text-sm text-[#666462]">{t("adoptionShift")}</span>
        <span className={`text-3xl font-bold ${simulation.adoption_rate_shift >= 0 ? "text-[#4ADE80]" : "text-[#F87171]"}`}>
          {simulation.adoption_rate_shift >= 0 ? "+" : ""}{simulation.adoption_rate_shift}%
        </span>
      </div>

      {/* Initial vs Final Stances */}
      {simulation.initial_adoption && simulation.final_adoption && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-[#2A2A2A] bg-[#141414] p-4">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-[#666462] mb-3">Initial Stances</h3>
            <div className="space-y-2">
              {simulation.initial_adoption.map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-lg">{getPersonaAvatar(item.persona_id)}</span>
                  <span className="text-sm text-[#EAEAE8] flex-1">{getPersonaName(item.persona_id)}</span>
                  <Badge className={`border text-xs ${stanceColors[item.stance] || ""}`}>
                    {item.stance}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-[#2A2A2A] bg-[#141414] p-4">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-[#666462] mb-3">Final Stances</h3>
            <div className="space-y-2">
              {simulation.final_adoption.map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-lg">{getPersonaAvatar(item.persona_id)}</span>
                  <span className="text-sm text-[#EAEAE8] flex-1">{getPersonaName(item.persona_id)}</span>
                  <Badge className={`border text-xs ${stanceColors[item.stance] || ""}`}>
                    {item.stance}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Influence Events Timeline */}
      {simulation.influence_events && simulation.influence_events.length > 0 && (
        <div className="rounded-xl border border-[#2A2A2A] bg-[#141414] p-5">
          <div className="flex items-center gap-2 mb-4">
            <Users className="h-4 w-4 text-[#C4A882]" />
            <h3 className="text-sm font-semibold text-[#EAEAE8]">Influence Events</h3>
          </div>
          <div className="space-y-0">
            {simulation.influence_events.map((event, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                className="flex gap-4"
              >
                <div className="flex flex-col items-center">
                  <div className="h-3 w-3 rounded-full border-2 border-[#C4A882] bg-[#0C0C0C]" />
                  {i < simulation.influence_events!.length - 1 && (
                    <div className="w-px flex-1 bg-[#2A2A2A]" />
                  )}
                </div>
                <div className="pb-5 flex-1 min-w-0">
                  {event.influencer_id && event.influenced_id && (
                    <p className="text-xs text-[#C4A882] mb-1">
                      {getPersonaName(event.influencer_id)} → {getPersonaName(event.influenced_id)}
                    </p>
                  )}
                  <p className="text-sm text-[#EAEAE8] leading-relaxed">
                    {event.shift || event.description || event.event || JSON.stringify(event)}
                  </p>
                  {event.reason && (
                    <p className="text-xs text-[#9B9594] mt-1">{event.reason}</p>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}
