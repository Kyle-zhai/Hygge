// Decides which mechanisms (and configurations) to run based on the
// finalized routing_extract. Pure function, no LLM, no DB — used both by
// Intake (when sealing the Brief) and by the API "rerun" path (when the
// user adjusts conditions).

import {
  ALL_MECHANISMS,
  DEFAULT_MECHANISMS,
  type MechanismConfig,
  type MechanismKind,
  type RoutingExtract,
} from "../types/decision.js";

export interface RouteResult {
  mechanisms: MechanismConfig[];
  reasoning: string;
}

export function routeMechanisms(extract: RoutingExtract): RouteResult {
  const reasons: string[] = [];
  const selected = new Set<MechanismKind>();

  // Always include the baseline triad — these are cheap and broadly useful.
  for (const m of DEFAULT_MECHANISMS) selected.add(m);
  reasons.push("baseline: persona_review + reflection_ranker + round_table_debate");

  // scenario_simulation kicks in when timeline is months/years OR stakes are high.
  const timeline = extract.timeline.value;
  const stakes = extract.stakes.value;
  if (timeline === "months" || timeline === "years" || stakes === "high") {
    selected.add("scenario_simulation");
    reasons.push(
      `scenario_simulation: timeline=${timeline}, stakes=${stakes}`,
    );
  }

  // theory_of_mind kicks in when stakeholders are named explicitly.
  if (extract.stakeholders.value.length > 0) {
    selected.add("theory_of_mind");
    reasons.push(
      `theory_of_mind: ${extract.stakeholders.value.length} stakeholder(s) named`,
    );
  }

  // cross_challenge kicks in when reversibility is one_way_door OR stakes high.
  if (extract.reversibility.value === "one_way_door" || stakes === "high") {
    selected.add("cross_challenge");
    reasons.push(
      `cross_challenge: reversibility=${extract.reversibility.value}, stakes=${stakes}`,
    );
  }

  // Build configs in canonical mechanism order.
  const mechanisms: MechanismConfig[] = ALL_MECHANISMS.filter((k) => selected.has(k)).map(
    (kind) => ({
      kind,
      args: argsForKind(kind, extract),
    }),
  );

  return { mechanisms, reasoning: reasons.join("; ") };
}

function argsForKind(kind: MechanismKind, extract: RoutingExtract) {
  const out: MechanismConfig["args"] = {};
  if (kind === "scenario_simulation") {
    out.time_horizon_months =
      extract.timeline.value === "years" ? 24
        : extract.timeline.value === "months" ? 6
        : 3;
  }
  if (kind === "theory_of_mind") {
    out.stakeholder_to_simulate = extract.stakeholders.value[0] ?? "primary user";
  }
  if (kind === "round_table_debate") {
    out.debate_rounds = 2;
  }
  return out;
}
