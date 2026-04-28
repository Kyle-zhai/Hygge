// Rhetorical moves catalog — one tag per persona utterance per round.
//
// Used to detect persona-level "rut patterns" (e.g. one persona keeps
// redirecting; nobody concedes; nobody cites data) and surface them as
// explicit reflection lines into the next round's prompt. Zero extra LLM
// calls — the model emits the tag in its existing JSON output.

export type RhetoricalMove =
  | "steelman"   // present opponent's view in strongest form before disagreeing
  | "concede"    // explicitly accept a point (full or partial)
  | "narrow"     // limit the scope of own/opponent's claim
  | "reframe"    // change the lens/frame of the conversation
  | "redirect"   // shift to a different question, side-stepping a challenge
  | "anecdote"   // support with a specific story or example
  | "data"       // support with a number, metric, or external study
  | "escalate"   // raise stakes, urgency, or implication severity
  | "none";      // catch-all when no move applies

export const RHETORICAL_MOVES: readonly RhetoricalMove[] = [
  "steelman",
  "concede",
  "narrow",
  "reframe",
  "redirect",
  "anecdote",
  "data",
  "escalate",
  "none",
] as const;

export const RHETORICAL_MOVE_DESCRIPTIONS: Record<RhetoricalMove, string> = {
  steelman: "presenting the opponent's view in its strongest form before pushing back",
  concede: "explicitly accepting a point (full or partial)",
  narrow: "limiting the scope of a claim — yours or theirs",
  reframe: "changing the frame or lens of the conversation",
  redirect: "shifting to a different question, side-stepping a direct challenge",
  anecdote: "supporting with a specific story or example",
  data: "supporting with a number, metric, or external reference",
  escalate: "raising stakes, urgency, or implication severity",
  none: "no clear rhetorical move",
};
