"use client";

import { useState, useRef, useEffect } from "react";
import { ReportTextView } from "@/components/evaluation/report-text-view";
import { ReportScoresView } from "@/components/evaluation/report-scores-view";
import { ScenarioSimulationView } from "@/components/evaluation/scenario-simulation-view";

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

type ViewMode = "report" | "scores" | "simulation";

interface ReportViewProps {
  report: any;
  reviews: ReviewData[];
  personas: PersonaData[];
  locale: string;
  topicClassification?: TopicClassification | null;
}

export function ReportView({ report, reviews, personas, locale, topicClassification }: ReportViewProps) {
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
    setView("scores");
  }

  function handleViewSimulation() {
    savedScrollY.current = window.scrollY;
    pendingScroll.current = 0;
    setView("simulation");
  }

  function handleBackToReport() {
    pendingScroll.current = savedScrollY.current;
    setView("report");
  }

  if (view === "scores") {
    return (
      <div className="mx-auto max-w-4xl pb-16">
        <ReportScoresView
          report={report}
          reviews={reviews}
          personas={personas}
          locale={locale}
          onBack={handleBackToReport}
          topicClassification={topicClassification}
        />
      </div>
    );
  }

  if (view === "simulation" && report?.scenario_simulation) {
    return (
      <div className="mx-auto max-w-4xl pb-16">
        <ScenarioSimulationView
          simulation={report.scenario_simulation}
          personas={personas}
          locale={locale}
          onBack={handleBackToReport}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl pb-16">
      <ReportTextView
        report={report}
        reviews={reviews}
        personas={personas}
        locale={locale}
        onViewScores={handleViewScores}
        onViewSimulation={report?.scenario_simulation ? handleViewSimulation : undefined}
        topicClassification={topicClassification}
      />
    </div>
  );
}
