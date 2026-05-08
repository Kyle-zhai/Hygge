// Server-side text extraction for chat attachments. Mirrors how the
// retired /evaluate flow used officeparser, but returns plain text for
// inlining into a user_text message rather than persisting to a project
// row. Extension whitelist matches the ChatComposer's accept attribute.

import { OfficeParser } from "officeparser";

const TEXT_EXTENSIONS = new Set(["txt", "md", "markdown", "csv"]);
const OFFICE_EXTENSIONS = new Set([
  "pdf",
  "docx",
  "doc",
  "pptx",
  "ppt",
  "xlsx",
  "xls",
]);

const MAX_PARSED_CHARS_PER_FILE = 20_000;

export interface ParsedAttachment {
  name: string;
  ok: boolean;
  text: string;
  bytes: number;
}

export async function parseAttachment(file: File): Promise<ParsedAttachment> {
  const name = file.name;
  const bytes = file.size;
  const ext = (name.split(".").pop() ?? "").toLowerCase();

  try {
    if (TEXT_EXTENSIONS.has(ext)) {
      const text = await file.text();
      return {
        name,
        ok: true,
        text: text.slice(0, MAX_PARSED_CHARS_PER_FILE),
        bytes,
      };
    }
    if (OFFICE_EXTENSIONS.has(ext)) {
      const buf = Buffer.from(await file.arrayBuffer());
      const ast = await OfficeParser.parseOffice(buf);
      const text =
        typeof ast === "string"
          ? ast
          : Array.isArray(ast)
          ? ast.map((n) => extractText(n)).join("\n")
          : extractText(ast);
      return {
        name,
        ok: true,
        text: text.slice(0, MAX_PARSED_CHARS_PER_FILE),
        bytes,
      };
    }
    // Unknown extension — record metadata only, don't reject the upload.
    return { name, ok: false, text: "", bytes };
  } catch (err) {
    console.error("decide.parse_attachment_failed", {
      name,
      ext,
      message: err instanceof Error ? err.message : String(err),
    });
    return { name, ok: false, text: "", bytes };
  }
}

function extractText(node: unknown): string {
  if (typeof node === "string") return node;
  if (!node || typeof node !== "object") return "";
  const n = node as Record<string, unknown>;
  if (typeof n.text === "string") return n.text;
  if (Array.isArray(n.children)) {
    return (n.children as unknown[]).map(extractText).filter(Boolean).join("\n");
  }
  return "";
}

// Composes a user_text content string from the user's typed message +
// each parsed attachment. Format is stable so the LLM intake prompt
// can recognise the boundary between user prose and attached content.
export function composeUserContent(
  userText: string,
  parsed: ParsedAttachment[],
): string {
  if (parsed.length === 0) return userText;
  const blocks: string[] = [];
  if (userText.trim()) blocks.push(userText.trim());
  for (const p of parsed) {
    if (p.ok && p.text.trim()) {
      blocks.push(`[Attached: ${p.name}]\n${p.text.trim()}`);
    } else {
      blocks.push(`[Attached: ${p.name} — not parsed]`);
    }
  }
  return blocks.join("\n\n");
}
