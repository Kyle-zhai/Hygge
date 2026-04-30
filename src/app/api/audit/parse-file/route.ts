import { NextResponse } from "next/server";
import { OfficeParser } from "officeparser";
import { createClient } from "@/lib/supabase/server";
import { enforceRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const MAX_EXTRACTED_BYTES = 64 * 1024;

const ALLOWED_EXT = new Set([
  "pdf",
  "docx",
  "pptx",
  "xlsx",
  "odt",
  "odp",
  "ods",
  "rtf",
  "txt",
  "md",
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

function clipUtf8(input: string, maxBytes: number): { text: string; truncated: boolean } {
  const buf = Buffer.from(input, "utf8");
  if (buf.byteLength <= maxBytes) return { text: input, truncated: false };
  // Slice without splitting a multi-byte char.
  let end = maxBytes;
  while (end > 0 && (buf[end] & 0b1100_0000) === 0b1000_0000) end -= 1;
  return { text: buf.subarray(0, end).toString("utf8"), truncated: true };
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
  if (PLAIN_TEXT_EXT.has(ext)) {
    rawText = buffer.toString("utf8");
  } else {
    try {
      const ast = await OfficeParser.parseOffice(buffer);
      rawText = ast.toText();
    } catch (err) {
      console.error("audit/parse-file failed", { name: file.name, ext, err });
      return NextResponse.json(
        { error: "Could not extract text from file. Try copy-pasting the contents instead." },
        { status: 422 }
      );
    }
  }

  const trimmed = rawText.replace(/\r\n/g, "\n").trim();
  if (trimmed.length === 0) {
    return NextResponse.json(
      { error: "No readable text found in file" },
      { status: 422 }
    );
  }

  const { text, truncated } = clipUtf8(trimmed, MAX_EXTRACTED_BYTES);

  return NextResponse.json({
    text,
    filename: file.name,
    originalSize: file.size,
    extractedSize: Buffer.byteLength(text, "utf8"),
    truncated,
  });
}
