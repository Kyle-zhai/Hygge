-- Map the 12 existing general-discussion personas into the new hierarchical taxonomy.
-- Matched by identity.name (stable across migration 006). Each persona gets a domain,
-- sub_domain, and 1-3 dimensions that best fit its flavor. Personas remain in category='general'.

UPDATE public.personas SET domain = 'intellectual', sub_domain = 'knowledge',
  dimensions = ARRAY['popsci','experience']
  WHERE identity->>'name' = 'Marcus Chen' AND category = 'general';

UPDATE public.personas SET domain = 'social', sub_domain = 'relationships',
  dimensions = ARRAY['family','social_circle']
  WHERE identity->>'name' = 'Sofia Rivera' AND category = 'general';

UPDATE public.personas SET domain = 'intellectual', sub_domain = 'values',
  dimensions = ARRAY['ethics','life_goals']
  WHERE identity->>'name' = 'James Whitfield' AND category = 'general';

UPDATE public.personas SET domain = 'intellectual', sub_domain = 'values',
  dimensions = ARRAY['beliefs','life_goals']
  WHERE identity->>'name' = 'Priya Sharma' AND category = 'general';

UPDATE public.personas SET domain = 'intellectual', sub_domain = 'opinions',
  dimensions = ARRAY['aesthetics','event_views']
  WHERE identity->>'name' = 'Tyler Brooks' AND category = 'general';

UPDATE public.personas SET domain = 'utility', sub_domain = 'help',
  dimensions = ARRAY['advice','recommendations']
  WHERE identity->>'name' = 'Margaret O''Brien' AND category = 'general';

UPDATE public.personas SET domain = 'social', sub_domain = 'career',
  dimensions = ARRAY['workplace','skills','kpi']
  WHERE identity->>'name' = 'Damon Jackson' AND category = 'general';

UPDATE public.personas SET domain = 'physical', sub_domain = 'finance',
  dimensions = ARRAY['saving','spending_mindset']
  WHERE identity->>'name' = 'Elena Volkov' AND category = 'general';

UPDATE public.personas SET domain = 'social', sub_domain = 'current_affairs',
  dimensions = ARRAY['tech','social_trends']
  WHERE identity->>'name' = 'Raj Patel' AND category = 'general';

UPDATE public.personas SET domain = 'social', sub_domain = 'leisure',
  dimensions = ARRAY['gaming','shows','sports']
  WHERE identity->>'name' = 'Kaylee Thompson' AND category = 'general';

UPDATE public.personas SET domain = 'intellectual', sub_domain = 'opinions',
  dimensions = ARRAY['event_views']
  WHERE identity->>'name' = 'Harold Kim' AND category = 'general';

UPDATE public.personas SET domain = 'physical', sub_domain = 'health',
  dimensions = ARRAY['body_state','fitness','sleep']
  WHERE identity->>'name' = 'Amara Osei' AND category = 'general';
