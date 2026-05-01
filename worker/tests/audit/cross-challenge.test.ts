import { describe, expect, it } from "vitest";
import { __test__ } from "../../src/audit/cross-challenge.js";
import type {
  CrossChallengeInput,
  CrossChallengeLawRow,
  CrossChallengePersonaRow,
} from "../../src/audit/cross-challenge.js";
import type { PlannedTask } from "../../src/audit/planner.js";
import type {
  PersonaAnalysisResult,
  PersonaFinding,
} from "../../src/audit/persona-analyst.js";
import type { LLMAdapter } from "../../src/llm/adapter.js";

const {
  buildCounterQuery,
  buildChallengePairs,
  parseChallengeOutput,
  applyDemotion,
  topicFromClaim,
  MAX_CHALLENGES_PER_RUN,
  NO_DISSENT_TOKEN,
} = __test__;

const fakeLlm: LLMAdapter = {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  complete: async () => ({ text: "" }),
} as unknown as LLMAdapter;

function makeFinding(overrides: Partial<PersonaFinding> = {}): PersonaFinding {
  return {
    claim: "Section 5(a) prohibits unfair acts that injure consumers.",
    confidence: "settled",
    basis: "statute",
    citations: [],
    severity: 3,
    probability: 3,
    suggested_mitigation: null,
    ...overrides,
  };
}

function makeTask(overrides: Partial<PlannedTask> = {}): PlannedTask {
  return {
    id: "t1",
    question: "Does the system meet GOVERN-1.1 oversight?",
    law_id: "law_nist_ai_rmf",
    law_section: "GOVERN-1.1",
    target_personas: ["p1"],
    needs_challenge: true,
    rationale: "statutory interpretation",
    ...overrides,
  };
}

function makeLaw(overrides: Partial<CrossChallengeLawRow> = {}): CrossChallengeLawRow {
  return {
    id: "law_nist_ai_rmf",
    name_en: "NIST AI RMF 1.0",
    citation_format: "GOVERN-#.#",
    source_domains: ["nist.gov", "ai.gov"],
    ...overrides,
  };
}

function makePersona(overrides: Partial<CrossChallengePersonaRow> = {}): CrossChallengePersonaRow {
  return {
    id: "p1",
    display_name_en: "Compliance Partner",
    search_style: "citation-heavy",
    system_prompt: "You are a compliance partner.",
    ...overrides,
  };
}

function makeAnalysis(overrides: Partial<PersonaAnalysisResult> = {}): PersonaAnalysisResult {
  return {
    task_id: "t1",
    persona_id: "p1",
    findings: [makeFinding()],
    searchCacheIds: [],
    searchLastVerifiedAt: null,
    searchHadResults: true,
    ...overrides,
  };
}

describe("topicFromClaim", () => {
  it("returns first N words and strips trailing punctuation", () => {
    expect(topicFromClaim("AI systems must monitor human oversight, per GOVERN-1.1.", 6)).toBe(
      "AI systems must monitor human oversight",
    );
  });

  it("handles short claims", () => {
    expect(topicFromClaim("Short claim.", 12)).toBe("Short claim");
  });

  it("handles empty / whitespace", () => {
    expect(topicFromClaim("", 12)).toBe("");
    expect(topicFromClaim("   ", 12)).toBe("");
  });
});

describe("buildCounterQuery", () => {
  it("includes law name, section, topic, and counter-keywords", () => {
    const q = buildCounterQuery(makeLaw(), makeTask(), makeFinding());
    expect(q).toContain('"NIST AI RMF 1.0"');
    expect(q).toContain("GOVERN-1.1");
    expect(q).toContain("limitation OR distinguished OR contrary OR exception OR criticized");
  });

  it("does not include trailing punctuation in the topic phrase", () => {
    const q = buildCounterQuery(
      makeLaw(),
      makeTask(),
      makeFinding({ claim: "AI bias monitoring is required." }),
    );
    expect(q).not.toMatch(/AI bias monitoring is required\./);
    expect(q).toContain("AI bias monitoring is required");
  });
});

describe("parseChallengeOutput", () => {
  it("returns null dissent when input is null", () => {
    expect(parseChallengeOutput(null)).toEqual({ dissent: null, citations: [] });
  });

  it("returns null dissent when literal no_dissent_found", () => {
    expect(parseChallengeOutput({ dissent: NO_DISSENT_TOKEN })).toEqual({
      dissent: null,
      citations: [],
    });
  });

  it("treats no_dissent_found case-insensitively", () => {
    expect(parseChallengeOutput({ dissent: "NO_DISSENT_FOUND" })).toEqual({
      dissent: null,
      citations: [],
    });
  });

  it("returns trimmed dissent and sanitized citations otherwise", () => {
    const result = parseChallengeOutput({
      dissent: "  The cited rule was distinguished in Doe v. Foo.  ",
      citations: [
        { url: "https://example.gov/case", title: "Doe v. Foo", quote: "distinguished" },
        { url: "not-a-url", title: "bad", quote: "x" },
      ],
    });
    expect(result.dissent).toBe("The cited rule was distinguished in Doe v. Foo.");
    expect(result.citations).toHaveLength(1);
    expect(result.citations[0].url).toBe("https://example.gov/case");
  });

  it("returns null dissent on empty string", () => {
    expect(parseChallengeOutput({ dissent: "  " })).toEqual({ dissent: null, citations: [] });
  });
});

describe("buildChallengePairs", () => {
  function input(overrides: Partial<CrossChallengeInput> = {}): CrossChallengeInput {
    return {
      llm: fakeLlm,
      tasks: [makeTask()],
      analyses: [makeAnalysis()],
      lawById: new Map([["law_nist_ai_rmf", makeLaw()]]),
      personaById: new Map([["p1", makePersona()]]),
      decisionText: "An AI hiring tool decision.",
      replyLanguage: "en",
      ...overrides,
    };
  }

  it("filters out tasks where needs_challenge is false", () => {
    const pairs = buildChallengePairs(
      input({
        tasks: [makeTask({ needs_challenge: false })],
      }),
    );
    expect(pairs).toEqual([]);
  });

  it("skips analyses with zero findings", () => {
    const pairs = buildChallengePairs(
      input({
        analyses: [makeAnalysis({ findings: [] })],
      }),
    );
    expect(pairs).toEqual([]);
  });

  it("falls back to self-challenge when no peer persona worked on the task", () => {
    const pairs = buildChallengePairs(input());
    expect(pairs).toHaveLength(1);
    // Self-challenge: challenger and original are same persona (p1)
    expect(pairs[0].originalPersona.id).toBe("p1");
    expect(pairs[0].challengerPersona.id).toBe("p1");
  });

  it("picks a peer persona as challenger when one exists", () => {
    const pairs = buildChallengePairs(
      input({
        analyses: [
          makeAnalysis({ persona_id: "p1" }),
          makeAnalysis({ persona_id: "p2" }),
        ],
        personaById: new Map([
          ["p1", makePersona()],
          ["p2", makePersona({ id: "p2", display_name_en: "ML Safety Expert" })],
        ]),
      }),
    );
    expect(pairs).toHaveLength(2);
    // Each persona gets a peer challenger.
    const p1Pair = pairs.find((p) => p.originalPersona.id === "p1")!;
    expect(p1Pair.challengerPersona.id).toBe("p2");
    const p2Pair = pairs.find((p) => p.originalPersona.id === "p2")!;
    expect(p2Pair.challengerPersona.id).toBe("p1");
  });

  it("caps total pairs at MAX_CHALLENGES_PER_RUN", () => {
    const tasks: PlannedTask[] = [];
    const analyses: PersonaAnalysisResult[] = [];
    // Create 20 tasks, each with one analysis. needs_challenge=true on all.
    for (let i = 0; i < 20; i++) {
      tasks.push(makeTask({ id: `t${i + 1}` }));
      analyses.push(makeAnalysis({ task_id: `t${i + 1}` }));
    }
    const pairs = buildChallengePairs(input({ tasks, analyses }));
    expect(pairs).toHaveLength(MAX_CHALLENGES_PER_RUN);
  });

  it("returns empty when law is missing from lawById", () => {
    const pairs = buildChallengePairs(
      input({
        lawById: new Map(),
      }),
    );
    expect(pairs).toEqual([]);
  });
});

describe("applyDemotion", () => {
  it("is a no-op when dissentByKey is empty", () => {
    const analyses = [makeAnalysis()];
    const out = applyDemotion(analyses, new Map());
    expect(out).toBe(analyses);
  });

  it("demotes settled findings to unsettled when dissent exists for that pair", () => {
    const analyses = [
      makeAnalysis({
        findings: [
          makeFinding({ confidence: "settled" }),
          makeFinding({ confidence: "speculative", claim: "Other claim" }),
        ],
      }),
    ];
    const dissent = new Map([["t1::p1", "There is a counter-authority."]]);
    const out = applyDemotion(analyses, dissent);
    expect(out[0].findings[0].confidence).toBe("unsettled");
    expect(out[0].findings[1].confidence).toBe("speculative");
  });

  it("does not touch analyses without dissent", () => {
    const analyses = [
      makeAnalysis({ task_id: "t1", persona_id: "p1" }),
      makeAnalysis({ task_id: "t2", persona_id: "p2" }),
    ];
    const dissent = new Map([["t1::p1", "dissent"]]);
    const out = applyDemotion(analyses, dissent);
    expect(out[0].findings[0].confidence).toBe("unsettled");
    expect(out[1].findings[0].confidence).toBe("settled");
  });

  it("returns the same analysis reference when no findings need demotion", () => {
    const analyses = [
      makeAnalysis({
        findings: [makeFinding({ confidence: "speculative" })],
      }),
    ];
    const dissent = new Map([["t1::p1", "dissent"]]);
    const out = applyDemotion(analyses, dissent);
    // No mutation needed because finding wasn't settled to begin with.
    expect(out[0]).toBe(analyses[0]);
  });
});
