export interface PersonaIdentity {
    name: string;
    avatar: string;
    tagline: string;
    locale_variants: {
        zh: {
            name: string;
            tagline: string;
        };
        en: {
            name: string;
            tagline: string;
        };
    };
}
export interface PersonaDemographics {
    age: number;
    gender: "M" | "F" | "NB";
    location: string;
    education: string;
    occupation: string;
    income_level: "low" | "medium" | "medium_high" | "high" | "very_high";
}
export interface PersonaFamily {
    status: string;
    background: string;
    financial_support: boolean;
    pressure: string;
}
export interface PersonaSocialCircle {
    primary: string;
    influencers: string[];
    trust_sources: string[];
}
export interface PersonaProductRelationship {
    adoption_path: string;
    referral_tendency: "low" | "medium" | "high";
    community_influence: "low" | "medium" | "high";
}
export interface PersonaSocialContext {
    family: PersonaFamily;
    social_circle: PersonaSocialCircle;
    relationships_with_products: PersonaProductRelationship;
}
export interface PersonaFinancialProfile {
    wealth_level: string;
    spending_on_tools: string;
    price_sensitivity: "low" | "medium" | "high";
    payment_preference: string;
    free_trial_behavior: string;
}
export interface PersonaDecisionMaking {
    style: string;
    persuadability: number;
    triggers: string[];
    resistances: string[];
}
export interface PersonaEmotionalState {
    baseline: string;
    stress_factors: string[];
    motivation: string;
}
export interface PersonaPsychology {
    personality_type: string;
    decision_making: PersonaDecisionMaking;
    cognitive_biases: string[];
    emotional_state: PersonaEmotionalState;
    risk_tolerance: number;
    patience_level: number;
}
export interface PersonaProductEvaluation {
    first_impression_weight: number;
    tries_before_judging: number;
    deal_breakers: string[];
    delighters: string[];
}
export interface PersonaBehaviors {
    daily_habits: string[];
    product_evaluation: PersonaProductEvaluation;
}
export interface PersonaScoringWeights {
    usability: number;
    market_fit: number;
    design: number;
    tech_quality: number;
    innovation: number;
    pricing: number;
}
export interface PersonaEvaluationLens {
    primary_question: string;
    scoring_weights: PersonaScoringWeights;
    known_biases: string[];
    blind_spots: string[];
}
export interface PersonaLifeNarrative {
    origin_story: string;
    turning_points: string[];
    current_chapter: string;
    imagined_future: string;
    core_fear: string;
}
export interface PersonaInternalConflict {
    conflict: string;
    manifests_as: string;
}
export interface PersonaContextualBehaviors {
    when_impressed: string;
    when_skeptical: string;
    when_confused: string;
    when_bored: string;
    first_10_seconds: string;
    price_page_reaction: string;
}
export interface PersonaLatentNeeds {
    stated_need: string;
    actual_need: string;
    emotional_need: string;
    unaware_need: string;
}
export interface Persona {
    id: string;
    identity: PersonaIdentity;
    demographics: PersonaDemographics;
    social_context: PersonaSocialContext;
    financial_profile: PersonaFinancialProfile;
    psychology: PersonaPsychology;
    behaviors: PersonaBehaviors;
    evaluation_lens: PersonaEvaluationLens;
    life_narrative: PersonaLifeNarrative;
    internal_conflicts: PersonaInternalConflict[];
    contextual_behaviors: PersonaContextualBehaviors;
    latent_needs: PersonaLatentNeeds;
    system_prompt: string;
    created_at: string;
}
