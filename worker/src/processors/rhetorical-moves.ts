import {
  type RhetoricalMove,
  RHETORICAL_MOVES,
  RHETORICAL_MOVE_DESCRIPTIONS,
} from "../types/rhetorical-moves.js";

const VALID_MOVES = new Set<RhetoricalMove>(RHETORICAL_MOVES);

export function parseMove(raw: unknown): RhetoricalMove {
  if (typeof raw !== "string") return "none";
  const normalized = raw.trim().toLowerCase() as RhetoricalMove;
  return VALID_MOVES.has(normalized) ? normalized : "none";
}

export interface MessageWithMove {
  persona_id: string;
  move: RhetoricalMove;
}

export interface RoundForMoves {
  round: number;
  messages: MessageWithMove[];
}

// Per-persona move counts AND a flat global count (across all personas).
export interface MoveHistogram {
  perPersona: Map<string, Map<RhetoricalMove, number>>;
  perPersonaSequence: Map<string, RhetoricalMove[]>;
  global: Map<RhetoricalMove, number>;
  totalMessages: number;
}

export function buildMoveHistogram(rounds: RoundForMoves[]): MoveHistogram {
  const perPersona = new Map<string, Map<RhetoricalMove, number>>();
  const perPersonaSequence = new Map<string, RhetoricalMove[]>();
  const global = new Map<RhetoricalMove, number>();
  let totalMessages = 0;

  for (const round of rounds) {
    for (const msg of round.messages) {
      if (!msg.persona_id) continue;
      totalMessages += 1;

      let personaCounts = perPersona.get(msg.persona_id);
      if (!personaCounts) {
        personaCounts = new Map<RhetoricalMove, number>();
        perPersona.set(msg.persona_id, personaCounts);
      }
      personaCounts.set(msg.move, (personaCounts.get(msg.move) ?? 0) + 1);

      let seq = perPersonaSequence.get(msg.persona_id);
      if (!seq) {
        seq = [];
        perPersonaSequence.set(msg.persona_id, seq);
      }
      seq.push(msg.move);

      global.set(msg.move, (global.get(msg.move) ?? 0) + 1);
    }
  }

  return { perPersona, perPersonaSequence, global, totalMessages };
}

// Lower-priority moves we want at least SOMEONE to use across the debate.
// If absent globally by round ≥ 2, we surface as a reflection.
const REQUIRED_MOVES: RhetoricalMove[] = ["concede", "data", "steelman"];
// Moves that signal evasion when over-used by a single persona.
const EVASIVE_MOVES = new Set<RhetoricalMove>(["redirect", "escalate"]);

export function buildMoveReflections(
  histogram: MoveHistogram,
  upcomingRound: number,
  personaName: (id: string) => string,
): string[] {
  const lines: string[] = [];
  if (upcomingRound <= 1 || histogram.totalMessages === 0) return lines;

  // Per-persona evasion: ≥3 of the persona's last 3 moves are in EVASIVE_MOVES,
  // OR ≥2 of the last 3 are the SAME evasive move.
  for (const [personaId, sequence] of histogram.perPersonaSequence) {
    if (sequence.length < 2) continue;
    const last = sequence.slice(-3);
    const evasiveCount = last.filter((m) => EVASIVE_MOVES.has(m)).length;
    const sameMoveCount = last.filter((m) => m === last[last.length - 1]).length;

    if (evasiveCount === last.length && last.length >= 2) {
      lines.push(
        `@${personaName(personaId)} — your last ${last.length} moves were ${formatSequence(last)}. If you feel cornered, name it directly this round instead of redirecting again.`,
      );
    } else if (
      sameMoveCount === last.length &&
      last.length >= 3 &&
      last[last.length - 1] !== "none"
    ) {
      lines.push(
        `@${personaName(personaId)} — you've used "${last[last.length - 1]}" three times in a row. Vary the move this round if your point genuinely warrants it.`,
      );
    }
  }

  // Globally missing moves (only flag once enough messages exist).
  if (histogram.totalMessages >= 4) {
    for (const required of REQUIRED_MOVES) {
      if ((histogram.global.get(required) ?? 0) === 0) {
        lines.push(
          `Across the whole debate, no persona has used "${required}" (${RHETORICAL_MOVE_DESCRIPTIONS[required]}). If genuinely warranted this round, use it.`,
        );
      }
    }
  }

  return lines;
}

function formatSequence(moves: RhetoricalMove[]): string {
  return `[${moves.join(", ")}]`;
}

export function buildMoveSchemaField(): string {
  const validList = RHETORICAL_MOVES.join(" | ");
  return `,
      "rhetorical_move": "<one of: ${validList} — the dominant move in your message>"`;
}
