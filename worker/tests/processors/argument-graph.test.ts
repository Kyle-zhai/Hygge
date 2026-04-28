import { describe, expect, it } from "vitest";
import {
  buildArgumentGraph,
  buildArgumentReflections,
  findCycles,
  findUnrespondedClaims,
  type DebateRoundForGraph,
} from "../../src/processors/argument-graph.js";
import { nodeIdFor } from "../../src/types/argument-graph.js";

const evalId = "eval-1";

function nameOf(id: string): string {
  const map: Record<string, string> = { p1: "Alice", p2: "Bob", p3: "Carol" };
  return map[id] ?? id;
}

describe("buildArgumentGraph", () => {
  it("creates one node per message", () => {
    const rounds: DebateRoundForGraph[] = [
      { round: 1, messages: [
        { persona_id: "p1", content: "claim A" },
        { persona_id: "p2", content: "claim B" },
      ]},
    ];
    const graph = buildArgumentGraph(evalId, rounds);
    expect(graph.nodes.size).toBe(2);
    expect(graph.nodes.get(nodeIdFor(1, "p1"))?.claim).toBe("claim A");
  });

  it("treats responding_to with empty stance_shift as an attack", () => {
    const rounds: DebateRoundForGraph[] = [
      { round: 1, messages: [{ persona_id: "p1", content: "growth is sustainable" }]},
      { round: 2, messages: [{ persona_id: "p2", content: "no, churn is rising", responding_to: "p1", stance_shift: null }]},
    ];
    const graph = buildArgumentGraph(evalId, rounds);
    const child = graph.nodes.get(nodeIdFor(2, "p2"));
    expect(child?.attacks).toEqual([nodeIdFor(1, "p1")]);
    expect(child?.supports).toEqual([]);
  });

  it("treats responding_to with non-empty stance_shift as a support", () => {
    const rounds: DebateRoundForGraph[] = [
      { round: 1, messages: [{ persona_id: "p1", content: "growth is sustainable" }]},
      { round: 2, messages: [{ persona_id: "p2", content: "you're right about retention", responding_to: "p1", stance_shift: "moved toward support" }]},
    ];
    const graph = buildArgumentGraph(evalId, rounds);
    const child = graph.nodes.get(nodeIdFor(2, "p2"));
    expect(child?.supports).toEqual([nodeIdFor(1, "p1")]);
    expect(child?.attacks).toEqual([]);
  });

  it("ignores responding_to that points to a speaker with no prior round", () => {
    const rounds: DebateRoundForGraph[] = [
      { round: 1, messages: [{ persona_id: "p2", content: "later", responding_to: "ghost" }]},
    ];
    const graph = buildArgumentGraph(evalId, rounds);
    expect(graph.nodes.get(nodeIdFor(1, "p2"))?.attacks).toEqual([]);
  });

  it("truncates very long claim text", () => {
    const long = "x".repeat(500);
    const rounds: DebateRoundForGraph[] = [{ round: 1, messages: [{ persona_id: "p1", content: long }]}];
    const graph = buildArgumentGraph(evalId, rounds);
    expect(graph.nodes.get(nodeIdFor(1, "p1"))?.claim.length).toBe(220);
  });
});

describe("findUnrespondedClaims", () => {
  it("returns claims from the previous round that received no attack", () => {
    const rounds: DebateRoundForGraph[] = [
      { round: 1, messages: [
        { persona_id: "p1", content: "A unattacked" },
        { persona_id: "p2", content: "B will be attacked" },
      ]},
      { round: 2, messages: [
        { persona_id: "p3", content: "rebut B", responding_to: "p2" },
      ]},
    ];
    const graph = buildArgumentGraph(evalId, rounds);
    const unresponded = findUnrespondedClaims(graph, 3);
    const ids = unresponded.map((n) => n.id);
    expect(ids).not.toContain(nodeIdFor(1, "p1"));
    expect(ids).toContain(nodeIdFor(2, "p3"));
    expect(ids).not.toContain(nodeIdFor(1, "p2"));
  });

  it("returns empty array when current round is 1 (no prior data)", () => {
    const rounds: DebateRoundForGraph[] = [
      { round: 1, messages: [{ persona_id: "p1", content: "first claim" }]},
    ];
    const graph = buildArgumentGraph(evalId, rounds);
    expect(findUnrespondedClaims(graph, 1)).toEqual([]);
  });

  it("supports do not count as responses", () => {
    const rounds: DebateRoundForGraph[] = [
      { round: 1, messages: [{ persona_id: "p1", content: "the claim" }]},
      { round: 2, messages: [{ persona_id: "p2", content: "I agree", responding_to: "p1", stance_shift: "moved" }]},
    ];
    const graph = buildArgumentGraph(evalId, rounds);
    const unresponded = findUnrespondedClaims(graph, 3);
    expect(unresponded.map((n) => n.id)).toContain(nodeIdFor(2, "p2"));
  });
});

describe("findCycles", () => {
  it("detects mutual attacks across rounds", () => {
    const rounds: DebateRoundForGraph[] = [
      { round: 1, messages: [{ persona_id: "p1", content: "alpha" }]},
      { round: 2, messages: [{ persona_id: "p2", content: "rebut alpha", responding_to: "p1" }]},
      { round: 3, messages: [{ persona_id: "p1", content: "rebut p2's rebuttal", responding_to: "p2" }]},
    ];
    const graph = buildArgumentGraph(evalId, rounds);
    const cycles = findCycles(graph);
    expect(cycles.length).toBe(1);
  });

  it("returns no cycles when only one direction exists", () => {
    const rounds: DebateRoundForGraph[] = [
      { round: 1, messages: [{ persona_id: "p1", content: "alpha" }]},
      { round: 2, messages: [{ persona_id: "p2", content: "rebut", responding_to: "p1" }]},
    ];
    const graph = buildArgumentGraph(evalId, rounds);
    expect(findCycles(graph)).toEqual([]);
  });
});

describe("buildArgumentReflections", () => {
  it("emits prompt-ready lines for unresponded claims and cycles", () => {
    const rounds: DebateRoundForGraph[] = [
      { round: 1, messages: [{ persona_id: "p1", content: "alpha" }, { persona_id: "p2", content: "beta" }]},
      { round: 2, messages: [
        { persona_id: "p2", content: "rebut alpha", responding_to: "p1" },
        { persona_id: "p1", content: "rebut beta", responding_to: "p2" },
      ]},
    ];
    const graph = buildArgumentGraph(evalId, rounds);
    const reflections = buildArgumentReflections(graph, 3, nameOf);
    expect(reflections.cycleLines.length).toBeGreaterThan(0);
    expect(reflections.cycleLines[0]).toContain("Alice");
    expect(reflections.cycleLines[0]).toContain("Bob");
  });

  it("returns empty lines when no unresponded claims or cycles exist", () => {
    const rounds: DebateRoundForGraph[] = [
      { round: 1, messages: [{ persona_id: "p1", content: "alpha" }]},
      { round: 2, messages: [{ persona_id: "p2", content: "rebut", responding_to: "p1" }]},
    ];
    const graph = buildArgumentGraph(evalId, rounds);
    const reflections = buildArgumentReflections(graph, 2, nameOf);
    expect(reflections.unrespondedLines).toEqual([]);
    expect(reflections.cycleLines).toEqual([]);
  });
});
