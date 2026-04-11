export type EvaluationStatus = "pending" | "processing" | "completed" | "failed";
export type PlanTier = "free" | "pro" | "max";

export interface ProjectParsedData {
  name: string;
  description: string;
  target_users: string;
  competitors: string;
  goals: string;
  success_metrics: string;
}

export interface Project {
  id: string;
  user_id: string;
  raw_input: string;
  parsed_data: ProjectParsedData;
  url: string | null;
  attachments: string[];
  created_at: string;
}

// Fixed scores for product mode (backwards compatible)
export interface FixedEvaluationScores {
  usability: number;
  market_fit: number;
  design: number;
  tech_quality: number;
  innovation: number;
  pricing: number;
}

// Dynamic scores for topic mode (numbers) or stances (strings like "support", "oppose")
export type EvaluationScores = FixedEvaluationScores | Record<string, number> | Record<string, string>;

export type EvaluationMode = "product" | "topic";

export interface TopicClassification {
  topic_type: "product" | "policy" | "idea" | "creative" | "decision" | "strategy" | "other";
  dimensions: Array<{
    key: string;
    label_en: string;
    label_zh: string;
    description: string;
  }>;
  readiness_label_en: string;
  readiness_label_zh: string;
}

export interface PersonaReview {
  id: string;
  evaluation_id: string;
  persona_id: string;
  scores: EvaluationScores;
  review_text: string;
  strengths: string[];
  weaknesses: string[];
  llm_model: string;
  created_at: string;
}

export interface Evaluation {
  id: string;
  project_id: string;
  status: EvaluationStatus;
  selected_persona_ids: string[];
  created_at: string;
  completed_at: string | null;
}

export interface Subscription {
  id: string;
  user_id: string;
  plan: PlanTier;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  evaluations_used: number;
  evaluations_limit: number;
  current_period_start: string;
  current_period_end: string;
}
