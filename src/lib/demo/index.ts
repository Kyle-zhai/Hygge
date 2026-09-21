// Demo mode — a complete, pre-built decision that needs no auth, no LLM
// provider and no worker.
//
// Why this exists: the interesting surfaces of this product (the report,
// the mechanism transcripts, a conflict between two mechanisms) all sit
// behind a login and a finished analysis run. Someone who clones the repo
// would have to wire up Supabase, Redis and an LLM key before seeing any
// of it. Demo mode short-circuits that: set NEXT_PUBLIC_DEMO_MODE=true,
// run `npm run dev`, and the decision below is browsable end to end.
//
// Safety: every consumer of this module is guarded by isDemoMode(), which
// reads a NEXT_PUBLIC_ variable. Those are inlined at build time, so a
// production build that does not set it compiles the demo branches out.
// The fixtures are static objects — nothing here touches the database,
// and no demo id can collide with a real UUID (they are all `demo-*`).

import type {
  DecisionBriefSummary,
  DecisionMessage,
  DecisionSession,
  Finding,
  MechanismKind,
  MechanismPersonaInfo,
  MechanismRunSummary,
  MechanismView,
} from "@/lib/decide/types";

export function isDemoMode(): boolean {
  return process.env.NEXT_PUBLIC_DEMO_MODE === "true";
}

export const DEMO_USER_ID = "demo-user";
export const DEMO_SESSION_ID = "demo-session";
export const DEMO_BRIEF_ID = "demo-brief";

export function isDemoId(id: string): boolean {
  return id.startsWith("demo-");
}

const T0 = "2026-03-04T09:12:00.000Z";
const T1 = "2026-03-04T09:14:30.000Z";

// ---------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------

export const DEMO_PERSONAS: MechanismPersonaInfo[] = [
  { id: "demo-staff-eng", name: "Alex Chen", occupation: "Staff Engineer" },
  { id: "demo-cto", name: "Priya Raman", occupation: "CTO" },
  { id: "demo-pm", name: "James Liu", occupation: "Product Manager" },
  { id: "demo-sre", name: "Maya Okafor", occupation: "SRE Lead" },
];

const PERSONA_IDS = DEMO_PERSONAS.map((p) => p.id);

// ---------------------------------------------------------------------
// Session + intake conversation
// ---------------------------------------------------------------------

export const DEMO_SESSION: DecisionSession = {
  id: DEMO_SESSION_ID,
  user_id: DEMO_USER_ID,
  workspace_id: null,
  title: "Rewrite the monolith in Go, or modularize it?",
  last_msg_at: T1,
  created_at: T0,
};

export const DEMO_MESSAGES: DecisionMessage[] = [
  {
    id: "demo-msg-1",
    session_id: DEMO_SESSION_ID,
    kind: "user_text",
    content:
      "Our Rails monolith is 8 years old and deploys take 40 minutes. Half the team wants to rewrite it in Go. The other half wants to modularize what we have. We ship to ~40k daily active users and have 11 engineers. I need to decide this quarter.",
    options: null,
    brief_id: null,
    is_ephemeral: false,
    created_at: T0,
  },
  {
    id: "demo-msg-2",
    session_id: DEMO_SESSION_ID,
    kind: "agent_question",
    content:
      "If the rewrite ran long, what would break first — a hiring commitment, a customer promise, or a funding milestone?",
    options: [
      { id: "customer", label: "A customer promise", is_recommended: true },
      { id: "funding", label: "A funding milestone", is_recommended: false },
      { id: "hiring", label: "A hiring commitment", is_recommended: false },
      { id: "start", label: "Skip — run now", is_recommended: false },
    ],
    brief_id: null,
    is_ephemeral: false,
    created_at: T0,
  },
  {
    id: "demo-msg-3",
    session_id: DEMO_SESSION_ID,
    kind: "user_option",
    content: "customer",
    options: null,
    brief_id: null,
    is_ephemeral: false,
    created_at: T0,
  },
  {
    id: "demo-msg-4",
    session_id: DEMO_SESSION_ID,
    kind: "agent_confirmation",
    content:
      "I'll analyze this as a high-stakes, months-horizon tradeoff across technical, business and people dimensions, using four mechanisms with a panel of four personas.",
    options: [
      { id: "start", label: "Start analysis", is_recommended: true },
      { id: "swap", label: "Swap personas", is_recommended: false },
    ],
    brief_id: DEMO_BRIEF_ID,
    is_ephemeral: false,
    created_at: T1,
  },
  {
    id: "demo-msg-5",
    session_id: DEMO_SESSION_ID,
    kind: "agent_artifact",
    content: "Analysis complete — 9 findings across 4 mechanisms, 1 conflict flagged.",
    options: null,
    brief_id: DEMO_BRIEF_ID,
    is_ephemeral: false,
    created_at: T1,
  },
];

// ---------------------------------------------------------------------
// Brief
// ---------------------------------------------------------------------

const DEMO_MECHANISM_KINDS: MechanismKind[] = [
  "persona_review",
  "round_table_debate",
  "scenario_simulation",
  "cross_challenge",
];

export const DEMO_BRIEF: DecisionBriefSummary = {
  id: DEMO_BRIEF_ID,
  session_id: DEMO_SESSION_ID,
  parent_brief_id: null,
  status: "completed",
  decision_type: "tradeoff",
  primary_dimensions: ["technical", "business", "people"],
  canonical_question:
    "Should we rewrite our 8-year-old Rails monolith in Go, or invest in modularizing it in place?",
  persona_ids: PERSONA_IDS,
  mechanism_kinds: DEMO_MECHANISM_KINDS,
  created_at: T0,
  finalized_at: T1,
};

// ---------------------------------------------------------------------
// Mechanism runs
// ---------------------------------------------------------------------

const RUN_IDS: Record<string, string> = {
  persona_review: "demo-run-persona-review",
  round_table_debate: "demo-run-round-table",
  scenario_simulation: "demo-run-scenario",
  cross_challenge: "demo-run-cross-challenge",
  // Synthetic carrier: conflict_warning findings must still point at a real
  // run row, so the synthesizer creates one tagged args.synthetic = true.
  reflection_ranker: "demo-run-conflict",
};

export const DEMO_RUNS: MechanismRunSummary[] = [
  { id: RUN_IDS.persona_review, kind: "persona_review", status: "completed", error_message: null, duration_ms: 18_400 },
  { id: RUN_IDS.round_table_debate, kind: "round_table_debate", status: "completed", error_message: null, duration_ms: 41_900 },
  { id: RUN_IDS.scenario_simulation, kind: "scenario_simulation", status: "completed", error_message: null, duration_ms: 22_700 },
  { id: RUN_IDS.cross_challenge, kind: "cross_challenge", status: "completed", error_message: null, duration_ms: 26_300 },
  { id: RUN_IDS.reflection_ranker, kind: "reflection_ranker", status: "completed", error_message: null, duration_ms: 9_100 },
];

const MECHANISM_VIEWS: Record<string, MechanismView> = {
  [RUN_IDS.persona_review]: {
    kind: "persona_review",
    persona_takes: [
      {
        persona_id: "demo-staff-eng",
        stance: "opposes",
        key_insight:
          "The 40-minute deploy is a test-suite and CI topology problem, not a language problem. Nothing about Go makes a 12,000-example suite faster to run.",
        surprising_angle:
          "Two thirds of that 40 minutes is a single serialized integration stage that nobody owns.",
      },
      {
        persona_id: "demo-cto",
        stance: "neutral",
        key_insight:
          "Either path is survivable. What is not survivable is starting the rewrite and stopping halfway, which is the historical base rate for teams this size.",
      },
      {
        persona_id: "demo-pm",
        stance: "opposes",
        key_insight:
          "A rewrite means roughly two quarters with no user-visible change while committed customer work is already on the roadmap.",
      },
      {
        persona_id: "demo-sre",
        stance: "supports",
        key_insight:
          "Modularizing inside the monolith keeps a single failure domain. The current on-call burden is already concentrated in one process.",
        surprising_angle:
          "The real operational win is independent deploys, and that is achievable without changing language.",
      },
    ],
  },
  [RUN_IDS.round_table_debate]: {
    kind: "round_table_debate",
    stance_matrix: [
      {
        persona_id: "demo-staff-eng",
        opening_stance: "opposes",
        final_stance: "opposes",
        shifted: false,
        key_argument: "Measure the deploy pipeline before rewriting anything it touches.",
      },
      {
        persona_id: "demo-cto",
        opening_stance: "neutral",
        final_stance: "opposes",
        shifted: true,
        key_argument:
          "Shifted after the 11-engineer headcount was put against a two-quarter freeze — the team cannot run both tracks.",
      },
      {
        persona_id: "demo-pm",
        opening_stance: "opposes",
        final_stance: "opposes",
        shifted: false,
        key_argument: "Committed customer work makes a feature freeze a contractual risk, not just a product one.",
      },
      {
        persona_id: "demo-sre",
        opening_stance: "supports",
        final_stance: "neutral",
        shifted: true,
        key_argument:
          "Conceded that independent deploys are the actual goal, and that the monolith can get them via extraction.",
      },
    ],
    pivotal_exchanges: [
      {
        from_persona_id: "demo-staff-eng",
        to_persona_id: "demo-sre",
        summary:
          "Asked which specific incidents in the last year would have been prevented by Go. The answer was none — they were data-model and retry-logic failures that a rewrite carries forward.",
      },
      {
        from_persona_id: "demo-pm",
        to_persona_id: "demo-cto",
        summary:
          "Put the two-quarter freeze against the signed renewal dates, which moved the CTO from neutral to opposed.",
      },
    ],
  },
  [RUN_IDS.scenario_simulation]: {
    kind: "scenario_simulation",
    scenarios: [
      {
        name: "Modularize in place, extract two services",
        probability_pct: 55,
        impact: "medium",
        narrative:
          "Deploy time drops to ~12 minutes within a quarter by parallelizing the integration stage and extracting billing and notifications. Feature work continues throughout. The monolith remains, and so does the underlying coupling.",
        leading_indicators: [
          "Integration stage parallelized within 3 weeks",
          "First service extracted without a rollback",
          "No increase in on-call pages",
        ],
      },
      {
        name: "Full rewrite, completed",
        probability_pct: 15,
        impact: "high",
        narrative:
          "Roughly three quarters, not two. Ends with a faster, cleaner system and a team that has shipped nothing user-visible for most of a year.",
        leading_indicators: [
          "Feature freeze holds past week 8",
          "No senior departures during the freeze",
          "Parity checklist stays under 200 items",
        ],
      },
      {
        name: "Rewrite started, abandoned mid-flight",
        probability_pct: 30,
        impact: "critical",
        narrative:
          "The most likely failure mode. Pressure from a committed customer date pulls engineers back to the monolith around month four. The org is left maintaining two systems and one half-finished migration, permanently.",
        leading_indicators: [
          "Any customer escalation routed to monolith engineers",
          "Rewrite headcount dropping below 4",
          "Parity checklist growing month over month",
        ],
      },
    ],
  },
  [RUN_IDS.cross_challenge]: {
    kind: "cross_challenge",
    pairings: [
      {
        proponent_id: "demo-sre",
        challenger_id: "demo-staff-eng",
        position: "A rewrite is the only way to get independent deploys and a sane failure domain.",
        sharpest_counter:
          "Independent deploys are an architectural property, not a language one. Extracting two services from the monolith delivers the same operational win in a fraction of the time, and is reversible.",
        residual_uncertainty:
          "Whether the existing data model can be cleanly split at the billing boundary — nobody in the room had looked.",
      },
      {
        proponent_id: "demo-pm",
        challenger_id: "demo-cto",
        position: "The freeze is unacceptable because customer commitments are already signed.",
        sharpest_counter:
          "Modularization is not free either — it consumes senior engineering attention for at least a quarter, and that is the same scarce resource.",
        residual_uncertainty:
          "No one costed the modularization path in engineer-weeks; the comparison is currently vibes against vibes.",
      },
    ],
  },
  [RUN_IDS.reflection_ranker]: {
    kind: "reflection_ranker",
    finding_scores: [
      {
        finding_headline: "Deploy time is a CI topology problem, not a language problem",
        evidence_strength: 4,
        missing_evidence: "Nobody produced an actual stage-by-stage breakdown of the 40 minutes.",
      },
      {
        finding_headline: "Abandoned-rewrite is the single most costly outcome",
        evidence_strength: 3,
        missing_evidence: "Base rate is asserted from general industry experience, not from this org's history.",
      },
    ],
  },
};

const RAW_TRANSCRIPTS: Record<string, unknown> = {
  [RUN_IDS.round_table_debate]: {
    rounds: [
      {
        round: 1,
        utterances: [
          {
            persona_id: "demo-sre",
            text: "Every page I take at 3am comes from one process. A rewrite lets us split the failure domain properly.",
          },
          {
            persona_id: "demo-staff-eng",
            text: "Name one incident from the last year that Go would have prevented. I pulled the postmortems — they're data-model bugs and missing retries. A rewrite carries both forward, plus it reintroduces every bug we've already fixed.",
          },
          {
            persona_id: "demo-pm",
            text: "I want to flag what two quarters of no user-visible change means. We have signed renewals in Q3.",
          },
          {
            persona_id: "demo-cto",
            text: "I'm genuinely undecided. Both paths are defensible on the technical merits.",
          },
        ],
      },
      {
        round: 2,
        utterances: [
          {
            persona_id: "demo-sre",
            text: "That's fair on the incidents. What I actually want is independent deploys. If extraction gets me that, I don't need the rewrite.",
          },
          {
            persona_id: "demo-cto",
            text: "Eleven engineers. If four go to the rewrite, feature velocity roughly halves for two quarters, and the renewal dates don't move. That moves me to opposed.",
          },
        ],
      },
    ],
  },
};

/** Matches the `{ run, personas }` envelope of GET /api/decisions/mechanism-runs/[runId]. */
export function getDemoRun(runId: string) {
  const summary = DEMO_RUNS.find((r) => r.id === runId);
  if (!summary) return null;
  return {
    run: {
      id: summary.id,
      brief_id: DEMO_BRIEF_ID,
      kind: summary.kind,
      status: summary.status,
      args: summary.kind === "reflection_ranker" ? { synthetic: true } : {},
      raw_output: {
        findings: DEMO_FINDINGS.filter((f) => f.mechanism_run_id === runId).map((f) => ({
          headline: f.headline,
          detail_summary: f.detail_summary,
          severity: f.severity,
          evidence: f.evidence ?? [],
        })),
        mechanism_view: MECHANISM_VIEWS[runId] ?? null,
        raw_transcript: RAW_TRANSCRIPTS[runId] ?? null,
      },
      error_message: null,
      attempts: 1,
      started_at: T1,
      completed_at: T1,
      duration_ms: summary.duration_ms,
    },
    personas: DEMO_PERSONAS,
  };
}

// ---------------------------------------------------------------------
// Findings
// ---------------------------------------------------------------------

function finding(
  n: number,
  runId: string,
  source: Finding["source_mechanism"],
  headline: string,
  severity: Finding["severity"],
  confidence: number,
  detail: string,
  cited: string[],
  evidence: Finding["evidence"] = [],
  position: number | null = null,
): Finding {
  return {
    id: `demo-finding-${n}`,
    brief_id: DEMO_BRIEF_ID,
    mechanism_run_id: runId,
    source_mechanism: source,
    headline,
    severity,
    confidence,
    detail_summary: detail,
    cited_persona_ids: cited,
    position,
    content_hash: `demo-hash-${n}`,
    created_at: T1,
    evidence,
  };
}

export const DEMO_FINDINGS: Finding[] = [
  finding(
    1,
    RUN_IDS.persona_review,
    "persona_review",
    "Deploy time is a CI topology problem, not a language problem",
    4,
    0.86,
    "Three of four personas independently located the 40 minutes in a serialized integration stage that no team owns.",
    ["demo-staff-eng", "demo-sre"],
    [
      { kind: "data_point", text: "~26 of the 40 minutes sit in one serialized integration stage" },
      { kind: "principle", text: "Rewrites do not inherit pipeline parallelism for free" },
    ],
    1,
  ),
  finding(
    2,
    RUN_IDS.persona_review,
    "persona_review",
    "No incident in the last 12 months would have been prevented by Go",
    3,
    0.79,
    "Postmortems reviewed in the panel were data-model and retry-logic failures — both survive a language change.",
    ["demo-staff-eng"],
    [{ kind: "user_research", text: "Panel reviewed the trailing-year postmortem set" }],
    2,
  ),
  finding(
    3,
    RUN_IDS.round_table_debate,
    "round_table_debate",
    "Two of four personas shifted position during debate",
    2,
    0.91,
    "The CTO moved neutral → opposed on headcount math; the SRE moved supports → neutral once independent deploys were separated from the rewrite.",
    ["demo-cto", "demo-sre"],
    [{ kind: "comparable", text: "11 engineers against a 2-quarter freeze with signed Q3 renewals" }],
    1,
  ),
  finding(
    4,
    RUN_IDS.round_table_debate,
    "round_table_debate",
    "The stated goal is independent deploys, not Go",
    5,
    0.88,
    "Once the SRE's underlying want was named, the disagreement narrowed to a question about architecture rather than language.",
    ["demo-sre", "demo-staff-eng"],
    [],
    2,
  ),
  finding(
    5,
    RUN_IDS.scenario_simulation,
    "scenario_simulation",
    "Abandoned-rewrite is the single most costly outcome at 30% probability",
    5,
    0.72,
    "Higher modelled probability than a completed rewrite (15%), and it leaves two systems and a permanent half-migration.",
    ["demo-cto", "demo-pm"],
    [
      { kind: "data_point", text: "Abandoned 30% vs completed 15% over a 9-month horizon" },
      { kind: "expert_view", text: "Failure mode triggers on the first customer escalation" },
    ],
    1,
  ),
  finding(
    6,
    RUN_IDS.scenario_simulation,
    "scenario_simulation",
    "Modularization reaches ~12-minute deploys within one quarter",
    3,
    0.68,
    "Modelled as the 55% path: parallelize the integration stage, then extract billing and notifications.",
    ["demo-staff-eng"],
    [{ kind: "comparable", text: "40 min → ~12 min without a language change" }],
    2,
  ),
  finding(
    7,
    RUN_IDS.cross_challenge,
    "cross_challenge",
    "Nobody costed the modularization path in engineer-weeks",
    4,
    0.83,
    "The comparison being argued is an estimated rewrite against an unestimated alternative.",
    ["demo-cto", "demo-pm"],
    [{ kind: "principle", text: "An unestimated option always looks cheaper than an estimated one" }],
    1,
  ),
  finding(
    8,
    RUN_IDS.cross_challenge,
    "cross_challenge",
    "Whether the data model splits cleanly at the billing boundary is unknown",
    4,
    0.65,
    "Both paths depend on this and nobody in the panel had examined it. It is the cheapest thing to go check first.",
    ["demo-staff-eng", "demo-sre"],
    [],
    2,
  ),
  // The interesting one: two mechanisms disagreed and the synthesizer
  // refused to resolve it silently.
  finding(
    9,
    RUN_IDS.reflection_ranker,
    "conflict_warning",
    "Scenario simulation and cross-challenge disagree on whether modularization is actually cheaper",
    5,
    0.7,
    "scenario_simulation assigns modularization a 55% chance of reaching ~12-minute deploys in one quarter. cross_challenge points out that no one costed it in engineer-weeks, which means that 55% rests on an unestimated plan. Both conclusions are supported by their own transcripts; they cannot both be relied on. Resolve by costing the modularization path before committing.",
    ["demo-cto", "demo-staff-eng"],
    [
      { kind: "principle", text: "scenario_simulation finding #6 vs cross_challenge finding #7" },
    ],
    1,
  ),
];
