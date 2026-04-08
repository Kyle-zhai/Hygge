"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScoreBar } from "./score-radar";
import { ChevronDown, ChevronUp } from "lucide-react";

interface PersonaReviewCardProps {
  personaName: string;
  personaAvatar: string;
  personaOccupation: string;
  scores: {
    usability: number;
    market_fit: number;
    design: number;
    tech_quality: number;
    innovation: number;
    pricing: number;
  };
  reviewText: string;
  strengths: string[];
  weaknesses: string[];
}

export function PersonaReviewCard({
  personaName,
  personaAvatar,
  personaOccupation,
  scores,
  reviewText,
  strengths,
  weaknesses,
}: PersonaReviewCardProps) {
  const t = useTranslations("evaluation");
  const [expanded, setExpanded] = useState(false);
  const avgScore = Object.values(scores).reduce((a, b) => a + b, 0) / 6;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-lg">
            {personaAvatar}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold">{personaName}</span>
              <Badge variant="secondary" className="text-xs">
                {avgScore.toFixed(1)}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">{personaOccupation}</p>
          </div>
          <button onClick={() => setExpanded(!expanded)} className="text-muted-foreground hover:text-foreground">
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <ScoreBar scores={scores} compact />

        {expanded && (
          <div className="space-y-4 pt-2">
            <p className="text-sm leading-relaxed text-foreground/90">{reviewText}</p>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <h4 className="mb-1.5 text-xs font-semibold text-green-600">{t("strengths")}</h4>
                <ul className="space-y-1">
                  {strengths.map((s, i) => (
                    <li key={i} className="text-xs text-muted-foreground">+ {s}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="mb-1.5 text-xs font-semibold text-red-600">{t("weaknesses")}</h4>
                <ul className="space-y-1">
                  {weaknesses.map((w, i) => (
                    <li key={i} className="text-xs text-muted-foreground">- {w}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
