import type { LLMAdapter } from "../llm/adapter.js";
import type { EvaluationScores, ProjectParsedData, TopicClassification } from "../types/evaluation.js";
import type {
  SummaryReport,
  DimensionAnalysis,
  MarketReadiness,
  PersonaAnalysisEntry,
  ConsensusPoint,
  DisagreementPoint,
  GoalAssessmentEntry,
  ActionItem,
  ReportPositions,
  ReportReference,
} from "../types/report.js";
import { robustJsonParse } from "../utils/json-parse.js";
import { buildSummaryReportPrompt, buildTopicSummaryReportPrompt } from "../prompts/summary-report.js";

type LooseRecord = Record<string, unknown>;

function reconstructFromStrings(arr: string[], requiredKey: string): LooseRecord[] {
  const objects: LooseRecord[] = [];
  let current: LooseRecord | null = null;
  for (const s of arr) {
    const colonIdx = s.indexOf(": ");
    if (colonIdx === -1) continue;
    const key = s.slice(0, colonIdx).trim();
    const value = s.slice(colonIdx + 2).trim();
    if (key === requiredKey) {
      if (current) objects.push(current);
      current = { [key]: value };
    } else if (current) {
      current[key] = value;
    }
  }
  if (current) objects.push(current);
  return objects;
}

function parseSupportingPersonas(val: unknown): string[] {
  if (Array.isArray(val)) return val.filter((v) => typeof v === "string" && v.length > 0);
  if (typeof val === "string") {
    const trimmed = val.trim();
    if (trimmed.startsWith("[")) {
      try { const parsed = JSON.parse(trimmed); if (Array.isArray(parsed)) return parsed; } catch {}
    }
    return trimmed.split(/,\s*/).filter(Boolean);
  }
  return [];
}

// Some LLM outputs flatten the object — the `point` ends up containing the
// supporting_personas array as inline text. Strip that tail and recover the ids.
function cleanConsensusPoint(raw: unknown): LooseRecord {
  if (!raw || typeof raw !== "object") return (raw ?? {}) as LooseRecord;
  const src = raw as LooseRecord;
  const rawPoint = typeof src.point === "string" ? src.point : "";
  const existing = parseSupportingPersonas(src.supporting_personas);
  const extracted: string[] = [];
  const cleaned = rawPoint
    .replace(/[,;]?\s*supporting[_ ]personas\s*:\s*\[([^\]]*)\]/gi, (_m: string, ids: string) => {
      ids.split(/[,\s]+/)
        .map((s) => s.trim().replace(/^['"]|['"]$/g, ""))
        .filter(Boolean)
        .forEach((id) => extracted.push(id));
      return "";
    })
    .replace(/[\s,;]+$/, "")
    .trim();
  return {
    ...src,
    point: cleaned,
    supporting_personas: existing.length > 0 ? existing : extracted,
  };
}

function toStringArray(val: unknown): string[] {
  if (!Array.isArray(val)) return [];
  return val.filter((v): v is string => typeof v === "string" && v.trim().length > 0);
}

function normalizeIfFeasible(raw: unknown): { next_steps: string[]; optimizations: string[]; risks: string[] } {
  const src: LooseRecord = raw && typeof raw === "object" ? (raw as LooseRecord) : {};
  return {
    next_steps: toStringArray(src.next_steps),
    optimizations: toStringArray(src.optimizations),
    risks: toStringArray(src.risks),
  };
}

function normalizeIfNotFeasible(raw: unknown): { modifications: string[]; direction: string; priorities: string[]; reference_cases: string[] } {
  const src: LooseRecord = raw && typeof raw === "object" ? (raw as LooseRecord) : {};
  return {
    modifications: toStringArray(src.modifications),
    direction: typeof src.direction === "string" ? src.direction : "",
    priorities: toStringArray(src.priorities),
    reference_cases: toStringArray(src.reference_cases),
  };
}

// LLMs sometimes emit `perspectives` as a string, a map keyed by persona name,
// or drop it entirely. Coerce to the expected array shape and filter entries
// that can't be salvaged — frontend renders .map() over this field.
function normalizeDebateHighlights(raw: unknown): Array<{
  topic: string;
  perspectives: { persona_name: string; stance: string }[];
  significance: string;
}> | null {
  if (!Array.isArray(raw)) return null;
  const out = raw
    .map((h: unknown) => {
      if (!h || typeof h !== "object") return null;
      const hr = h as LooseRecord;
      let perspectives: { persona_name: string; stance: string }[] = [];
      if (Array.isArray(hr.perspectives)) {
        perspectives = hr.perspectives
          .filter((p: unknown): p is LooseRecord => !!p && typeof p === "object")
          .map((p: LooseRecord) => ({
            persona_name: typeof p.persona_name === "string" ? p.persona_name : "",
            stance: typeof p.stance === "string" ? p.stance : "",
          }))
          .filter((p: { persona_name: string; stance: string }) => p.persona_name && p.stance);
      } else if (hr.perspectives && typeof hr.perspectives === "object") {
        perspectives = Object.entries(hr.perspectives as Record<string, unknown>)
          .map(([name, stance]) => ({
            persona_name: name,
            stance: typeof stance === "string" ? stance : "",
          }))
          .filter((p) => p.persona_name && p.stance);
      }
      return {
        topic: typeof hr.topic === "string" ? hr.topic : "",
        perspectives,
        significance: typeof hr.significance === "string" ? hr.significance : "",
      };
    })
    .filter((h): h is { topic: string; perspectives: { persona_name: string; stance: string }[]; significance: string } =>
      h !== null && h.topic.length > 0 && h.perspectives.length > 0,
    );
  return out.length > 0 ? out : null;
}

const MIN_FEASIBILITY_ITEMS = 3;

type IfFeasible = { next_steps: string[]; optimizations: string[]; risks: string[] };
type IfNotFeasible = { modifications: string[]; direction: string; priorities: string[]; reference_cases: string[] };

function isFeasibleSparse(f: IfFeasible): boolean {
  return f.next_steps.length < MIN_FEASIBILITY_ITEMS
    || f.optimizations.length < MIN_FEASIBILITY_ITEMS
    || f.risks.length < MIN_FEASIBILITY_ITEMS;
}

function isNotFeasibleSparse(f: IfNotFeasible): boolean {
  return f.modifications.length < MIN_FEASIBILITY_ITEMS
    || f.direction.trim().length === 0
    || f.priorities.length < MIN_FEASIBILITY_ITEMS
    || f.reference_cases.length < MIN_FEASIBILITY_ITEMS;
}

async function backfillFeasibility(
  llm: LLMAdapter,
  project: ProjectParsedData,
  reviews: ReviewForSummary[],
  current: { if_feasible: IfFeasible; if_not_feasible: IfNotFeasible }
): Promise<{ if_feasible: IfFeasible; if_not_feasible: IfNotFeasible }> {
  const feasibleSparse = isFeasibleSparse(current.if_feasible);
  const notFeasibleSparse = isNotFeasibleSparse(current.if_not_feasible);
  if (!feasibleSparse && !notFeasibleSparse) return current;

  const reviewSnippets = reviews
    .map((r) => `### ${r.persona_name} (${r.persona_id})
Review: ${r.review_text.slice(0, 500)}
Strengths: ${r.strengths.join(", ")}
Weaknesses: ${r.weaknesses.join(", ")}`)
    .join("\n\n");

  const system = `You are filling in the feasibility scenarios for a discussion synthesis report. The main report came back with the feasibility sections too sparse. You must regenerate both paths with rigorous quality.

CONTENT QUALITY REQUIREMENTS (non-negotiable):
1. PERSONA VOICE — every item MUST open with attribution to a specific persona from the reviews below, then state the specific action/change. Format: "Following {PersonaName}'s concern that {exact concern}, {specific action tied to a named feature/goal}." or "Addressing {PersonaName}'s point about {X}, ...".
2. TIE TO THE SUBMISSION — reference the topic's actual name, described features, stated goals, target users, or named comparables by exact wording. Do not invent details not in the submission or reviews.
3. REAL-WORLD GROUNDING — name real companies/products/initiatives from your training knowledge (e.g., "Figma's browser-first pivot", "Superhuman's waitlist launch"). Only cite what you are confident is real. Do NOT fabricate studies, reports, or company histories.
4. NO PLATITUDES — banned: "improve marketing", "gather feedback", "iterate quickly", "build community", "refine messaging", "leverage synergies". If generic, rewrite or drop.
5. EACH array MUST contain AT LEAST 3 items. "direction" MUST be a non-empty 1-2 sentence pivot description.
6. BOTH paths (if_feasible AND if_not_feasible) must be fully populated regardless of which seems more viable. The user sees them side-by-side.

"if_feasible" = concrete moves if the topic IS pursued. "if_not_feasible" = what must change OR pivot to if the current form cannot succeed.

Respond in English. Respond ONLY with valid JSON matching:
{
  "if_feasible": {
    "next_steps": ["<'{PersonaName} argued X, so do specific action Y tied to named feature Z'>", "<...>", "<...>"],
    "optimizations": ["<'{PersonaName} flagged weakness X; refine feature Y by...'>", "<...>", "<...>"],
    "risks": ["<'{PersonaName}'s concern that X may play out as Y, specifically when...'>", "<...>", "<...>"]
  },
  "if_not_feasible": {
    "modifications": ["<'{PersonaName} raised blocker X; change Y to address it'>", "<...>", "<...>"],
    "direction": "<recommended pivot in 1-2 sentences — name a real analogous case if possible>",
    "priorities": ["<specific first move tied to a named gap or persona concern>", "<...>", "<...>"],
    "reference_cases": ["<Real named company/product (e.g., 'Slack's pivot from game dev') — one-line reason the analogy fits>", "<...>", "<...>"]
  }
}`;

  const prompt = `Topic: ${project.name}
Description: ${project.description}
Target Audience: ${project.target_users}
Goals: ${project.goals}

## Persona Reviews

${reviewSnippets}

Generate both feasibility paths. At least 3 concrete, persona-referenced items per array. "direction" must be non-empty.`;

  try {
    const response = await llm.complete({ system, prompt, maxTokens: 2048, jsonMode: true });
    const parsed = robustJsonParse(response.text) as LooseRecord;
    const refilledFeasible = normalizeIfFeasible(parsed.if_feasible);
    const refilledNotFeasible = normalizeIfNotFeasible(parsed.if_not_feasible);
    return {
      if_feasible: feasibleSparse && !isFeasibleSparse(refilledFeasible) ? refilledFeasible : current.if_feasible,
      if_not_feasible: notFeasibleSparse && !isNotFeasibleSparse(refilledNotFeasible) ? refilledNotFeasible : current.if_not_feasible,
    };
  } catch (e) {
    console.warn("[backfillFeasibility] Retry failed, keeping original:", (e as Error).message);
    return current;
  }
}

function normalizePersonaAnalysis(raw: unknown): { entries: PersonaAnalysisEntry[]; consensus: ConsensusPoint[]; disagreements: DisagreementPoint[] } {
  if (!raw || typeof raw !== "object") return { entries: [], consensus: [], disagreements: [] };
  const src = raw as LooseRecord;

  let entries: LooseRecord[];
  if (Array.isArray(src.entries) && src.entries.length > 0 && typeof src.entries[0] === "string") {
    entries = reconstructFromStrings(src.entries as string[], "persona_id");
    console.warn("[normalizePersonaAnalysis] Reconstructed entries from flat strings:", entries.length);
  } else {
    entries = Array.isArray(src.entries)
      ? (src.entries as unknown[]).filter((e): e is LooseRecord => typeof e === "object" && e !== null && "persona_id" in (e as object))
      : [];
  }

  let consensus: LooseRecord[];
  if (Array.isArray(src.consensus) && src.consensus.length > 0 && typeof src.consensus[0] === "string") {
    consensus = reconstructFromStrings(src.consensus as string[], "point");
  } else {
    consensus = Array.isArray(src.consensus)
      ? (src.consensus as unknown[]).filter((c): c is LooseRecord => typeof c === "object" && c !== null && "point" in (c as object))
      : [];
  }
  consensus = consensus.map((c) => cleanConsensusPoint({
    ...c,
    supporting_personas: parseSupportingPersonas(c.supporting_personas),
  }));

  let disagreements: LooseRecord[];
  if (Array.isArray(src.disagreements) && src.disagreements.length > 0 && typeof src.disagreements[0] === "string") {
    disagreements = reconstructFromStrings(src.disagreements as string[], "point");
  } else {
    disagreements = Array.isArray(src.disagreements)
      ? (src.disagreements as unknown[]).filter((d): d is LooseRecord => typeof d === "object" && d !== null && ("point" in (d as object) || "reason" in (d as object)))
      : [];
  }
  disagreements = disagreements.map(cleanConsensusPoint);

  return {
    entries: entries as unknown as PersonaAnalysisEntry[],
    consensus: consensus as unknown as ConsensusPoint[],
    disagreements: disagreements as unknown as DisagreementPoint[],
  };
}

export interface ReviewForSummary {
  persona_id: string;
  persona_name: string;
  scores: EvaluationScores;
  review_text: string;
  strengths: string[];
  weaknesses: string[];
  cited_references?: Array<{ claim: string; source?: string }> | null;
}

/** Generate topic-mode synthesis report with consensus_score, synthesis, debate_highlights. */
export async function generateTopicSummaryReport(
  llm: LLMAdapter,
  project: ProjectParsedData,
  reviews: ReviewForSummary[],
  rawInput: string,
  dimensions: TopicClassification["dimensions"]
): Promise<Omit<SummaryReport, "id" | "evaluation_id">> {
  const { system, prompt } = buildTopicSummaryReportPrompt(project, reviews, rawInput, dimensions);
  const response = await llm.complete({ system, prompt, maxTokens: 8192, jsonMode: true });
  let parsed: LooseRecord;
  try {
    parsed = robustJsonParse(response.text) as LooseRecord;
  } catch (e) {
    console.error("[TopicSummary] JSON parse failed. Raw text (first 500 chars):", response.text.slice(0, 500));
    throw new Error(`Topic summary JSON parse failed: ${(e as Error).message}`);
  }
  const feasibility = await backfillFeasibility(llm, project, reviews, {
    if_feasible: normalizeIfFeasible(parsed.if_feasible),
    if_not_feasible: normalizeIfNotFeasible(parsed.if_not_feasible),
  });

  return {
    overall_score: 0,
    persona_analysis: normalizePersonaAnalysis(parsed.persona_analysis),
    multi_dimensional_analysis: (parsed.multi_dimensional_analysis ?? []) as DimensionAnalysis[],
    goal_assessment: [],
    if_not_feasible: feasibility.if_not_feasible,
    if_feasible: feasibility.if_feasible,
    action_items: [],
    market_readiness: parsed.market_readiness as MarketReadiness,
    readiness_label_en: typeof parsed.readiness_label_en === "string" ? parsed.readiness_label_en : undefined,
    readiness_label_zh: typeof parsed.readiness_label_zh === "string" ? parsed.readiness_label_zh : undefined,
    scenario_simulation: null,
    round_table_debate: null,
    opinion_drift: null,
    consensus_score: typeof parsed.consensus_score === "number" ? parsed.consensus_score : null,
    synthesis: typeof parsed.synthesis === "string" ? parsed.synthesis : null,
    debate_highlights: normalizeDebateHighlights(parsed.debate_highlights),
    positions: (parsed.positions ?? null) as ReportPositions | null,
    references: Array.isArray(parsed.references) ? (parsed.references as ReportReference[]) : null,
  };
}

/** Synthesize all persona perspectives into a comprehensive discussion summary. */
export async function generateSummaryReport(
  llm: LLMAdapter,
  project: ProjectParsedData,
  reviews: ReviewForSummary[],
  rawInput: string,
  dimensions?: TopicClassification["dimensions"]
): Promise<Omit<SummaryReport, "id" | "evaluation_id">> {
  const { system, prompt } = buildSummaryReportPrompt(project, reviews, rawInput, dimensions);
  const response = await llm.complete({ system, prompt, maxTokens: 8192, jsonMode: true });
  let parsed: LooseRecord;
  try {
    parsed = robustJsonParse(response.text) as LooseRecord;
  } catch (e) {
    console.error("[SummaryReport] JSON parse failed. Raw text (first 500 chars):", response.text.slice(0, 500));
    throw new Error(`Summary report JSON parse failed: ${(e as Error).message}`);
  }
  const feasibility = await backfillFeasibility(llm, project, reviews, {
    if_feasible: normalizeIfFeasible(parsed.if_feasible),
    if_not_feasible: normalizeIfNotFeasible(parsed.if_not_feasible),
  });

  return {
    overall_score: typeof parsed.overall_score === "number" ? parsed.overall_score : 0,
    persona_analysis: normalizePersonaAnalysis(parsed.persona_analysis),
    multi_dimensional_analysis: (parsed.multi_dimensional_analysis ?? []) as DimensionAnalysis[],
    goal_assessment: (parsed.goal_assessment ?? []) as GoalAssessmentEntry[],
    if_not_feasible: feasibility.if_not_feasible,
    if_feasible: feasibility.if_feasible,
    action_items: (parsed.action_items ?? []) as ActionItem[],
    market_readiness: parsed.market_readiness as MarketReadiness,
    readiness_label_en: typeof parsed.readiness_label_en === "string" ? parsed.readiness_label_en : undefined,
    readiness_label_zh: typeof parsed.readiness_label_zh === "string" ? parsed.readiness_label_zh : undefined,
    scenario_simulation: null,
    round_table_debate: null,
    opinion_drift: null,
  };
}
