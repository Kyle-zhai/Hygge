import {
  type ArgumentGraph,
  type ArgumentNode,
  createArgumentGraph,
  nodeIdFor,
} from "../types/argument-graph.js";

export interface DebateRoundForGraph {
  round: number;
  messages: Array<{
    persona_id: string;
    content: string;
    responding_to?: string | null;
    stance_shift?: string | null;
  }>;
}

const CLAIM_TRUNC = 220;

export function buildArgumentGraph(
  evaluationId: string,
  rounds: DebateRoundForGraph[],
): ArgumentGraph {
  const graph = createArgumentGraph();

  for (const r of rounds) {
    for (const m of r.messages) {
      if (!m.persona_id) continue;
      const id = nodeIdFor(r.round, m.persona_id);
      graph.nodes.set(id, {
        id,
        evaluation_id: evaluationId,
        round: r.round,
        speaker: m.persona_id,
        claim: (m.content ?? "").slice(0, CLAIM_TRUNC),
        attacks: [],
        supports: [],
      });
    }
  }

  for (const r of rounds) {
    for (const m of r.messages) {
      if (!m.responding_to) continue;
      const childId = nodeIdFor(r.round, m.persona_id);
      const child = graph.nodes.get(childId);
      if (!child) continue;
      const parentId = findLatestNodeBy(graph, m.responding_to, r.round);
      if (!parentId) continue;
      const parent = graph.nodes.get(parentId);
      if (!parent) continue;

      const isSupport = typeof m.stance_shift === "string" && m.stance_shift.trim().length > 0;
      if (isSupport) {
        if (!child.supports.includes(parentId)) child.supports.push(parentId);
      } else {
        if (!child.attacks.includes(parentId)) child.attacks.push(parentId);
      }
    }
  }

  return graph;
}

function findLatestNodeBy(graph: ArgumentGraph, speaker: string, beforeRound: number): string | null {
  let best: ArgumentNode | null = null;
  for (const node of graph.nodes.values()) {
    if (node.speaker !== speaker) continue;
    if (node.round >= beforeRound) continue;
    if (!best || node.round > best.round) best = node;
  }
  return best ? best.id : null;
}

export function findUnrespondedClaims(graph: ArgumentGraph, currentRound: number): ArgumentNode[] {
  const challenged = new Set<string>();
  for (const node of graph.nodes.values()) {
    for (const target of node.attacks) challenged.add(target);
  }

  const unresponded: ArgumentNode[] = [];
  for (const node of graph.nodes.values()) {
    if (node.round >= currentRound) continue;
    if (challenged.has(node.id)) continue;
    if (node.round === currentRound - 1) unresponded.push(node);
  }
  return unresponded;
}

export function findCycles(graph: ArgumentGraph): Array<[string, string]> {
  const attackedBy = new Map<string, Set<string>>();
  for (const node of graph.nodes.values()) {
    if (!attackedBy.has(node.speaker)) attackedBy.set(node.speaker, new Set());
    for (const targetId of node.attacks) {
      const target = graph.nodes.get(targetId);
      if (!target) continue;
      attackedBy.get(node.speaker)!.add(target.speaker);
    }
  }

  const cycles: Array<[string, string]> = [];
  const seen = new Set<string>();
  for (const [a, attacked] of attackedBy) {
    for (const b of attacked) {
      const reverse = attackedBy.get(b);
      if (!reverse?.has(a)) continue;
      const key = [a, b].sort().join("|");
      if (seen.has(key)) continue;
      seen.add(key);
      cycles.push([a, b]);
    }
  }
  return cycles;
}

export interface ArgumentGraphReflection {
  unrespondedLines: string[];
  cycleLines: string[];
}

export function buildArgumentReflections(
  graph: ArgumentGraph,
  currentRound: number,
  personaName: (id: string) => string,
): ArgumentGraphReflection {
  const unresponded = findUnrespondedClaims(graph, currentRound);
  const cycles = findCycles(graph);

  const unrespondedLines = unresponded.map((n) => {
    const name = personaName(n.speaker);
    const snippet = n.claim.length > 140 ? n.claim.slice(0, 140) + "…" : n.claim;
    return `UN-RESPONDED CLAIM (round ${n.round}, ${name}): "${snippet}" — at least one persona should engage with this claim directly, either rebut or concede a piece.`;
  });

  const cycleLines = cycles.map(([a, b]) =>
    `ARGUMENT CYCLE: ${personaName(a)} ↔ ${personaName(b)} have been attacking each other's positions across rounds. Break the loop: introduce new evidence, reframe the disagreement, or acknowledge the impasse.`,
  );

  return { unrespondedLines, cycleLines };
}
