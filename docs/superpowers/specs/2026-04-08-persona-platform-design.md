# Persona - AI Virtual Focus Group Platform

## Overview

A platform that uses AI personas to simulate real-world focus group feedback for indie developers and small teams. Users submit their project, select AI personas, and receive detailed multi-dimensional evaluation reports to validate product-market fit before investing in marketing.

**Target Users:** Indie developers (primary), small startup teams (secondary)
**Languages:** Chinese + English (V1)

---

## Architecture

### System Components

```
Browser (Next.js App Router)
    │
    ├── Supabase (PostgreSQL + Auth + Realtime + Storage)
    │
    ├── Message Queue (BullMQ + Redis)
    │
    └── AI Worker (Node.js)
        ├── Project analysis (parse user input)
        ├── Persona evaluation orchestration
        ├── Summary report generation
        └── Multi-LLM adapter layer
```

### Tech Stack

- **Frontend + API:** Next.js 15 (App Router, Server Components)
- **Database + Auth:** Supabase (PostgreSQL + Auth + Realtime + Storage)
- **Task Queue:** BullMQ + Redis
- **Payments:** Stripe (subscriptions)
- **AI Worker:** Node.js (shares type definitions with frontend)
- **i18n:** next-intl (zh/en)
- **UI:** Tailwind CSS + Shadcn/UI + Framer Motion
- **Deployment:** Vercel (frontend) + Railway/Fly.io (Worker)

### Core Flow

1. User submits project via single input (text, URL, PDF, screenshots)
2. Next.js API → LLM parses input → extracts structured project info → writes to DB + pushes task to queue
3. AI Worker pulls task → generates evaluation for each selected persona
4. All persona evaluations complete → Worker generates deep summary report
5. Supabase Realtime pushes progress and results to frontend
6. User views individual persona reviews + comprehensive report

---

## Data Model

### users (Supabase Auth)
- id, email, avatar, locale (zh/en)

### subscriptions
- user_id
- plan: free | pro | max
- stripe_customer_id, stripe_subscription_id
- evaluations_used, evaluations_limit
- current_period_start, current_period_end

### projects
- id, user_id
- raw_input (original user input text)
- parsed_data: { name, description, target_users, competitors, goals, success_metrics }
- url (optional)
- attachments[] (PDF, screenshots — Supabase Storage)
- created_at

### evaluations
- id, project_id
- status: pending | processing | completed | failed
- selected_persona_ids[]
- created_at, completed_at

### persona_reviews
- id, evaluation_id, persona_id
- scores: { usability, market_fit, design, tech_quality, innovation, pricing }
- review_text (structured review)
- strengths[], weaknesses[]
- llm_model (which model was used)
- created_at

### summary_reports
- id, evaluation_id
- overall_score
- persona_analysis_summary (each persona's core viewpoint, consensus, disagreements)
- multi_dimensional_analysis (deep analysis per dimension with pros/cons)
- goal_assessment (evaluate each user goal individually)
- if_not_feasible: { modifications, direction, priorities, reference_cases }
- if_feasible: { next_steps, optimizations, risks }
- action_items[] (each with priority, expected_impact, difficulty)
- market_readiness: low | medium | high

### personas (platform-maintained)
See Persona System section below.

---

## Persona System (11-Layer Model)

Each persona is defined by 11 layers that create a realistic, three-dimensional character:

### Layer 1: Identity
- name, avatar (generated), tagline
- locale_variants: { zh: {...}, en: {...} }

### Layer 2: Demographics
- age, gender, location
- education, occupation, income_level

### Layer 3: Social Context
- **family:** status, background, financial_support, pressure
- **social_circle:** primary communities, influencers, trust_sources
- **relationships_with_products:** adoption_path, referral_tendency, community_influence

### Layer 4: Financial Profile
- wealth_level, spending_on_tools
- price_sensitivity, payment_preference, free_trial_behavior

### Layer 5: Psychology
- personality_type (MBTI)
- **decision_making:** style, persuadability (0-1), triggers[], resistances[]
- **cognitive_biases[]** (e.g., survivorship bias, anchoring effect)
- **emotional_state:** baseline, stress_factors, motivation
- risk_tolerance (0-1), patience_level (0-1)

### Layer 6: Behaviors
- daily_habits[]
- **product_evaluation:** first_impression_weight, tries_before_judging, deal_breakers[], delighters[]

### Layer 7: Evaluation Lens
- primary_question (the core question this persona asks when evaluating)
- scoring_weights: { usability, market_fit, design, tech_quality, innovation, pricing }
- known_biases[], blind_spots[]

### Layer 8: Life Narrative
- origin_story (what shaped this person)
- turning_points[] (key life events)
- current_chapter (where they are now)
- imagined_future (where they want to be)
- core_fear (deepest worry)

### Layer 9: Internal Conflicts
- Each conflict has:
  - conflict (the tension)
  - manifests_as (how it shows up in evaluations)

### Layer 10: Contextual Behaviors
- when_impressed, when_skeptical, when_confused, when_bored
- first_10_seconds (first impression reaction)
- price_page_reaction

### Layer 11: Latent Needs
- stated_need (what they say they want)
- actual_need (what they really need)
- emotional_need (underlying emotional driver)
- unaware_need (need they don't know they have)

### System Prompt Generation
The system_prompt for each persona is auto-generated from all 11 layers as a natural language character description that the LLM uses to role-play the evaluation.

### V1 Persona Library
12-15 pre-built personas covering:

| Category | Examples | Focus |
|----------|----------|-------|
| Technical | Full-stack developer, CTO | Tech feasibility, architecture |
| Product | Product manager, Entrepreneur | Market fit, business model |
| Design | UI/UX designer | User experience, visual quality |
| End User | College student, Office worker, Freelancer | Actual usage, pain points |
| Business | Investor, Marketing expert | Market size, growth potential |

---

## Summary Report Structure

The summary report is a comprehensive, actionable product diagnosis:

### 1. Persona Analysis Summary
- Each persona's core viewpoint and scoring rationale
- Points of consensus across personas
- Points of disagreement and why they diverge

### 2. Multi-Dimensional Product Analysis
Deep analysis for each dimension:
- Usability
- Market fit
- Design quality
- Technical implementation
- Innovation
- Business model / Pricing

Each dimension includes specific strengths, weaknesses, and comparisons.

### 3. Goal Assessment
- List each goal/success metric the user stated
- Evaluate current product's ability to achieve each goal
- Identify specific gaps

### 4. If Not Feasible: Modification Direction
- What specifically needs to change
- Which direction to pivot toward
- Priority ordering of changes
- Reference cases and examples

### 5. If Feasible: Optimization Path
- How to continue building
- Where to optimize further
- Recommended next actions
- Potential risks to watch

### 6. Executable Action List
Each item includes:
- Specific action description
- Priority level (critical / high / medium / low)
- Expected impact
- Implementation difficulty

---

## Page Structure

| Page | Description |
|------|-------------|
| Landing Page | Product intro, value proposition, pricing, CTA |
| Login / Register | Supabase Auth (email + Google/GitHub OAuth) |
| Dashboard | Project history, subscription status, usage stats |
| New Evaluation | Single input box (ChatGPT-style: text, URL, PDF, screenshots) → persona selection → submit |
| Evaluation In Progress | Real-time progress, persona-by-persona completion status |
| Evaluation Results | Individual persona review cards + deep summary report (single page long report) |
| Subscription Management | Plan selection, Stripe checkout, billing history |
| Settings | Language toggle (zh/en), profile info |

### Input Box Design
- ChatGPT-style: clean, minimal, rounded corners
- Supports: plain text, URL (auto-detected), file attachments (PDF, images)
- Attachment buttons on the left, send button on the right
- Single submission — no multi-turn conversation

---

## Pricing

| | Free | Pro | Max |
|--|------|-----|-----|
| Monthly evaluations | 1 | 10 | 40 |
| Max personas per evaluation | 3 | 10 | 20 |
| Summary report | Brief | Full + Action list | Full + Action list + Real-world scenario simulation |
| Price | $0 | $20/mo | $100/mo |

### Max Exclusive: Real-World Scenario Simulation
Simulates all selected personas in the same physical space (e.g., a meetup, conference, office). Evaluates whether personas who like the product would influence skeptical personas through social dynamics, word-of-mouth, and peer pressure. Outputs a social influence report showing adoption likelihood shifts.

### Cost Analysis (Claude Sonnet 4.6)
- Input: $3/M tokens, Output: $15/M tokens
- Per evaluation cost by persona count:
  - 3 personas: ~$0.27
  - 10 personas: ~$0.55 (without simulation), ~$0.64 (with simulation)
  - 20 personas: ~$0.96 (without simulation), ~$1.10 (with simulation)
- Average Max user selects ~12 personas: ~$0.75/evaluation
- **Pro gross margin: ~73%**
- **Max gross margin: ~70% (average), ~56% (worst case: 20 personas x 40 evaluations)**

---

## V2 Features (Post-MVP)
- Group discussion simulation (personas debating with each other in conversation form)
- User-created custom personas
- Project iteration comparison (re-evaluate after changes, diff the reports)
- Export report as PDF
- Team collaboration features
