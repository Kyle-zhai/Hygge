import { describe, expect, it } from "vitest";
import { __test__ } from "../../src/audit/planner.js";

const { sanitizeTasks } = __test__;

const validLaws = new Set(["law_nist_ai_rmf", "law_iso_42001"]);
const validPersonas = new Set(["p1", "p2", "p3"]);

describe("sanitizeTasks", () => {
  it("returns [] when raw is not an array", () => {
    expect(sanitizeTasks(null, validLaws, validPersonas, 12)).toEqual([]);
    expect(sanitizeTasks({}, validLaws, validPersonas, 12)).toEqual([]);
    expect(sanitizeTasks("[]", validLaws, validPersonas, 12)).toEqual([]);
  });

  it("drops tasks with invalid law_id", () => {
    const out = sanitizeTasks(
      [
        {
          id: "t1",
          question: "q",
          law_id: "law_made_up",
          law_section: "1.1",
          target_personas: ["p1"],
        },
      ],
      validLaws,
      validPersonas,
      12,
    );
    expect(out).toEqual([]);
  });

  it("drops tasks with empty question", () => {
    const out = sanitizeTasks(
      [
        {
          id: "t1",
          question: "  ",
          law_id: "law_nist_ai_rmf",
          law_section: "1.1",
          target_personas: ["p1"],
        },
      ],
      validLaws,
      validPersonas,
      12,
    );
    expect(out).toEqual([]);
  });

  it("drops tasks with empty law_section", () => {
    const out = sanitizeTasks(
      [
        {
          id: "t1",
          question: "q",
          law_id: "law_nist_ai_rmf",
          law_section: "",
          target_personas: ["p1"],
        },
      ],
      validLaws,
      validPersonas,
      12,
    );
    expect(out).toEqual([]);
  });

  it("drops invented persona_ids and keeps only valid ones", () => {
    const out = sanitizeTasks(
      [
        {
          id: "t1",
          question: "q",
          law_id: "law_nist_ai_rmf",
          law_section: "GOVERN-1.1",
          target_personas: ["p1", "ghost", "p2"],
        },
      ],
      validLaws,
      validPersonas,
      12,
    );
    expect(out).toHaveLength(1);
    expect(out[0].target_personas).toEqual(["p1", "p2"]);
  });

  it("drops tasks where no valid personas remain after filtering", () => {
    const out = sanitizeTasks(
      [
        {
          id: "t1",
          question: "q",
          law_id: "law_nist_ai_rmf",
          law_section: "1.1",
          target_personas: ["ghost1", "ghost2"],
        },
      ],
      validLaws,
      validPersonas,
      12,
    );
    expect(out).toEqual([]);
  });

  it("defaults needs_challenge to false unless === true", () => {
    const out = sanitizeTasks(
      [
        {
          id: "t1",
          question: "q",
          law_id: "law_nist_ai_rmf",
          law_section: "1.1",
          target_personas: ["p1"],
          needs_challenge: "yes",
        },
      ],
      validLaws,
      validPersonas,
      12,
    );
    expect(out[0].needs_challenge).toBe(false);
  });

  it("preserves needs_challenge when explicitly true", () => {
    const out = sanitizeTasks(
      [
        {
          id: "t1",
          question: "q",
          law_id: "law_nist_ai_rmf",
          law_section: "1.1",
          target_personas: ["p1"],
          needs_challenge: true,
        },
      ],
      validLaws,
      validPersonas,
      12,
    );
    expect(out[0].needs_challenge).toBe(true);
  });

  it("re-issues duplicate ids using positional t<n>", () => {
    const out = sanitizeTasks(
      [
        {
          id: "dup",
          question: "q1",
          law_id: "law_nist_ai_rmf",
          law_section: "A",
          target_personas: ["p1"],
        },
        {
          id: "dup",
          question: "q2",
          law_id: "law_nist_ai_rmf",
          law_section: "B",
          target_personas: ["p1"],
        },
      ],
      validLaws,
      validPersonas,
      12,
    );
    expect(out[0].id).toBe("dup");
    expect(out[1].id).toBe("t2");
  });

  it("respects maxTasks", () => {
    const raw = Array.from({ length: 30 }, (_, i) => ({
      id: `t${i}`,
      question: `q${i}`,
      law_id: "law_nist_ai_rmf",
      law_section: `S${i}`,
      target_personas: ["p1"],
    }));
    const out = sanitizeTasks(raw, validLaws, validPersonas, 6);
    expect(out).toHaveLength(6);
  });

  it("caps target_personas to 5", () => {
    const out = sanitizeTasks(
      [
        {
          id: "t1",
          question: "q",
          law_id: "law_nist_ai_rmf",
          law_section: "1.1",
          target_personas: ["p1", "p2", "p3", "p1", "p2", "p3", "p1"],
        },
      ],
      validLaws,
      new Set(["p1", "p2", "p3"]),
      12,
    );
    expect(out[0].target_personas.length).toBeLessThanOrEqual(5);
  });
});
