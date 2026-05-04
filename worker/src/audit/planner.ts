// planner.ts
//
// Multi-agent audit kernel: Layer 2 — task planner.
// Spec: docs/superpowers/specs/2026-04-30-multi-agent-audit-architecture.md §4
//
// Inputs:
//   - locked scope (scope_in[] from Layer 1b)
//   - persona pool rows (audit_persona_pool)
//   - law catalog rows for the in-scope laws (audit_law_catalog)
//
// One LLM call. Output is a list of tasks. Each task names the law section,
// asks a focused compliance question, picks 1-3 personas from the pool, and
// flags whether it needs a cross-challenge round in Layer 4.
//
// needs_challenge rule (locked in spec §4):
//   - pure citation lookup        → false
//   - simple classification       → false
//   - statutory interpretation    → true
//   - gap analysis                → true
//   - cross-jurisdictional        → true

import type { LLMAdapter } from "../llm/adapter.js";
import { robustJsonParse } from "../utils/json-parse.js";
import { completeWithTruncationRetry } from "../utils/llm-helpers.js";
import { log } from "../utils/logger.js";
import type { ScopedLaw } from "./scoping-agent.js";

// ============================================
// Public types
// ============================================
export interface PlannerLawRow {
  id: string;
  name_en: string;
  jurisdiction: string;
  category: string;
  citation_format: string;
  source_domains: string[];
}

export interface PlannerPersonaRow {
  id: string;
  display_name_en: string;
  role_description_en: string;
  search_style: string;
  default_law_ids: string[];
}

export interface PlannerInput {
  decisionText: string;
  scopeIn: ScopedLaw[];
  laws: PlannerLawRow[];
  personas: PlannerPersonaRow[];
  /** "en" | "zh"; only affects task.question phrasing */
  replyLanguage: "en" | "zh";
  /** Hard cap on emitted tasks. Default 12. */
  maxTasks?: number;
}

export interface PlannedTask {
  id: string;
  question: string;
  law_id: string;
  law_section: string;
  target_personas: string[];
  needs_challenge: boolean;
  rationale: string;
}

export interface PlannerResult {
  tasks: PlannedTask[];
  persona_pool: string[];
}

// ============================================
// Raw LLM output (pre-validation)
// ============================================
interface RawPlanned {
  id?: string;
  question?: string;
  law_id?: string;
  law_section?: string;
  target_personas?: unknown;
  needs_challenge?: unknown;
  rationale?: string;
}

interface RawPlannerOutput {
  tasks?: unknown;
  persona_pool?: unknown;
}

// ============================================
// Prompt builders
// ============================================
function renderScope(scope: ScopedLaw[]): string {
  if (scope.length === 0) return "(scope_in is empty — nothing to audit)";
  return scope
    .map((s) => `- ${s.law_id} :: ${s.reason}`)
    .join("\n");
}

function renderLaws(rows: PlannerLawRow[]): string {
  if (rows.length === 0) return "(no in-scope laws resolved)";
  return rows
    .map(
      (r) =>
        `- ${r.id} (${r.jurisdiction}, ${r.category}): ${r.name_en}\n  citation_format: ${r.citation_format}`,
    )
    .join("\n");
}

function renderPersonas(personas: PlannerPersonaRow[]): string {
  if (personas.length === 0) return "(no personas available — abort)";
  return personas
    .map((p) => {
      const laws = p.default_law_ids.length > 0 ? p.default_law_ids.join(", ") : "(none)";
      return [
        `- ${p.id}: ${p.display_name_en}`,
        `  role: ${p.role_description_en}`,
        `  search_style: ${p.search_style}`,
        `  default_laws: ${laws}`,
      ].join("\n");
    })
    .join("\n");
}

function buildPlannerSystem(): string {
  return [
    "You are Layer 2 of a multi-agent audit kernel: the task planner.",
    "You decompose an in-scope compliance audit into a list of focused tasks. Each task is one specific compliance question against ONE law section, assigned to 1-3 personas from the pool.",
    "",
    "## Your job",
    "1. Read the decision under audit, the locked in-scope laws, and the persona pool.",
    "2. For each in-scope law, pick the 2-4 most material sections/clauses to evaluate. Skip sections clearly inapplicable to the decision.",
    "3. Produce 1 task per (law, section) pair. Aim for 6-12 tasks total across all in-scope laws — not 30, not 3.",
    "4. Assign target_personas using the rules below.",
    "5. Set needs_challenge per the rule below.",
    "",
    "## Persona assignment rules",
    "- Pick 1-3 personas per task whose default_law_ids include this law_id, OR whose role/search_style is the right specialty.",
    "- If multiple personas fit equally, pick those with the most complementary perspectives (e.g. compliance_partner + ml_safety_expert for a NIST MEASURE task).",
    "- Don't assign the same 5 personas to every task. Vary the panel by law and section.",
    "",
    "## needs_challenge rule (apply strictly)",
    "- pure citation lookup        → false",
    "- simple classification       → false",
    "- statutory interpretation    → true",
    "- gap analysis                → true",
    "- cross-jurisdictional        → true",
    "Bias toward true when in doubt. Layer 4 is conditional on this flag.",
    "",
    "## Hard constraints",
    "- Use ONLY law_ids and persona_ids from the inputs. Never invent ids.",
    "- Use citation_format from the law catalog when phrasing law_section (e.g. 'GOVERN-1.1', 'A.6.2', 'Section 5(a)').",
    "- task.id must be unique, format `t<int>` starting at t1.",
    "- Output JSON only.",
    "",
    "## Output schema",
    "{",
    '  "tasks": [',
    "    {",
    '      "id": "t1",',
    '      "question": "<one sentence compliance question>",',
    '      "law_id": "<id from in-scope laws>",',
    '      "law_section": "<section/clause per citation_format>",',
    '      "target_personas": ["<persona_id>", ...],',
    '      "needs_challenge": true | false,',
    '      "rationale": "<why this task; one sentence>"',
    "    }",
    "  ],",
    '  "persona_pool": ["<persona_id>", ...]   // union of all personas used',
    "}",
  ].join("\n");
}

function buildPlannerPrompt(input: PlannerInput): string {
  const langNote =
    input.replyLanguage === "zh"
      ? "Phrase task.question and task.rationale in Simplified Chinese. law_id, law_section, persona_ids stay machine-readable."
      : "Phrase task.question and task.rationale in English.";
  return [
    "## Decision under audit",
    input.decisionText.slice(0, 16000),
    "",
    "## Locked scope_in",
    renderScope(input.scopeIn),
    "",
    "## In-scope law catalog rows",
    renderLaws(input.laws),
    "",
    "## Persona pool (pick from here)",
    renderPersonas(input.personas),
    "",
    "## Language",
    langNote,
    "",
    `Produce up to ${input.maxTasks ?? 12} tasks. Return JSON only.`,
  ].join("\n");
}

// ============================================
// Validation / sanitization
// ============================================
function asString(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

function sanitizeTasks(
  raw: unknown,
  validLawIds: ReadonlySet<string>,
  validPersonaIds: ReadonlySet<string>,
  maxTasks: number,
): PlannedTask[] {
  if (!Array.isArray(raw)) return [];
  const out: PlannedTask[] = [];
  const seenIds = new Set<string>();
  for (let i = 0; i < raw.length && out.length < maxTasks; i++) {
    const t = raw[i] as RawPlanned | null;
    if (!t || typeof t !== "object") continue;

    const law_id = asString(t.law_id);
    if (!validLawIds.has(law_id)) continue;

    const question = asString(t.question).trim();
    if (!question) continue;

    const law_section = asString(t.law_section).trim().slice(0, 200);
    if (!law_section) continue;

    const target_personas = Array.isArray(t.target_personas)
      ? (t.target_personas as unknown[])
          .filter((p): p is string => typeof p === "string")
          .filter((p) => validPersonaIds.has(p))
          .slice(0, 5)
      : [];
    if (target_personas.length === 0) continue;

    let id = asString(t.id).trim();
    if (!id || seenIds.has(id)) id = `t${out.length + 1}`;
    seenIds.add(id);

    out.push({
      id,
      question: question.slice(0, 1000),
      law_id,
      law_section,
      target_personas,
      needs_challenge: t.needs_challenge === true,
      rationale: asString(t.rationale).slice(0, 1000),
    });
  }
  return out;
}

// ============================================
// Public API
// ============================================
export async function runPlanner(
  llm: LLMAdapter,
  input: PlannerInput,
): Promise<PlannerResult> {
  const validLawIds = new Set(input.laws.map((l) => l.id));
  const validPersonaIds = new Set(input.personas.map((p) => p.id));
  const maxTasks = Math.max(1, Math.min(input.maxTasks ?? 12, 20));

  if (validLawIds.size === 0 || validPersonaIds.size === 0) {
    log.warn("planner.empty_inputs", {
      lawCount: validLawIds.size,
      personaCount: validPersonaIds.size,
    });
    return { tasks: [], persona_pool: [] };
  }

  const system = buildPlannerSystem();
  const prompt = buildPlannerPrompt(input);

  const response = await completeWithTruncationRetry(
    llm,
    { system, prompt, jsonMode: true },
    "planner",
    { base: 3500, retry: 5000 },
  );
  const parsed = robustJsonParse<RawPlannerOutput>(response.text);

  const tasks = sanitizeTasks(parsed?.tasks, validLawIds, validPersonaIds, maxTasks);
  const personaUnion = new Set<string>();
  for (const t of tasks) for (const p of t.target_personas) personaUnion.add(p);

  // sanitizeTasks silently discards malformed tasks; if the count is short of
  // the expected number, surface that — most likely truncation chopped the
  // last few entries. Without this log, audits run on partial plans with no
  // indication of why fewer tasks emerged than the prompt requested.
  const rawTaskCount = Array.isArray(parsed?.tasks) ? parsed.tasks.length : 0;
  if (rawTaskCount > tasks.length) {
    log.warn("planner.tasks_dropped", {
      rawCount: rawTaskCount,
      keptCount: tasks.length,
      lawCount: validLawIds.size,
      personaCount: validPersonaIds.size,
    });
  }
  if (tasks.length === 0) {
    log.error("planner.no_tasks", {
      preview: response.text.slice(0, 200),
      lawCount: validLawIds.size,
      personaCount: validPersonaIds.size,
    });
  }

  return {
    tasks,
    persona_pool: Array.from(personaUnion),
  };
}

// Exported for tests
export const __test__ = {
  sanitizeTasks,
  buildPlannerSystem,
  buildPlannerPrompt,
};
