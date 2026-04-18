/**
 * Attempt JSON.parse with a sequence of cleanups that recover common LLM output issues:
 * - markdown code fences
 * - leading/trailing chatter around the JSON block
 * - unescaped control characters inside strings
 * - invalid backslash escapes (e.g. \$, \₹, \p)
 */
export function robustJsonParse<T = unknown>(text: string): T {
  const stripped = stripFencesAndChatter(text);
  const noCtrl = stripControlChars(stripped);
  const fixedEsc = fixInvalidEscapes(noCtrl);
  const attempts = [
    text,
    stripped,
    noCtrl,
    fixedEsc,
    balanceStringQuotes(fixedEsc),
  ];

  let lastErr: unknown;
  for (const candidate of attempts) {
    try {
      return JSON.parse(candidate);
    } catch (err) {
      lastErr = err;
    }
  }

  const preview = attempts[attempts.length - 1].slice(0, 200);
  throw new Error(
    `No valid JSON found after cleanup. Last error: ${(lastErr as Error)?.message ?? "unknown"}. Preview: ${preview}`,
  );
}

function stripFencesAndChatter(text: string): string {
  let t = text.trim();
  t = t.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "");

  const firstObj = t.indexOf("{");
  const firstArr = t.indexOf("[");
  const firstIdx = firstObj === -1
    ? firstArr
    : firstArr === -1
      ? firstObj
      : Math.min(firstObj, firstArr);
  if (firstIdx > 0) t = t.slice(firstIdx);

  const lastObj = t.lastIndexOf("}");
  const lastArr = t.lastIndexOf("]");
  const lastIdx = Math.max(lastObj, lastArr);
  if (lastIdx >= 0 && lastIdx < t.length - 1) t = t.slice(0, lastIdx + 1);

  return t;
}

function stripControlChars(text: string): string {
  let out = "";
  let inString = false;
  let escape = false;
  for (const ch of text) {
    if (escape) {
      out += ch;
      escape = false;
      continue;
    }
    if (ch === "\\") {
      out += ch;
      escape = true;
      continue;
    }
    if (ch === '"') {
      out += ch;
      inString = !inString;
      continue;
    }
    if (inString) {
      const code = ch.charCodeAt(0);
      if (code < 0x20 || code === 0x7f) {
        if (code === 0x0a) { out += "\\n"; continue; }
        if (code === 0x0d) { out += "\\r"; continue; }
        if (code === 0x09) { out += "\\t"; continue; }
        continue;
      }
    }
    out += ch;
  }
  return out;
}

function fixInvalidEscapes(text: string): string {
  return text.replace(/\\([^"\\/bfnrtu])/g, "$1");
}

/**
 * Escape stray unescaped `"` characters inside string values. A `"` closes a
 * string only when followed (after whitespace) by a JSON structural terminator
 * (`,`, `}`, `]`, `:`) or EOF. Any other `"` while inside a string is treated
 * as embedded content and escaped.
 */
function balanceStringQuotes(text: string): string {
  let out = "";
  let inString = false;
  let escape = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (!inString) {
      out += ch;
      if (ch === '"') inString = true;
      continue;
    }
    if (escape) {
      out += ch;
      escape = false;
      continue;
    }
    if (ch === "\\") {
      out += ch;
      escape = true;
      continue;
    }
    if (ch === '"') {
      let j = i + 1;
      while (j < text.length && (text[j] === " " || text[j] === "\t" || text[j] === "\n" || text[j] === "\r")) j++;
      const next = text[j];
      if (next === undefined || next === "," || next === "}" || next === "]" || next === ":") {
        out += ch;
        inString = false;
      } else {
        out += "\\" + ch;
      }
      continue;
    }
    out += ch;
  }
  return out;
}
