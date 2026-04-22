-- Fixes Supabase security alert: persona_marketplace_reviews was created in
-- migration 025 without row-level security. Enables RLS + policies matching
-- the app's access pattern (public read, author-only write), and sets the
-- associated aggregate view to security_invoker so RLS flows through it.

alter table public.persona_marketplace_reviews enable row level security;

create policy "persona_marketplace_reviews_public_select"
  on public.persona_marketplace_reviews for select
  using (true);

create policy "persona_marketplace_reviews_author_insert"
  on public.persona_marketplace_reviews for insert
  with check (auth.uid() = author_id);

create policy "persona_marketplace_reviews_author_update"
  on public.persona_marketplace_reviews for update
  using (auth.uid() = author_id)
  with check (auth.uid() = author_id);

create policy "persona_marketplace_reviews_author_delete"
  on public.persona_marketplace_reviews for delete
  using (auth.uid() = author_id);

alter view public.persona_marketplace_stats set (security_invoker = true);
