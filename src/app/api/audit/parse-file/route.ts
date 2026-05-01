import { NextResponse } from "next/server";
import { OfficeParser } from "officeparser";
import type {
  OfficeAttachment,
  OfficeContentNode,
  OfficeParserAST,
  HeadingMetadata,
  ListMetadata,
  CellMetadata,
  SlideMetadata,
  SheetMetadata,
  PageMetadata,
  ImageMetadata,
} from "officeparser";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { enforceRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 90;

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
// Markdown output is structurally richer than the old toText() blob; raise
// the cap from the previous 64KB to 256KB. Modern LLMs handle this comfortably.
const MAX_EXTRACTED_BYTES = 256 * 1024;
// Hard ceiling on how many attachment-meta entries we keep per file. Image
// data lives base64-inline in audit_session_files.attachments_meta, so we
// cap to avoid blowing up the row.
const MAX_ATTACHMENTS = 64;
const MAX_ATTACHMENT_BYTES_TOTAL = 4 * 1024 * 1024;

const STORAGE_BUCKET = "audit-uploads";

const ALLOWED_EXT = new Set([
  "pdf", "docx", "pptx", "xlsx", "odt", "odp", "ods", "rtf", "txt", "md",
]);

const ALLOWED_MIME = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.oasis.opendocument.text",
  "application/vnd.oasis.opendocument.presentation",
  "application/vnd.oasis.opendocument.spreadsheet",
  "application/rtf",
  "text/rtf",
  "text/plain",
  "text/markdown",
  "",
]);

const PLAIN_TEXT_EXT = new Set(["txt", "md"]);

interface AttachmentMeta {
  name: string;
  mimeType: string;
  altText?: string;
  ocrText?: string;
  bytes: number;
  // Inline base64 data for downstream vision processing (Gap 6). Capped by
  // MAX_ATTACHMENT_BYTES_TOTAL across all attachments per file.
  data?: string;
}

function clipUtf8(input: string, maxBytes: number): { text: string; truncated: boolean } {
  const buf = Buffer.from(input, "utf8");
  if (buf.byteLength <= maxBytes) return { text: input, truncated: false };
  let end = maxBytes;
  while (end > 0 && (buf[end] & 0b1100_0000) === 0b1000_0000) end -= 1;
  return { text: buf.subarray(0, end).toString("utf8"), truncated: true };
}

function repeat(ch: string, n: number): string {
  if (n <= 0) return "";
  return new Array(n + 1).join(ch);
}

function nodesToMarkdown(
  nodes: OfficeContentNode[],
  attachmentByName: Map<string, OfficeAttachment>,
): string {
  const parts: string[] = [];
  let currentTable: string[][] | null = null;
  let currentRow: string[] | null = null;
  let currentRowIdx = -1;

  function flushTable() {
    if (!currentTable || currentTable.length === 0) {
      currentTable = null;
      currentRow = null;
      currentRowIdx = -1;
      return;
    }
    const colCount = currentTable.reduce((m, r) => Math.max(m, r.length), 0);
    if (colCount === 0) {
      currentTable = null;
      currentRow = null;
      currentRowIdx = -1;
      return;
    }
    const header = currentTable[0].concat(
      new Array(Math.max(0, colCount - currentTable[0].length)).fill(""),
    );
    parts.push(`| ${header.join(" | ")} |`);
    parts.push(`| ${header.map(() => "---").join(" | ")} |`);
    for (let i = 1; i < currentTable.length; i++) {
      const row = currentTable[i].concat(
        new Array(Math.max(0, colCount - currentTable[i].length)).fill(""),
      );
      parts.push(`| ${row.join(" | ")} |`);
    }
    parts.push("");
    currentTable = null;
    currentRow = null;
    currentRowIdx = -1;
  }

  function visit(node: OfficeContentNode, depth: number): void {
    const text = (node.text ?? "").replace(/\s+/g, " ").trim();

    switch (node.type) {
      case "heading": {
        flushTable();
        const meta = node.metadata as HeadingMetadata | undefined;
        const level = Math.min(Math.max(meta?.level ?? 2, 1), 6);
        if (text) parts.push(`${repeat("#", level)} ${text}`);
        return;
      }
      case "paragraph": {
        flushTable();
        if (text) parts.push(text);
        return;
      }
      case "list": {
        flushTable();
        const meta = node.metadata as ListMetadata | undefined;
        const indent = repeat("  ", meta?.indentation ?? 0);
        const bullet = meta?.listType === "ordered" ? "1." : "-";
        if (text) parts.push(`${indent}${bullet} ${text}`);
        return;
      }
      case "slide": {
        flushTable();
        const meta = node.metadata as SlideMetadata | undefined;
        parts.push("");
        parts.push("---");
        parts.push(`## Slide ${meta?.slideNumber ?? "?"}`);
        for (const child of node.children ?? []) visit(child, depth + 1);
        return;
      }
      case "sheet": {
        flushTable();
        const meta = node.metadata as SheetMetadata | undefined;
        parts.push("");
        parts.push(`## Sheet: ${meta?.sheetName ?? "?"}`);
        for (const child of node.children ?? []) visit(child, depth + 1);
        flushTable();
        return;
      }
      case "page": {
        flushTable();
        const meta = node.metadata as PageMetadata | undefined;
        parts.push("");
        parts.push(`<!-- page ${meta?.pageNumber ?? "?"} -->`);
        for (const child of node.children ?? []) visit(child, depth + 1);
        return;
      }
      case "row": {
        if (!currentTable) currentTable = [];
        currentRow = [];
        for (const child of node.children ?? []) visit(child, depth + 1);
        if (currentRow.length > 0) currentTable.push(currentRow);
        currentRow = null;
        return;
      }
      case "cell": {
        const meta = node.metadata as CellMetadata | undefined;
        const cellText = text.replace(/\|/g, "\\|");
        if (currentRow) {
          currentRow.push(cellText);
        } else {
          if (!currentTable) currentTable = [];
          if (currentRowIdx !== meta?.row) {
            currentRowIdx = meta?.row ?? currentRowIdx + 1;
            currentTable.push([cellText]);
          } else {
            currentTable[currentTable.length - 1].push(cellText);
          }
        }
        return;
      }
      case "table": {
        flushTable();
        currentTable = [];
        for (const child of node.children ?? []) visit(child, depth + 1);
        flushTable();
        return;
      }
      case "image": {
        flushTable();
        const meta = node.metadata as ImageMetadata | undefined;
        const alt = meta?.altText?.trim() || "image";
        const name = meta?.attachmentName ?? "";
        // Pull the matching attachment so we can fold its altText/OCR into
        // the markdown stream — Gap 6: this is how charts/diagrams reach
        // downstream agents even before a vision LLM is wired in.
        const att = name ? attachmentByName.get(name) : undefined;
        const ocr = att?.ocrText?.trim();
        const altDescr = att?.altText?.trim() || alt;
        parts.push(`![${altDescr}](${name})`);
        if (ocr) {
          parts.push(`> Image OCR (${altDescr}): ${ocr.replace(/\s+/g, " ")}`);
        }
        return;
      }
      case "chart": {
        flushTable();
        if (text) parts.push(`> chart: ${text}`);
        return;
      }
      case "note": {
        flushTable();
        if (text) parts.push(`> note: ${text}`);
        return;
      }
      case "text":
        if (text) parts.push(text);
        return;
      case "drawing":
      case "break":
        return;
      default: {
        if (text) parts.push(text);
        for (const child of node.children ?? []) visit(child, depth + 1);
      }
    }
  }

  for (const node of nodes) visit(node, 0);
  flushTable();
  return parts.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function captureAttachments(ast: OfficeParserAST): AttachmentMeta[] {
  const out: AttachmentMeta[] = [];
  let totalBytes = 0;
  for (const att of ast.attachments ?? []) {
    if (out.length >= MAX_ATTACHMENTS) break;
    if (att.type !== "image") {
      out.push({
        name: att.name,
        mimeType: att.mimeType,
        altText: att.altText,
        ocrText: att.ocrText,
        bytes: att.data ? Math.floor(att.data.length * 0.75) : 0,
      });
      continue;
    }
    const approxBytes = att.data ? Math.floor(att.data.length * 0.75) : 0;
    const meta: AttachmentMeta = {
      name: att.name,
      mimeType: att.mimeType,
      altText: att.altText,
      ocrText: att.ocrText,
      bytes: approxBytes,
    };
    if (totalBytes + approxBytes <= MAX_ATTACHMENT_BYTES_TOTAL && att.data) {
      meta.data = att.data;
      totalBytes += approxBytes;
    }
    out.push(meta);
  }
  return out;
}

async function parseWithOptions(
  buffer: Buffer,
  withOcr: boolean,
): Promise<OfficeParserAST> {
  return OfficeParser.parseOffice(buffer, {
    extractAttachments: true,
    ocr: withOcr,
    ignoreNotes: false,
    newlineDelimiter: "\n",
  });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limitResponse = await enforceRateLimit("evaluations", user.id);
  if (limitResponse) return limitResponse;

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid multipart body" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: `File exceeds ${MAX_UPLOAD_BYTES / 1024 / 1024}MB cap` },
      { status: 413 }
    );
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "File is empty" }, { status: 400 });
  }

  const ext = (file.name.split(".").pop() || "").toLowerCase();
  if (!ALLOWED_EXT.has(ext)) {
    return NextResponse.json(
      { error: `Unsupported file type: .${ext || "unknown"}` },
      { status: 415 }
    );
  }
  if (file.type && !ALLOWED_MIME.has(file.type)) {
    return NextResponse.json(
      { error: `Unsupported MIME type: ${file.type}` },
      { status: 415 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  let rawText: string;
  let attachments: AttachmentMeta[] = [];
  let ocrApplied = false;
  let parserError: string | null = null;

  if (PLAIN_TEXT_EXT.has(ext)) {
    rawText = buffer.toString("utf8");
  } else {
    let ast: OfficeParserAST | null = null;
    try {
      ast = await parseWithOptions(buffer, false);
    } catch (err) {
      console.error("audit/parse-file failed", { name: file.name, ext, err });
      parserError = err instanceof Error ? err.message : String(err);
      return NextResponse.json(
        { error: "Could not extract text from file. Try copy-pasting the contents instead." },
        { status: 422 }
      );
    }

    const attMap = new Map<string, OfficeAttachment>();
    for (const a of ast.attachments ?? []) attMap.set(a.name, a);
    rawText = nodesToMarkdown(ast.content ?? [], attMap);

    // OCR fallback for image-only documents (PDF/PPTX/ODP). Tesseract is
    // heavy (10-30s) so we only retry when the fast path produced nothing.
    if (
      rawText.trim().length === 0 &&
      (ext === "pdf" || ext === "pptx" || ext === "odp")
    ) {
      try {
        const ocrAst = await parseWithOptions(buffer, true);
        const ocrAttMap = new Map<string, OfficeAttachment>();
        for (const a of ocrAst.attachments ?? []) ocrAttMap.set(a.name, a);
        rawText = nodesToMarkdown(ocrAst.content ?? [], ocrAttMap);
        attachments = captureAttachments(ocrAst);
        ocrApplied = true;
      } catch (err) {
        console.error("audit/parse-file OCR retry failed", {
          name: file.name,
          ext,
          err,
        });
        parserError = err instanceof Error ? err.message : String(err);
      }
    } else {
      attachments = captureAttachments(ast);
    }
  }

  const trimmed = rawText.replace(/\r\n/g, "\n").trim();
  if (trimmed.length === 0) {
    if (ext === "pdf") {
      return NextResponse.json(
        {
          error:
            "PDF appears to be image-only and OCR could not recover any readable text. Try a different copy or paste the contents directly.",
          code: "image_only_pdf",
        },
        { status: 422 }
      );
    }
    return NextResponse.json(
      { error: "No readable text found in file" },
      { status: 422 }
    );
  }

  const { text, truncated } = clipUtf8(trimmed, MAX_EXTRACTED_BYTES);
  const extractedBytes = Buffer.byteLength(text, "utf8");

  // Persist: upload binary to Storage + insert audit_session_files row.
  // Uses the service role admin client so the path can ignore RLS during
  // the insert (RLS still applies to the storage object via the path
  // segment policy in migration 056).
  const admin = createAdminClient();
  const fileId = crypto.randomUUID();
  const storagePath = `${user.id}/${fileId}.${ext || "bin"}`;
  const uploadResult = await admin.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, buffer, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
  if (uploadResult.error) {
    console.error("audit/parse-file storage upload failed", {
      storagePath,
      error: uploadResult.error.message,
    });
    return NextResponse.json(
      {
        error:
          "File parsed but could not be persisted. Submit again or paste the contents directly.",
      },
      { status: 500 }
    );
  }

  const { error: insertErr } = await admin
    .from("audit_session_files")
    .insert({
      id: fileId,
      user_id: user.id,
      session_id: null,
      filename: file.name,
      mime_type: file.type || "application/octet-stream",
      size_bytes: file.size,
      storage_path: storagePath,
      extracted_text: text,
      extracted_text_truncated: truncated,
      extracted_bytes: extractedBytes,
      ocr_applied: ocrApplied,
      attachments_meta: attachments,
      parser_error: parserError,
    });
  if (insertErr) {
    console.error("audit/parse-file row insert failed", {
      fileId,
      error: insertErr.message,
    });
    // Best-effort cleanup of the orphan storage object.
    await admin.storage.from(STORAGE_BUCKET).remove([storagePath]);
    return NextResponse.json(
      { error: "File parsed but persistence failed. Please retry." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    file_id: fileId,
    text,
    filename: file.name,
    originalSize: file.size,
    extractedSize: extractedBytes,
    truncated,
    ocrApplied,
    attachments: attachments.map((a) => ({
      name: a.name,
      mimeType: a.mimeType,
      altText: a.altText,
      ocrText: a.ocrText,
      bytes: a.bytes,
    })),
  });
}
