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
