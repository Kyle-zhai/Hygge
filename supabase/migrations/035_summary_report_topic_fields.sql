-- Topic-mode summary reports carry two shaped-output fields that the LLM
-- produces and the worker writes, but which were never added to the schema:
--
--   * positions  — { question, positive_label, positive_summary, negative_label, negative_summary }
--                  Drives the "观点框架 / Positions" pro-vs-con panel on the report page.
--   * references — [ { title, detail, source, persona_name } ]
--                  Flat list of citations rendered below the synthesis.
--
-- Without these columns, every Topic-mode evaluation fails the insert with
-- "Could not find the 'positions' column" and the evaluation ends in `failed`.
-- Product-mode reports don't populate them, so a nullable jsonb is the right shape.

alter table public.summary_reports
  add column if not exists positions jsonb default null;

alter table public.summary_reports
  add column if not exists "references" jsonb default null;
