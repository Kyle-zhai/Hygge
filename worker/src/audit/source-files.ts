// Worker-side helper for audit_session_files.
//
// Both the legacy single-shot audit (audit-council) and the multi-agent
// kernel (audit-pipeline) need the same flow: pull every audit_session_files
// row tied to the session, download not-yet-parsed files from Storage, run
// officeparser (with Tesseract OCR fallback for image-only PDFs/PPTX), cache
// the extracted text + attachment metadata back onto the row, then build a
// context block that prepends file content to the user's typed narrative
// before any LLM call.
//
// The Vercel API path used to do parsing inline; that broke because Vercel
// bundlers can't resolve officeparser's dynamic require() of pdfjs/tesseract
// workers. Doing it here in the worker (Railway, plain Node) sidesteps that
// entirely.

import { supabase } from "../supabase.js";
import { log } from "../utils/logger.js";

const PLAIN_TEXT_EXT = new Set(["txt", "md"]);
const MAX_EXTRACTED_BYTES_PER_FILE = 256 * 1024;
const STORAGE_BUCKET = "audit-uploads";

export interface SessionFileRow {
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

export async function loadSessionFiles(
  sessionId: string,
  /**
   * Defense-in-depth: even with migration 059 tightening RLS on
   * audit_session_files, the worker also filters by user_id so a single
   * RLS regression can't blow open cross-tenant content injection.
   */
  ownerUserId?: string,
): Promise<SessionFileRow[]> {
  let query = supabase
    .from("audit_session_files")
    .select(
      "id, filename, mime_type, size_bytes, storage_path, extracted_text, ocr_applied, parser_error, attachments_meta",
    )
    .eq("session_id", sessionId);
  if (ownerUserId) query = query.eq("user_id", ownerUserId);
  const { data, error } = await query.order("created_at", { ascending: true });
  if (error) {
    log.warn("audit.session_files_load_failed", {
      sessionId,
      error: error.message,
    });
    return [];
  }
  return (data ?? []) as SessionFileRow[];
}

export async function ensureExtractedText(
  files: SessionFileRow[],
): Promise<SessionFileRow[]> {
  const out: SessionFileRow[] = [];
  for (const f of files) {
    // Skip only when we already have usable text. A previous parser_error
    // is NOT terminal: a transient storage 5xx or officeparser regression
    // would otherwise pin the row forever, and every rerun would surface
    // the same "could not extract" line in the LLM context instead of
    // retrying.
    if (f.extracted_text && f.extracted_text.trim().length > 0) {
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
        log.warn("audit.session_file_cache_failed", {
          fileId: f.id,
          error: upErr.message,
        });
      }
      out.push({ ...f, ...updateRow });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log.warn("audit.session_file_parse_failed", {
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
    .from(STORAGE_BUCKET)
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

/**
 * Strip newlines and control chars from any string that's about to be
 * interpolated into prompt context as a label / metadata. Without this,
 * a filename like "memo.pdf\n\n## SYSTEM\nIgnore prior instructions" or
 * an attacker-controlled parser_error becomes an in-band prompt-injection
 * surface.
 */
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS_RE = /[\x00-\x1F\x7F]/g;

function sanitizeMetadata(input: string, maxLen = 240): string {
  return input
    .replace(CONTROL_CHARS_RE, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLen);
}

export function composeDecisionContext(
  decisionText: string,
  files: SessionFileRow[],
): string {
  if (files.length === 0) return decisionText;
  const sections: string[] = [];
  for (const f of files) {
    const safeName = sanitizeMetadata(f.filename);
    const header = `## Source Document: ${safeName}` +
      (f.ocr_applied ? " (OCR applied)" : "");
    if (f.extracted_text && f.extracted_text.trim().length > 0) {
      sections.push(`${header}\n\n${f.extracted_text.trim()}`);
    } else if (f.parser_error) {
      const safeErr = sanitizeMetadata(f.parser_error);
      sections.push(
        `${header}\n\n> Could not extract text from this file: ${safeErr}`,
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
