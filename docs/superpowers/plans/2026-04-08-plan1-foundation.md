# Plan 1: Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Set up the full project scaffolding with auth, database, i18n, and base layout so that subsequent plans can build features on a working foundation.

**Architecture:** Next.js 15 (App Router) with Supabase for auth/database, next-intl for i18n (zh/en), Tailwind CSS + Shadcn/UI for styling. Monorepo with shared types between frontend and future worker.

**Tech Stack:** Next.js 15, TypeScript, Supabase, next-intl, Tailwind CSS, Shadcn/UI, Framer Motion

---

## File Structure

```
persona/
├── package.json
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── .env.local
├── .gitignore
├── messages/
│   ├── zh.json                    # Chinese translations
│   └── en.json                    # English translations
├── src/
│   ├── app/
│   │   ├── [locale]/
│   │   │   ├── layout.tsx         # Root layout with providers
│   │   │   ├── page.tsx           # Landing page (placeholder)
│   │   │   ├── auth/
│   │   │   │   ├── login/page.tsx
│   │   │   │   ├── register/page.tsx
│   │   │   │   └── callback/route.ts
│   │   │   ├── dashboard/
│   │   │   │   └── page.tsx       # Placeholder
│   │   │   ├── evaluate/
│   │   │   │   ├── new/page.tsx   # Placeholder
│   │   │   │   └── [id]/
│   │   │   │       ├── progress/page.tsx  # Placeholder
│   │   │   │       └── result/page.tsx    # Placeholder
│   │   │   ├── pricing/page.tsx   # Placeholder
│   │   │   └── settings/page.tsx  # Placeholder
│   │   └── api/
│   │       └── health/route.ts    # Health check endpoint
│   ├── components/
│   │   ├── ui/                    # Shadcn/UI components (auto-generated)
│   │   └── layout/
│   │       ├── header.tsx
│   │       ├── footer.tsx
│   │       ├── sidebar.tsx
│   │       ├── locale-switcher.tsx
│   │       └── user-menu.tsx
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts          # Browser client
│   │   │   ├── server.ts          # Server client
│   │   │   └── middleware.ts      # Auth middleware helper
│   │   └── utils.ts               # cn() helper
│   ├── i18n/
│   │   ├── request.ts             # next-intl request config
│   │   └── routing.ts             # Locale routing config
│   ├── middleware.ts               # Root middleware (auth + i18n)
│   └── types/
│       └── database.ts            # Supabase generated types
├── shared/
│   └── types/
│       ├── persona.ts             # Persona 11-layer type definitions
│       ├── evaluation.ts          # Evaluation types
│       └── report.ts              # Report types
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql # Full database schema
└── worker/                        # Empty placeholder for Plan 2
    └── .gitkeep
```

---

### Task 1: Initialize Next.js Project

**Files:**
- Create: `package.json`, `next.config.ts`, `tsconfig.json`, `tailwind.config.ts`, `.gitignore`, `.env.local`

- [ ] **Step 1: Create Next.js project**

Run:
```bash
cd /Users/pinan/Desktop/persona
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm
```

When prompted, accept defaults. If it asks about overwriting, say yes.

- [ ] **Step 2: Install core dependencies**

Run:
```bash
npm install @supabase/supabase-js @supabase/ssr next-intl framer-motion stripe
npm install -D supabase @types/node
```

- [ ] **Step 3: Set up environment file**

Create `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

- [ ] **Step 4: Update .gitignore**

Append to `.gitignore`:
```
.env.local
.env*.local
.superpowers/
```

- [ ] **Step 5: Verify dev server starts**

Run: `npm run dev`
Expected: Server starts at http://localhost:3000 without errors.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: initialize Next.js 15 project with core dependencies"
```

---

### Task 2: Set Up Shadcn/UI

**Files:**
- Create: `src/lib/utils.ts`, `components.json`
- Modify: `tailwind.config.ts`

- [ ] **Step 1: Initialize Shadcn/UI**

Run:
```bash
npx shadcn@latest init
```

When prompted:
- Style: Default
- Base color: Slate
- CSS variables: Yes

- [ ] **Step 2: Install essential Shadcn/UI components**

Run:
```bash
npx shadcn@latest add button card input label separator avatar dropdown-menu sheet tabs badge dialog form toast
```

- [ ] **Step 3: Verify utils.ts exists**

Read `src/lib/utils.ts` and confirm it contains the `cn()` helper function.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: set up Shadcn/UI with essential components"
```

---

### Task 3: Shared Type Definitions

**Files:**
- Create: `shared/types/persona.ts`, `shared/types/evaluation.ts`, `shared/types/report.ts`

- [ ] **Step 1: Create shared types directory**

Run: `mkdir -p shared/types`

- [ ] **Step 2: Create persona types**

Create `shared/types/persona.ts`:
```typescript
export interface PersonaIdentity {
  name: string;
  avatar: string;
  tagline: string;
  locale_variants: {
    zh: { name: string; tagline: string };
    en: { name: string; tagline: string };
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
  persuadability: number; // 0-1
  triggers: string[];
  resistances: string[];
}

export interface PersonaEmotionalState {
  baseline: string;
  stress_factors: string[];
  motivation: string;
}

export interface PersonaPsychology {
  personality_type: string; // MBTI
  decision_making: PersonaDecisionMaking;
  cognitive_biases: string[];
  emotional_state: PersonaEmotionalState;
  risk_tolerance: number; // 0-1
  patience_level: number; // 0-1
}

export interface PersonaProductEvaluation {
  first_impression_weight: number; // 0-1
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
```

- [ ] **Step 3: Create evaluation types**

Create `shared/types/evaluation.ts`:
```typescript
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
  attachments: string[]; // storage paths
  created_at: string;
}

export interface EvaluationScores {
  usability: number;
  market_fit: number;
  design: number;
  tech_quality: number;
  innovation: number;
  pricing: number;
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
```

- [ ] **Step 4: Create report types**

Create `shared/types/report.ts`:
```typescript
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
  sides: { persona_ids: string[]; position: string }[];
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
  initial_adoption: { persona_id: string; stance: "positive" | "neutral" | "negative" }[];
  influence_events: { influencer_id: string; influenced_id: string; shift: string; reason: string }[];
  final_adoption: { persona_id: string; stance: "positive" | "neutral" | "negative" }[];
  adoption_rate_shift: number; // percentage change
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
  scenario_simulation: ScenarioSimulationResult | null; // Max plan only
}
```

- [ ] **Step 5: Add path alias for shared types**

Add to `tsconfig.json` in `compilerOptions.paths`:
```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"],
      "@shared/*": ["./shared/*"]
    }
  }
}
```

- [ ] **Step 6: Commit**

```bash
git add shared/
git commit -m "feat: add shared type definitions for persona, evaluation, and report"
```

---

### Task 4: Supabase Database Schema

**Files:**
- Create: `supabase/migrations/001_initial_schema.sql`

- [ ] **Step 1: Create migrations directory**

Run: `mkdir -p supabase/migrations`

- [ ] **Step 2: Write the migration**

Create `supabase/migrations/001_initial_schema.sql`:
```sql
-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================
-- Subscriptions
-- ============================================
create table public.subscriptions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'pro', 'max')),
  stripe_customer_id text,
  stripe_subscription_id text,
  evaluations_used integer not null default 0,
  evaluations_limit integer not null default 1,
  current_period_start timestamptz not null default now(),
  current_period_end timestamptz not null default (now() + interval '30 days'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id)
);

-- ============================================
-- Personas (platform-maintained)
-- ============================================
create table public.personas (
  id uuid primary key default uuid_generate_v4(),
  identity jsonb not null,
  demographics jsonb not null,
  social_context jsonb not null,
  financial_profile jsonb not null,
  psychology jsonb not null,
  behaviors jsonb not null,
  evaluation_lens jsonb not null,
  life_narrative jsonb not null,
  internal_conflicts jsonb not null,
  contextual_behaviors jsonb not null,
  latent_needs jsonb not null,
  system_prompt text not null,
  category text not null check (category in ('technical', 'product', 'design', 'end_user', 'business')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ============================================
-- Projects
-- ============================================
create table public.projects (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  raw_input text not null,
  parsed_data jsonb not null default '{}',
  url text,
  attachments text[] not null default '{}',
  created_at timestamptz not null default now()
);

-- ============================================
-- Evaluations
-- ============================================
create table public.evaluations (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references public.projects(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'failed')),
  selected_persona_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

-- ============================================
-- Persona Reviews
-- ============================================
create table public.persona_reviews (
  id uuid primary key default uuid_generate_v4(),
  evaluation_id uuid not null references public.evaluations(id) on delete cascade,
  persona_id uuid not null references public.personas(id) on delete cascade,
  scores jsonb not null default '{}',
  review_text text not null default '',
  strengths text[] not null default '{}',
  weaknesses text[] not null default '{}',
  llm_model text not null default '',
  created_at timestamptz not null default now()
);

-- ============================================
-- Summary Reports
-- ============================================
create table public.summary_reports (
  id uuid primary key default uuid_generate_v4(),
  evaluation_id uuid not null references public.evaluations(id) on delete cascade,
  overall_score numeric(3,1) not null default 0,
  persona_analysis jsonb not null default '{}',
  multi_dimensional_analysis jsonb not null default '[]',
  goal_assessment jsonb not null default '[]',
  if_not_feasible jsonb not null default '{}',
  if_feasible jsonb not null default '{}',
  action_items jsonb not null default '[]',
  market_readiness text not null default 'low' check (market_readiness in ('low', 'medium', 'high')),
  scenario_simulation jsonb,
  created_at timestamptz not null default now(),
  unique(evaluation_id)
);

-- ============================================
-- Row Level Security (RLS)
-- ============================================
alter table public.subscriptions enable row level security;
alter table public.personas enable row level security;
alter table public.projects enable row level security;
alter table public.evaluations enable row level security;
alter table public.persona_reviews enable row level security;
alter table public.summary_reports enable row level security;

-- Subscriptions: users can only see their own
create policy "Users can view own subscription"
  on public.subscriptions for select
  using (auth.uid() = user_id);

create policy "Users can update own subscription"
  on public.subscriptions for update
  using (auth.uid() = user_id);

-- Personas: everyone can read active personas
create policy "Anyone can view active personas"
  on public.personas for select
  using (is_active = true);

-- Projects: users can CRUD their own
create policy "Users can view own projects"
  on public.projects for select
  using (auth.uid() = user_id);

create policy "Users can create projects"
  on public.projects for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own projects"
  on public.projects for delete
  using (auth.uid() = user_id);

-- Evaluations: users can view their own (via project)
create policy "Users can view own evaluations"
  on public.evaluations for select
  using (
    project_id in (
      select id from public.projects where user_id = auth.uid()
    )
  );

create policy "Users can create evaluations"
  on public.evaluations for insert
  with check (
    project_id in (
      select id from public.projects where user_id = auth.uid()
    )
  );

-- Persona Reviews: users can view reviews for their evaluations
create policy "Users can view own persona reviews"
  on public.persona_reviews for select
  using (
    evaluation_id in (
      select e.id from public.evaluations e
      join public.projects p on e.project_id = p.id
      where p.user_id = auth.uid()
    )
  );

-- Summary Reports: users can view their own
create policy "Users can view own summary reports"
  on public.summary_reports for select
  using (
    evaluation_id in (
      select e.id from public.evaluations e
      join public.projects p on e.project_id = p.id
      where p.user_id = auth.uid()
    )
  );

-- ============================================
-- Indexes
-- ============================================
create index idx_subscriptions_user_id on public.subscriptions(user_id);
create index idx_projects_user_id on public.projects(user_id);
create index idx_evaluations_project_id on public.evaluations(project_id);
create index idx_evaluations_status on public.evaluations(status);
create index idx_persona_reviews_evaluation_id on public.persona_reviews(evaluation_id);
create index idx_summary_reports_evaluation_id on public.summary_reports(evaluation_id);
create index idx_personas_category on public.personas(category);

-- ============================================
-- Function: auto-create subscription on signup
-- ============================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.subscriptions (user_id, plan, evaluations_limit)
  values (new.id, 'free', 1);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================
-- Function: enable realtime for evaluations
-- ============================================
alter publication supabase_realtime add table public.evaluations;
alter publication supabase_realtime add table public.persona_reviews;
```

- [ ] **Step 3: Apply migration to Supabase**

If using local Supabase:
```bash
npx supabase start
npx supabase db reset
```

If using hosted Supabase, apply via the Supabase dashboard SQL editor by pasting the migration content.

- [ ] **Step 4: Commit**

```bash
git add supabase/
git commit -m "feat: add initial database schema with RLS policies"
```

---

### Task 5: Supabase Client Setup

**Files:**
- Create: `src/lib/supabase/client.ts`, `src/lib/supabase/server.ts`, `src/lib/supabase/middleware.ts`

- [ ] **Step 1: Create Supabase browser client**

Create `src/lib/supabase/client.ts`:
```typescript
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

- [ ] **Step 2: Create Supabase server client**

Create `src/lib/supabase/server.ts`:
```typescript
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // setAll called from Server Component — ignore
          }
        },
      },
    }
  );
}
```

- [ ] **Step 3: Create Supabase middleware helper**

Create `src/lib/supabase/middleware.ts`:
```typescript
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest, response: NextResponse) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { user, response };
}
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/supabase/
git commit -m "feat: add Supabase client setup (browser, server, middleware)"
```

---

### Task 6: i18n Setup with next-intl

**Files:**
- Create: `src/i18n/routing.ts`, `src/i18n/request.ts`, `messages/en.json`, `messages/zh.json`
- Modify: `next.config.ts`

- [ ] **Step 1: Create routing config**

Create `src/i18n/routing.ts`:
```typescript
import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["zh", "en"],
  defaultLocale: "zh",
});
```

- [ ] **Step 2: Create request config**

Create `src/i18n/request.ts`:
```typescript
import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;

  if (!locale || !routing.locales.includes(locale as "zh" | "en")) {
    locale = routing.defaultLocale;
  }

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
```

- [ ] **Step 3: Create English translations**

Create `messages/en.json`:
```json
{
  "common": {
    "appName": "Persona",
    "tagline": "AI-Powered Virtual Focus Group",
    "login": "Log In",
    "register": "Sign Up",
    "logout": "Log Out",
    "dashboard": "Dashboard",
    "newEvaluation": "New Evaluation",
    "pricing": "Pricing",
    "settings": "Settings",
    "loading": "Loading...",
    "error": "Something went wrong",
    "save": "Save",
    "cancel": "Cancel",
    "submit": "Submit",
    "back": "Back"
  },
  "landing": {
    "hero": "Validate Your Product Before You Spend",
    "subtitle": "AI personas simulate real user feedback. Know if your product will succeed before investing in marketing.",
    "cta": "Get Started Free"
  },
  "auth": {
    "loginTitle": "Welcome Back",
    "registerTitle": "Create Account",
    "email": "Email",
    "password": "Password",
    "loginWith": "Continue with {provider}",
    "noAccount": "Don't have an account?",
    "hasAccount": "Already have an account?"
  },
  "dashboard": {
    "title": "My Projects",
    "empty": "No evaluations yet. Start your first one!",
    "evaluationsUsed": "{used} / {limit} evaluations used this month",
    "plan": "Current Plan: {plan}"
  },
  "evaluation": {
    "inputPlaceholder": "Describe your project, paste a link, or upload a file...",
    "startEvaluation": "Start Evaluation",
    "selectPersonas": "Select Personas",
    "recommended": "Recommended",
    "inProgress": "Evaluation in progress...",
    "completed": "Evaluation complete"
  },
  "pricing": {
    "title": "Choose Your Plan",
    "free": "Free",
    "pro": "Pro",
    "max": "Max",
    "perMonth": "/month",
    "evaluationsPerMonth": "{count} evaluations/month",
    "personasPerEvaluation": "Up to {count} personas",
    "currentPlan": "Current Plan",
    "upgrade": "Upgrade"
  }
}
```

- [ ] **Step 4: Create Chinese translations**

Create `messages/zh.json`:
```json
{
  "common": {
    "appName": "Persona",
    "tagline": "AI 虚拟焦点小组",
    "login": "登录",
    "register": "注册",
    "logout": "退出登录",
    "dashboard": "仪表盘",
    "newEvaluation": "新建评价",
    "pricing": "定价",
    "settings": "设置",
    "loading": "加载中...",
    "error": "出了点问题",
    "save": "保存",
    "cancel": "取消",
    "submit": "提交",
    "back": "返回"
  },
  "landing": {
    "hero": "在花钱之前，先验证你的产品",
    "subtitle": "AI 人格模拟真实用户反馈，在投入营销之前就知道你的产品能否成功。",
    "cta": "免费开始"
  },
  "auth": {
    "loginTitle": "欢迎回来",
    "registerTitle": "创建账户",
    "email": "邮箱",
    "password": "密码",
    "loginWith": "使用 {provider} 登录",
    "noAccount": "还没有账户？",
    "hasAccount": "已有账户？"
  },
  "dashboard": {
    "title": "我的项目",
    "empty": "还没有评价记录，开始你的第一次评价吧！",
    "evaluationsUsed": "本月已使用 {used} / {limit} 次评价",
    "plan": "当前套餐：{plan}"
  },
  "evaluation": {
    "inputPlaceholder": "描述你的项目、粘贴链接、或上传文件...",
    "startEvaluation": "开始评价",
    "selectPersonas": "选择人格",
    "recommended": "推荐",
    "inProgress": "评价进行中...",
    "completed": "评价完成"
  },
  "pricing": {
    "title": "选择你的套餐",
    "free": "免费版",
    "pro": "Pro",
    "max": "Max",
    "perMonth": "/月",
    "evaluationsPerMonth": "每月 {count} 次评价",
    "personasPerEvaluation": "最多 {count} 个人格",
    "currentPlan": "当前套餐",
    "upgrade": "升级"
  }
}
```

- [ ] **Step 5: Update next.config.ts**

Replace `next.config.ts` with:
```typescript
import createNextIntlPlugin from "next-intl/plugin";
import type { NextConfig } from "next";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {};

export default withNextIntl(nextConfig);
```

- [ ] **Step 6: Commit**

```bash
git add src/i18n/ messages/ next.config.ts
git commit -m "feat: set up next-intl with zh/en translations"
```

---

### Task 7: Root Middleware (Auth + i18n)

**Files:**
- Create: `src/middleware.ts`

- [ ] **Step 1: Create middleware**

Create `src/middleware.ts`:
```typescript
import createMiddleware from "next-intl/middleware";
import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { routing } from "@/i18n/routing";

const intlMiddleware = createMiddleware(routing);

// Routes that require authentication
const protectedRoutes = ["/dashboard", "/evaluate", "/settings"];

// Routes that should redirect to dashboard if already logged in
const authRoutes = ["/auth/login", "/auth/register"];

export async function middleware(request: NextRequest) {
  // Run i18n middleware first to get locale-aware response
  const response = intlMiddleware(request);

  // Run Supabase session refresh
  const { user } = await updateSession(request, response);

  const { pathname } = request.nextUrl;
  // Strip locale prefix for route matching
  const pathnameWithoutLocale = pathname.replace(/^\/(zh|en)/, "") || "/";

  // Redirect unauthenticated users away from protected routes
  const isProtected = protectedRoutes.some((route) =>
    pathnameWithoutLocale.startsWith(route)
  );
  if (isProtected && !user) {
    const locale = pathname.startsWith("/en") ? "en" : "zh";
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}/auth/login`;
    return NextResponse.redirect(url);
  }

  // Redirect authenticated users away from auth routes
  const isAuthRoute = authRoutes.some((route) =>
    pathnameWithoutLocale.startsWith(route)
  );
  if (isAuthRoute && user) {
    const locale = pathname.startsWith("/en") ? "en" : "zh";
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}/dashboard`;
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/", "/(zh|en)/:path*"],
};
```

- [ ] **Step 2: Commit**

```bash
git add src/middleware.ts
git commit -m "feat: add root middleware with auth protection and i18n routing"
```

---

### Task 8: Root Layout with Providers

**Files:**
- Create: `src/app/[locale]/layout.tsx`
- Delete: `src/app/layout.tsx`, `src/app/page.tsx` (old non-i18n files)

- [ ] **Step 1: Remove default files**

Run:
```bash
rm -f src/app/layout.tsx src/app/page.tsx
```

- [ ] **Step 2: Create locale layout**

Create `src/app/[locale]/layout.tsx`:
```typescript
import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import "@/app/globals.css";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "common" });
  return {
    title: {
      default: `${t("appName")} - ${t("tagline")}`,
      template: `%s | ${t("appName")}`,
    },
    description: t("tagline"),
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as "zh" | "en")) {
    notFound();
  }

  const messages = await getMessages();

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans antialiased">
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Ensure globals.css exists**

Verify `src/app/globals.css` exists (created by Shadcn init). It should contain Tailwind directives and CSS variables.

- [ ] **Step 4: Commit**

```bash
git add src/app/
git commit -m "feat: add locale-aware root layout with next-intl provider"
```

---

### Task 9: Layout Components (Header, Sidebar, Footer)

**Files:**
- Create: `src/components/layout/header.tsx`, `src/components/layout/sidebar.tsx`, `src/components/layout/footer.tsx`, `src/components/layout/locale-switcher.tsx`, `src/components/layout/user-menu.tsx`

- [ ] **Step 1: Create locale switcher**

Create `src/components/layout/locale-switcher.tsx`:
```typescript
"use client";

import { useLocale } from "next-intl";
import { useRouter, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";

export function LocaleSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  function switchLocale() {
    const newLocale = locale === "zh" ? "en" : "zh";
    const newPath = pathname.replace(`/${locale}`, `/${newLocale}`);
    router.push(newPath);
  }

  return (
    <Button variant="ghost" size="sm" onClick={switchLocale}>
      {locale === "zh" ? "EN" : "中文"}
    </Button>
  );
}
```

- [ ] **Step 2: Create user menu**

Create `src/components/layout/user-menu.tsx`:
```typescript
"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface UserMenuProps {
  email: string;
}

export function UserMenu({ email }: UserMenuProps) {
  const t = useTranslations("common");
  const router = useRouter();
  const supabase = createClient();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <Avatar className="h-8 w-8">
          <AvatarFallback>{email[0].toUpperCase()}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem className="text-sm text-muted-foreground" disabled>
          {email}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push("/settings")}>
          {t("settings")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleLogout}>
          {t("logout")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

- [ ] **Step 3: Create header**

Create `src/components/layout/header.tsx`:
```typescript
import Link from "next/link";
import { useLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { LocaleSwitcher } from "./locale-switcher";
import { UserMenu } from "./user-menu";

export async function Header() {
  const t = await getTranslations("common");
  const locale = useLocale();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center justify-between">
        <Link href={`/${locale}`} className="flex items-center gap-2">
          <span className="text-xl font-bold">{t("appName")}</span>
        </Link>

        <nav className="flex items-center gap-2">
          <LocaleSwitcher />
          {user ? (
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/${locale}/dashboard`}>{t("dashboard")}</Link>
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/${locale}/pricing`}>{t("pricing")}</Link>
              </Button>
              <UserMenu email={user.email ?? ""} />
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/${locale}/pricing`}>{t("pricing")}</Link>
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/${locale}/auth/login`}>{t("login")}</Link>
              </Button>
              <Button size="sm" asChild>
                <Link href={`/${locale}/auth/register`}>{t("register")}</Link>
              </Button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
```

- [ ] **Step 4: Create footer**

Create `src/components/layout/footer.tsx`:
```typescript
import { getTranslations } from "next-intl/server";

export async function Footer() {
  const t = await getTranslations("common");

  return (
    <footer className="border-t py-6">
      <div className="container flex items-center justify-center">
        <p className="text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} {t("appName")}. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/
git commit -m "feat: add layout components (header, footer, locale switcher, user menu)"
```

---

### Task 10: Auth Pages (Login + Register + Callback)

**Files:**
- Create: `src/app/[locale]/auth/login/page.tsx`, `src/app/[locale]/auth/register/page.tsx`, `src/app/[locale]/auth/callback/route.ts`

- [ ] **Step 1: Create login page**

Create `src/app/[locale]/auth/login/page.tsx`:
```typescript
"use client";

import { useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

export default function LoginPage() {
  const t = useTranslations("auth");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push(`/${locale}/dashboard`);
      router.refresh();
    }
  }

  async function handleOAuth(provider: "google" | "github") {
    await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/${locale}/auth/callback`,
      },
    });
  }

  return (
    <div className="flex min-h-[80vh] items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center text-2xl">{t("loginTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{t("email")}</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t("password")}</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? tc("loading") : tc("login")}
            </Button>
          </form>

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">or</span>
            </div>
          </div>

          <div className="space-y-2">
            <Button variant="outline" className="w-full" onClick={() => handleOAuth("google")}>
              {t("loginWith", { provider: "Google" })}
            </Button>
            <Button variant="outline" className="w-full" onClick={() => handleOAuth("github")}>
              {t("loginWith", { provider: "GitHub" })}
            </Button>
          </div>
        </CardContent>
        <CardFooter className="justify-center">
          <p className="text-sm text-muted-foreground">
            {t("noAccount")}{" "}
            <Link href={`/${locale}/auth/register`} className="text-primary underline">
              {tc("register")}
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Create register page**

Create `src/app/[locale]/auth/register/page.tsx`:
```typescript
"use client";

import { useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

export default function RegisterPage() {
  const t = useTranslations("auth");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/${locale}/auth/callback`,
      },
    });
    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push(`/${locale}/dashboard`);
      router.refresh();
    }
  }

  async function handleOAuth(provider: "google" | "github") {
    await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/${locale}/auth/callback`,
      },
    });
  }

  return (
    <div className="flex min-h-[80vh] items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center text-2xl">{t("registerTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{t("email")}</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t("password")}</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? tc("loading") : tc("register")}
            </Button>
          </form>

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">or</span>
            </div>
          </div>

          <div className="space-y-2">
            <Button variant="outline" className="w-full" onClick={() => handleOAuth("google")}>
              {t("loginWith", { provider: "Google" })}
            </Button>
            <Button variant="outline" className="w-full" onClick={() => handleOAuth("github")}>
              {t("loginWith", { provider: "GitHub" })}
            </Button>
          </div>
        </CardContent>
        <CardFooter className="justify-center">
          <p className="text-sm text-muted-foreground">
            {t("hasAccount")}{" "}
            <Link href={`/${locale}/auth/login`} className="text-primary underline">
              {tc("login")}
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
```

- [ ] **Step 3: Create auth callback handler**

Create `src/app/[locale]/auth/callback/route.ts`:
```typescript
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const locale = request.url.includes("/en/") ? "en" : "zh";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}/${locale}/dashboard`);
    }
  }

  return NextResponse.redirect(`${origin}/${locale}/auth/login`);
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/\[locale\]/auth/
git commit -m "feat: add auth pages (login, register, OAuth callback)"
```

---

### Task 11: Placeholder Pages

**Files:**
- Create: `src/app/[locale]/page.tsx`, `src/app/[locale]/dashboard/page.tsx`, `src/app/[locale]/evaluate/new/page.tsx`, `src/app/[locale]/evaluate/[id]/progress/page.tsx`, `src/app/[locale]/evaluate/[id]/result/page.tsx`, `src/app/[locale]/pricing/page.tsx`, `src/app/[locale]/settings/page.tsx`

- [ ] **Step 1: Create landing page placeholder**

Create `src/app/[locale]/page.tsx`:
```typescript
import Link from "next/link";
import { useLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";

export default async function LandingPage() {
  const t = await getTranslations("landing");
  const tc = await getTranslations("common");
  const locale = useLocale();

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4 text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
          {t("hero")}
        </h1>
        <p className="max-w-2xl text-lg text-muted-foreground">
          {t("subtitle")}
        </p>
        <Button size="lg" asChild>
          <Link href={`/${locale}/auth/register`}>{t("cta")}</Link>
        </Button>
      </main>
      <Footer />
    </div>
  );
}
```

- [ ] **Step 2: Create app shell layout for authenticated pages**

Create `src/app/[locale]/(app)/layout.tsx`:
```typescript
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="container flex-1 py-8">{children}</main>
      <Footer />
    </div>
  );
}
```

- [ ] **Step 3: Create dashboard placeholder**

Create `src/app/[locale]/(app)/dashboard/page.tsx`:
```typescript
import { getTranslations } from "next-intl/server";

export default async function DashboardPage() {
  const t = await getTranslations("dashboard");

  return (
    <div>
      <h1 className="text-3xl font-bold">{t("title")}</h1>
      <p className="mt-4 text-muted-foreground">{t("empty")}</p>
    </div>
  );
}
```

- [ ] **Step 4: Create new evaluation placeholder**

Create `src/app/[locale]/(app)/evaluate/new/page.tsx`:
```typescript
import { getTranslations } from "next-intl/server";

export default async function NewEvaluationPage() {
  const t = await getTranslations("evaluation");

  return (
    <div>
      <h1 className="text-3xl font-bold">{t("selectPersonas")}</h1>
      <p className="mt-4 text-muted-foreground">{t("inputPlaceholder")}</p>
    </div>
  );
}
```

- [ ] **Step 5: Create evaluation progress placeholder**

Create `src/app/[locale]/(app)/evaluate/[id]/progress/page.tsx`:
```typescript
import { getTranslations } from "next-intl/server";

export default async function EvaluationProgressPage() {
  const t = await getTranslations("evaluation");

  return (
    <div>
      <h1 className="text-3xl font-bold">{t("inProgress")}</h1>
    </div>
  );
}
```

- [ ] **Step 6: Create evaluation result placeholder**

Create `src/app/[locale]/(app)/evaluate/[id]/result/page.tsx`:
```typescript
import { getTranslations } from "next-intl/server";

export default async function EvaluationResultPage() {
  const t = await getTranslations("evaluation");

  return (
    <div>
      <h1 className="text-3xl font-bold">{t("completed")}</h1>
    </div>
  );
}
```

- [ ] **Step 7: Create pricing placeholder**

Create `src/app/[locale]/(app)/pricing/page.tsx`:
```typescript
import { getTranslations } from "next-intl/server";

export default async function PricingPage() {
  const t = await getTranslations("pricing");

  return (
    <div>
      <h1 className="text-3xl font-bold">{t("title")}</h1>
    </div>
  );
}
```

- [ ] **Step 8: Create settings placeholder**

Create `src/app/[locale]/(app)/settings/page.tsx`:
```typescript
import { getTranslations } from "next-intl/server";

export default async function SettingsPage() {
  const t = await getTranslations("common");

  return (
    <div>
      <h1 className="text-3xl font-bold">{t("settings")}</h1>
    </div>
  );
}
```

- [ ] **Step 9: Commit**

```bash
git add src/app/
git commit -m "feat: add app shell layout and placeholder pages for all routes"
```

---

### Task 12: Health Check API + Verify Full Stack

**Files:**
- Create: `src/app/api/health/route.ts`

- [ ] **Step 1: Create health check endpoint**

Create `src/app/api/health/route.ts`:
```typescript
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
}
```

- [ ] **Step 2: Create worker placeholder**

Run: `mkdir -p worker && touch worker/.gitkeep`

- [ ] **Step 3: Run dev server and verify**

Run: `npm run dev`

Verify manually:
- http://localhost:3000 → redirects to /zh (landing page)
- http://localhost:3000/en → English landing page
- http://localhost:3000/zh/auth/login → Login page
- http://localhost:3000/zh/dashboard → Redirects to login (not authenticated)
- http://localhost:3000/api/health → Returns JSON `{ status: "ok" }`

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: add health check API and worker placeholder — Plan 1 complete"
```

---

## Summary

Plan 1 delivers:
- Next.js 15 project with TypeScript, Tailwind, Shadcn/UI
- Supabase integration (client, server, middleware)
- Full database schema with RLS policies and auto-subscription trigger
- i18n (zh/en) with next-intl
- Auth flow (email/password + Google/GitHub OAuth)
- Base layout (header, footer, locale switcher, user menu)
- All route placeholders ready for Plan 2-4
- Shared type definitions for the entire system (persona 11-layer model, evaluation, report)

**Next:** Plan 2 (Persona & Evaluation Engine) builds the AI Worker, LLM adapter, and evaluation pipeline on this foundation.
