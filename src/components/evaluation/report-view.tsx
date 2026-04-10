"use client";

import { useState, useRef, useEffect } from "react";
import { ReportTextView } from "@/components/evaluation/report-text-view";
import { ReportScoresView } from "@/components/evaluation/report-scores-view";

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

interface ReportViewProps {
  report: any;
  reviews: ReviewData[];
  personas: PersonaData[];
  locale: string;
  topicClassification?: TopicClassification | null;
}

export function ReportView({ report, reviews, personas, locale, topicClassification }: ReportViewProps) {
  const [showScores, setShowScores] = useState(false);
  const savedScrollY = useRef(0);
  const pendingScroll = useRef<number | null>(null);

  useEffect(() => {
    if (pendingScroll.current !== null) {
      const target = pendingScroll.current;
      pendingScroll.current = null;
      window.scrollTo(0, target);
      // Override browser scroll restoration after layout settles
      const t1 = setTimeout(() => window.scrollTo(0, target), 50);
      const t2 = setTimeout(() => window.scrollTo(0, target), 150);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    }
  }, [showScores]);

  function handleViewScores() {
    savedScrollY.current = window.scrollY;
    pendingScroll.current = 0;
    setShowScores(true);
  }

  function handleBack() {
    pendingScroll.current = savedScrollY.current;
    setShowScores(false);
  }

  if (showScores) {
    return (
      <div className="mx-auto max-w-4xl pb-16">
        <ReportScoresView
          report={report}
          reviews={reviews}
          personas={personas}
          locale={locale}
          onBack={handleBack}
          topicClassification={topicClassification}
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
        topicClassification={topicClassification}
      />
    </div>
  );
}
