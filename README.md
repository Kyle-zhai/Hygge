# Hygge

Multi-agent decision analysis for product teams. Paste a decision, the
system runs a panel of AI personas through up to six analysis mechanisms
(round-table debate, scenario simulation, theory-of-mind, cross-challenge,
reflection ranker, persona review) and returns a structured report where
every conclusion traces back to a specific mechanism transcript.

Differentiation against ChatGPT/Claude: **transparent multi-mechanism
provenance**. The user can always click into the source.

## Architecture

Two long-running processes plus Supabase + Redis:

```
┌──────────────────────┐        ┌──────────────────────┐
│  Next.js (Vercel)    │  HTTP  │  Worker (Railway)    │
│  - /decide UI        │ ─────▶ │  - BullMQ consumers  │
│  - /api/decisions/*  │        │  - LLM chain         │
└──────────┬───────────┘        └──────────┬───────────┘
           │                                │
           │   Supabase (Postgres + RLS +   │
           └───── Realtime publication) ────┘
                          │
                  Upstash Redis (BullMQ queues)
```

**Three BullMQ queues** drive the decision flow:
- `decision-intake` — conversational state machine (extract → ask or confirm → finalize)
- `decision-orchestrator` — fans out mechanism jobs and runs the synthesizer
- `decision-mechanism` — six job names share this queue, one per analysis mechanism

See `docs/superpowers/specs/2026-05-06-multi-agent-decision-tool-design.md`
for the full spec.

## Local setup

You need three things running: Supabase (DB + auth), Upstash Redis (queues),
and an OpenAI-compatible LLM endpoint. The current production primary is
**MiMo-V2.5-Pro on Xiaomi's Token-Plan** — the worker code is OpenAI-compatible
and works with any provider.

### 1. Environment variables

Two `.env` files coexist, and they don't overlap perfectly:
- **Root `.env.local`** — read by Next.js. Supabase URLs, Stripe, posthog, the LLM chain (`LLM_1_*`, `LLM_2_*`, `LLM_3_*`), `WORKER_URL`/`WORKER_SHARED_SECRET`.
- **`worker/.env`** — read by the worker process. Same LLM chain (worker calls LLMs directly; Vercel proxies to it), plus `REDIS_URL` and `SUPABASE_SERVICE_ROLE_KEY`.

Copy `.env.example` and `worker/.env.example` and fill in the values.

### 2. Database

Apply migrations 001–065 in order:

```bash
npm run db:migrate
```

Or `npm run db:reset` for a clean slate (drops everything).

### 3. Run the dev environment

```bash
# Terminal 1 — Next.js
npm run dev

# Terminal 2 — worker
npm run dev:worker
```

The Next.js side proxies LLM calls to the worker, so the worker has to be
running for any decision flow to work end-to-end. Without the worker the
chat will accept messages but no intake/orchestrator job will execute.

### 4. Verify

```bash
npm run typecheck:all   # next + worker tsc
npm test                # next-side vitest
npm run test:worker     # worker-side vitest
```

## Database conventions

- **`personas.id` is `TEXT`, not `UUID`.** All FK columns to `personas(id)`
  must use `TEXT` / `TEXT[]` — initial schema docs lie. See migration 061
  comment on `decision_briefs.persona_ids`.
- **Decision briefs are immutable post-finalize.** A trigger blocks any
  mutation of routing-related columns once `status` leaves `draft`. To
  "edit" a brief, create a child via the `/rerun` endpoint with
  `parent_brief_id`.
- **One draft per session.** Migration 065 enforces this with a partial
  unique index, closing a TOCTOU window in the intake processor.
- **`parent_brief_id` chain depth is capped at 8** by a trigger from
  migration 065.

## Data flywheel — utterance feedback

Every persona utterance — across round-table debates, 1v1 debates, and
decision-flow mechanism transcripts — can receive a 👍/👎 + optional
1-line comment from the user who owns the conversation. Votes are stored
in `public.persona_utterance_feedback` keyed by one of:

- Round-table: `(user_id, evaluation_id, round_number, message_index)`
- 1v1: `(user_id, debate_message_id)`
- Decision mechanism: `(user_id, decision_mechanism_run_id, utterance_index)` (added 2026-05-06)

This data feeds Phase 3 of the debate-realism roadmap
(`docs/superpowers/specs/2026-04-28-debate-realism-moat-spec.md`) —
persona-specific DPO fine-tunes once we have ~5k labels per archetype.

Monitor with `docs/superpowers/queries/feedback-flywheel-stats.sql`.

## Deploy

Vercel auto-deploys the Next.js side from `main`. Worker deploys
independently to Railway via its own pipeline (see `worker/railway.toml`).

Routine ops:
```bash
vercel env pull .env.local       # sync env from Vercel
gh pr view                        # PR status
```
