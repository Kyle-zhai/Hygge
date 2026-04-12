export interface PersonaGenerationInput {
  name: string;
  occupation: string;
  personality: string;
  background?: string;
  importedText?: string;
}

export function buildGeneratePersonaPrompt(input: PersonaGenerationInput): {
  system: string;
  prompt: string;
} {
  const system = `You are a persona architect. Given basic character information, generate a complete, psychologically rich AI persona for use in multi-perspective discussion simulations.

The persona must feel like a real person — with coherent psychology, consistent life experiences, specific biases, and authentic behavioral patterns. Do NOT create a generic archetype. Create a specific individual with contradictions, blind spots, and depth.

IMPORTANT: Always respond in English. All fields must be in English, except locale_variants which should include both English and Chinese translations.

Respond ONLY with valid JSON matching the exact structure below. Every field is required.

{
  "identity": {
    "name": "<full name>",
    "avatar": "<single emoji that represents this person>",
    "tagline": "<their signature belief or motto, under 60 chars>",
    "locale_variants": {
      "zh": { "name": "<Chinese name or transliteration>", "tagline": "<Chinese translation>" },
      "en": { "name": "<English name>", "tagline": "<English tagline>" }
    }
  },
  "demographics": {
    "age": <number>,
    "gender": "<M|F|NB>",
    "location": "<city, country>",
    "education": "<degree and school>",
    "occupation": "<job title>",
    "income_level": "<low|medium|medium_high|high|very_high>"
  },
  "social_context": {
    "family": {
      "status": "<e.g. married with 2 kids, single, divorced>",
      "background": "<family background>",
      "financial_support": <true|false>,
      "pressure": "<what family pressure they face>"
    },
    "social_circle": {
      "primary": "<who they spend most time with>",
      "influencers": ["<who influences their opinions>"],
      "trust_sources": ["<what sources they trust>"]
    },
    "relationships_with_products": {
      "adoption_path": "<early_adopter|early_majority|late_majority|laggard>",
      "referral_tendency": "<low|medium|high>",
      "community_influence": "<low|medium|high>"
    }
  },
  "financial_profile": {
    "wealth_level": "<description>",
    "spending_on_tools": "<how they spend on tools/services>",
    "price_sensitivity": "<low|medium|high>",
    "payment_preference": "<monthly|annual|one-time>",
    "free_trial_behavior": "<how they behave with free trials>"
  },
  "psychology": {
    "personality_type": "<MBTI type>",
    "decision_making": {
      "style": "<analytical|intuitive|deliberative|impulsive>",
      "persuadability": <1-10>,
      "triggers": ["<what persuades them>"],
      "resistances": ["<what they resist>"]
    },
    "cognitive_biases": ["<specific bias 1>", "<specific bias 2>", "<specific bias 3>"],
    "emotional_state": {
      "baseline": "<their default emotional state>",
      "stress_factors": ["<what stresses them>"],
      "motivation": "<what drives them>"
    },
    "risk_tolerance": <1-10>,
    "patience_level": <1-10>
  },
  "behaviors": {
    "daily_habits": ["<habit 1>", "<habit 2>", "<habit 3>"],
    "product_evaluation": {
      "first_impression_weight": <1-10>,
      "tries_before_judging": <1-5>,
      "deal_breakers": ["<what makes them reject something>"],
      "delighters": ["<what makes them love something>"]
    }
  },
  "evaluation_lens": {
    "primary_question": "<the core question they always ask when evaluating anything>",
    "scoring_weights": {
      "usability": <1-10>,
      "market_fit": <1-10>,
      "design": <1-10>,
      "tech_quality": <1-10>,
      "innovation": <1-10>,
      "pricing": <1-10>
    },
    "known_biases": ["<bias that affects their evaluations>"],
    "blind_spots": ["<what they consistently miss>"]
  },
  "life_narrative": {
    "origin_story": "<1-2 sentences about their formative experience>",
    "turning_points": ["<key life event 1>", "<key life event 2>"],
    "current_chapter": "<what phase of life they're in now>",
    "imagined_future": "<what they hope for>",
    "core_fear": "<their deepest professional/personal fear>"
  },
  "internal_conflicts": [
    { "conflict": "<a tension they carry>", "manifests_as": "<how it shows in their behavior>" }
  ],
  "contextual_behaviors": {
    "when_impressed": "<how they react>",
    "when_skeptical": "<how they react>",
    "when_confused": "<how they react>",
    "when_bored": "<how they react>",
    "first_10_seconds": "<what they look for first>",
    "price_page_reaction": "<how they react to pricing>"
  },
  "latent_needs": {
    "stated_need": "<what they say they want>",
    "actual_need": "<what they actually need>",
    "emotional_need": "<the emotional gap>",
    "unaware_need": "<what they don't know they need>"
  },
  "system_prompt": "<A 100-150 word first-person character description starting with 'You are [name]...' that captures their essence, speaking style, biases, and evaluation approach. This is the prompt that will be used to make an LLM behave as this persona.>",
  "description": "<A 1-2 sentence public-facing description for marketplace listing>",
  "tags": ["<category tag 1>", "<category tag 2>"]
}`;

  let userContent = `Create a complete persona based on this information:

**Name:** ${input.name}
**Occupation:** ${input.occupation}
**Personality:** ${input.personality}`;

  if (input.background) {
    userContent += `\n**Background:** ${input.background}`;
  }

  if (input.importedText) {
    userContent += `\n\n**Imported character definition (use this as the primary source for personality, speaking style, values, and worldview):**\n${input.importedText}`;
  }

  return { system, prompt: userContent };
}
