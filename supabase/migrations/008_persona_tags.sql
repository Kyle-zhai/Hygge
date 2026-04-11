-- Add tags to general discussion personas (2 core tags each)
UPDATE public.personas SET identity = identity || '{"tags": ["Analytical", "Data-Driven"]}'::jsonb WHERE identity->>'name' = 'Marcus Chen';
UPDATE public.personas SET identity = identity || '{"tags": ["Empathetic", "Equity"]}'::jsonb WHERE identity->>'name' = 'Sofia Rivera';
UPDATE public.personas SET identity = identity || '{"tags": ["Conservative", "Traditional"]}'::jsonb WHERE identity->>'name' = 'James Whitfield';
UPDATE public.personas SET identity = identity || '{"tags": ["Philosophical", "Ethics"]}'::jsonb WHERE identity->>'name' = 'Priya Sharma';
UPDATE public.personas SET identity = identity || '{"tags": ["Creative", "Contrarian"]}'::jsonb WHERE identity->>'name' = 'Tyler Brooks';
UPDATE public.personas SET identity = identity || '{"tags": ["Practical", "No-Nonsense"]}'::jsonb WHERE identity->>'name' = 'Margaret O''Brien';
UPDATE public.personas SET identity = identity || '{"tags": ["Entrepreneur", "Growth"]}'::jsonb WHERE identity->>'name' = 'Damon Jackson';
UPDATE public.personas SET identity = identity || '{"tags": ["Security", "Privacy"]}'::jsonb WHERE identity->>'name' = 'Elena Volkov';
UPDATE public.personas SET identity = identity || '{"tags": ["Global", "Cross-Cultural"]}'::jsonb WHERE identity->>'name' = 'Raj Patel';
UPDATE public.personas SET identity = identity || '{"tags": ["Gen Z", "Digital Native"]}'::jsonb WHERE identity->>'name' = 'Kaylee Thompson';
UPDATE public.personas SET identity = identity || '{"tags": ["Devil''s Advocate", "Legal"]}'::jsonb WHERE identity->>'name' = 'Harold Kim';
UPDATE public.personas SET identity = identity || '{"tags": ["Wellness", "Psychology"]}'::jsonb WHERE identity->>'name' = 'Amara Osei';

NOTIFY pgrst, 'reload schema';
