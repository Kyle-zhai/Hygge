// annotation-tags.ts
//
// Multi-agent audit kernel: Layer 1a passage-annotation vocabulary.
// Spec: docs/superpowers/specs/2026-04-30-multi-agent-audit-architecture.md §4
//
// This file defines every annotation tag the Layer 1a annotator may emit on
// a passage. The set is the union of all `trigger_annotations[]` referenced
// in supabase/migrations/049_audit_law_catalog.sql, plus a handful of
// disambiguation tags that don't trigger a law on their own but help the
// scoping agent (Layer 1b) decide what to ask the user.
//
// Two invariants the annotator MUST follow:
//   1. Only emit tags from ALL_ANNOTATION_TAG_IDS. Anything else is dropped.
//   2. A tag fires when the passage describes the concept; it does NOT fire
//      when the passage merely *mentions* it as something that does not apply.
//      Example: "we never collect biometric data" does NOT trigger 'biometric'.
//
// Categories are for prompt construction (group related tags so the small
// annotator model has tighter focus per pass) and for scoping-side display.
// They do NOT change downstream law-matching, which is purely union-based.

export type AnnotationCategory =
  | "ai_architecture"
  | "decision_type"
  | "employment"
  | "financial_services"
  | "healthcare"
  | "other_domain"
  | "population"
  | "geography"
  | "biometric"
  | "marketing_design"
  | "data_practices";

export interface AnnotationTagDef {
  /** Stable id. Wire format. Must match trigger_annotations[] entries in 049. */
  id: string;
  category: AnnotationCategory;
  /** Plain-English description used inside the annotator system prompt. */
  description: string;
  /** Short positive example, used inline in the prompt. */
  example: string;
}

// ============================================
// ai_architecture — what the system *is*
// ============================================
const AI_ARCHITECTURE: AnnotationTagDef[] = [
  {
    id: "ai_system",
    category: "ai_architecture",
    description: "Any AI / ML / algorithmic system, broadly defined.",
    example: "we deploy a recommendation model trained on user behavior",
  },
  {
    id: "agent_system",
    category: "ai_architecture",
    description: "An autonomous or semi-autonomous AI agent that takes actions.",
    example: "the agent reads emails and books meetings on the user's calendar",
  },
  {
    id: "llm_use",
    category: "ai_architecture",
    description: "A large language model is invoked at runtime.",
    example: "we call GPT-4 to summarize support tickets",
  },
  {
    id: "foundation_model",
    category: "ai_architecture",
    description: "A general-purpose / foundation model (LLM, multimodal, diffusion).",
    example: "fine-tuned LLaMA 3 deployed on AWS",
  },
  {
    id: "genai",
    category: "ai_architecture",
    description: "Generative AI producing text, images, code, audio, or video.",
    example: "users generate marketing copy with the tool",
  },
  {
    id: "model_training_use",
    category: "ai_architecture",
    description: "Data is used to train, fine-tune, or further-train a model.",
    example: "user prompts are stored and used to fine-tune our chatbot",
  },
  {
    id: "model_evaluation",
    category: "ai_architecture",
    description: "Performance / accuracy / fairness evaluation of a model.",
    example: "we benchmark precision and recall against a held-out test set",
  },
  {
    id: "enterprise_deployment",
    category: "ai_architecture",
    description: "Deployed inside an organization (B2B internal or B2B SaaS).",
    example: "rolled out to 5,000 employees across HR and finance",
  },
  {
    id: "third_party_ai",
    category: "ai_architecture",
    description: "AI supplied by a vendor / third party rather than built in-house.",
    example: "we resell OpenAI API access under our brand",
  },
  {
    id: "ai_supply_chain",
    category: "ai_architecture",
    description: "Multiple upstream AI components / model vendors / data brokers.",
    example: "voice → Deepgram → GPT → ElevenLabs → user",
  },
  {
    id: "procurement_ai",
    category: "ai_architecture",
    description: "Purchasing or licensing AI from outside the organization.",
    example: "RFP for an AI scoring vendor",
  },
  {
    id: "continuous_monitoring",
    category: "ai_architecture",
    description: "Ongoing performance / drift monitoring of a deployed model.",
    example: "weekly drift alerts feed our on-call rotation",
  },
  {
    id: "incident_response",
    category: "ai_architecture",
    description: "Process for handling AI failures, harm, or model misbehavior.",
    example: "we have a kill-switch and a postmortem process",
  },
];

// ============================================
// decision_type — what the system *does*
// ============================================
const DECISION_TYPE: AnnotationTagDef[] = [
  {
    id: "automated_decision",
    category: "decision_type",
    description: "System produces a decision or score about a person, with limited human review.",
    example: "approves or denies loan applications without human sign-off",
  },
  {
    id: "consequential_decision",
    category: "decision_type",
    description: "Decision has legal or similarly significant effects on a person.",
    example: "denies housing, fires an employee, sets insurance premium",
  },
  {
    id: "automated_employment_decision",
    category: "decision_type",
    description: "Automated decision specifically in an employment context.",
    example: "AI ranks candidates and shortlist is used as-is",
  },
  {
    id: "safety_critical",
    category: "decision_type",
    description: "Failure could cause physical harm, injury, or death.",
    example: "controls dosage in an infusion pump",
  },
  {
    id: "safety_relevant",
    category: "decision_type",
    description: "Output influences safety decisions even if not directly controlling them.",
    example: "flags risky driving behavior for a fleet manager to review",
  },
  {
    id: "high_risk_ai",
    category: "decision_type",
    description: "Falls into EU AI Act Annex III (or analogous) high-risk category.",
    example: "biometric ID, employment, credit, critical infrastructure",
  },
  {
    id: "prohibited_ai_practice",
    category: "decision_type",
    description: "Falls into EU AI Act Article 5 / similar prohibited categories.",
    example: "social scoring, real-time biometric ID in public spaces",
  },
  {
    id: "profiling",
    category: "decision_type",
    description: "Automated evaluation of personal aspects (work, finances, health, behavior).",
    example: "predicts churn risk per individual user",
  },
];

// ============================================
// employment domain
// ============================================
const EMPLOYMENT: AnnotationTagDef[] = [
  {
    id: "employment_decision",
    category: "employment",
    description: "Any decision about hiring, promotion, pay, discipline, or termination.",
    example: "AI sets compensation bands during annual review",
  },
  {
    id: "hiring_decision",
    category: "employment",
    description: "Decision to hire / advance / reject a candidate.",
    example: "AI rejects 70% of applicants automatically",
  },
  {
    id: "promotion_decision",
    category: "employment",
    description: "Decision to promote or not promote an employee.",
    example: "AI ranks employees for promotion eligibility",
  },
  {
    id: "termination_decision",
    category: "employment",
    description: "Decision to terminate, lay off, or non-renew an employee.",
    example: "AI flags low-performers for layoff selection",
  },
  {
    id: "candidate_screening",
    category: "employment",
    description: "Pre-interview screening of applicants.",
    example: "chatbot interview filters candidates",
  },
  {
    id: "resume_screening",
    category: "employment",
    description: "Automated parsing / ranking of resumes.",
    example: "ATS scores resumes against a JD",
  },
  {
    id: "video_interview_analysis",
    category: "employment",
    description: "AI scoring of video interview content (speech, facial, sentiment).",
    example: "tool rates candidate enthusiasm from facial expressions",
  },
  {
    id: "demographic_data",
    category: "employment",
    description: "Race, sex, age, disability, or similar demographic data is collected or inferred.",
    example: "EEO-1 reporting category is captured during onboarding",
  },
  {
    id: "protected_class",
    category: "employment",
    description: "Decisions could disparately impact a Title VII / ADA / ADEA protected class.",
    example: "model accuracy is lower for women than men",
  },
  {
    id: "accommodations",
    category: "employment",
    description: "Disability or religious accommodations are involved.",
    example: "system must offer alternative format for blind candidates",
  },
];

// ============================================
// financial_services domain
// ============================================
const FINANCIAL_SERVICES: AnnotationTagDef[] = [
  {
    id: "financial_services",
    category: "financial_services",
    description: "Operates inside banking, credit, insurance, securities, or payments.",
    example: "we are a fintech offering credit cards",
  },
  {
    id: "financial_model",
    category: "financial_services",
    description: "Quantitative model used in finance (risk, pricing, valuation).",
    example: "Monte Carlo VaR model",
  },
  {
    id: "credit_decision",
    category: "financial_services",
    description: "Decision to extend, deny, or price credit.",
    example: "approves credit card applications",
  },
  {
    id: "lending",
    category: "financial_services",
    description: "Loan origination, servicing, or collection.",
    example: "auto-loan origination platform",
  },
  {
    id: "underwriting",
    category: "financial_services",
    description: "Insurance or loan underwriting decision.",
    example: "AI prices auto-insurance premiums",
  },
  {
    id: "fraud_detection",
    category: "financial_services",
    description: "Detection of fraudulent transactions, accounts, or claims.",
    example: "flags suspicious card transactions",
  },
  {
    id: "aml",
    category: "financial_services",
    description: "Anti-money-laundering / suspicious-activity monitoring.",
    example: "OFAC screening + SAR generation",
  },
  {
    id: "kyc",
    category: "financial_services",
    description: "Know-your-customer identity verification.",
    example: "ID document + selfie liveness check",
  },
  {
    id: "trading_model",
    category: "financial_services",
    description: "Algorithmic trading or market-making model.",
    example: "ML model places orders on equities",
  },
  {
    id: "risk_model",
    category: "financial_services",
    description: "Model used for capital, credit, market, or operational risk.",
    example: "credit-loss reserve model",
  },
  {
    id: "bank_use",
    category: "financial_services",
    description: "Used by a bank, BHC, or other federally regulated financial institution.",
    example: "a regional bank deploys this for compliance",
  },
  {
    id: "insurance_decision",
    category: "financial_services",
    description: "Insurance underwriting, pricing, or claims decision.",
    example: "AI approves or denies health-insurance claims",
  },
];

// ============================================
// healthcare domain
// ============================================
const HEALTHCARE: AnnotationTagDef[] = [
  {
    id: "healthcare_use",
    category: "healthcare",
    description: "Used in healthcare delivery, payment, or operations broadly.",
    example: "deployed inside a hospital system",
  },
  {
    id: "health_data",
    category: "healthcare",
    description: "Health, medical, or wellness data is processed.",
    example: "stores blood-pressure readings from a wearable",
  },
  {
    id: "phi",
    category: "healthcare",
    description: "Protected Health Information under HIPAA (identifiable + health).",
    example: "patient name + diagnosis stored together",
  },
  {
    id: "medical_diagnosis",
    category: "healthcare",
    description: "Software diagnoses, predicts, or rules out a disease.",
    example: "skin-lesion classifier flags melanoma risk",
  },
  {
    id: "clinical_decision_support",
    category: "healthcare",
    description: "Software recommends or flags clinical actions to a provider.",
    example: "alerts oncologist to consider drug interaction",
  },
  {
    id: "patient_data",
    category: "healthcare",
    description: "Data tied to identified or identifiable patients.",
    example: "EHR record export feeds the model",
  },
  {
    id: "provider_use",
    category: "healthcare",
    description: "Used by clinicians, hospitals, or other providers.",
    example: "physicians use the tool during patient visits",
  },
  {
    id: "insurer_use",
    category: "healthcare",
    description: "Used by health insurers / payers.",
    example: "payer auto-adjudicates claims",
  },
  {
    id: "hipaa_covered_entity",
    category: "healthcare",
    description: "User organization is a HIPAA covered entity or business associate.",
    example: "we are a clinical lab; downstream is a hospital",
  },
  {
    id: "treatment_recommendation",
    category: "healthcare",
    description: "Software recommends a treatment, dose, or therapy.",
    example: "chemo-dosing assistant",
  },
  {
    id: "patient_triage",
    category: "healthcare",
    description: "Software triages or prioritizes patients.",
    example: "ED triage prioritization model",
  },
  {
    id: "medical_imaging",
    category: "healthcare",
    description: "Reads or analyzes medical images (X-ray, MRI, CT, pathology).",
    example: "chest-X-ray pneumonia classifier",
  },
  {
    id: "diagnostic_ai",
    category: "healthcare",
    description: "AI specifically intended for diagnostic purposes (FDA SaMD candidate).",
    example: "intended use claims diagnosis of diabetic retinopathy",
  },
  {
    id: "therapeutic_ai",
    category: "healthcare",
    description: "AI delivering therapy (digital therapeutic, behavioral intervention).",
    example: "FDA-cleared cognitive-behavioral therapy app",
  },
  {
    id: "samd",
    category: "healthcare",
    description: "Software meeting the FDA / IMDRF Software-as-a-Medical-Device definition.",
    example: "standalone software that diagnoses without a physical device",
  },
  {
    id: "medical_device",
    category: "healthcare",
    description: "Software embedded in or controlling a regulated medical device.",
    example: "firmware in an insulin pump",
  },
];

// ============================================
// other_domain — housing / education / govt / infra / law enforcement
// ============================================
const OTHER_DOMAIN: AnnotationTagDef[] = [
  {
    id: "housing_decision",
    category: "other_domain",
    description: "Decision about renting, selling, or financing housing.",
    example: "tenant screening AI",
  },
  {
    id: "education_decision",
    category: "other_domain",
    description: "Decision about admission, grading, or discipline in education.",
    example: "AI grades essays for a university course",
  },
  {
    id: "education_use",
    category: "other_domain",
    description: "Deployed in K-12 or higher-ed teaching or operations.",
    example: "tutoring chatbot for high-school students",
  },
  {
    id: "government_services",
    category: "other_domain",
    description: "Provides or supports a government / public-sector service.",
    example: "AI helps determine SNAP benefit eligibility",
  },
  {
    id: "critical_infrastructure",
    category: "other_domain",
    description: "Energy, water, transport, or telecom infrastructure.",
    example: "predictive maintenance for a power-grid operator",
  },
  {
    id: "law_enforcement_use",
    category: "other_domain",
    description: "Used by law enforcement, prosecution, or corrections.",
    example: "predictive policing model",
  },
];

// ============================================
// population — who is affected
// ============================================
const POPULATION: AnnotationTagDef[] = [
  {
    id: "consumer_facing",
    category: "population",
    description: "End users include retail consumers (not just business users).",
    example: "free mobile app downloaded by the public",
  },
  {
    id: "minors",
    category: "population",
    description: "Users or data subjects include people under 18.",
    example: "K-12 classroom tool",
  },
  {
    id: "children_under_13",
    category: "population",
    description: "Specifically directed to or knowingly used by children under 13.",
    example: "preschool reading-help app",
  },
  {
    id: "student_data",
    category: "population",
    description: "Educational records / student data is processed.",
    example: "GPA, attendance, special-ed status",
  },
  {
    id: "employee_biometric",
    category: "population",
    description: "Employer collects employee biometric data.",
    example: "fingerprint timeclock for warehouse staff",
  },
];

// ============================================
// geography — where data subjects / deployment live
// ============================================
const GEOGRAPHY: AnnotationTagDef[] = [
  {
    id: "california_resident_data",
    category: "geography",
    description: "Data subjects include California residents.",
    example: "we have CA users",
  },
  {
    id: "colorado_resident_data",
    category: "geography",
    description: "Data subjects include Colorado residents.",
    example: "Denver-based customers use the product",
  },
  {
    id: "illinois_resident_data",
    category: "geography",
    description: "Data subjects (consumers or employees) are in Illinois.",
    example: "Chicago warehouse uses the timeclock",
  },
  {
    id: "nyc_employment",
    category: "geography",
    description: "Candidates or employees are located in New York City, or positions are in NYC.",
    example: "NYC-based engineering roles",
  },
  {
    id: "eu_resident_data",
    category: "geography",
    description: "Data subjects in the EU or EEA.",
    example: "we have German customers",
  },
  {
    id: "eu_deployment",
    category: "geography",
    description: "AI system placed on the EU market or outputs used in the EU.",
    example: "sold to a French company through their EU entity",
  },
];

// ============================================
// biometric
// ============================================
const BIOMETRIC: AnnotationTagDef[] = [
  {
    id: "biometric",
    category: "biometric",
    description: "Any biometric identifier (face, voice, fingerprint, etc.).",
    example: "voiceprint authentication",
  },
  {
    id: "face_image",
    category: "biometric",
    description: "Face photographs or scans are captured or processed.",
    example: "selfie required at signup",
  },
  {
    id: "facial_recognition",
    category: "biometric",
    description: "Software identifies or verifies a person from face data.",
    example: "1:N face match against a watchlist",
  },
  {
    id: "voice_print",
    category: "biometric",
    description: "Voice biometric used for ID or verification.",
    example: "call-center voice authentication",
  },
  {
    id: "fingerprint",
    category: "biometric",
    description: "Fingerprint capture or matching.",
    example: "fingerprint timeclock",
  },
  {
    id: "retina_scan",
    category: "biometric",
    description: "Retina or iris scanning.",
    example: "iris scanner at building entrance",
  },
  {
    id: "hand_geometry",
    category: "biometric",
    description: "Hand or palm geometry scanning.",
    example: "palm-print door access",
  },
];

// ============================================
// marketing_design — claims, dark patterns, advertising
// ============================================
const MARKETING_DESIGN: AnnotationTagDef[] = [
  {
    id: "marketing_claims",
    category: "marketing_design",
    description: "Public-facing claims about the product (capabilities, results).",
    example: "homepage states '99% accuracy'",
  },
  {
    id: "ai_capability_claim",
    category: "marketing_design",
    description: "Specific claims about what the AI can do or how it was trained.",
    example: "advertised as 'human-level reasoning'",
  },
  {
    id: "advertising",
    category: "marketing_design",
    description: "Advertising / promotion is performed or targeted by the system.",
    example: "AI auto-generates Facebook ad copy",
  },
  {
    id: "dark_patterns",
    category: "marketing_design",
    description: "UI patterns identified as deceptive (forced consent, hidden costs, fake urgency).",
    example: "'are you sure you want to leave?' guilt screens",
  },
  {
    id: "deceptive_design",
    category: "marketing_design",
    description: "Design elements likely to mislead a reasonable consumer.",
    example: "mislabels AI output as a human agent",
  },
];

// ============================================
// data_practices — collection, retention, sharing, sensitivity, consent
// ============================================
const DATA_PRACTICES: AnnotationTagDef[] = [
  {
    id: "data_collection",
    category: "data_practices",
    description: "Personal data is collected from users or data subjects.",
    example: "signup form captures name, email, phone",
  },
  {
    id: "data_retention",
    category: "data_practices",
    description: "Personal data is stored for a defined or indefinite period.",
    example: "session logs retained 18 months",
  },
  {
    id: "third_party_sharing",
    category: "data_practices",
    description: "Personal data is shared with vendors, partners, or sold.",
    example: "user data sent to an analytics SaaS",
  },
  {
    id: "sensitive_personal_information",
    category: "data_practices",
    description: "CCPA-style sensitive personal information is processed.",
    example: "race, religion, precise geolocation, SSN",
  },
  {
    id: "consent",
    category: "data_practices",
    description: "User consent is captured (or relied on) for the processing.",
    example: "checkbox 'I agree to terms and privacy policy'",
  },
];

// ============================================
// Public exports
// ============================================
export const ANNOTATION_TAGS: AnnotationTagDef[] = [
  ...AI_ARCHITECTURE,
  ...DECISION_TYPE,
  ...EMPLOYMENT,
  ...FINANCIAL_SERVICES,
  ...HEALTHCARE,
  ...OTHER_DOMAIN,
  ...POPULATION,
  ...GEOGRAPHY,
  ...BIOMETRIC,
  ...MARKETING_DESIGN,
  ...DATA_PRACTICES,
];

export const ALL_ANNOTATION_TAG_IDS: ReadonlySet<string> = new Set(
  ANNOTATION_TAGS.map((t) => t.id),
);

export const ANNOTATION_TAGS_BY_CATEGORY: Record<AnnotationCategory, AnnotationTagDef[]> = {
  ai_architecture: AI_ARCHITECTURE,
  decision_type: DECISION_TYPE,
  employment: EMPLOYMENT,
  financial_services: FINANCIAL_SERVICES,
  healthcare: HEALTHCARE,
  other_domain: OTHER_DOMAIN,
  population: POPULATION,
  geography: GEOGRAPHY,
  biometric: BIOMETRIC,
  marketing_design: MARKETING_DESIGN,
  data_practices: DATA_PRACTICES,
};

/** Filter an annotator's raw output to only known tags. Drops unknowns silently. */
export function sanitizeAnnotations(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim();
    if (ALL_ANNOTATION_TAG_IDS.has(trimmed)) seen.add(trimmed);
  }
  return Array.from(seen);
}

/**
 * Build a compact prompt-ready vocabulary block. Used by the Layer 1a annotator
 * system prompt to constrain output. Format keeps token count low while still
 * giving the model a description per tag.
 */
export function renderAnnotationVocabulary(): string {
  const lines: string[] = [];
  for (const cat of Object.keys(ANNOTATION_TAGS_BY_CATEGORY) as AnnotationCategory[]) {
    lines.push(`## ${cat}`);
    for (const tag of ANNOTATION_TAGS_BY_CATEGORY[cat]) {
      lines.push(`- ${tag.id}: ${tag.description} (e.g. "${tag.example}")`);
    }
    lines.push("");
  }
  return lines.join("\n").trim();
}
