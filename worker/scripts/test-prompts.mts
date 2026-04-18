import "dotenv/config";
import { buildLLM } from "../src/llm/factory.js";
import { parseProject } from "../src/processors/parse-project.js";
import { classifyTopic } from "../src/processors/classify-topic.js";
import { generatePersonaReview } from "../src/processors/persona-review.js";
import type { Persona } from "../src/types/persona.js";

const RAW_INPUT = `I'm launching PulseLoop, a $29/mo SaaS for indie SaaS founders to consolidate user feedback from Intercom, email, Twitter, and in-app widgets into one ranked roadmap. Target: solo founders and ≤5-person teams who currently juggle Canny ($49/mo) and Savio ($99/mo).

Core promise: "zero-training onboarding" — pipe feedback in via an email forwarder, see ranked roadmap in under 10 minutes. No SQL, no admin panel.

Goals in first 6 months:
- 500 paying customers
- <5% monthly churn
- NPS above 40 among customers who've been active 30+ days

Concerns:
- Canny already dominates indie-hacker Twitter; switching cost is real.
- I've been told 'compliance-heavy' teams won't buy from a 3-person shop without SOC 2.
- My runway is 18 months; I need revenue by month 9.

Launch plan: Product Hunt at month 2, ship Slack integration at month 3, seed indie-hacker newsletters at month 4. No paid ads yet.`;

function makePersona(overrides: Partial<Persona> = {}): Persona {
  return {
    id: "test-maya",
    identity: {
      name: "Maya Chen",
      avatar: "",
      tagline: "Pragmatic product lead, has shipped at 3 YC startups",
      locale_variants: { zh: { name: "Maya", tagline: "" }, en: { name: "Maya Chen", tagline: "" } },
    },
    demographics: {
      age: 32,
      gender: "F",
      location: "San Francisco, CA",
      education: "BS CS, Stanford",
      occupation: "Product Lead at a Series-A SaaS startup",
      income_level: "high",
    },
    social_context: {
      family: { status: "partnered", background: "tech", financial_support: false, pressure: "moderate" },
      social_circle: {
        primary: "YC alumni network, indie hackers",
        influencers: ["Lenny Rachitsky", "Jason Cohen"],
        trust_sources: ["peer founders", "ProductHunt rankings", "first-principles reasoning"],
      },
      relationships_with_products: {
        adoption_path: "tries tools her peers use, switches fast if activation fails",
        referral_tendency: "high",
        community_influence: "high",
      },
    },
    financial_profile: {
      wealth_level: "comfortable",
      spending_on_tools: "$500/mo personal + $3k/mo company stack",
      price_sensitivity: "medium",
      payment_preference: "annual for SaaS she commits to",
      free_trial_behavior: "uses 7 days aggressively, decides by day 7",
    },
    psychology: {
      personality_type: "analytical builder",
      decision_making: {
        style: "data-driven with strong opinions",
        persuadability: 5,
        triggers: ["activation metrics", "peer endorsement", "clear wedge against incumbents"],
        resistances: ["pricing above Linear's $8 entry tier", "vague value props"],
      },
      cognitive_biases: ["recency bias on latest launch she loved", "discounts marketing-heavy tools"],
      emotional_state: { baseline: "focused", stress_factors: ["shipping deadlines"], motivation: "ship things that compound" },
      risk_tolerance: 7,
      patience_level: 4,
    },
    behaviors: {
      daily_habits: ["reads Indie Hackers daily", "codes 4hrs before meetings"],
      product_evaluation: {
        first_impression_weight: 8,
        tries_before_judging: 2,
        deal_breakers: ["no activation within 10 minutes", "pricing that doesn't match the buyer persona"],
        delighters: ["clear wedge positioning", "integration with tools she already pays for"],
      },
    },
    evaluation_lens: {
      primary_question: "Is this wedge sharp enough to pull users off the incumbent?",
      scoring_weights: { usability: 0.2, market_fit: 0.25, design: 0.1, tech_quality: 0.1, innovation: 0.15, pricing: 0.2 },
      known_biases: ["favors tools with opinionated UX", "trusts founder-led distribution"],
      blind_spots: ["undervalues enterprise compliance needs", "skeptical of paid ads"],
    },
    life_narrative: {
      origin_story: "Grew up coding in Shenzhen, moved to SF at 22, shipped two failed startups before finding PM as her lever",
      turning_points: ["first PM role at a failing SaaS", "seeing Linear's launch and getting jealous"],
      current_chapter: "building toward becoming a founder again in 2 years",
      imagined_future: "run a $10M ARR bootstrapped SaaS",
      core_fear: "shipping a 'me-too' product",
    },
    internal_conflicts: [
      { conflict: "bias toward simplicity vs. enterprise's need for complexity", manifests_as: "often dismisses enterprise tools too fast" },
    ],
    contextual_behaviors: {
      when_impressed: "DMs 5 founder friends, then writes a tweet thread",
      when_skeptical: "goes to pricing page and competitor comparison first",
      when_confused: "assumes the product is confused, leaves",
      when_bored: "closes the tab within 40 seconds",
      first_10_seconds: "reads the hero promise, scans for a clear wedge",
      price_page_reaction: "compares to Linear ($8) and Notion ($10) tiers",
    },
    latent_needs: {
      stated_need: "ship faster",
      actual_need: "evidence that her next startup will work",
      emotional_need: "validation from founders she respects",
      unaware_need: "to pick a wedge narrow enough to feel like a bet",
    },
    system_prompt: `You are Maya Chen, a 32-year-old product lead at a Series-A SaaS startup in SF. You've shipped at 3 YC startups. You are sharp, blunt, allergic to platitudes, and deeply skeptical of 'me-too' products. You trust peer founders and first-principles reasoning. You compare every SaaS price to Linear's $8 and Notion's $10 starter tiers. You are currently 2 years away from starting your own SaaS again and watching every competitive positioning carefully. You speak plainly, with specific numbers when you have them. You often DM 5 founder friends after seeing something you like.`,
    created_at: new Date().toISOString(),
  };
}

function hr(title: string) {
  console.log("\n" + "═".repeat(70));
  console.log("  " + title);
  console.log("═".repeat(70));
}

async function main() {
  const llm = buildLLM();

  hr("RAW USER INPUT");
  console.log(RAW_INPUT);

  hr("1) parseProject → structured fields");
  const parsed = await parseProject(llm, RAW_INPUT);
  console.log(JSON.stringify(parsed, null, 2));

  hr("2) classifyTopic → topic type + dimensions (must cite user submission)");
  const classification = await classifyTopic(llm, RAW_INPUT);
  console.log(JSON.stringify(classification, null, 2));

  hr("3) generatePersonaReview (Maya Chen) → must include verbatim quotes + benchmarks");
  const maya = makePersona();
  const review = await generatePersonaReview(llm, maya, parsed, RAW_INPUT, classification.dimensions, "topic");
  console.log(JSON.stringify(review, null, 2));

  hr("QUICK QUALITY CHECKS");
  const reviewText = review.review_text ?? "";
  const quoteCount = (reviewText.match(/"/g) ?? []).length / 2;
  const numberMatches = reviewText.match(/\$\d|\d+%|\d+x|\d+\/\d+|\d{2,}/g) ?? [];
  const bannedPhrases = [
    "has potential", "could be better", "interesting idea", "well thought out",
    "needs more work", "solid foundation", "great start", "overall good",
  ];
  const bannedHits = bannedPhrases.filter((p) => reviewText.toLowerCase().includes(p));
  const citedCount = Array.isArray(review.cited_references) ? review.cited_references.length : 0;
  const strengthsCount = review.strengths.length;
  const weaknessesCount = review.weaknesses.length;

  const checks = [
    { label: "Verbatim quotes in review_text (target ≥3)", value: quoteCount, pass: quoteCount >= 3 },
    { label: "Specific numbers in review_text (target ≥3)", value: numberMatches.length, pass: numberMatches.length >= 3 },
    { label: "cited_references count (target ≥2)", value: citedCount, pass: citedCount >= 2 },
    { label: "strengths count (target ≥3)", value: strengthsCount, pass: strengthsCount >= 3 },
    { label: "weaknesses count (target ≥3)", value: weaknessesCount, pass: weaknessesCount >= 3 },
    { label: "Banned phrase hits (target = 0)", value: bannedHits.length, pass: bannedHits.length === 0 },
  ];
  for (const c of checks) {
    console.log(`  ${c.pass ? "✓" : "✗"} ${c.label}: ${c.value}${bannedHits.length && c.label.includes("Banned") ? ` [${bannedHits.join(", ")}]` : ""}`);
  }
  console.log(`  Numbers found: ${numberMatches.join(", ")}`);

  hr("DIMENSION DESCRIPTIONS (should cite user submission, not be generic)");
  for (const d of classification.dimensions) {
    console.log(`  • ${d.label_en} (${d.key}): ${d.description}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
