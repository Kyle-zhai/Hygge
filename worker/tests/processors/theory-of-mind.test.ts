import { describe, expect, it } from "vitest";
import {
  parseToMEntries,
  buildPriorToMBlock,
  buildToMSchemaField,
} from "../../src/processors/theory-of-mind.js";
import {
  type ToMState,
  TOM_BELIEF_MAX_CHARS,
  TOM_ASSUMPTION_MAX_CHARS,
} from "../../src/types/theory-of-mind.js";

const VALID_IDS = new Set(["p1", "p2", "p3"]);

describe("parseToMEntries", () => {
  it("returns empty array for non-array input", () => {
    expect(parseToMEntries(null, VALID_IDS)).toEqual([]);
    expect(parseToMEntries({}, VALID_IDS)).toEqual([]);
    expect(parseToMEntries("string", VALID_IDS)).toEqual([]);
  });

  it("parses well-formed entries", () => {
    const raw = [
      {
        about: "p2",
        i_think_they_believe: "they want feature X shipped",
        their_unstated_assumption: "assumes engineers have spare cycles",
        my_confidence_in_this_read: 0.8,
      },
    ];
    const out = parseToMEntries(raw, VALID_IDS);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      about_persona_id: "p2",
      i_think_they_believe: "they want feature X shipped",
      their_unstated_assumption: "assumes engineers have spare cycles",
      my_confidence_in_this_read: 0.8,
    });
  });

  it("accepts about_persona_id alias when about is missing", () => {
    const raw = [
      {
        about_persona_id: "p2",
        i_think_they_believe: "x",
        their_unstated_assumption: "y",
        my_confidence_in_this_read: 0.5,
      },
    ];
    const out = parseToMEntries(raw, VALID_IDS);
    expect(out).toHaveLength(1);
    expect(out[0].about_persona_id).toBe("p2");
  });

  it("drops entries with unknown about persona", () => {
    const raw = [
      { about: "p99", i_think_they_believe: "x", their_unstated_assumption: "y", my_confidence_in_this_read: 0.5 },
    ];
    expect(parseToMEntries(raw, VALID_IDS)).toEqual([]);
  });

  it("drops entries where both belief and assumption are empty", () => {
    const raw = [
      { about: "p2", i_think_they_believe: "  ", their_unstated_assumption: "", my_confidence_in_this_read: 0.7 },
    ];
    expect(parseToMEntries(raw, VALID_IDS)).toEqual([]);
  });

  it("keeps entry when only one of belief/assumption is provided", () => {
    const raw = [
      { about: "p2", i_think_they_believe: "they think X", their_unstated_assumption: "", my_confidence_in_this_read: 0.6 },
    ];
    const out = parseToMEntries(raw, VALID_IDS);
    expect(out).toHaveLength(1);
    expect(out[0].i_think_they_believe).toBe("they think X");
    expect(out[0].their_unstated_assumption).toBe("");
  });

  it("truncates fields exceeding max chars", () => {
    const longBelief = "b".repeat(TOM_BELIEF_MAX_CHARS + 50);
    const longAssumption = "a".repeat(TOM_ASSUMPTION_MAX_CHARS + 50);
    const raw = [
      {
        about: "p2",
        i_think_they_believe: longBelief,
        their_unstated_assumption: longAssumption,
        my_confidence_in_this_read: 0.5,
      },
    ];
    const out = parseToMEntries(raw, VALID_IDS);
    expect(out[0].i_think_they_believe).toHaveLength(TOM_BELIEF_MAX_CHARS);
    expect(out[0].their_unstated_assumption).toHaveLength(TOM_ASSUMPTION_MAX_CHARS);
  });

  it("clamps confidence to [0,1]", () => {
    const raw = [
      { about: "p2", i_think_they_believe: "x", their_unstated_assumption: "y", my_confidence_in_this_read: 5 },
      { about: "p3", i_think_they_believe: "x", their_unstated_assumption: "y", my_confidence_in_this_read: -2 },
    ];
    const out = parseToMEntries(raw, VALID_IDS);
    expect(out[0].my_confidence_in_this_read).toBe(1);
    expect(out[1].my_confidence_in_this_read).toBe(0);
  });

  it("defaults invalid confidence to 0.5", () => {
    const raw = [
      { about: "p2", i_think_they_believe: "x", their_unstated_assumption: "y", my_confidence_in_this_read: "high" },
      { about: "p3", i_think_they_believe: "x", their_unstated_assumption: "y" },
    ];
    const out = parseToMEntries(raw, VALID_IDS);
    expect(out[0].my_confidence_in_this_read).toBe(0.5);
    expect(out[1].my_confidence_in_this_read).toBe(0.5);
  });
});

describe("buildPriorToMBlock", () => {
  const personaName = (id: string): string => ({ p1: "Alice", p2: "Bob", p3: "Carol" })[id] ?? id;

  it("returns empty string when no prior state", () => {
    expect(buildPriorToMBlock("p1", undefined, personaName, undefined)).toBe("");
  });

  it("returns empty string when prior state has no entries", () => {
    const state: ToMState = {
      evaluation_id: "e1",
      observer_persona_id: "p1",
      round_number: 1,
      entries: [],
    };
    expect(buildPriorToMBlock("p1", state, personaName, undefined)).toBe("");
  });

  it("formats belief and assumption with target name and confidence percent", () => {
    const state: ToMState = {
      evaluation_id: "e1",
      observer_persona_id: "p1",
      round_number: 1,
      entries: [
        {
          about_persona_id: "p2",
          i_think_they_believe: "ship now",
          their_unstated_assumption: "engineers have spare cycles",
          my_confidence_in_this_read: 0.75,
        },
      ],
    };
    const out = buildPriorToMBlock("p1", state, personaName, undefined);
    expect(out).toContain("Alice");
    expect(out).toContain("Bob");
    expect(out).toContain('believes: "ship now"');
    expect(out).toContain('unstated assumption: "engineers have spare cycles"');
    expect(out).toContain("75%");
  });

  it("appends actual position when provided", () => {
    const state: ToMState = {
      evaluation_id: "e1",
      observer_persona_id: "p1",
      round_number: 1,
      entries: [
        {
          about_persona_id: "p2",
          i_think_they_believe: "they oppose",
          their_unstated_assumption: "",
          my_confidence_in_this_read: 0.5,
        },
      ],
    };
    const positions = new Map([["p2", -0.7]]);
    const out = buildPriorToMBlock("p1", state, personaName, positions);
    expect(out).toContain("-0.70");
    expect(out).toContain("opposition");
  });

  it("classifies actual position as support / neutral / opposition by threshold", () => {
    const state: ToMState = {
      evaluation_id: "e1",
      observer_persona_id: "p1",
      round_number: 1,
      entries: [
        { about_persona_id: "p2", i_think_they_believe: "x", their_unstated_assumption: "", my_confidence_in_this_read: 0.5 },
        { about_persona_id: "p3", i_think_they_believe: "x", their_unstated_assumption: "", my_confidence_in_this_read: 0.5 },
      ],
    };
    const positions = new Map([
      ["p2", 0.5],
      ["p3", 0.0],
    ]);
    const out = buildPriorToMBlock("p1", state, personaName, positions);
    expect(out).toContain("support");
    expect(out).toContain("neutral");
  });

  it("includes the gap-naming directive", () => {
    const state: ToMState = {
      evaluation_id: "e1",
      observer_persona_id: "p1",
      round_number: 1,
      entries: [
        { about_persona_id: "p2", i_think_they_believe: "x", their_unstated_assumption: "", my_confidence_in_this_read: 0.5 },
      ],
    };
    const out = buildPriorToMBlock("p1", state, personaName, undefined);
    expect(out).toContain("If your prior read was wrong");
  });
});

describe("buildToMSchemaField", () => {
  it("returns empty string when no other personas", () => {
    expect(buildToMSchemaField([])).toBe("");
  });

  it("includes the persona ids in the schema hint", () => {
    const out = buildToMSchemaField(["p2", "p3"]);
    expect(out).toContain("theory_of_mind");
    expect(out).toContain("p2, p3");
    expect(out).toContain("about");
    expect(out).toContain("i_think_they_believe");
    expect(out).toContain("their_unstated_assumption");
    expect(out).toContain("my_confidence_in_this_read");
  });
});
