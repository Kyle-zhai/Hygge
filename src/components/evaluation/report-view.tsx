"use client";

import { useState } from "react";
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

  if (showScores) {
    return (
      <div className="mx-auto max-w-4xl pb-16">
        <ReportScoresView
          report={report}
          reviews={reviews}
          personas={personas}
          locale={locale}
          onBack={() => setShowScores(false)}
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
        onViewScores={() => setShowScores(true)}
      />
    </div>
  );
}
