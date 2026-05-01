// audit-pipeline.ts
//
// Multi-agent audit kernel: orchestrator (Layer 2 → Layer 3 → [Layer 4] → Layer 5).
// Spec: docs/superpowers/specs/2026-04-30-multi-agent-audit-architecture.md §4, §10
//
// Job data is just { sessionId }. Pre-conditions:
//   - audit_session row exists
//   - audit_scoping_session row exists with status='scope_locked'
//
// Sequence:
//   1. Move audit_session.status -> 'running'.
//   2. Run Layer 2 (planner) over scope_in × persona pool.
//   3. Run Layer 3 (per-task × per-persona Tavily-grounded analysis), with a
//      concurrency cap so we don't blow up rate limits.
//   4. (Phase 3) For tasks with needs_challenge=true, run Layer 4 cross-
//      challenge — wired in via the optional `runCrossChallenge` import.
//   5. Run Layer 5 synthesizer over the flattened findings.
//   6. Persist:
//        - audit_findings rows (one per persona finding)
//        - decision_meta.synthesized_report = SynthesizedReport
//        - status = 'findings_ready', completed_at = now()
//   7. Append audit_trail entries at every transition (hash-chained).
//
// On any failure: status='failed', decision_meta.pipeline_error = message,
// audit_trail row 'pipeline_failed'.

import type { Job } from "bullmq";
import { supabase } from "../supabase.js";
import { buildLLM, buildAuxLLM, type LLMOverrides } from "../llm/factory.js";
import { log } from "../utils/logger.js";
import { appendAuditTrail } from "../audit/hash-chain.js";
import {
  runPlanner,
  type PlannerLawRow,
  type PlannerPersonaRow,
  type PlannedTask,
} from "../audit/planner.js";
import {
  runPersonaAnalysis,
  type AnalystLawRow,
  type AnalystPersonaRow,
  type PersonaAnalysisResult,
} from "../audit/persona-analyst.js";
import {
  runSynthesizer,
  computeStale,
  type SynthesizerFinding,
  type SynthesizerLawRow,
  type SynthesizedReport,
} from "../audit/synthesizer.js";
import type { ScopedLaw } from "../audit/scoping-agent.js";

// ============================================
// Job shape
// ============================================
export interface AuditPipelineJobData {
  sessionId: string;
  llmOverrides?: LLMOverrides;
  auxLlmOverrides?: LLMOverrides;
  /** "en" | "zh"; surfaces in task questions, executive summary, etc. */
  replyLanguage?: "en" | "zh";
}

const ANALYSIS_CONCURRENCY = 3; // 3 in-flight LLM+Tavily calls at once
const MAX_FINDINGS_PER_RUN = 200; // hard cap on rows we'll write per session

// ============================================
// DB shapes
// ============================================
interface AuditSessionRow {
  id: string;
  user_id: string;
  workspace_id: string | null;
  template_slug: string;
  decision_text: string;
  status: string;
  decision_meta: Record<string, unknown> | null;
}

interface ScopingRow {
  id: string;
  audit_session_id: string;
  status: string;
  scope_in: ScopedLaw[];
  scope_out: ScopedLaw[];
}

interface LawCatalogRow {
  id: string;
  name_en: string;
  name_zh: string;
  jurisdiction: string;
  category: string;
  citation_format: string;
  source_domains: string[];
}

interface PersonaPoolRow {
  id: string;
  display_name_en: string;
  display_name_zh: string;
  role_description_en: string;
  search_style: string;
  system_prompt: string;
  default_law_ids: string[];
}

// ============================================
// Main entry
// ============================================
export async function processAuditPipelineJob(
  job: Job<AuditPipelineJobData>,
): Promise<void> {
  const { sessionId, llmOverrides, auxLlmOverrides, replyLanguage = "en" } =
    job.data;
  const ctx = { sessionId, jobId: job.id };

  log.info("audit_pipeline.start", ctx);

  const session = await fetchSession(sessionId);
  if (!session) throw new Error(`audit session ${sessionId} not found`);
  const scoping = await fetchScoping(sessionId);
  if (!scoping) throw new Error(`scoping session for ${sessionId} not found`);
  if (scoping.status !== "scope_locked") {
    throw new Error(
      `pipeline can't run: scoping status is ${scoping.status} (need scope_locked)`,
    );
  }

  // Idempotent guard: if status is already terminal, skip.
  if (
    session.status === "findings_ready" ||
    session.status === "signed_off" ||
    session.status === "archived"
  ) {
    log.info("audit_pipeline.noop_terminal", { ...ctx, status: session.status });
    return;
  }

  await markRunning(session, replyLanguage);

  // Gap 5+6: source documents live in Storage, parsed lazily here in the
  // worker (officeparser works in plain Node without bundler issues).
  // ensureExtractedText downloads each not-yet-parsed file, runs
  // officeparser (with OCR fallback for image-only PDFs/PPTX), and caches
  // extracted_text + attachment metadata on the row so reruns skip the
  // parse cost. The composed context block is what reaches every agent
  // (planner / analyst / synthesizer) instead of the user-only narrative.
  const sourceFilesRaw = await loadSessionFiles(session.id);
  const sourceFiles = await ensureExtractedText(sourceFilesRaw);
  const enrichedDecisionText = composeDecisionContext(
    session.decision_text,
    sourceFiles,
  );

  try {
    const auxLlm = buildAuxLLM(auxLlmOverrides);
    const proLlm = buildLLM(llmOverrides);

    // Layer 2 — planner
    const { plannerLaws, personas } = await loadPlannerInputs(scoping.scope_in);
    const planner = await runPlanner(auxLlm, {
      decisionText: enrichedDecisionText,
      scopeIn: scoping.scope_in,
      laws: plannerLaws,
      personas,
      replyLanguage,
    });
    if (planner.tasks.length === 0) {
      throw new Error("planner produced zero tasks");
    }
    await appendAuditTrail({
      sessionId: session.id,
      action: "tasks_planned",
      actorId: null,
      payload: {
        task_count: planner.tasks.length,
        persona_pool: planner.persona_pool,
        task_summaries: planner.tasks.map((t) => ({
          id: t.id,
          law_id: t.law_id,
          law_section: t.law_section,
          target_personas: t.target_personas,
          needs_challenge: t.needs_challenge,
        })),
      },
    });
    log.info("audit_pipeline.planner_done", {
      ...ctx,
      taskCount: planner.tasks.length,
    });

    // Layer 3 — persona analysis (parallel-with-concurrency)
    const lawById = indexById(plannerLaws);
    const personaById = indexById(personas);
    const analyses = await runAnalysisLayer({
      llm: proLlm,
      tasks: planner.tasks,
      lawById,
      personaById,
      decisionText: enrichedDecisionText,
      replyLanguage,
    });
    await appendAuditTrail({
      sessionId: session.id,
      action: "analysis_complete",
      actorId: null,
      payload: {
        analysis_count: analyses.length,
        finding_count: analyses.reduce((acc, a) => acc + a.findings.length, 0),
      },
    });
    log.info("audit_pipeline.analysis_done", {
      ...ctx,
      analysisCount: analyses.length,
    });

    // Layer 4 — cross-challenge (Phase 3, optional). Imported lazily to keep
    // Phase 2 lean. The module exports a noop-style runner if not built yet.
    const challenged = await runChallengeLayerSafe({
      llm: proLlm,
      tasks: planner.tasks,
      analyses,
      lawById,
      personaById,
      decisionText: enrichedDecisionText,
      replyLanguage,
      sessionId: session.id,
    });

    // Flatten + stale-flag for synthesizer
    const synthFindings: SynthesizerFinding[] = [];
    const taskById = new Map(planner.tasks.map((t) => [t.id, t]));
    for (const a of challenged.analyses) {
      const task = taskById.get(a.task_id);
      if (!task) continue;
      const law = lawById.get(task.law_id);
      if (!law) continue;
      const dissent = challenged.dissentByKey.get(`${a.task_id}::${a.persona_id}`) ?? null;
      for (const f of a.findings) {
        synthFindings.push({
          ...f,
          task_id: task.id,
          law_id: law.id,
          law_section: task.law_section,
          persona_id: a.persona_id,
          dissent,
          stale: computeStale({
            finding: {
              ...f,
              task_id: task.id,
              persona_id: a.persona_id,
              law_id: law.id,
              law_section: task.law_section,
              searchCacheLastVerifiedAt: a.searchLastVerifiedAt,
            },
          }),
        });
        if (synthFindings.length >= MAX_FINDINGS_PER_RUN) break;
      }
      if (synthFindings.length >= MAX_FINDINGS_PER_RUN) break;
    }

    // Layer 5 — synthesizer
    const synthLaws: SynthesizerLawRow[] = plannerLaws.map((l) => ({
      id: l.id,
      name_en: l.name_en,
      citation_format: l.citation_format,
      jurisdiction: l.jurisdiction,
    }));
    const report = await runSynthesizer(proLlm, {
      decisionText: enrichedDecisionText,
      scopeIn: scoping.scope_in,
      scopeOut: scoping.scope_out,
      laws: synthLaws,
      findings: synthFindings,
      replyLanguage,
    });
    await appendAuditTrail({
      sessionId: session.id,
      action: "report_synthesized",
      actorId: null,
      payload: {
        executive_summary: report.executive_summary.slice(0, 1000),
        in_scope_count: report.in_scope_analysis.length,
        out_of_scope_count: report.out_of_scope.length,
        open_question_count: report.open_questions.length,
      },
    });

    // Persist findings + report
    await persistFindings(session.id, synthFindings, challenged.searchCacheIdsByKey);
    await persistReport(session.id, report);
    await markFindingsReady(session.id);

    await appendAuditTrail({
      sessionId: session.id,
      action: "findings_ready",
      actorId: null,
      payload: { finding_count: synthFindings.length },
    });

    log.info("audit_pipeline.complete", {
      ...ctx,
      findingCount: synthFindings.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error("audit_pipeline.failed", { ...ctx, error: message });
    await markFailed(session.id, message);
    await appendAuditTrail({
      sessionId: session.id,
      action: "pipeline_failed",
      actorId: null,
      payload: { error: message.slice(0, 1000) },
    });
    throw err;
  }
}

// ============================================
// Layer 2 inputs
// ============================================
async function loadPlannerInputs(
  scopeIn: ScopedLaw[],
): Promise<{ plannerLaws: LawCatalogRow[]; personas: PersonaPoolRow[] }> {
  const lawIds = scopeIn.map((s) => s.law_id);
  if (lawIds.length === 0) {
    return { plannerLaws: [], personas: [] };
  }
  const [{ data: lawsRaw, error: lawsErr }, { data: personasRaw, error: personasErr }] =
    await Promise.all([
      supabase
        .from("audit_law_catalog")
        .select(
          "id, name_en, name_zh, jurisdiction, category, citation_format, source_domains",
        )
        .in("id", lawIds)
        .eq("is_active", true),
      supabase
        .from("audit_persona_pool")
        .select(
          "id, display_name_en, display_name_zh, role_description_en, search_style, system_prompt, default_law_ids",
        )
        .eq("is_active", true),
    ]);
  if (lawsErr) throw new Error(`law catalog load failed: ${lawsErr.message}`);
  if (personasErr)
    throw new Error(`persona pool load failed: ${personasErr.message}`);

  const plannerLaws = ((lawsRaw ?? []) as LawCatalogRow[]).map((l) => ({
    ...l,
    source_domains: Array.isArray(l.source_domains) ? l.source_domains : [],
  }));
  const personas = ((personasRaw ?? []) as PersonaPoolRow[]).map((p) => ({
    ...p,
    default_law_ids: Array.isArray(p.default_law_ids) ? p.default_law_ids : [],
  }));
  return { plannerLaws, personas };
}

// ============================================
// Layer 3 runner with concurrency cap
// ============================================
interface AnalysisRunInput {
  llm: ReturnType<typeof buildLLM>;
  tasks: PlannedTask[];
  lawById: Map<string, LawCatalogRow>;
  personaById: Map<string, PersonaPoolRow>;
  decisionText: string;
  replyLanguage: "en" | "zh";
}

async function runAnalysisLayer(
  input: AnalysisRunInput,
): Promise<PersonaAnalysisResult[]> {
  // Build the worklist as flat (task, persona) pairs.
  const worklist: { task: PlannedTask; personaId: string }[] = [];
  for (const task of input.tasks) {
    for (const personaId of task.target_personas) {
      worklist.push({ task, personaId });
    }
  }

  const results: PersonaAnalysisResult[] = [];
  let cursor = 0;
  const workers: Promise<void>[] = [];

  const worker = async (): Promise<void> => {
    // Defense-in-depth: the entire loop body lives inside a try/catch so
    // that any future edit can't silently break partial-failure recovery.
    // If a sync error escapes the inner try, the placeholder fallback still
    // runs and the pipeline continues for the remaining work items.
    while (true) {
      const i = cursor++;
      if (i >= worklist.length) return;
      const { task, personaId } = worklist[i];
      try {
        const law = input.lawById.get(task.law_id);
        const persona = input.personaById.get(personaId);
        if (!law || !persona) {
          log.warn("audit_pipeline.analysis_skip_missing", {
            taskId: task.id,
            lawId: task.law_id,
            personaId,
            lawFound: !!law,
            personaFound: !!persona,
          });
          continue;
        }
        try {
          const res = await runPersonaAnalysis(input.llm, {
            task,
            law: toAnalystLaw(law),
            persona: toAnalystPersona(persona),
            decisionText: input.decisionText,
            replyLanguage: input.replyLanguage,
          });
          results.push(res);
        } catch (err) {
          log.error("audit_pipeline.analysis_pair_failed", {
            taskId: task.id,
            personaId,
            error: err instanceof Error ? err.message : String(err),
          });
          results.push({
            task_id: task.id,
            persona_id: personaId,
            findings: [],
            searchCacheIds: [],
            searchLastVerifiedAt: null,
            searchHadResults: false,
          });
        }
      } catch (outerErr) {
        log.error("audit_pipeline.analysis_outer_failed", {
          taskId: task.id,
          personaId,
          error: outerErr instanceof Error ? outerErr.message : String(outerErr),
        });
        results.push({
          task_id: task.id,
          persona_id: personaId,
          findings: [],
          searchCacheIds: [],
          searchLastVerifiedAt: null,
          searchHadResults: false,
        });
      }
    }
  };

  for (let i = 0; i < ANALYSIS_CONCURRENCY; i++) workers.push(worker());
  await Promise.all(workers);
  return results;
}

function toAnalystLaw(l: LawCatalogRow): AnalystLawRow {
  return {
    id: l.id,
    name_en: l.name_en,
    citation_format: l.citation_format,
    source_domains: l.source_domains,
  };
}

function toAnalystPersona(p: PersonaPoolRow): AnalystPersonaRow {
  return {
    id: p.id,
    display_name_en: p.display_name_en,
    search_style: p.search_style,
    system_prompt: p.system_prompt,
  };
}

// ============================================
// Layer 4 (Phase 3) — lazy-loaded
// ============================================
interface ChallengeLayerOutput {
  analyses: PersonaAnalysisResult[];
  /** task_id::persona_id -> dissent string (single round, capped per spec §16) */
  dissentByKey: Map<string, string>;
  /** task_id::persona_id -> all cache ids the (analysis + challenge) cited */
  searchCacheIdsByKey: Map<string, string[]>;
}

async function runChallengeLayerSafe(args: {
  llm: ReturnType<typeof buildLLM>;
  tasks: PlannedTask[];
  analyses: PersonaAnalysisResult[];
  lawById: Map<string, LawCatalogRow>;
  personaById: Map<string, PersonaPoolRow>;
  decisionText: string;
  replyLanguage: "en" | "zh";
  sessionId: string;
}): Promise<ChallengeLayerOutput> {
  const cacheIdsByKey = new Map<string, string[]>();
  for (const a of args.analyses) {
    cacheIdsByKey.set(`${a.task_id}::${a.persona_id}`, a.searchCacheIds);
  }
  // Dynamic import keeps Phase 2 from depending on Phase 3 file existing yet.
  let runCrossChallenge: typeof import("../audit/cross-challenge.js")["runCrossChallenge"] | null = null;
  try {
    const mod = await import("../audit/cross-challenge.js");
    runCrossChallenge = mod.runCrossChallenge ?? null;
  } catch {
    // Module not present yet — Phase 2 path. Skip silently.
    runCrossChallenge = null;
  }
  if (!runCrossChallenge) {
    return {
      analyses: args.analyses,
      dissentByKey: new Map(),
      searchCacheIdsByKey: cacheIdsByKey,
    };
  }
  try {
    const out = await runCrossChallenge({
      llm: args.llm,
      tasks: args.tasks,
      analyses: args.analyses,
      lawById: args.lawById,
      personaById: args.personaById,
      decisionText: args.decisionText,
      replyLanguage: args.replyLanguage,
    });
    // Merge any new cache ids.
    for (const [k, ids] of out.searchCacheIdsByKey.entries()) {
      const existing = cacheIdsByKey.get(k) ?? [];
      cacheIdsByKey.set(k, dedupe([...existing, ...ids]));
    }
    return {
      analyses: out.analyses,
      dissentByKey: out.dissentByKey,
      searchCacheIdsByKey: cacheIdsByKey,
    };
  } catch (err) {
    log.error("audit_pipeline.challenge_failed_skipped", {
      sessionId: args.sessionId,
      error: err instanceof Error ? err.message : String(err),
    });
    return {
      analyses: args.analyses,
      dissentByKey: new Map(),
      searchCacheIdsByKey: cacheIdsByKey,
    };
  }
}

// ============================================
// Persistence
// ============================================
async function fetchSession(sessionId: string): Promise<AuditSessionRow | null> {
  const { data, error } = await supabase
    .from("audit_sessions")
    .select(
      "id, user_id, workspace_id, template_slug, decision_text, status, decision_meta",
    )
    .eq("id", sessionId)
    .maybeSingle();
  if (error) throw new Error(`audit session fetch failed: ${error.message}`);
  return (data as AuditSessionRow | null) ?? null;
}

async function fetchScoping(sessionId: string): Promise<ScopingRow | null> {
  const { data, error } = await supabase
    .from("audit_scoping_sessions")
    .select("id, audit_session_id, status, scope_in, scope_out")
    .eq("audit_session_id", sessionId)
    .maybeSingle();
  if (error) throw new Error(`scoping fetch failed: ${error.message}`);
  return (data as ScopingRow | null) ?? null;
}

// ============================================
// Source-document context (Gaps 5+6: persisted upload, worker-side parse)
// ============================================
const PLAIN_TEXT_EXT = new Set(["txt", "md"]);
const MAX_EXTRACTED_BYTES_PER_FILE = 256 * 1024;

interface SessionFileRow {
  id: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  storage_path: string;
  extracted_text: string | null;
  ocr_applied: boolean;
  parser_error: string | null;
  attachments_meta: Array<{
    name: string;
    mimeType: string;
    altText?: string;
    ocrText?: string;
    bytes: number;
  }>;
}

async function loadSessionFiles(sessionId: string): Promise<SessionFileRow[]> {
  const { data, error } = await supabase
    .from("audit_session_files")
    .select(
      "id, filename, mime_type, size_bytes, storage_path, extracted_text, ocr_applied, parser_error, attachments_meta",
    )
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });
  if (error) {
    log.warn("audit_pipeline.session_files_load_failed", {
      sessionId,
      error: error.message,
    });
    return [];
  }
  return (data ?? []) as SessionFileRow[];
}

// Download each file with no cached extracted_text from Storage and parse
// it in the worker (Railway Node env, where officeparser works without
// bundler issues). Result is cached back to the row so reruns don't repay
// the parse cost. Files that fail to parse are recorded with parser_error
// so they're not retried indefinitely.
async function ensureExtractedText(
  files: SessionFileRow[],
): Promise<SessionFileRow[]> {
  const out: SessionFileRow[] = [];
  for (const f of files) {
    if (f.extracted_text || f.parser_error) {
      out.push(f);
      continue;
    }
    try {
      const parsed = await downloadAndParse(f);
      const updateRow = {
        extracted_text: parsed.text,
        extracted_bytes: Buffer.byteLength(parsed.text, "utf8"),
        ocr_applied: parsed.ocrApplied,
        attachments_meta: parsed.attachments,
        parser_error: null,
      };
      const { error: upErr } = await supabase
        .from("audit_session_files")
        .update(updateRow)
        .eq("id", f.id);
      if (upErr) {
        log.warn("audit_pipeline.session_file_cache_failed", {
          fileId: f.id,
          error: upErr.message,
        });
      }
      out.push({ ...f, ...updateRow });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log.warn("audit_pipeline.session_file_parse_failed", {
        fileId: f.id,
        filename: f.filename,
        error: msg,
      });
      await supabase
        .from("audit_session_files")
        .update({ parser_error: msg })
        .eq("id", f.id);
      out.push({ ...f, parser_error: msg });
    }
  }
  return out;
}

interface ParsedFile {
  text: string;
  ocrApplied: boolean;
  attachments: SessionFileRow["attachments_meta"];
}

async function downloadAndParse(f: SessionFileRow): Promise<ParsedFile> {
  const { data: blob, error: dlErr } = await supabase.storage
    .from("audit-uploads")
    .download(f.storage_path);
  if (dlErr || !blob) {
    throw new Error(`storage download failed: ${dlErr?.message ?? "no blob"}`);
  }
  const buffer = Buffer.from(await blob.arrayBuffer());
  const ext = f.filename.split(".").pop()?.toLowerCase() ?? "";

  if (PLAIN_TEXT_EXT.has(ext)) {
    return {
      text: clipUtf8(buffer.toString("utf8"), MAX_EXTRACTED_BYTES_PER_FILE),
      ocrApplied: false,
      attachments: [],
    };
  }

  // Lazy import — keeps bullmq cold start lean for sessions without files.
  const { OfficeParser } = await import("officeparser");

  const fastAst = await OfficeParser.parseOffice(buffer, {
    extractAttachments: true,
    ocr: false,
    ignoreNotes: false,
  });
  let text = astToMarkdown(fastAst);
  let ocrApplied = false;
  let attachments = collectAttachments(fastAst);

  if (text.trim().length === 0 && (ext === "pdf" || ext === "pptx" || ext === "odp")) {
    const ocrAst = await OfficeParser.parseOffice(buffer, {
      extractAttachments: true,
      ocr: true,
      ignoreNotes: false,
    });
    text = astToMarkdown(ocrAst);
    attachments = collectAttachments(ocrAst);
    ocrApplied = true;
  }

  return {
    text: clipUtf8(text, MAX_EXTRACTED_BYTES_PER_FILE),
    ocrApplied,
    attachments,
  };
}

// Minimal markdown emitter — preserves headings / lists / table cells /
// slide+sheet+page boundaries. Mirrors the structure of the deleted
// /api/audit/parse-file walker, kept compact here because the worker
// has full Node and the Vercel bundle isn't a concern.
function astToMarkdown(ast: {
  content?: Array<{ type: string; text?: string; children?: Array<unknown>; metadata?: unknown }>;
  attachments?: Array<{ name?: string; ocrText?: string; altText?: string; mimeType?: string }>;
}): string {
  const attMap = new Map<string, { ocrText?: string; altText?: string }>();
  for (const a of ast.attachments ?? []) {
    if (a.name) attMap.set(a.name, { ocrText: a.ocrText, altText: a.altText });
  }
  const parts: string[] = [];
  function walk(node: { type: string; text?: string; children?: unknown[]; metadata?: unknown }, depth: number) {
    const text = (node.text ?? "").replace(/\s+/g, " ").trim();
    switch (node.type) {
      case "heading": {
        const lvl = Math.min(Math.max((node.metadata as { level?: number } | undefined)?.level ?? 2, 1), 6);
        if (text) parts.push("#".repeat(lvl) + " " + text);
        break;
      }
      case "paragraph":
        if (text) parts.push(text);
        break;
      case "list": {
        const meta = node.metadata as { listType?: string; indentation?: number } | undefined;
        const indent = "  ".repeat(meta?.indentation ?? 0);
        const bullet = meta?.listType === "ordered" ? "1." : "-";
        if (text) parts.push(`${indent}${bullet} ${text}`);
        break;
      }
      case "slide": {
        const n = (node.metadata as { slideNumber?: number } | undefined)?.slideNumber ?? "?";
        parts.push("");
        parts.push(`## Slide ${n}`);
        for (const c of (node.children ?? []) as Array<typeof node>) walk(c, depth + 1);
        break;
      }
      case "sheet": {
        const n = (node.metadata as { sheetName?: string } | undefined)?.sheetName ?? "?";
        parts.push("");
        parts.push(`## Sheet: ${n}`);
        for (const c of (node.children ?? []) as Array<typeof node>) walk(c, depth + 1);
        break;
      }
      case "page": {
        const n = (node.metadata as { pageNumber?: number } | undefined)?.pageNumber ?? "?";
        parts.push("");
        parts.push(`<!-- page ${n} -->`);
        for (const c of (node.children ?? []) as Array<typeof node>) walk(c, depth + 1);
        break;
      }
      case "table":
      case "row":
      case "cell":
        // Tables: flatten cells separated by " | " — losslessly recoverable
        // by the LLM but not strictly markdown table syntax.
        if (text) parts.push(text);
        for (const c of (node.children ?? []) as Array<typeof node>) walk(c, depth + 1);
        break;
      case "image": {
        const meta = node.metadata as { altText?: string; attachmentName?: string } | undefined;
        const att = meta?.attachmentName ? attMap.get(meta.attachmentName) : undefined;
        const alt = (att?.altText ?? meta?.altText ?? "image").trim();
        const ocr = att?.ocrText?.trim();
        parts.push(`![${alt}](${meta?.attachmentName ?? ""})`);
        if (ocr) parts.push(`> Image OCR (${alt}): ${ocr.replace(/\s+/g, " ")}`);
        break;
      }
      case "note":
        if (text) parts.push(`> note: ${text}`);
        break;
      default:
        if (text) parts.push(text);
        for (const c of (node.children ?? []) as Array<typeof node>) walk(c, depth + 1);
    }
  }
  for (const node of ast.content ?? []) walk(node as { type: string; text?: string; children?: unknown[]; metadata?: unknown }, 0);
  return parts.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function collectAttachments(ast: {
  attachments?: Array<{
    name?: string;
    mimeType?: string;
    altText?: string;
    ocrText?: string;
    data?: string;
    type?: string;
  }>;
}): SessionFileRow["attachments_meta"] {
  const out: SessionFileRow["attachments_meta"] = [];
  for (const a of ast.attachments ?? []) {
    if (out.length >= 64) break;
    out.push({
      name: a.name ?? "",
      mimeType: a.mimeType ?? "",
      altText: a.altText,
      ocrText: a.ocrText,
      bytes: a.data ? Math.floor(a.data.length * 0.75) : 0,
    });
  }
  return out;
}

function clipUtf8(s: string, maxBytes: number): string {
  const buf = Buffer.from(s, "utf8");
  if (buf.byteLength <= maxBytes) return s;
  let end = maxBytes;
  while (end > 0 && (buf[end] & 0b1100_0000) === 0b1000_0000) end -= 1;
  return buf.subarray(0, end).toString("utf8");
}

// Build a context block where each source file's extracted_text is injected
// before the user's typed narrative. This is what reaches planner / analyst
// / synthesizer. If a file failed to parse, surface that explicitly so the
// agents don't pretend they had the content.
function composeDecisionContext(
  decisionText: string,
  files: SessionFileRow[],
): string {
  if (files.length === 0) return decisionText;
  const sections: string[] = [];
  for (const f of files) {
    const header = `## Source Document: ${f.filename}` +
      (f.ocr_applied ? " (OCR applied)" : "");
    if (f.extracted_text && f.extracted_text.trim().length > 0) {
      sections.push(`${header}\n\n${f.extracted_text.trim()}`);
    } else if (f.parser_error) {
      sections.push(
        `${header}\n\n> Could not extract text from this file: ${f.parser_error}`,
      );
    } else {
      sections.push(`${header}\n\n> (no extractable text)`);
    }
  }
  const narrative = decisionText.trim();
  if (narrative) {
    return `${sections.join("\n\n")}\n\n## Submitter Narrative\n\n${narrative}`;
  }
  return sections.join("\n\n");
}

async function markRunning(
  session: AuditSessionRow,
  replyLanguage: "en" | "zh",
): Promise<void> {
  const meta = { ...(session.decision_meta ?? {}), reply_language: replyLanguage };
  delete (meta as Record<string, unknown>).pipeline_error;
  const { error } = await supabase
    .from("audit_sessions")
    .update({
      status: "running",
      decision_meta: meta,
      pipeline_started_at: new Date().toISOString(),
    })
    .eq("id", session.id);
  if (error) throw new Error(`mark running failed: ${error.message}`);
  await appendAuditTrail({
    sessionId: session.id,
    action: "pipeline_started",
    actorId: null,
    payload: { reply_language: replyLanguage },
  });
}

async function markFindingsReady(sessionId: string): Promise<void> {
  const { error } = await supabase
    .from("audit_sessions")
    .update({
      status: "findings_ready",
      completed_at: new Date().toISOString(),
    })
    .eq("id", sessionId);
  if (error) throw new Error(`mark findings_ready failed: ${error.message}`);
}

async function markFailed(sessionId: string, message: string): Promise<void> {
  const { data: prev, error: readErr } = await supabase
    .from("audit_sessions")
    .select("decision_meta")
    .eq("id", sessionId)
    .maybeSingle();
  if (readErr) {
    log.warn("audit_pipeline.failed_meta_read_failed", {
      sessionId,
      error: readErr.message,
    });
  }
  const meta = {
    ...((prev?.decision_meta as Record<string, unknown> | null) ?? {}),
    pipeline_error: message.slice(0, 2000),
    pipeline_failed_at: new Date().toISOString(),
  };
  await supabase
    .from("audit_sessions")
    .update({ status: "failed", decision_meta: meta })
    .eq("id", sessionId);
}

async function persistFindings(
  sessionId: string,
  synthFindings: SynthesizerFinding[],
  cacheIdsByKey: Map<string, string[]>,
): Promise<void> {
  if (synthFindings.length === 0) return;

  // Wipe any pre-existing findings for this session — re-runs replace.
  // (Audit trail is append-only; this just keeps the live row set clean.)
  const { error: delErr } = await supabase
    .from("audit_findings")
    .delete()
    .eq("session_id", sessionId);
  if (delErr) {
    log.warn("audit_pipeline.findings_wipe_failed", {
      sessionId,
      error: delErr.message,
    });
  }

  const rows = synthFindings.map((f, i) => ({
    session_id: sessionId,
    persona_id: null, // legacy column, we now use pool_persona_id
    pool_persona_id: f.persona_id,
    finding_kind: severityToKind(f.severity, f.confidence),
    severity: f.severity,
    probability: f.probability,
    claim: f.claim,
    // Backfill the legacy `evidence_refs` shape from citations so the
    // pre-multi-agent report renderer (Risk Register table) keeps showing
    // citation links. New renderers should read `citations` directly.
    evidence_refs: (f.citations ?? [])
      .filter((c) => c?.url)
      .map((c) => ({ kind: "url", ref: c.url })),
    suggested_mitigation: f.suggested_mitigation,
    confidence: f.confidence,
    basis: f.basis,
    citations: f.citations,
    law_id: f.law_id,
    law_section: f.law_section,
    task_id: f.task_id,
    dissent: f.dissent ? { text: f.dissent } : null,
    search_cache_ids: cacheIdsByKey.get(`${f.task_id}::${f.persona_id}`) ?? [],
    display_order: i,
  }));

  // Chunk inserts: Postgres can choke on huge multi-row inserts.
  const CHUNK = 50;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const slice = rows.slice(i, i + CHUNK);
    const { error } = await supabase.from("audit_findings").insert(slice);
    if (error) throw new Error(`audit_findings insert failed: ${error.message}`);
  }
}

async function persistReport(
  sessionId: string,
  report: SynthesizedReport,
): Promise<void> {
  const { data: prev, error: readErr } = await supabase
    .from("audit_sessions")
    .select("decision_meta")
    .eq("id", sessionId)
    .maybeSingle();
  if (readErr) throw new Error(`pre-report meta read failed: ${readErr.message}`);
  const meta = {
    ...((prev?.decision_meta as Record<string, unknown> | null) ?? {}),
    synthesized_report: report,
    synthesized_at: new Date().toISOString(),
  };
  const { error } = await supabase
    .from("audit_sessions")
    .update({ decision_meta: meta })
    .eq("id", sessionId);
  if (error) throw new Error(`report persist failed: ${error.message}`);
}

// ============================================
// Helpers
// ============================================
function indexById<T extends { id: string }>(rows: T[]): Map<string, T> {
  const m = new Map<string, T>();
  for (const r of rows) m.set(r.id, r);
  return m;
}

function dedupe(arr: string[]): string[] {
  return Array.from(new Set(arr));
}

/**
 * Map confidence + severity to the legacy finding_kind enum so existing
 * UI surfaces still work pre-migration. Heuristic:
 *   - severity >= 4               → 'risk'
 *   - severity in {2, 3}          → 'risk' (non-critical risk)
 *   - severity == 1               → 'mitigation' if suggested_mitigation else 'no_risk'
 *   - severity null + speculative → 'blind_spot'
 *   - severity null + others      → 'blind_spot'
 */
function severityToKind(
  severity: number | null,
  confidence: string,
): "risk" | "blind_spot" | "dissent" | "mitigation" | "no_risk" {
  if (severity != null && severity >= 2) return "risk";
  if (severity === 1) return "no_risk";
  if (confidence === "speculative") return "blind_spot";
  return "blind_spot";
}

// Exported for tests
export const __test__ = { indexById, severityToKind, dedupe };
