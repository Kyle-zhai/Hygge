"use client";

// Renders the per-mechanism structured view (the new replacement for the
// "Full transcript" wall-of-text). Each mechanism kind has its own
// visualization: tables, scenario cards, mental-model cards, evidence
// strength bars. The component dispatches on `view.kind` and renders
// nothing if the view payload is missing — callers should fall back to
// the `findings` list in that case.

import { useTranslations } from "next-intl";
import {
  ArrowRight,
  CheckCircle2,
  Circle,
  MinusCircle,
  TrendingUp,
  AlertTriangle,
  Sparkles,
} from "lucide-react";
import type {
  MechanismView,
  MechanismPersonaInfo,
} from "@/lib/decide/types";
import { cn } from "@/lib/utils";

interface Props {
  view: MechanismView;
  personas: MechanismPersonaInfo[];
}

export function MechanismViewBlock({ view, personas }: Props) {
  const personaById = new Map(personas.map((p) => [p.id, p]));
  const personaName = (id: string) => personaById.get(id)?.name ?? id;
  const personaRole = (id: string) => personaById.get(id)?.occupation ?? "";

  switch (view.kind) {
    case "persona_review":
      return (
        <PersonaReviewView
          takes={view.persona_takes}
          personaName={personaName}
          personaRole={personaRole}
        />
      );
    case "round_table_debate":
      return (
        <RoundTableView
          matrix={view.stance_matrix}
          exchanges={view.pivotal_exchanges}
          personaName={personaName}
          personaRole={personaRole}
        />
      );
    case "scenario_simulation":
      return <ScenarioView scenarios={view.scenarios} />;
    case "theory_of_mind":
      return (
        <TheoryOfMindView
          stakeholder={view.stakeholder}
          optimizeFor={view.what_they_optimize_for}
          fears={view.fears}
          changeMind={view.what_would_change_their_mind}
        />
      );
    case "cross_challenge":
      return (
        <CrossChallengeView
          pairings={view.pairings}
          personaName={personaName}
          personaRole={personaRole}
        />
      );
    case "reflection_ranker":
      return <ReflectionRankerView scores={view.finding_scores} />;
    default:
      return null;
  }
}

// ─────────────────────────────────────────────────────────────────────
// Stance icon + color (shared)
// ─────────────────────────────────────────────────────────────────────

function StanceBadge({
  stance,
  size = "sm",
}: {
  stance: "supports" | "neutral" | "opposes";
  size?: "sm" | "md";
}) {
  const t = useTranslations("decide");
  const cls = size === "md" ? "size-4" : "size-3.5";
  if (stance === "supports") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
        <CheckCircle2 className={cls} aria-hidden="true" />
        {t("stanceSupports")}
      </span>
    );
  }
  if (stance === "opposes") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2 py-0.5 text-[11px] font-medium text-rose-700 dark:text-rose-400">
        <MinusCircle className={cls} aria-hidden="true" />
        {t("stanceOpposes")}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
      <Circle className={cls} aria-hidden="true" />
      {t("stanceNeutral")}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Persona review — table of (persona, stance, insight)
// ─────────────────────────────────────────────────────────────────────

function PersonaReviewView({
  takes,
  personaName,
  personaRole,
}: {
  takes: Extract<MechanismView, { kind: "persona_review" }>["persona_takes"];
  personaName: (id: string) => string;
  personaRole: (id: string) => string;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-xs text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-left font-medium">Persona</th>
            <th className="px-3 py-2 text-left font-medium">Stance</th>
            <th className="px-3 py-2 text-left font-medium">Key insight</th>
          </tr>
        </thead>
        <tbody>
          {takes.map((t) => (
            <tr key={t.persona_id} className="border-t border-border align-top">
              <td className="px-3 py-3">
                <div className="font-medium text-foreground">{personaName(t.persona_id)}</div>
                {personaRole(t.persona_id) && (
                  <div className="text-xs text-muted-foreground">{personaRole(t.persona_id)}</div>
                )}
              </td>
              <td className="px-3 py-3">
                <StanceBadge stance={t.stance} />
              </td>
              <td className="px-3 py-3 text-foreground">
                <p>{t.key_insight}</p>
                {t.surprising_angle && (
                  <p className="mt-1 inline-flex items-start gap-1.5 text-xs text-muted-foreground">
                    <Sparkles className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
                    <span>{t.surprising_angle}</span>
                  </p>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Round-table debate — stance matrix + pivotal exchanges
// ─────────────────────────────────────────────────────────────────────

function RoundTableView({
  matrix,
  exchanges,
  personaName,
  personaRole,
}: {
  matrix: Extract<MechanismView, { kind: "round_table_debate" }>["stance_matrix"];
  exchanges: Extract<MechanismView, { kind: "round_table_debate" }>["pivotal_exchanges"];
  personaName: (id: string) => string;
  personaRole: (id: string) => string;
}) {
  const t = useTranslations("decide");
  return (
    <div className="space-y-6">
      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("stanceMatrix")}
        </h3>
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Persona</th>
                <th className="px-3 py-2 text-left font-medium">{t("openingStance")}</th>
                <th className="px-3 py-2 text-left font-medium">{t("finalStance")}</th>
                <th className="px-3 py-2 text-left font-medium">{t("keyArgument")}</th>
              </tr>
            </thead>
            <tbody>
              {matrix.map((r) => (
                <tr
                  key={r.persona_id}
                  className={cn(
                    "border-t border-border align-top",
                    r.shifted && "bg-amber-500/5",
                  )}
                >
                  <td className="px-3 py-3">
                    <div className="font-medium text-foreground">{personaName(r.persona_id)}</div>
                    {personaRole(r.persona_id) && (
                      <div className="text-xs text-muted-foreground">{personaRole(r.persona_id)}</div>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <StanceBadge stance={r.opening_stance} />
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-1.5">
                      <StanceBadge stance={r.final_stance} />
                      {r.shifted && (
                        <span className="text-[10px] font-medium uppercase tracking-wide text-amber-700 dark:text-amber-500">
                          {t("shifted")}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-foreground">{r.key_argument}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {exchanges.length > 0 && (
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("pivotalExchanges")}
          </h3>
          <ul className="space-y-2">
            {exchanges.map((e, i) => (
              <li key={i} className="rounded-md border border-border bg-card p-3 text-sm">
                <div className="mb-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{personaName(e.from_persona_id)}</span>
                  <ArrowRight className="size-3" aria-hidden="true" />
                  <span className="font-medium text-foreground">{personaName(e.to_persona_id)}</span>
                </div>
                <p className="text-foreground">{e.summary}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Scenario simulation — 3 cards with probability bars
// ─────────────────────────────────────────────────────────────────────

const IMPACT_COLOR: Record<"low" | "medium" | "high" | "critical", string> = {
  low: "bg-slate-400",
  medium: "bg-blue-500",
  high: "bg-amber-500",
  critical: "bg-rose-600",
};
const IMPACT_LABEL_KEY: Record<"low" | "medium" | "high" | "critical", string> = {
  low: "impactLow",
  medium: "impactMedium",
  high: "impactHigh",
  critical: "impactCritical",
};

function ScenarioView({
  scenarios,
}: {
  scenarios: Extract<MechanismView, { kind: "scenario_simulation" }>["scenarios"];
}) {
  const t = useTranslations("decide");
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {scenarios.map((s, i) => (
        <div
          key={i}
          className="flex flex-col rounded-lg border border-border bg-card p-4"
        >
          <div className="mb-2 flex items-baseline justify-between">
            <h4 className="text-sm font-semibold text-foreground">{s.name}</h4>
            <span className="text-2xl font-semibold tabular-nums text-foreground">
              {s.probability_pct}%
            </span>
          </div>
          <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn("h-full rounded-full", IMPACT_COLOR[s.impact])}
              style={{ width: `${s.probability_pct}%` }}
            />
          </div>
          <div className="mb-3 inline-flex items-center gap-1 self-start rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            <TrendingUp className="size-3" aria-hidden="true" />
            <span>
              {t("impactLabel")}: {t(IMPACT_LABEL_KEY[s.impact])}
            </span>
          </div>
          <p className="mb-3 text-sm text-foreground">{s.narrative}</p>
          {s.leading_indicators.length > 0 && (
            <div className="mt-auto border-t border-border/60 pt-3">
              <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {t("leadingIndicators")}
              </p>
              <ul className="space-y-1 text-xs text-foreground">
                {s.leading_indicators.map((ind, j) => (
                  <li key={j} className="flex items-start gap-1.5">
                    <span className="mt-1.5 size-1 shrink-0 rounded-full bg-muted-foreground" />
                    <span>{ind}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Theory of mind — stakeholder mental model card
// ─────────────────────────────────────────────────────────────────────

function TheoryOfMindView({
  stakeholder,
  optimizeFor,
  fears,
  changeMind,
}: {
  stakeholder: string;
  optimizeFor: string[];
  fears: string[];
  changeMind: string[];
}) {
  const t = useTranslations("decide");
  return (
    <div className="space-y-4 rounded-lg border border-border bg-card p-5">
      <header>
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {t("stakeholderLabel")}
        </p>
        <h3 className="text-base font-semibold text-foreground">{stakeholder}</h3>
      </header>
      <div className="grid gap-4 md:grid-cols-3">
        <ListSection
          icon={<TrendingUp className="size-3.5" />}
          title={t("optimizesFor")}
          items={optimizeFor}
          tone="positive"
        />
        <ListSection
          icon={<AlertTriangle className="size-3.5" />}
          title={t("fears")}
          items={fears}
          tone="warning"
        />
        <ListSection
          icon={<Sparkles className="size-3.5" />}
          title={t("changeMindIf")}
          items={changeMind}
          tone="neutral"
        />
      </div>
    </div>
  );
}

function ListSection({
  icon,
  title,
  items,
  tone,
}: {
  icon: React.ReactNode;
  title: string;
  items: string[];
  tone: "positive" | "warning" | "neutral";
}) {
  if (items.length === 0) return null;
  const toneClass =
    tone === "positive"
      ? "text-emerald-700 dark:text-emerald-400"
      : tone === "warning"
        ? "text-amber-700 dark:text-amber-500"
        : "text-foreground";
  return (
    <div>
      <p className={cn("mb-2 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide", toneClass)}>
        {icon}
        {title}
      </p>
      <ul className="space-y-1.5 text-sm text-foreground">
        {items.map((it, i) => (
          <li key={i} className="flex items-start gap-1.5">
            <span className="mt-1.5 size-1 shrink-0 rounded-full bg-muted-foreground" />
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Cross challenge — proponent ↔ challenger pairings
// ─────────────────────────────────────────────────────────────────────

function CrossChallengeView({
  pairings,
  personaName,
  personaRole,
}: {
  pairings: Extract<MechanismView, { kind: "cross_challenge" }>["pairings"];
  personaName: (id: string) => string;
  personaRole: (id: string) => string;
}) {
  const t = useTranslations("decide");
  return (
    <div className="space-y-3">
      {pairings.map((p, i) => (
        <div key={i} className="rounded-lg border border-border bg-card p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 font-medium text-emerald-700 dark:text-emerald-400">
              {t("proponent")}: {personaName(p.proponent_id)}
            </span>
            {personaRole(p.proponent_id) && (
              <span className="text-muted-foreground">{personaRole(p.proponent_id)}</span>
            )}
            <ArrowRight className="size-3 text-muted-foreground" aria-hidden="true" />
            <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2 py-0.5 font-medium text-rose-700 dark:text-rose-400">
              {t("challenger")}: {personaName(p.challenger_id)}
            </span>
            {personaRole(p.challenger_id) && (
              <span className="text-muted-foreground">{personaRole(p.challenger_id)}</span>
            )}
          </div>
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {t("position")}
              </dt>
              <dd className="text-foreground">{p.position}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-rose-700 dark:text-rose-400">
                {t("sharpestCounter")}
              </dt>
              <dd className="text-foreground">{p.sharpest_counter}</dd>
            </div>
            {p.residual_uncertainty && (
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-500">
                  {t("residualUncertainty")}
                </dt>
                <dd className="text-foreground">{p.residual_uncertainty}</dd>
              </div>
            )}
          </dl>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Reflection ranker — bar chart of finding strength
// ─────────────────────────────────────────────────────────────────────

function ReflectionRankerView({
  scores,
}: {
  scores: Extract<MechanismView, { kind: "reflection_ranker" }>["finding_scores"];
}) {
  const t = useTranslations("decide");
  return (
    <ul className="space-y-3">
      {scores.map((s, i) => (
        <li key={i} className="rounded-md border border-border bg-card p-3">
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <p className="flex-1 text-sm font-medium text-foreground">{s.finding_headline}</p>
            <span className="shrink-0 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {t("evidenceStrength")}: {s.evidence_strength}/5
            </span>
          </div>
          <div className="mb-2 flex gap-1" aria-hidden="true">
            {[1, 2, 3, 4, 5].map((n) => (
              <span
                key={n}
                className={cn(
                  "h-1.5 flex-1 rounded-full",
                  n <= s.evidence_strength ? "bg-foreground/70" : "bg-muted",
                )}
              />
            ))}
          </div>
          {s.missing_evidence && (
            <p className="text-xs text-muted-foreground">
              <span className="font-medium">{t("missingEvidence")}: </span>
              {s.missing_evidence}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}
