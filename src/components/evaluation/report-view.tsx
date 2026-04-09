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
  scores: {
    usability: number;
    market_fit: number;
    design: number;
    tech_quality: number;
    innovation: number;
    pricing: number;
  };
  review_text: string;
  strengths: string[];
  weaknesses: string[];
}

interface ReportViewProps {
  report: any;
  reviews: ReviewData[];
  personas: PersonaData[];
  locale: string;
}

export function ReportView({ report, reviews, personas, locale }: ReportViewProps) {
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
      />
    </div>
  );
}
