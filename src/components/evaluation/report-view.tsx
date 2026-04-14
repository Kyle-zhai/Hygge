"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { ReportTextView } from "@/components/evaluation/report-text-view";
import { ReportScoresView } from "@/components/evaluation/report-scores-view";
import { ScenarioSimulationView } from "@/components/evaluation/scenario-simulation-view";
import { RoundTableDebateView } from "@/components/evaluation/round-table-debate-view";
import { PersonaChatDrawer } from "@/components/evaluation/persona-chat-drawer";

interface PersonaData {
  id: string;
  identity: any;
  demographics: any;
  category: string;
}

interface ReviewData {
  id: string;
  persona_id: string;
  scores: Record<string, number>;
  review_text: string;
  strengths: string[];
  weaknesses: string[];
}

interface TopicClassification {
  topic_type: string;
  dimensions: Array<{ key: string; label_en: string; label_zh: string; description: string }>;
  readiness_label_en: string;
  readiness_label_zh: string;
}

type ViewMode = "report" | "scores" | "simulation" | "debate";

interface ReportViewProps {
  report: any;
  reviews: ReviewData[];
  personas: PersonaData[];
  locale: string;
  evaluationId?: string;
  topicClassification?: TopicClassification | null;
  mode?: "topic" | "product";
}

export function ReportView({ report, reviews, personas, locale, evaluationId, topicClassification, mode = "product" }: ReportViewProps) {
  const router = useRouter();
  const currentLocale = useLocale();
  const [view, setView] = useState<ViewMode>("report");
  const savedScrollY = useRef(0);
  const pendingScroll = useRef<number | null>(null);

  useEffect(() => {
    if (pendingScroll.current !== null) {
      const target = pendingScroll.current;
      pendingScroll.current = null;
      window.scrollTo(0, target);
      const t1 = setTimeout(() => window.scrollTo(0, target), 50);
      const t2 = setTimeout(() => window.scrollTo(0, target), 150);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    }
  }, [view]);

  function handleViewScores() {
    savedScrollY.current = window.scrollY;
    pendingScroll.current = 0;
    window.scrollTo(0, 0);
    setView("scores");
  }

  function handleViewSimulation() {
    savedScrollY.current = window.scrollY;
    pendingScroll.current = 0;
    window.scrollTo(0, 0);
    setView("simulation");
  }

  function handleViewDebate() {
    savedScrollY.current = window.scrollY;
    pendingScroll.current = 0;
    window.scrollTo(0, 0);
    setView("debate");
  }

  function handleBackToReport() {
    pendingScroll.current = savedScrollY.current;
    setView("report");
  }

  const [chatPersonaId, setChatPersonaId] = useState<string | null>(null);
  const chatPersona = chatPersonaId ? personas.find((p) => p.id === chatPersonaId) : null;

  function handleStartDebate(personaId: string) {
    setChatPersonaId(personaId);
  }

  const drawer = evaluationId && chatPersona ? (
    <PersonaChatDrawer
      evaluationId={evaluationId}
      persona={chatPersona}
      onClose={() => setChatPersonaId(null)}
    />
  ) : null;

  if (view === "scores") {
    return (
      <>
        <div className="mx-auto max-w-4xl px-4 py-8 pb-16">
          <ReportScoresView
            report={report}
            reviews={reviews}
            personas={personas}
            locale={locale}
            onBack={handleBackToReport}
            topicClassification={topicClassification}
            mode={mode}
          />
        </div>
        {drawer}
      </>
    );
  }

  if (view === "debate" && report?.round_table_debate) {
    return (
      <>
        <div className="mx-auto max-w-4xl px-4 py-8 pb-16">
          <RoundTableDebateView
            debate={report.round_table_debate}
            personas={personas}
            locale={locale}
            onBack={handleBackToReport}
            onStartDebate={evaluationId ? handleStartDebate : undefined}
          />
        </div>
        {drawer}
      </>
    );
  }

  if (view === "simulation" && report?.scenario_simulation) {
    return (
      <>
        <div className="mx-auto max-w-4xl px-4 py-8 pb-16">
          <ScenarioSimulationView
            simulation={report.scenario_simulation}
            personas={personas}
            locale={locale}
            onBack={handleBackToReport}
          />
        </div>
        {drawer}
      </>
    );
  }

  return (
    <>
      <div className="mx-auto max-w-5xl px-4 py-8 pb-16">
        <ReportTextView
          report={report}
          reviews={reviews}
          personas={personas}
          locale={locale}
          onViewScores={handleViewScores}
          onViewSimulation={report?.scenario_simulation ? handleViewSimulation : undefined}
          onViewDebate={report?.round_table_debate ? handleViewDebate : undefined}
          onStartDebate={evaluationId ? handleStartDebate : undefined}
          evaluationId={evaluationId}
          topicClassification={topicClassification}
          mode={mode}
        />
      </div>
      {drawer}
    </>
  );
}
