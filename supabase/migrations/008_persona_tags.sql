-- Add tags to general discussion personas for compact display
UPDATE public.personas SET identity = identity || '{"tags": ["Analytical", "Data-Driven", "Tech", "Skeptical"]}'::jsonb WHERE identity->>'name' = 'Marcus Chen';
UPDATE public.personas SET identity = identity || '{"tags": ["Empathetic", "Equity-Focused", "Community", "Social Impact"]}'::jsonb WHERE identity->>'name' = 'Sofia Rivera';
UPDATE public.personas SET identity = identity || '{"tags": ["Conservative", "Risk-Averse", "Business", "Traditional"]}'::jsonb WHERE identity->>'name' = 'James Whitfield';
UPDATE public.personas SET identity = identity || '{"tags": ["Philosophical", "Ethics", "Academic", "Nuanced"]}'::jsonb WHERE identity->>'name' = 'Priya Sharma';
UPDATE public.personas SET identity = identity || '{"tags": ["Creative", "Contrarian", "Design", "Anti-Mainstream"]}'::jsonb WHERE identity->>'name' = 'Tyler Brooks';
UPDATE public.personas SET identity = identity || '{"tags": ["Practical", "Common Sense", "Healthcare", "No-Nonsense"]}'::jsonb WHERE identity->>'name' = 'Margaret O''Brien';
UPDATE public.personas SET identity = identity || '{"tags": ["Entrepreneur", "Growth-Focused", "Optimist", "Startup"]}'::jsonb WHERE identity->>'name' = 'Damon Jackson';
UPDATE public.personas SET identity = identity || '{"tags": ["Security", "Privacy", "Cautious", "Risk-Aware"]}'::jsonb WHERE identity->>'name' = 'Elena Volkov';
UPDATE public.personas SET identity = identity || '{"tags": ["Global", "Cross-Cultural", "Development", "Pragmatic"]}'::jsonb WHERE identity->>'name' = 'Raj Patel';
UPDATE public.personas SET identity = identity || '{"tags": ["Gen Z", "Digital Native", "Aesthetic", "Value-Conscious"]}'::jsonb WHERE identity->>'name' = 'Kaylee Thompson';
UPDATE public.personas SET identity = identity || '{"tags": ["Devil''s Advocate", "Legal", "Critical Thinker", "Debate"]}'::jsonb WHERE identity->>'name' = 'Harold Kim';
UPDATE public.personas SET identity = identity || '{"tags": ["Wellness", "Psychology", "Emotional", "Holistic"]}'::jsonb WHERE identity->>'name' = 'Amara Osei';

NOTIFY pgrst, 'reload schema';
