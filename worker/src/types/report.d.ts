import type { EvaluationScores } from "./evaluation";
export type MarketReadiness = "low" | "medium" | "high";
export type Priority = "critical" | "high" | "medium" | "low";
export interface PersonaAnalysisEntry {
    persona_id: string;
    persona_name: string;
    core_viewpoint: string;
    scoring_rationale: string;
}
export interface ConsensusPoint {
    point: string;
    supporting_personas: string[];
}
export interface DisagreementPoint {
    point: string;
    sides: {
        persona_ids: string[];
        position: string;
    }[];
    reason: string;
}
export interface DimensionAnalysis {
    dimension: keyof EvaluationScores;
    score: number;
    strengths: string[];
    weaknesses: string[];
    analysis: string;
}
export interface GoalAssessmentEntry {
    goal: string;
    achievable: boolean;
    current_status: string;
    gaps: string[];
}
export interface ActionItem {
    description: string;
    priority: Priority;
    expected_impact: string;
    difficulty: "easy" | "medium" | "hard";
}
export interface ScenarioSimulationResult {
    initial_adoption: {
        persona_id: string;
        stance: "positive" | "neutral" | "negative";
    }[];
    influence_events: {
        influencer_id: string;
        influenced_id: string;
        shift: string;
        reason: string;
    }[];
    final_adoption: {
        persona_id: string;
        stance: "positive" | "neutral" | "negative";
    }[];
    adoption_rate_shift: number;
    summary: string;
}
export interface SummaryReport {
    id: string;
    evaluation_id: string;
    overall_score: number;
    persona_analysis: {
        entries: PersonaAnalysisEntry[];
        consensus: ConsensusPoint[];
        disagreements: DisagreementPoint[];
    };
    multi_dimensional_analysis: DimensionAnalysis[];
    goal_assessment: GoalAssessmentEntry[];
    if_not_feasible: {
        modifications: string[];
        direction: string;
        priorities: string[];
        reference_cases: string[];
    };
    if_feasible: {
        next_steps: string[];
        optimizations: string[];
        risks: string[];
    };
    action_items: ActionItem[];
    market_readiness: MarketReadiness;
    scenario_simulation: ScenarioSimulationResult | null;
}
