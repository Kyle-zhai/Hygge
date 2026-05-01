-- 049_audit_law_catalog.sql
--
-- Multi-agent audit kernel: breadth library of US-relevant laws/frameworks.
-- Spec: docs/superpowers/specs/2026-04-30-multi-agent-audit-architecture.md §6
--
-- Wedge 1 (depth): NIST AI RMF + ISO/IEC 42001.
-- Breadth (auto-detect via Layer 1a annotations): the rest of this seed.
--
-- Each row tells the scoping agent (Layer 1b):
--   - which annotation tags trigger this law into in-scope consideration
--   - what clarifying questions to ask when triggers are ambiguous
--   - which source domains personas may search via Tavily
--   - how to format citations in the final report

set client_min_messages to warning;

-- ============================================
-- audit_law_catalog
-- ============================================
create table if not exists public.audit_law_catalog (
  id text primary key,
  name_en text not null,
  name_zh text not null,
  jurisdiction text not null,
  category text not null,
  trigger_annotations text[] not null default '{}',
  trigger_questions text[] not null default '{}',
  source_domains text[] not null default '{}',
  citation_format text not null,
  is_wedge boolean not null default false,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists audit_law_catalog_active_wedge_idx
  on public.audit_law_catalog (is_active, is_wedge);

create index if not exists audit_law_catalog_triggers_idx
  on public.audit_law_catalog using gin (trigger_annotations);

create index if not exists audit_law_catalog_jurisdiction_idx
  on public.audit_law_catalog (jurisdiction);

-- RLS: world-readable (catalog is public reference data)
alter table public.audit_law_catalog enable row level security;

drop policy if exists "law_catalog public read" on public.audit_law_catalog;
create policy "law_catalog public read"
  on public.audit_law_catalog for select
  using (is_active = true);

-- ============================================
-- Helper for idempotent upsert
-- ============================================
create or replace function pg_temp.upsert_law(
  p_id text,
  p_name_en text,
  p_name_zh text,
  p_jurisdiction text,
  p_category text,
  p_triggers text[],
  p_questions text[],
  p_domains text[],
  p_citation_format text,
  p_is_wedge boolean,
  p_notes text
) returns void as $$
begin
  insert into public.audit_law_catalog (
    id, name_en, name_zh, jurisdiction, category,
    trigger_annotations, trigger_questions, source_domains,
    citation_format, is_wedge, notes
  ) values (
    p_id, p_name_en, p_name_zh, p_jurisdiction, p_category,
    p_triggers, p_questions, p_domains,
    p_citation_format, p_is_wedge, p_notes
  )
  on conflict (id) do update set
    name_en = excluded.name_en,
    name_zh = excluded.name_zh,
    jurisdiction = excluded.jurisdiction,
    category = excluded.category,
    trigger_annotations = excluded.trigger_annotations,
    trigger_questions = excluded.trigger_questions,
    source_domains = excluded.source_domains,
    citation_format = excluded.citation_format,
    is_wedge = excluded.is_wedge,
    notes = excluded.notes,
    updated_at = now();
end;
$$ language plpgsql;

-- ============================================
-- Common authoritative source domains
-- (used across multiple laws — kept as comments for reference)
--   nist.gov, csrc.nist.gov         -- NIST guidance
--   iso.org                          -- ISO standards
--   ftc.gov                          -- FTC enforcement, guidance
--   eeoc.gov                         -- employment discrimination
--   cfpb.gov                         -- consumer finance
--   sec.gov, federalreserve.gov      -- financial regulators
--   fda.gov                          -- medical device / SaMD
--   hhs.gov                          -- HIPAA
--   congress.gov, federalregister.gov, regulations.gov  -- statutes/rules
--   law.cornell.edu                  -- LII (free statute access)
--   iapp.org                         -- privacy professional analysis
--   ssrn.com                         -- legal scholarship
-- ============================================

-- ============================================
-- WEDGE 1: NIST AI RMF
-- ============================================
select pg_temp.upsert_law(
  'nist_ai_rmf',
  'NIST AI Risk Management Framework (AI RMF 1.0 + GenAI Profile)',
  'NIST 人工智能风险管理框架',
  'US-federal',
  'ai_governance',
  array[
    'ai_system','automated_decision','model_training_use','model_evaluation',
    'consequential_decision','safety_critical','safety_relevant',
    'consumer_facing','employment_decision','credit_decision',
    'healthcare_use','genai','foundation_model','llm_use','agent_system'
  ],
  array[
    'Is this AI system used to make or substantially inform decisions about people (employment, lending, housing, healthcare, education)?',
    'Have you established a documented governance process (roles, responsibilities, accountability) for this AI system?',
    'Do you measure model performance on representative populations including protected demographics?',
    'What is the deployment context — internal tool, public-facing product, or third-party integration?',
    'Has this system been mapped against the four NIST AI RMF functions (GOVERN, MAP, MEASURE, MANAGE)?'
  ],
  array[
    'nist.gov','csrc.nist.gov','airc.nist.gov',
    'ftc.gov','eeoc.gov',
    'federalregister.gov','regulations.gov',
    'iapp.org','ssrn.com'
  ],
  'NIST AI RMF {section}',
  true,
  'Voluntary US framework but treated as de facto standard. EEOC, FTC, and most enterprise procurement reference it. Maps to GOVERN / MAP / MEASURE / MANAGE.'
);

-- ============================================
-- WEDGE 1: ISO/IEC 42001
-- ============================================
select pg_temp.upsert_law(
  'iso_42001',
  'ISO/IEC 42001 — AI Management System',
  'ISO/IEC 42001 人工智能管理体系',
  'international',
  'ai_governance',
  array[
    'ai_system','enterprise_deployment','third_party_ai','ai_supply_chain',
    'model_training_use','model_evaluation','automated_decision',
    'continuous_monitoring','incident_response','procurement_ai'
  ],
  array[
    'Is your organization seeking ISO 42001 certification or treating it as an internal benchmark?',
    'Do you have a documented AI management system covering policy, roles, risk register, and change control?',
    'How is AI supplier / third-party model risk assessed in your procurement process?',
    'Do you track AI-related incidents and corrective actions?',
    'What is the scope of the management system — single product, business unit, or whole company?'
  ],
  array[
    'iso.org','iec.ch',
    'nist.gov','csrc.nist.gov',
    'iaf.nu',
    'iapp.org','ssrn.com'
  ],
  'ISO/IEC 42001:2023 §{clause}',
  true,
  'International standard, finalized December 2023. Big-enterprise procurement increasingly requires it. Maps to PDCA cycle plus Annex A controls (A.2 through A.10).'
);

-- ============================================
-- BREADTH: Colorado AI Act (SB 24-205)
-- ============================================
select pg_temp.upsert_law(
  'colorado_ai_act',
  'Colorado AI Act (SB 24-205) — Consumer Protections for Artificial Intelligence',
  '科罗拉多州人工智能法案 (SB 24-205)',
  'US-CO',
  'consumer_protection',
  array[
    'consequential_decision','automated_decision','employment_decision',
    'lending','credit_decision','housing_decision','education_decision',
    'healthcare_use','insurance_decision','government_services',
    'colorado_resident_data','consumer_facing'
  ],
  array[
    'Does this AI system make or substantially inform consequential decisions (employment, education, financial services, government services, healthcare, housing, insurance, legal services)?',
    'Do you serve consumers in Colorado?',
    'Do you provide consumers with notice that an AI system is making or informing a decision about them?',
    'Have you completed a risk assessment for high-risk AI systems as defined in the act?'
  ],
  array[
    'leg.colorado.gov','coag.gov',
    'ftc.gov','eeoc.gov','iapp.org','ssrn.com'
  ],
  'Colorado SB 24-205 §{section}',
  false,
  'Effective February 2026. Covers "high-risk" AI in consequential decisions. Algorithmic discrimination duty of reasonable care.'
);

-- ============================================
-- BREADTH: NYC Local Law 144 (Automated Employment Decision Tools)
-- ============================================
select pg_temp.upsert_law(
  'nyc_ll144',
  'NYC Local Law 144 — Automated Employment Decision Tools',
  '纽约市第144号地方法 — 自动化雇佣决策工具',
  'US-NYC',
  'employment',
  array[
    'employment_decision','automated_employment_decision','hiring_decision',
    'promotion_decision','candidate_screening','resume_screening',
    'video_interview_analysis','nyc_employment','consumer_facing'
  ],
  array[
    'Does the AI system substantially assist or replace human discretion in employment decisions (hiring, promotion)?',
    'Are any candidates or employees located in NYC, or are positions located in NYC?',
    'Have you completed an annual independent bias audit?',
    'Do you provide notice to candidates at least 10 business days before use?'
  ],
  array[
    'nyc.gov','www1.nyc.gov',
    'eeoc.gov','dol.gov','iapp.org','ssrn.com'
  ],
  'NYC LL144 §{section} (RCNY 5-300 et seq.)',
  false,
  'Effective July 2023. Annual independent bias audit + candidate notice required.'
);

-- ============================================
-- BREADTH: EEOC (Title VII + ADA + ADEA + Equal Pay)
-- ============================================
select pg_temp.upsert_law(
  'eeoc_employment_law',
  'EEOC Employment Discrimination Laws (Title VII, ADA, ADEA, Equal Pay Act)',
  'EEOC 就业歧视法律',
  'US-federal',
  'employment',
  array[
    'employment_decision','automated_employment_decision','hiring_decision',
    'promotion_decision','termination_decision','candidate_screening',
    'demographic_data','protected_class','accommodations'
  ],
  array[
    'Could the AI system''s decisions adversely affect protected groups (race, color, religion, sex, national origin, age 40+, disability)?',
    'Have you tested for disparate impact using the four-fifths rule or equivalent statistical methods?',
    'Does the system accommodate applicants with disabilities (e.g., alternative formats for video interviews)?',
    'Do you retain records of selection decisions for the federal recordkeeping period?'
  ],
  array[
    'eeoc.gov','dol.gov',
    'ftc.gov','justice.gov','law.cornell.edu','ssrn.com'
  ],
  'EEOC {guidance_or_section}',
  false,
  'EEOC 2023 technical assistance document on AI/algorithmic decision-making in employment is the operative guidance.'
);

-- ============================================
-- BREADTH: FTC Section 5 (UDAP) for AI / dark patterns / deceptive claims
-- ============================================
select pg_temp.upsert_law(
  'ftc_act_section5',
  'FTC Act Section 5 — Unfair or Deceptive Acts or Practices',
  'FTC 法第5条 — 不公平或欺诈行为',
  'US-federal',
  'consumer_protection',
  array[
    'consumer_facing','marketing_claims','ai_capability_claim',
    'automated_decision','dark_patterns','deceptive_design',
    'data_collection','third_party_sharing','advertising'
  ],
  array[
    'Does your marketing make claims about AI capabilities (accuracy, fairness, "human-level", "trained on X")?',
    'Can each AI capability claim be substantiated with evidence at the time the claim is made?',
    'Do user-facing flows use design patterns that could be characterized as deceptive (preselected opt-ins, hidden costs, manipulative urgency)?',
    'Are users clearly informed when they are interacting with AI vs a human?'
  ],
  array[
    'ftc.gov','consumer.ftc.gov','federalregister.gov',
    'law.cornell.edu','iapp.org','ssrn.com'
  ],
  'FTC Act §5; FTC {publication_or_consent_decree}',
  false,
  'FTC has stated it will use Section 5 against deceptive AI claims. Recent consent decrees (Rite Aid, Weight Watchers) set precedent.'
);

-- ============================================
-- BREADTH: SR 11-7 (Federal Reserve Model Risk Management) + ECOA
-- ============================================
select pg_temp.upsert_law(
  'sr_11_7_model_risk',
  'Federal Reserve SR 11-7 — Model Risk Management',
  '美联储 SR 11-7 模型风险管理',
  'US-federal',
  'financial_services',
  array[
    'financial_model','credit_decision','lending','underwriting',
    'fraud_detection','aml','kyc','trading_model','risk_model',
    'bank_use','financial_services'
  ],
  array[
    'Is the AI system used by a bank, BHC, or other federally regulated financial institution?',
    'Is there a documented model inventory, model risk tier, and model owner?',
    'Has the model been independently validated by a separate function from the developers?',
    'Do you have ongoing monitoring (back-testing, performance drift) and a kill-switch process?'
  ],
  array[
    'federalreserve.gov','occ.gov','fdic.gov',
    'sec.gov','cfpb.gov','federalregister.gov','ssrn.com'
  ],
  'Federal Reserve SR 11-7 §{section}',
  false,
  'Joint OCC/Fed/FDIC guidance. Foundation of bank model governance. Often cross-applied to AI/ML models.'
);

-- ============================================
-- BREADTH: HIPAA (health data + AI)
-- ============================================
select pg_temp.upsert_law(
  'hipaa',
  'Health Insurance Portability and Accountability Act (HIPAA)',
  'HIPAA 健康保险流通与责任法案',
  'US-federal',
  'healthcare_privacy',
  array[
    'health_data','phi','medical_diagnosis','clinical_decision_support',
    'patient_data','provider_use','insurer_use','model_training_use',
    'third_party_sharing','hipaa_covered_entity'
  ],
  array[
    'Is your organization a covered entity (provider, plan, clearinghouse) or business associate under HIPAA?',
    'Does the AI system process protected health information (PHI)?',
    'Is PHI used to train the model, and if so, was the training data de-identified per Safe Harbor or Expert Determination?',
    'Are there business associate agreements (BAAs) in place with each cloud or AI vendor that touches PHI?'
  ],
  array[
    'hhs.gov','ocrportal.hhs.gov',
    'fda.gov','federalregister.gov','law.cornell.edu','iapp.org','ssrn.com'
  ],
  '45 CFR §{section} (HIPAA)',
  false,
  'Privacy Rule (45 CFR 164.502+), Security Rule (164.302+), Breach Notification (164.400+). PHI in LLM prompts is a frequent compliance failure.'
);

-- ============================================
-- BREADTH: FDA SaMD (AI in medical devices)
-- ============================================
select pg_temp.upsert_law(
  'fda_samd',
  'FDA Software as a Medical Device (SaMD) + AI/ML Action Plan',
  'FDA 软件作为医疗器械 (SaMD) 与 AI/ML 行动计划',
  'US-federal',
  'healthcare_devices',
  array[
    'medical_diagnosis','clinical_decision_support','treatment_recommendation',
    'patient_triage','medical_imaging','diagnostic_ai','therapeutic_ai',
    'samd','medical_device','health_data','safety_critical'
  ],
  array[
    'Does the software diagnose, treat, mitigate, prevent, or cure a disease (i.e., does it meet the FDA definition of a medical device)?',
    'What SaMD risk category applies (FDA risk framework: I/II/III/IV based on healthcare situation × significance of information)?',
    'Are model updates pushed to deployed instances without a new 510(k) submission (covered by Predetermined Change Control Plan)?',
    'Have human-readable labeling and intended-use statements been developed?'
  ],
  array[
    'fda.gov','accessdata.fda.gov',
    'hhs.gov','federalregister.gov','law.cornell.edu','ssrn.com'
  ],
  'FDA {guidance_or_510k_section}',
  false,
  'FDA AI/ML Action Plan (2021) + Predetermined Change Control Plan guidance (2023). Locked vs adaptive algorithms have different pathways.'
);

-- ============================================
-- BREADTH: BIPA (Illinois biometric)
-- ============================================
select pg_temp.upsert_law(
  'bipa_illinois',
  'Illinois Biometric Information Privacy Act (BIPA)',
  '伊利诺伊州生物识别信息隐私法',
  'US-IL',
  'privacy_biometric',
  array[
    'biometric','face_image','facial_recognition','voice_print',
    'fingerprint','retina_scan','hand_geometry','illinois_resident_data',
    'consumer_facing','employee_biometric'
  ],
  array[
    'Does the system collect, capture, purchase, receive through trade, or otherwise obtain biometric identifiers (retina, iris, fingerprint, voiceprint, scan of hand or face geometry)?',
    'Are any data subjects located in Illinois, including employees?',
    'Have you obtained written, informed consent before collection, with disclosure of purpose, length of storage, and destruction schedule?',
    'Have you published a written retention and destruction policy?'
  ],
  array[
    'ilga.gov','illinoisattorneygeneral.gov',
    'law.cornell.edu','iapp.org','ssrn.com'
  ],
  '740 ILCS 14/{section} (BIPA)',
  false,
  'Private right of action with statutory damages ($1K-$5K per violation). Largest source of biometric AI litigation in US.'
);

-- ============================================
-- BREADTH: COPPA (children)
-- ============================================
select pg_temp.upsert_law(
  'coppa',
  'Children''s Online Privacy Protection Act (COPPA)',
  'COPPA 儿童在线隐私保护法',
  'US-federal',
  'privacy_children',
  array[
    'minors','children_under_13','student_data','education_use',
    'consumer_facing','data_collection','third_party_sharing','model_training_use'
  ],
  array[
    'Is the service directed to children under 13, or do you have actual knowledge that you are collecting information from children under 13?',
    'Have you obtained verifiable parental consent before collecting personal information from children?',
    'Is children''s data used to train AI models, and if so, was that disclosed and consented to?',
    'Do you minimize data collection to what is reasonably necessary for the activity?'
  ],
  array[
    'ftc.gov','consumer.ftc.gov',
    'federalregister.gov','law.cornell.edu','ssrn.com'
  ],
  '16 CFR Part 312 (COPPA Rule); 15 USC §§6501-6506',
  false,
  'FTC enforces. 2025 amendments tightened requirements around AI training data and ed-tech.'
);

-- ============================================
-- BREADTH: CCPA / CPRA (California consumer privacy + ADMT)
-- ============================================
select pg_temp.upsert_law(
  'ccpa_cpra',
  'California Consumer Privacy Act (CCPA / CPRA) + Automated Decision-Making Technology Rules',
  '加州消费者隐私法 (CCPA/CPRA) 与自动化决策技术规则',
  'US-CA',
  'privacy_consumer',
  array[
    'california_resident_data','consumer_facing','automated_decision',
    'profiling','sensitive_personal_information','third_party_sharing',
    'data_collection','data_retention','model_training_use'
  ],
  array[
    'Do you process personal information of California residents (consumers, employees, or business contacts)?',
    'Does the system perform automated decision-making technology (ADMT) that produces legal or similarly significant effects?',
    'Have you provided notice at collection of categories collected, purposes of use, and retention periods?',
    'Do you honor consumer rights (access, deletion, correction, opt-out of sale/share, opt-out of ADMT)?'
  ],
  array[
    'oag.ca.gov','cppa.ca.gov',
    'ftc.gov','iapp.org','law.cornell.edu','ssrn.com'
  ],
  'Cal. Civ. Code §{section} (CCPA/CPRA); CCPA Regs §{section}',
  false,
  'CPPA finalized ADMT rules late 2025. Pre-use notice + opt-out + access right become operative phase by phase.'
);

-- ============================================
-- BREADTH: EU AI Act (only triggers when EU deployment confirmed)
-- ============================================
select pg_temp.upsert_law(
  'eu_ai_act',
  'EU AI Act (Regulation (EU) 2024/1689)',
  '欧盟人工智能法案',
  'EU',
  'ai_governance',
  array[
    'eu_resident_data','eu_deployment','high_risk_ai','prohibited_ai_practice',
    'biometric','employment_decision','education_decision','credit_decision',
    'critical_infrastructure','law_enforcement_use','genai','foundation_model'
  ],
  array[
    'Is the AI system placed on the EU market or are its outputs used in the EU?',
    'Does the system fall in any prohibited category (Article 5: social scoring, real-time biometric ID in public spaces, etc.)?',
    'Is the system listed in Annex III (high-risk: employment, education, credit, critical infrastructure, etc.)?',
    'Is this a general-purpose AI model, and if so, does it meet the systemic-risk threshold?'
  ],
  array[
    'eur-lex.europa.eu','digital-strategy.ec.europa.eu',
    'edpb.europa.eu','iapp.org','ssrn.com'
  ],
  'EU AI Act Art. {article}',
  false,
  'Phased application 2024-2027. Prohibited practices effective Feb 2025. High-risk obligations apply Aug 2026. GPAI rules from Aug 2025.'
);

-- ============================================
-- BREADTH: GDPR (only triggers when EU resident data confirmed)
-- ============================================
select pg_temp.upsert_law(
  'gdpr',
  'EU General Data Protection Regulation (GDPR)',
  '欧盟通用数据保护条例 (GDPR)',
  'EU',
  'privacy_consumer',
  array[
    'eu_resident_data','automated_decision','profiling','consent',
    'data_collection','data_retention','third_party_sharing','model_training_use'
  ],
  array[
    'Do you process personal data of individuals in the EU/EEA, regardless of where your company is located?',
    'Is processing based on a lawful basis under Article 6 (and Article 9 for special categories)?',
    'Does the system make solely automated decisions that produce legal or similarly significant effects (Article 22)?',
    'Have you completed a Data Protection Impact Assessment (DPIA) for high-risk processing?'
  ],
  array[
    'gdpr.eu','edpb.europa.eu','eur-lex.europa.eu',
    'iapp.org','ssrn.com'
  ],
  'GDPR Art. {article}',
  false,
  'Article 22 governs automated decision-making. Article 35 governs DPIAs. EDPB guidelines are operative interpretation.'
);

-- Drop the temp helper (cleans up automatically at session end, but explicit)
-- (No-op if anonymous block ended; left for clarity.)
