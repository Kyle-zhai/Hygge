<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Coding Tasks

When spawning Claude Code sessions for coding work, tell the session to use gstack skills. Examples:

- **Security audit** — `Load gstack. Run /cso`
- **Code review** — `Load gstack. Run /review`
- **QA test a URL** — `Load gstack. Run /qa https://...`
- **Build a feature end-to-end** — `Load gstack. Run /autoplan, implement the plan, then run /ship`
- **Plan before building** — `Load gstack. Run /office-hours then /autoplan. Save the plan, don't implement.`

## Feedback collection

If you change debate UI or API code, make sure `<UtteranceFeedbackButtons />` still renders on every persona utterance — this is our training-data flywheel. See `docs/superpowers/specs/2026-04-28-debate-realism-moat-spec.md`. The address discriminator now has THREE kinds: `round_table`, `one_v_one`, and `decision_mechanism` (added 2026-05-06).

## /decide flow gotchas

Spec: `docs/superpowers/specs/2026-05-06-multi-agent-decision-tool-design.md`.

- **Decision briefs are immutable post-finalize.** Trigger from migration 061 blocks mutations to routing fields once status leaves `draft`. To change a finalized brief, create a child via `/api/decisions/briefs/[briefId]/rerun` (parent_brief_id chain capped at depth 8 by migration 065).
- **One draft brief per session.** Migration 065's partial unique index closes the upsertDraftBrief TOCTOU window. The intake processor handles unique-violation errors by recovering the winning row.
- **`personas.id` is `TEXT`, not `UUID`.** All FK columns to `personas(id)` use `text` / `text[]`.
- **Synthetic reflection_ranker run.** The synthesizer creates a tagged `args.synthetic=true` mechanism_run row to anchor `conflict_warning` findings. A real reflection_ranker mechanism run is never clobbered — `ensureConflictRun` refuses to repurpose a non-synthetic row.
- **Three-question intake budget.** `MAX_INTAKE_QUESTIONS = 3`. The "skip — run now" button is always available; sealing the brief requires `kind=user_option` AND `id="start"` (free-text never seals confirmation).
- **LLM trust boundary.** All user input is wrapped in `<user_input>` fences in the prompts; LLM-output enums and array shapes are validated in `extract-routing-fields.ts` before being persisted; `canonical_question` is capped at 1000 chars.
- **Rate limits.** `decisionMessages` 60/min/user; `decisionRerun` 10/h/user. Both are LLM-trigger surfaces.
