import "dotenv/config";
import { buildLLM } from "../src/llm/factory.js";
import { parseProject } from "../src/processors/parse-project.js";
import { classifyTopic } from "../src/processors/classify-topic.js";
import { generatePersonaReview, type PersonaReviewResult } from "../src/processors/persona-review.js";
import type { LLMAdapter } from "../src/llm/adapter.js";
import type { Persona } from "../src/types/persona.js";
import type { ProjectParsedData, TopicClassification } from "../src/types/evaluation.js";
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

interface TestCase {
  id: string;
  mode: "topic" | "product";
  category: string;
  raw: string;
}

const CASES: TestCase[] = [
  {
    id: "T1-decision",
    mode: "topic",
    category: "personal-decision",
    raw: `Should I leave my $240K Senior SWE role at Google to co-found an AI infrastructure startup? I've been at Google 6 years. Co-founder role: CTO, $120K salary + 8% equity. Three founding eng I trust have committed. We have a $500K friends-and-family round lined up. My partner is supportive but worried about childcare for our 2-year-old. Our mortgage is $3,800/month. We have 6 months personal runway.`,
  },
  {
    id: "T2-policy",
    mode: "topic",
    category: "company-policy",
    raw: `Our 350-person e-commerce company is considering mandatory 4-day in-office starting June 2026. Currently fully remote. Internal survey: 68% oppose. Engineering leadership claims velocity dropped 15% post-2020. CFO says SF office costs $2.1M/year at 22% occupancy. Board wants decision by May 1, 2026.`,
  },
  {
    id: "T3-idea",
    mode: "topic",
    category: "civic-idea",
    raw: `What if Seattle made Metro buses completely free by 2028? Current budget: $42M/year from fares. Vancouver BC experimented with fare-free on 4 routes in 2023 — ridership up 27% but maintenance costs up 8%. Portland spends $0.38/rider on fare enforcement. Concerns: homeless encampments, off-peak crowding, funding gap.`,
  },
  {
    id: "T4-creative",
    mode: "topic",
    category: "creative-concept",
    raw: `Short film concept: A barista in 2032 Tokyo discovers her espresso machine is a retired spy gadget. It leaks classified memories of its former CIA handler. She has 72 hours to decide: turn it in for a $50K reward, or help the machine find its former partner (now in witness protection). Target: 18-min short, $40K budget, shoot on Sony A7S III. Lead actor budget: $8K. Festival target: Sundance 2027 shorts.`,
  },
  {
    id: "T5-strategy",
    mode: "topic",
    category: "market-strategy",
    raw: `Our D2C skincare brand Lumera ($8M ARR, 40% YoY growth, profitable) is expanding into India Q3 2026. Current markets: US, UK, Australia. India plan: partner with Nykaa (commission 22%), launch 6 SKUs at ₹1,400-2,800 (vs our US $24-48), target Tier-1 cities first. Competitors: Minimalist ($120M ARR), Plum ($60M ARR). COGS will increase 18% due to import duties.`,
  },
  {
    id: "P1-saas",
    mode: "product",
    category: "saas",
    raw: `MeetScribe: AI meeting transcription built for M&A lawyers at 30-150-attorney firms. $89/user/mo, privileged-mode never stores transcripts outside the firm's Azure tenant. Competitors: Otter.ai ($20), Fireflies ($19). Our wedge: SOC 2 Type II + ABA Formal Opinion 498 compliance, Bates numbering, auto-redaction of PII. 12 beta firms signed 6-month LOIs. Target: 500 paying seats by month 9.`,
  },
  {
    id: "P2-hardware",
    mode: "product",
    category: "consumer-hardware",
    raw: `SproutPot: smart garden pot with auto-watering, soil sensors, iOS/Android app. $149 MSRP, BOM $38, Shenzhen manufacturing (MOQ 2,000 units). Targeting urban millennials with limited outdoor space. Competitors: Click & Grow ($199), AeroGarden ($149). Differentiation: works with any plant (not just pods), 90-day dry-spell battery. Launch: Kickstarter April 2026, $75K goal, ship December 2026.`,
  },
  {
    id: "P3-mobile-app",
    mode: "product",
    category: "mobile-app",
    raw: `Blink — 30-second video journaling app. Free: 7-day history, 1 prompt/day. Pro: $4.99/mo for unlimited history + AI prompts + mood analytics. Target: Gen Z women 18-28 who've dropped Instagram. Hook: zero social features, zero followers, zero likes. Acquisition: 50 TikTok micro-influencers + App Store feature submission. Goal: 100K installs in 90 days.`,
  },
  {
    id: "P4-marketplace",
    mode: "product",
    category: "marketplace",
    raw: `SkillSwap: peer-to-peer tutoring for US undergrads. Trade hour-for-hour (1hr calculus for 1hr Spanish), no money. Take-rate: $0, ad-supported. Launch: Berkeley + UCLA, fall 2026. Beta: 180 active users, 42% week-2 retention. Competitors: Wyzant ($35-80/hr paid), TutorMe (bundled with schools). Risks: 18% no-show rate, matching sparseness in low-demand subjects like classical Greek.`,
  },
  {
    id: "P5-b2c",
    mode: "product",
    category: "b2c-consumer",
    raw: `Voltra E-bikes: $1,800 Class-2 e-bike for urban millennials wanting a car replacement for sub-5-mile commutes. DTC only, 30-day trial. BOM: $620, assembled in Taiwan. Competitors: Rad Power ($1,499), Aventon ($1,599), Lectric ($999). Differentiation: 80 Nm torque (vs competitors' 55-60 Nm), 8-year battery warranty (vs 2-year industry standard). Preorder Feb 2026, delivery June 2026. Break-even at 2,400 units/year.`,
  },
];

function makePersona(): Persona {
  return {
    id: "test-maya",
    identity: {
      name: "Maya Chen",
      avatar: "",
      tagline: "Pragmatic product lead, 10yr operator, shipped at 3 YC startups",
      locale_variants: { zh: { name: "Maya", tagline: "" }, en: { name: "Maya Chen", tagline: "" } },
    },
    demographics: {
      age: 32, gender: "F", location: "San Francisco, CA",
      education: "BS CS, Stanford", occupation: "Product Lead", income_level: "high",
    },
    social_context: {
      family: { status: "partnered", background: "tech", financial_support: false, pressure: "moderate" },
      social_circle: {
        primary: "YC alumni, indie hackers",
        influencers: ["Lenny Rachitsky", "Jason Cohen"],
        trust_sources: ["peer founders", "specific numbers", "first-principles reasoning"],
      },
      relationships_with_products: { adoption_path: "tries peer tools", referral_tendency: "high", community_influence: "high" },
    },
    financial_profile: {
      wealth_level: "comfortable", spending_on_tools: "$500/mo personal",
      price_sensitivity: "medium", payment_preference: "annual", free_trial_behavior: "decides by day 7",
    },
    psychology: {
      personality_type: "analytical builder",
      decision_making: {
        style: "data-driven with strong opinions",
        persuadability: 5,
        triggers: ["specific numbers", "clear wedge"],
        resistances: ["vague value props", "platitudes"],
      },
      cognitive_biases: ["recency bias"],
      emotional_state: { baseline: "focused", stress_factors: ["shipping deadlines"], motivation: "ship things that compound" },
      risk_tolerance: 7, patience_level: 4,
    },
    behaviors: {
      daily_habits: ["reads Indie Hackers", "codes 4hrs before meetings"],
      product_evaluation: {
        first_impression_weight: 8, tries_before_judging: 2,
        deal_breakers: ["no activation in 10 min"], delighters: ["clear wedge"],
      },
    },
    evaluation_lens: {
      primary_question: "Is the thesis sharp enough to beat incumbents?",
      scoring_weights: { usability: 0.2, market_fit: 0.25, design: 0.1, tech_quality: 0.1, innovation: 0.15, pricing: 0.2 },
      known_biases: ["favors opinionated UX"],
      blind_spots: ["undervalues enterprise compliance"],
    },
    life_narrative: {
      origin_story: "SF-based product lead, 10yr operator",
      turning_points: ["first PM role", "Linear launch"],
      current_chapter: "2 years from founding again",
      imagined_future: "run a $10M ARR bootstrapped SaaS",
      core_fear: "shipping a 'me-too' product",
    },
    internal_conflicts: [],
    contextual_behaviors: {
      when_impressed: "DMs founder friends", when_skeptical: "reads pricing/competitor pages",
      when_confused: "assumes product is confused, leaves", when_bored: "closes tab in 40 sec",
      first_10_seconds: "scans for wedge", price_page_reaction: "compares to Linear and Notion tiers",
    },
    latent_needs: {
      stated_need: "ship faster", actual_need: "evidence next startup will work",
      emotional_need: "peer validation", unaware_need: "pick a narrow wedge",
    },
    system_prompt: `You are Maya Chen, 32, pragmatic product lead. Sharp, blunt, allergic to platitudes. Trust peer founders and first-principles reasoning. Use specific numbers.`,
    created_at: new Date().toISOString(),
  };
}

interface CaseResult {
  id: string;
  mode: "topic" | "product";
  category: string;
  raw: string;
  parsed?: ProjectParsedData;
  classification?: TopicClassification;
  review?: PersonaReviewResult;
  error?: string;
  durationMs?: number;
}

async function runCase(llm: LLMAdapter, persona: Persona, tc: TestCase): Promise<CaseResult> {
  const start = Date.now();
  try {
    const [parsed, classification] = await Promise.all([
      parseProject(llm, tc.raw),
      classifyTopic(llm, tc.raw),
    ]);
    const review = await generatePersonaReview(llm, persona, parsed, tc.raw, classification.dimensions, tc.mode);
    return {
      id: tc.id, mode: tc.mode, category: tc.category, raw: tc.raw,
      parsed, classification, review, durationMs: Date.now() - start,
    };
  } catch (err) {
    return {
      id: tc.id, mode: tc.mode, category: tc.category, raw: tc.raw,
      error: err instanceof Error ? err.message : String(err), durationMs: Date.now() - start,
    };
  }
}

function tokenize(s: string): Set<string> {
  return new Set(s.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 4));
}

function analyzeOne(r: CaseResult) {
  if (r.error) {
    return { id: r.id, mode: r.mode, category: r.category, error: r.error, checks: [], issues: [`FAILED: ${r.error}`], snippets: {} };
  }

  const review = r.review ?? {};
  const rt: string = review.review_text ?? "";
  const lower = rt.toLowerCase();
  const rawLower = r.raw.toLowerCase();

  // Only mask apostrophes inside contractions (letter-letter) so they don't split phrases.
  // Possessive apostrophes (letter-then-space) are left alone — they're ambiguous with closing quotes.
  const maskContractions = (s: string) => s.replace(/([A-Za-z])'(?=[A-Za-z])/g, "$1\u0001");
  const rtMasked = maskContractions(rt);
  const rawMasked = maskContractions(r.raw).toLowerCase();

  const trivialConnectors = new Set(["and", "or", "the", "an", "a", "is", "in", "of", "to", "for", "with", "but", "as", "at", "on", "by", "from"]);
  const isConnectorOnly = (s: string) => {
    const words = s.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return words.length > 0 && words.every((w) => trivialConnectors.has(w));
  };
  // Snake-case identifiers (dimension keys like "financial_risk") are quoted for reference,
  // not claimed as verbatim user text. Skip them.
  const isIdentifier = (s: string) => /^[a-z][a-z0-9_]*$/.test(s.trim());
  const keepQuote = (q: string) => !isConnectorOnly(q) && !isIdentifier(q);

  const doubleQuoted = [...rtMasked.matchAll(/"([^"\n]{3,120})"/g)].map((m) => m[1]).filter(keepQuote);
  const singleQuoted = [...rtMasked.matchAll(/(?<![A-Za-z])'([^'\n]{3,120})'(?![A-Za-z])/g)].map((m) => m[1]).filter(keepQuote);
  const quoteCount = doubleQuoted.length + singleQuoted.length;
  const numberMatches = rt.match(/\$[\d.,]+[KMB]?|[\d.]+%|\d+x|\d+\/\d+|[\d]{2,}/g) ?? [];
  const bannedPhrases = [
    "has potential", "could be better", "interesting idea", "well thought out",
    "needs more work", "solid foundation", "great start", "overall good",
    "generally positive", "compelling vision", "thoughtful approach", "has merit",
    "a decent chance", "reasonable idea", "promising direction",
  ];
  const bannedHits = bannedPhrases.filter((p) => lower.includes(p));

  const citedRefs: Array<{ claim: string; source?: string }> = Array.isArray(review.cited_references) ? review.cited_references : [];
  const citedCount = citedRefs.length;

  const allQuoted = [...doubleQuoted, ...singleQuoted];
  const rawNorm = rawMasked.replace(/\s+/g, " ");
  const normalizeQuote = (q: string) =>
    q.toLowerCase().replace(/\s+/g, " ").replace(/^[\s.,;:!?"'()[\]{}—–-]+|[\s.,;:!?"'()[\]{}—–-]+$/g, "").trim();
  const fabricatedQuotes = allQuoted.filter((q) => {
    const qNorm = normalizeQuote(q);
    return qNorm.length >= 3 && !rawNorm.includes(qNorm);
  });

  // Source-type constraint: all cited_references sources must be one of the approved enums.
  const allowedSources = new Set(["user_submission", "persona_experience", "common_knowledge"]);
  const offendingSources: string[] = [];
  for (const ref of citedRefs) {
    const src = (ref.source ?? "").toLowerCase();
    const isAllowed = [...allowedSources].some((a) => src === a || src.startsWith(a));
    if (!isAllowed) offendingSources.push(ref.source ?? "(empty)");
  }

  // Third-party firm names commonly hallucinated — a secondary guard
  const fakeFirmHits: string[] = [];
  const fakeFirms = ["gartner", "mckinsey", "forrester", "statista", "cb insights", "pew research", "deloitte", "localytics", "idc", "techcrunch", "national gardening association"];
  for (const firm of fakeFirms) {
    if (lower.includes(firm)) fakeFirmHits.push(firm);
    for (const ref of citedRefs) {
      if ((ref.source ?? "").toLowerCase().includes(firm) || (ref.claim ?? "").toLowerCase().includes(firm)) {
        fakeFirmHits.push(`${firm}(in-ref)`);
      }
    }
  }

  const dims = r.classification?.dimensions ?? [];
  const rawTokens = tokenize(r.raw);
  const dimsGeneric: string[] = [];
  for (const d of dims) {
    const desc: string = d.description ?? "";
    const hasNumber = /[\d$%]/.test(desc);
    const descTokens = Array.from(tokenize(desc));
    const overlaps = descTokens.filter((w) => rawTokens.has(w)).length;
    if (!hasNumber && overlaps < 2) {
      dimsGeneric.push(d.key);
    }
  }

  const ghostCitations: string[] = [];
  const stripPunct = (s: string) => s.replace(/^[\s.,;:!?"'()[\]{}—–-]+|[\s.,;:!?"'()[\]{}—–-]+$/g, "");
  // Words / symbols signaling the claim is an arithmetic derivation combining verbatim values
  // rather than a pure echo. These are legitimate and should not be flagged as ghost citations.
  const DERIVATION_MARKERS = /=|≈|×|÷|\bequals?\b|\bapprox(?:imately)?\b|\b~\s*\d|\brepresents?\b|\btranslates? to\b|\byields?\b|\bcalculate[sd]?\b|\bpremium\b|\bdiscount\b|\bcut\b|\blarger\b|\bsmaller\b|\bcheaper\b|\bmore expensive\b|\b\d+(?:\.\d+)?x\b|\b\d+(?:\.\d+)?%\s+(?:of|over|cheaper|premium|discount|cut|off|higher|lower|more|less)\b|\([^)]*\d[^)]*\b(?:annually|yearly|per year|monthly|per month|weekly|per week|daily|per day|hourly|per hour|total)\b[^)]*\)/i;
  for (const ref of citedRefs) {
    // Only user_submission claims must echo the raw text verbatim.
    // persona_experience / common_knowledge may legitimately introduce external numbers.
    const src = (ref.source ?? "").toLowerCase();
    if (!src.startsWith("user_submission")) continue;
    const claim = ref.claim ?? "";
    if (DERIVATION_MARKERS.test(claim)) continue;
    const numericClaim = claim.match(/\$\d[\d,]*(?:\.\d+)?[kmb]?|\d+(?:\.\d+)?%|\d+x|\d+\/\d+|\b\d{2,}\b/gi);
    if (!numericClaim) continue;
    const cleaned = numericClaim.map(stripPunct).filter((n) => n.length > 0);
    const anchors = cleaned.filter((n) => rawLower.includes(n.toLowerCase()));
    // Catch-all: ≥2 numerics from raw combined with 1+ derived → arithmetic. Skip.
    if (anchors.length >= 2) continue;
    for (const n of cleaned) {
      if (!rawLower.includes(n.toLowerCase())) {
        ghostCitations.push(`"${n}" in: ${claim.slice(0, 80)}`);
      }
    }
  }

  const strengthsCount = Array.isArray(review.strengths) ? review.strengths.length : 0;
  const weaknessesCount = Array.isArray(review.weaknesses) ? review.weaknesses.length : 0;

  const checks = [
    { label: "Verbatim quotes (≥3, either '' or \"\")", value: quoteCount, pass: quoteCount >= 3 },
    { label: "Specific numbers (≥3)", value: numberMatches.length, pass: numberMatches.length >= 3 },
    { label: "Cited references (≥2)", value: citedCount, pass: citedCount >= 2 },
    { label: "Strengths (≥3)", value: strengthsCount, pass: strengthsCount >= 3 },
    { label: "Weaknesses (≥3)", value: weaknessesCount, pass: weaknessesCount >= 3 },
    { label: "Banned phrases (=0)", value: bannedHits.join(", ") || "0", pass: bannedHits.length === 0 },
    { label: "Fabricated quotes (=0)", value: fabricatedQuotes.length, pass: fabricatedQuotes.length === 0 },
    { label: "Generic dimensions (=0)", value: dimsGeneric.length, pass: dimsGeneric.length === 0 },
    { label: "Ghost citations (=0)", value: ghostCitations.length, pass: ghostCitations.length === 0 },
    { label: "Offending ref sources (=0)", value: offendingSources.join(", ") || "0", pass: offendingSources.length === 0 },
    { label: "Fake-firm mentions (=0)", value: fakeFirmHits.join(", ") || "0", pass: fakeFirmHits.length === 0 },
  ];

  const issues: string[] = [];
  if (bannedHits.length) issues.push(`Banned: ${bannedHits.join(", ")}`);
  if (fabricatedQuotes.length) issues.push(`Fabricated quotes: ${fabricatedQuotes.slice(0, 2).map((q) => `"${q.slice(0, 60)}"`).join(" | ")}`);
  if (dimsGeneric.length) issues.push(`Generic dimensions: ${dimsGeneric.join(", ")}`);
  if (ghostCitations.length) issues.push(`Ghost citations: ${ghostCitations.slice(0, 2).join(" | ")}`);
  if (offendingSources.length) issues.push(`Bad ref.source values: ${offendingSources.slice(0, 3).join(" | ")}`);
  if (fakeFirmHits.length) issues.push(`Fake-firm mention: ${fakeFirmHits.join(", ")}`);

  return {
    id: r.id, mode: r.mode, category: r.category,
    checks, issues,
    snippets: {
      review_first_300: rt.slice(0, 300),
      dimensions: dims.map((d: { key: string; description: string }) => `${d.key}: ${d.description}`),
      cited: citedRefs.map((c) => `${c.claim} [${c.source ?? "?"}]`),
      bad_quotes: fabricatedQuotes.slice(0, 3),
    },
  };
}

async function main() {
  const llm = buildLLM();
  const persona = makePersona();

  console.log(`\nRunning ${CASES.length} cases in parallel (${CASES.filter((c) => c.mode === "topic").length} topic + ${CASES.filter((c) => c.mode === "product").length} product)...\n`);
  const start = Date.now();
  const results = await Promise.all(CASES.map((tc) => runCase(llm, persona, tc)));
  const elapsed = Math.round((Date.now() - start) / 1000);
  console.log(`Done in ${elapsed}s\n`);

  const analyses = results.map((r) => analyzeOne(r));

  const outDir = resolve(__dirname, "..", "test-output");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(resolve(outDir, "results.json"), JSON.stringify(results, null, 2));
  writeFileSync(resolve(outDir, "analysis.json"), JSON.stringify(analyses, null, 2));

  for (const a of analyses) {
    console.log("═".repeat(78));
    console.log(`[${a.id}] ${a.mode}/${a.category}`);
    console.log("─".repeat(78));
    const analysisError = (a as { error?: string }).error;
    if (analysisError) {
      console.log(`  ✗ ERRORED: ${analysisError}`);
      continue;
    }
    for (const c of a.checks) {
      console.log(`  ${c.pass ? "✓" : "✗"} ${c.label}: ${c.value}`);
    }
    if (a.issues.length > 0) {
      console.log("  ISSUES:");
      for (const iss of a.issues) console.log(`    · ${iss}`);
    }
    console.log("  DIMENSION DESCRIPTIONS:");
    for (const d of a.snippets.dimensions ?? []) console.log(`    • ${d}`);
    if ((a.snippets.cited ?? []).length > 0) {
      console.log("  CITED REFERENCES:");
      for (const c of a.snippets.cited ?? []) console.log(`    • ${c}`);
    }
    console.log("  REVIEW OPENING:");
    console.log(`    ${a.snippets.review_first_300?.replace(/\n/g, " ")}...`);
  }

  console.log("\n" + "═".repeat(78));
  console.log("AGGREGATE PROBLEM SUMMARY");
  console.log("═".repeat(78));
  const failureCounts: Record<string, number> = {};
  for (const a of analyses) {
    for (const c of a.checks) {
      if (!c.pass) failureCounts[c.label] = (failureCounts[c.label] ?? 0) + 1;
    }
  }
  const sortedFailures = Object.entries(failureCounts).sort((a, b) => b[1] - a[1]);
  for (const [label, count] of sortedFailures) {
    console.log(`  ${count}/${analyses.length} cases failed: ${label}`);
  }

  const topicIssues = analyses.filter((a) => a.mode === "topic").reduce((sum, a) => sum + a.issues.length, 0);
  const productIssues = analyses.filter((a) => a.mode === "product").reduce((sum, a) => sum + a.issues.length, 0);
  console.log(`\n  Topic-mode   total issues: ${topicIssues}`);
  console.log(`  Product-mode total issues: ${productIssues}`);
  console.log(`\nFull outputs → ${outDir}/`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
