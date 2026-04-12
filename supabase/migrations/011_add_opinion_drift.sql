-- ============================================
-- Opinion drift — how each persona's stance
-- would shift after hearing the rest of the room
-- ============================================
-- Captured once per evaluation after all persona reviews land.
-- Shape:
-- [
--   {
--     "persona_id": "uuid",
--     "initial_leaning": "support" | "oppose" | "neutral" | "mixed",
--     "final_leaning":   "support" | "oppose" | "neutral" | "mixed",
--     "shift_magnitude": "none" | "small" | "large",
--     "reasoning": "1-2 sentence narrative of why they would or wouldn't shift"
--   }
-- ]

alter table public.summary_reports
  add column if not exists opinion_drift jsonb;
