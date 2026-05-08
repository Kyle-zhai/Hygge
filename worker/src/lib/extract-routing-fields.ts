// Extracts routing fields from a user's decision question + any clarifying
// answers. Wraps the LLM call with a regex fallback so a flaky model never
// blocks the intake flow entirely.

import type { LLMAdapter } from "../llm/adapter.js";
import type {
  RoutingExtract,
  DecisionType,
  Dimension,
  Timeline,
  Reversibility,
  Stakes,
  ExtractedField,
} from "../types/decision.js";
import { robustJsonParse } from "../utils/json-parse.js";
import {
  INTAKE_EXTRACT_SYSTEM,
  buildExtractUserPrompt,
} from "../prompts/intake-extract.js";
import { log } from "../utils/logger.js";

interface RawExtractedField<T> {
  value: T;
  confidence: number;
  source_quote: string | null;
}

interface RawExtractionResponse {
  canonical_question: string;
  fields: {
    decision_type: RawExtractedField<DecisionType>;
    primary_dimensions: RawExtractedField<Dimension[]>;
    timeline: RawExtractedField<Timeline>;
    reversibility: RawExtractedField<Reversibility>;
    stakes: RawExtractedField<Stakes>;
    stakeholders: RawExtractedField<string[]>;
    persona_hints: RawExtractedField<string[]>;
    alternatives: RawExtractedField<string[]>;
    constraints: RawExtractedField<string[]>;
  };
}

export interface ExtractionResult {
  canonical_question: string;
  routing_extract: RoutingExtract;
  tokens_used: number;
  used_fallback: boolean;
}

function field<T>(
  raw: RawExtractedField<T> | undefined,
  fallback: T,
  wasAsked: boolean,
  validator?: (v: unknown) => T | null,
): ExtractedField<T> {
  if (!raw || raw.value === undefined || raw.value === null) {
    return { value: fallback, confidence: 0, source_quote: null, was_asked: wasAsked };
  }
  // LLM trust boundary: validate the value if a validator is provided
  // (used for enums and bounded arrays). On mismatch, fall back to the
  // safe default with confidence 0 — the intake will then ask about it.
  let value: T = raw.value;
  let confidence = clampConfidence(raw.confidence);
  if (validator) {
    const validated = validator(raw.value);
    if (validated === null) {
      value = fallback;
      confidence = 0;
    } else {
      value = validated;
    }
  }
  return {
    value,
    confidence,
    source_quote: typeof raw.source_quote === "string" ? raw.source_quote.slice(0, 600) : null,
    was_asked: wasAsked,
  };
}

// ── LLM-output validators (zod-style hand-rolled) ────────────────────
const DECISION_TYPES: DecisionType[] = [
  "tradeoff", "build_or_kill", "hire", "pivot",
  "feature_design", "vendor_selection", "other",
];
const DIMENSIONS: Dimension[] = [
  "technical", "business", "ux", "strategic", "people", "finance",
];
const TIMELINES: Timeline[] = ["immediate", "weeks", "months", "years"];
const REVERSIBILITIES: Reversibility[] = ["one_way_door", "two_way_door", "unknown"];
const STAKES_VALUES: Stakes[] = ["low", "medium", "high", "unknown"];

const MAX_ARRAY_ITEMS = 10;
const MAX_STRING_ITEM_LEN = 200;
const MAX_CANONICAL_QUESTION_LEN = 1000;

function inEnum<T extends string>(allowed: readonly T[]) {
  return (v: unknown): T | null => (typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : null);
}

function arrayOfEnum<T extends string>(allowed: readonly T[]) {
  return (v: unknown): T[] | null => {
    if (!Array.isArray(v)) return null;
    return v
      .filter((x): x is T => typeof x === "string" && (allowed as readonly string[]).includes(x))
      .slice(0, MAX_ARRAY_ITEMS);
  };
}

function arrayOfString(v: unknown): string[] | null {
  if (!Array.isArray(v)) return null;
  return v
    .filter((x): x is string => typeof x === "string")
    .map((x) => x.slice(0, MAX_STRING_ITEM_LEN))
    .slice(0, MAX_ARRAY_ITEMS);
}

function clampConfidence(c: unknown): number {
  if (typeof c !== "number" || Number.isNaN(c)) return 0;
  if (c < 0) return 0;
  if (c > 1) return 1;
  return c;
}

export async function extractRoutingFields(
  llm: LLMAdapter,
  rawUserMessages: string[],
  priorAskedFields: Set<string> = new Set(),
): Promise<ExtractionResult> {
  try {
    const response = await llm.complete({
      system: INTAKE_EXTRACT_SYSTEM,
      prompt: buildExtractUserPrompt(rawUserMessages),
      maxTokens: 1500,
      jsonMode: true,
    });

    const parsed = robustJsonParse<RawExtractionResponse>(response.text);
    const f = parsed.fields ?? ({} as RawExtractionResponse["fields"]);
    const tokens = response.usage.inputTokens + response.usage.outputTokens;

    const canonical = (parsed.canonical_question || rawUserMessages[0] || "").slice(
      0,
      MAX_CANONICAL_QUESTION_LEN,
    );

    return {
      canonical_question: canonical,
      routing_extract: {
        decision_type: field<DecisionType>(f.decision_type, "other", priorAskedFields.has("decision_type"), inEnum(DECISION_TYPES)),
        primary_dimensions: field<Dimension[]>(f.primary_dimensions, [], priorAskedFields.has("primary_dimensions"), arrayOfEnum(DIMENSIONS)),
        timeline: field<Timeline>(f.timeline, "weeks", priorAskedFields.has("timeline"), inEnum(TIMELINES)),
        reversibility: field<Reversibility>(f.reversibility, "unknown", priorAskedFields.has("reversibility"), inEnum(REVERSIBILITIES)),
        stakes: field<Stakes>(f.stakes, "unknown", priorAskedFields.has("stakes"), inEnum(STAKES_VALUES)),
        stakeholders: field<string[]>(f.stakeholders, [], priorAskedFields.has("stakeholders"), arrayOfString),
        persona_hints: field<string[]>(f.persona_hints, [], priorAskedFields.has("persona_hints"), arrayOfString),
        alternatives: field<string[]>(f.alternatives, [], priorAskedFields.has("alternatives"), arrayOfString),
        constraints: field<string[]>(f.constraints, [], priorAskedFields.has("constraints"), arrayOfString),
      },
      tokens_used: tokens,
      used_fallback: false,
    };
  } catch (err) {
    log.warn("intake.extract.llm_failed_using_fallback", {
      error: err instanceof Error ? err.message : String(err),
    });
    return regexFallbackExtraction(rawUserMessages, priorAskedFields);
  }
}

// Regex fallback: zero-LLM heuristic extraction. Designed to keep the intake
// flow alive when the LLM call fails. Confidence is capped at 0.5 so the
// intake will still ask clarifying questions to confirm.
function regexFallbackExtraction(
  rawUserMessages: string[],
  priorAskedFields: Set<string>,
): ExtractionResult {
  const text = rawUserMessages.join("\n").toLowerCase();
  const empty = <T>(fallback: T, wasAsked: boolean): ExtractedField<T> => ({
    value: fallback,
    confidence: 0,
    source_quote: null,
    was_asked: wasAsked,
  });

  const detected = (re: RegExp): boolean => re.test(text);

  const decisionType: DecisionType = (() => {
    if (detected(/\bvs\.?\b|\bor\b.*\b(better|choose|pick)\b|对比|选择|取舍/)) return "tradeoff";
    if (detected(/\bship|launch|build|kill|drop|sunset\b|上线|砍|做不做|是否上线/)) return "build_or_kill";
    if (detected(/\bhire|hiring|candidate|offer\b|招聘|候选人|发 offer|入职/)) return "hire";
    if (detected(/\bpivot|reposition|restructure\b|转型|战略调整|换方向/)) return "pivot";
    if (detected(/\bvendor|supplier|provider|tool\b.*\bselect\b|选型|供应商/)) return "vendor_selection";
    if (detected(/\bfeature\b.*\bdesign\b|设计|功能设计/)) return "feature_design";
    return "other";
  })();

  const dimensions: Dimension[] = [];
  if (detected(/\b(tech|technical|engineering|stack|infra|api)\b|技术|工程/)) dimensions.push("technical");
  if (detected(/\bbusiness|revenue|cost|pricing|market\b|商业|营收|成本|定价/)) dimensions.push("business");
  if (detected(/\b(ux|user experience|usability|onboarding)\b|用户体验|易用|上手/)) dimensions.push("ux");
  if (detected(/\bstrategic|long.?term|moat|competitive\b|战略|长期|护城河/)) dimensions.push("strategic");
  if (detected(/\b(hire|hiring|team|people|culture)\b|招聘|团队|文化/)) dimensions.push("people");
  if (detected(/\b(finance|budget|funding|cash)\b|财务|预算|融资|现金/)) dimensions.push("finance");

  return {
    canonical_question: rawUserMessages[0] ?? "",
    routing_extract: {
      decision_type: {
        value: decisionType,
        confidence: decisionType === "other" ? 0.2 : 0.5,
        source_quote: null,
        was_asked: priorAskedFields.has("decision_type"),
      },
      primary_dimensions: {
        value: dimensions.length === 0 ? (["business"] as Dimension[]) : dimensions,
        confidence: dimensions.length === 0 ? 0.2 : 0.5,
        source_quote: null,
        was_asked: priorAskedFields.has("primary_dimensions"),
      },
      timeline: empty<Timeline>("weeks", priorAskedFields.has("timeline")),
      reversibility: empty<Reversibility>("unknown", priorAskedFields.has("reversibility")),
      stakes: empty<Stakes>("unknown", priorAskedFields.has("stakes")),
      stakeholders: empty<string[]>([], priorAskedFields.has("stakeholders")),
      persona_hints: empty<string[]>([], priorAskedFields.has("persona_hints")),
      alternatives: empty<string[]>([], priorAskedFields.has("alternatives")),
      constraints: empty<string[]>([], priorAskedFields.has("constraints")),
    },
    tokens_used: 0,
    used_fallback: true,
  };
}
