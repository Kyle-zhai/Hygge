import { describe, expect, it } from "vitest";
import {
  parseMove,
  buildMoveHistogram,
  buildMoveReflections,
  buildMoveSchemaField,
  type MessageWithMove,
  type RoundForMoves,
} from "../../src/processors/rhetorical-moves.js";

const personaName = (id: string): string => ({ p1: "Alice", p2: "Bob" })[id] ?? id;

function msg(persona_id: string, move: string): MessageWithMove {
  return { persona_id, move: parseMove(move) };
}

describe("parseMove", () => {
  it("returns 'none' for non-string input", () => {
    expect(parseMove(undefined)).toBe("none");
    expect(parseMove(null)).toBe("none");
    expect(parseMove(42)).toBe("none");
    expect(parseMove({})).toBe("none");
  });

  it("returns 'none' for unknown values", () => {
    expect(parseMove("ad_hominem")).toBe("none");
    expect(parseMove("")).toBe("none");
    expect(parseMove("   ")).toBe("none");
  });

  it("normalizes case + whitespace", () => {
    expect(parseMove("CONCEDE")).toBe("concede");
    expect(parseMove("  Steelman  ")).toBe("steelman");
  });

  it("accepts all canonical moves", () => {
    for (const m of [
      "steelman", "concede", "narrow", "reframe",
      "redirect", "anecdote", "data", "escalate", "none",
    ]) {
      expect(parseMove(m)).toBe(m);
    }
  });
});

describe("buildMoveHistogram", () => {
  it("returns empty histogram for no rounds", () => {
    const h = buildMoveHistogram([]);
    expect(h.totalMessages).toBe(0);
    expect(h.perPersona.size).toBe(0);
    expect(h.global.size).toBe(0);
  });

  it("counts moves per persona and globally", () => {
    const rounds: RoundForMoves[] = [
      { round: 1, messages: [msg("p1", "data"), msg("p2", "redirect")] },
      { round: 2, messages: [msg("p1", "data"), msg("p2", "redirect")] },
    ];
    const h = buildMoveHistogram(rounds);
    expect(h.totalMessages).toBe(4);
    expect(h.perPersona.get("p1")?.get("data")).toBe(2);
    expect(h.perPersona.get("p2")?.get("redirect")).toBe(2);
    expect(h.global.get("data")).toBe(2);
    expect(h.global.get("redirect")).toBe(2);
  });

  it("preserves move sequence per persona", () => {
    const rounds: RoundForMoves[] = [
      { round: 1, messages: [msg("p1", "redirect")] },
      { round: 2, messages: [msg("p1", "escalate")] },
      { round: 3, messages: [msg("p1", "data")] },
    ];
    const h = buildMoveHistogram(rounds);
    expect(h.perPersonaSequence.get("p1")).toEqual(["redirect", "escalate", "data"]);
  });

  it("skips messages with empty persona_id", () => {
    const rounds: RoundForMoves[] = [
      { round: 1, messages: [msg("", "data"), msg("p1", "data")] },
    ];
    const h = buildMoveHistogram(rounds);
    expect(h.totalMessages).toBe(1);
  });
});

describe("buildMoveReflections", () => {
  it("is silent in round 1 (no history)", () => {
    const h = buildMoveHistogram([
      { round: 1, messages: [msg("p1", "redirect"), msg("p2", "redirect")] },
    ]);
    expect(buildMoveReflections(h, 1, personaName)).toEqual([]);
  });

  it("flags persona who keeps using evasive moves (last 2 both evasive)", () => {
    const h = buildMoveHistogram([
      { round: 1, messages: [msg("p1", "redirect")] },
      { round: 2, messages: [msg("p1", "escalate")] },
    ]);
    const lines = buildMoveReflections(h, 3, personaName);
    expect(lines.some((l) => l.includes("Alice") && l.includes("cornered"))).toBe(true);
  });

  it("flags persona who repeats the same non-none move 3x", () => {
    const h = buildMoveHistogram([
      { round: 1, messages: [msg("p1", "data")] },
      { round: 2, messages: [msg("p1", "data")] },
      { round: 3, messages: [msg("p1", "data")] },
    ]);
    const lines = buildMoveReflections(h, 4, personaName);
    expect(lines.some((l) => l.includes("Alice") && l.includes("three times"))).toBe(true);
  });

  it("does NOT flag repeated 'none' moves (uninformative)", () => {
    const h = buildMoveHistogram([
      { round: 1, messages: [msg("p1", "none")] },
      { round: 2, messages: [msg("p1", "none")] },
      { round: 3, messages: [msg("p1", "none")] },
    ]);
    const lines = buildMoveReflections(h, 4, personaName);
    expect(lines.some((l) => l.includes("three times"))).toBe(false);
  });

  it("flags missing global moves (concede, data, steelman) once enough messages exist", () => {
    const h = buildMoveHistogram([
      { round: 1, messages: [msg("p1", "redirect"), msg("p2", "redirect")] },
      { round: 2, messages: [msg("p1", "escalate"), msg("p2", "anecdote")] },
    ]);
    const lines = buildMoveReflections(h, 3, personaName);
    expect(lines.some((l) => l.includes('"concede"'))).toBe(true);
    expect(lines.some((l) => l.includes('"data"'))).toBe(true);
    expect(lines.some((l) => l.includes('"steelman"'))).toBe(true);
  });

  it("does NOT flag missing moves before 4 messages exist", () => {
    const h = buildMoveHistogram([
      { round: 1, messages: [msg("p1", "redirect"), msg("p2", "redirect")] },
    ]);
    const lines = buildMoveReflections(h, 2, personaName);
    expect(lines.some((l) => l.includes('"concede"'))).toBe(false);
  });

  it("does NOT flag a missing move when at least one persona used it", () => {
    const h = buildMoveHistogram([
      { round: 1, messages: [msg("p1", "concede"), msg("p2", "data")] },
      { round: 2, messages: [msg("p1", "steelman"), msg("p2", "redirect")] },
    ]);
    const lines = buildMoveReflections(h, 3, personaName);
    expect(lines.some((l) => l.includes('"concede"'))).toBe(false);
    expect(lines.some((l) => l.includes('"data"'))).toBe(false);
    expect(lines.some((l) => l.includes('"steelman"'))).toBe(false);
  });
});

describe("buildMoveSchemaField", () => {
  it("includes all canonical moves in the schema string", () => {
    const out = buildMoveSchemaField();
    expect(out).toContain("rhetorical_move");
    expect(out).toContain("steelman");
    expect(out).toContain("concede");
    expect(out).toContain("data");
    expect(out).toContain("none");
  });
});
