"use client";

// Renders evidence chips beneath a finding. Each chip shows the kind
// (data point / comparable / user research / principle / expert view)
// with an icon and the text. When `source` is a URL, the chip becomes
// a link the user can click through to verify the claim.

import { useTranslations } from "next-intl";
import {
  BarChart3,
  Building2,
  Users,
  BookOpen,
  GraduationCap,
  ExternalLink,
} from "lucide-react";
import type { FindingEvidence } from "@/lib/decide/types";

const KIND_ICON = {
  data_point: BarChart3,
  comparable: Building2,
  user_research: Users,
  principle: BookOpen,
  expert_view: GraduationCap,
} as const;

const KIND_LABEL_KEY: Record<FindingEvidence["kind"], string> = {
  data_point: "evidenceDataPoint",
  comparable: "evidenceComparable",
  user_research: "evidenceUserResearch",
  principle: "evidencePrinciple",
  expert_view: "evidenceExpertView",
};

export function EvidenceChips({ evidence }: { evidence: FindingEvidence[] | undefined }) {
  const t = useTranslations("decide");
  if (!evidence || evidence.length === 0) return null;

  return (
    <ul className="mt-2 flex flex-wrap gap-1.5">
      {evidence.map((e, i) => {
        const Icon = KIND_ICON[e.kind];
        const isLink = !!e.source && /^https?:\/\//i.test(e.source);
        const body = (
          <>
            <Icon className="size-3 shrink-0" aria-hidden="true" />
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {t(KIND_LABEL_KEY[e.kind])}
            </span>
            <span className="text-xs text-foreground">{e.text}</span>
            {isLink && <ExternalLink className="size-3 shrink-0 text-muted-foreground" aria-hidden="true" />}
          </>
        );
        const className =
          "inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2.5 py-1";
        return (
          <li key={i} className="max-w-full">
            {isLink ? (
              <a
                href={e.source}
                target="_blank"
                rel="noopener noreferrer"
                className={`${className} hover:bg-muted hover:text-foreground transition-colors`}
                title={e.source}
              >
                {body}
              </a>
            ) : (
              <span className={className}>{body}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
