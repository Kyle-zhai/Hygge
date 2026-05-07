import { describe, it, expect } from "vitest";
import { routeMechanisms } from "../../src/lib/route-mechanisms.js";
import type {
  RoutingExtract,
  ExtractedField,
  Timeline,
  Reversibility,
  Stakes,
} from "../../src/types/decision.js";

function f<T>(value: T, confidence = 0.9): ExtractedField<T> {
  return { value, confidence, source_quote: null, was_asked: false };
}

function buildExtract(opts: {
  timeline?: Timeline;
  reversibility?: Reversibility;
  stakes?: Stakes;
  stakeholders?: string[];
}): RoutingExtract {
  return {
    decision_type: f("tradeoff"),
    primary_dimensions: f(["business"]),
    timeline: f<Timeline>(opts.timeline ?? "weeks"),
    reversibility: f<Reversibility>(opts.reversibility ?? "two_way_door"),
    stakes: f<Stakes>(opts.stakes ?? "medium"),
    stakeholders: f(opts.stakeholders ?? []),
    persona_hints: f([]),
    alternatives: f([]),
    constraints: f([]),
  };
}

describe("routeMechanisms", () => {
  it("always includes the baseline triad", () => {
    const route = routeMechanisms(buildExtract({ timeline: "weeks" }));
    const kinds = route.mechanisms.map((m) => m.kind);
    expect(kinds).toContain("persona_review");
    expect(kinds).toContain("reflection_ranker");
    expect(kinds).toContain("round_table_debate");
  });

  it("adds scenario_simulation when timeline is months/years", () => {
    expect(
      routeMechanisms(buildExtract({ timeline: "months" })).mechanisms.map((m) => m.kind),
    ).toContain("scenario_simulation");
    expect(
      routeMechanisms(buildExtract({ timeline: "years" })).mechanisms.map((m) => m.kind),
    ).toContain("scenario_simulation");
  });

  it("adds scenario_simulation when stakes are high (even on short timeline)", () => {
    expect(
      routeMechanisms(buildExtract({ timeline: "weeks", stakes: "high" })).mechanisms.map(
        (m) => m.kind,
      ),
    ).toContain("scenario_simulation");
  });

  it("does not add scenario_simulation for low-stakes immediate decisions", () => {
    expect(
      routeMechanisms(
        buildExtract({ timeline: "immediate", stakes: "low" }),
      ).mechanisms.map((m) => m.kind),
    ).not.toContain("scenario_simulation");
  });

  it("adds theory_of_mind when stakeholders are named", () => {
    const route = routeMechanisms(
      buildExtract({ stakeholders: ["existing self-serve users"] }),
    );
    expect(route.mechanisms.map((m) => m.kind)).toContain("theory_of_mind");
    const tom = route.mechanisms.find((m) => m.kind === "theory_of_mind");
    expect(tom?.args.stakeholder_to_simulate).toBe("existing self-serve users");
  });

  it("adds cross_challenge when reversibility is one_way_door", () => {
    expect(
      routeMechanisms(
        buildExtract({ reversibility: "one_way_door" }),
      ).mechanisms.map((m) => m.kind),
    ).toContain("cross_challenge");
  });

  it("scenario_simulation horizon scales with timeline", () => {
    const months = routeMechanisms(buildExtract({ timeline: "months" }));
    expect(
      months.mechanisms.find((m) => m.kind === "scenario_simulation")?.args
        .time_horizon_months,
    ).toBe(6);

    const years = routeMechanisms(buildExtract({ timeline: "years" }));
    expect(
      years.mechanisms.find((m) => m.kind === "scenario_simulation")?.args
        .time_horizon_months,
    ).toBe(24);
  });
});
