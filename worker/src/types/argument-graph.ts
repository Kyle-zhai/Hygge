export interface ArgumentNode {
  id: string;
  evaluation_id: string;
  round: number;
  speaker: string;
  claim: string;
  attacks: string[];
  supports: string[];
}

export interface ArgumentGraph {
  nodes: Map<string, ArgumentNode>;
}

export function createArgumentGraph(): ArgumentGraph {
  return { nodes: new Map() };
}

export function nodeIdFor(round: number, speaker: string): string {
  return `r${round}:${speaker}`;
}
