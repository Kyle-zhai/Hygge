// Ranks and caps reflection lines so the prompt has signal, not noise.
//
// Reflection lines come from four independent sources (stance dynamics,
// argument graph un-responded claims, attack cycles, rhetorical-move ruts).
// In a 5-persona / 3-round debate the raw count can climb past 10 — at which
// point the model treats the whole block as boilerplate and ignores it.
//
// Heuristic: lines that name a specific persona (by "@Name" prefix or by
// mentioning a persona name in the first 120 chars) are highest signal.
// Lines that target the whole debate ("no persona has used data") are lower.
// Cap total at MAX_LINES, preferring named lines first.

const MAX_LINES = 6;
const MAX_GLOBAL_LINES = 2;
const NAMED_DETECT_PREFIX_CHARS = 120;

export interface RankOptions {
  maxLines?: number;
  maxGlobalLines?: number;
}

export function rankReflectionLines(
  lines: string[],
  personaNames: string[] = [],
  options: RankOptions = {},
): string[] {
  const maxLines = options.maxLines ?? MAX_LINES;
  const maxGlobalLines = options.maxGlobalLines ?? MAX_GLOBAL_LINES;

  const seen = new Set<string>();
  const named: string[] = [];
  const global: string[] = [];

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (seen.has(line)) continue;
    seen.add(line);
    if (isNamedLine(line, personaNames)) {
      named.push(line);
    } else {
      global.push(line);
    }
  }

  const trimmedGlobal = global.slice(0, maxGlobalLines);
  return [...named, ...trimmedGlobal].slice(0, maxLines);
}

function isNamedLine(line: string, personaNames: string[]): boolean {
  if (line.startsWith("@")) return true;
  const head = line.slice(0, NAMED_DETECT_PREFIX_CHARS);
  for (const name of personaNames) {
    if (!name) continue;
    if (head.includes(name)) return true;
  }
  return false;
}
