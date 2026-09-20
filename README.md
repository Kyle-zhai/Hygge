# Hygge

Multi-agent decision analysis. You describe a decision; a panel of AI personas
runs it through six analysis mechanisms and returns a structured report where
every conclusion carries a pointer back to the mechanism run that produced it.

[![License: MIT](https://img.shields.io/badge/License-MIT-black.svg)](LICENSE)
[![Next.js 16](https://img.shields.io/badge/Next.js-16-black.svg)](https://nextjs.org)
[![React 19](https://img.shields.io/badge/React-19-black.svg)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-black.svg)](https://www.typescriptlang.org)

---

## Why

Ask one model a hard product question and you get one confident voice with
invisible reasoning. You cannot tell which parts were contested, which
assumptions carried the answer, or where it would break.

Hygge makes the deliberation the product. Personas with genuinely different
priors argue the decision, disagree on the record, and every finding in the
final report stores the `mechanism_run_id` it came from — so the trail back to
the transcript is a foreign key, not a citation the model wrote for itself.

| | Single-model chat | Hygge |
|---|---|---|
| Perspectives | One voice | A panel with conflicting priors |
| Disagreement | Averaged away | Emitted as a first-class `conflict_warning` finding |
| Provenance | Model-authored, unverifiable | `finding.mechanism_run_id` FK to the run |
| Output | Prose | Typed findings: severity, confidence, cited personas |

---

## How a decision flows

### 1 · Conversational intake

Instead of a settings form, an intake agent extracts routing fields from what
you wrote and asks at most three clarifying questions (`MAX_INTAKE_QUESTIONS = 3`).
Every extracted field carries its own confidence and the verbatim quote it came
from — nothing is silently inferred:

```ts
interface ExtractedField<T> {
  value: T;
  confidence: number;          // 0–1; "known" threshold is 0.7
  source_quote: string | null; // verbatim user text, or null if defaulted
  was_asked: boolean;          // came from a clarifying question, not extraction
}
```

Those fields decide the routing:

```ts
decision_type       tradeoff | build_or_kill | hire | pivot |
                    feature_design | vendor_selection | other
primary_dimensions  technical | business | ux | strategic | people | finance
timeline            immediate | weeks | months | years
reversibility       one_way_door | two_way_door | unknown
stakes              low | medium | high | unknown
```

The run always remains one click away — `sealed_by` records how intake ended:
`all_required_filled`, `user_skip`, `budget_exhausted`, or `auto_timeout`.

### 2 · Mechanism fan-out

The sealed brief is routed to a subset of six mechanisms. Each becomes its own
job, its own row, its own transcript:

| Mechanism | What it does | Notable arg |
|---|---|---|
| `persona_review` | Each persona reviews independently, no cross-talk | — |
| `round_table_debate` | Multi-round open debate; personas react to each other | `debate_rounds` |
| `theory_of_mind` | Simulates how a named stakeholder receives the decision | `stakeholder_to_simulate` |
| `scenario_simulation` | Projects the decision forward over a horizon | `time_horizon_months` |
| `cross_challenge` | Explicit proponent-vs-challenger pairings | `challenge_pairs` |
| `reflection_ranker` | Ranks findings, flags contradictions between mechanisms | — |

Every mechanism processor must emit the same finding shape, which is what makes
results from a debate and results from a scenario projection comparable:

```ts
interface MechanismFindingDraft {
  headline: string;            // ≤ 80 chars — the one-line conclusion
  severity: 1 | 2 | 3 | 4 | 5; // 1 info … 5 critical
  confidence: number;          // 0–1
  detail_summary: string;      // ≤ 200 chars — what the mechanism actually saw
  cited_persona_ids: string[];
}
```

### 3 · Synthesis, including the disagreements

The synthesizer merges runs into persisted `Finding` rows. Each keeps its
origin:

```ts
interface Finding {
  mechanism_run_id: string;      // FK → the run whose transcript you can open
  source_mechanism: FindingSource;
  headline: string;
  severity: 1 | 2 | 3 | 4 | 5;
  confidence: number;
  cited_persona_ids: string[];
  content_hash: string;          // stable id for UI reconcile across reruns
  // …
}

type FindingSource = MechanismKind | "conflict_warning";
```

`conflict_warning` is the interesting one. When two mechanisms reach
contradictory conclusions on the same point, the contradiction is **not resolved
silently** — it is emitted as its own finding for you to judge. Because every
finding needs a real `mechanism_run_id`, the synthesizer anchors these to a
run tagged `args.synthetic = true`; `ensureConflictRun` refuses to repurpose a
genuine `reflection_ranker` run for this.

Briefs are **immutable once finalized** — a trigger blocks mutation of routing
fields after `status` leaves `draft`. Changing your mind creates a child brief
through `/rerun`, so the lineage stays auditable (`parent_brief_id`, capped at
depth 8).

---

## Architecture

Two long-running processes over Postgres and Redis:

```
┌────────────────────────────┐              ┌────────────────────────────┐
│  Next.js 16 (App Router)   │    HTTPS     │  Worker (Node)             │
│                            │ ───────────▶ │                            │
│  · /decide chat UI         │  shared      │  · BullMQ consumers        │
│  · /api/decisions/*        │  secret      │  · LLM fallback chain      │
│  · Stripe, auth, admin     │              │  · Tavily web grounding    │
└─────────────┬──────────────┘              └─────────────┬──────────────┘
              │                                           │
              │        Supabase — Postgres + RLS          │
              └────────── + Realtime publication ─────────┘
                                   │
                    Redis — BullMQ queues + rate limits
```

Four queues carry the work:

- `evaluations` — round-table evaluations (the original product surface)
- `decision-intake` — the conversational state machine (extract → ask → seal)
- `decision-orchestrator` — fans out mechanism jobs, then runs the synthesizer
- `decision-mechanism` — six job names share this queue, one per mechanism

In production the Next.js side never calls an LLM provider directly; it proxies
to the worker, which owns the fallback chain. Provider keys stay on one host,
and the chain can hop providers when one refuses or times out.

### Repository layout

```
src/
  app/[locale]/      Localized pages (en · zh) — landing, decide, personas, settings
  app/api/           Route handlers — decisions, personas, stripe, admin, cron
  components/        UI by feature: decide, landing, personas, settings, ui
  lib/               auth · billing · decide · llm · queue · rate-limit · supabase
shared/types/        Types imported by BOTH the app and the worker
worker/src/
  processors/        One file per job kind — the mechanisms live here
  queue.ts           Queue + Worker construction, concurrency
supabase/migrations/ Ordered SQL migrations (001 → 069)
messages/            en.json · zh.json (next-intl)
tests/               App-side vitest; worker/tests/ for the worker
```

---

## Quick start

**Prerequisites:** Node 20+, a [Supabase](https://supabase.com) project, a Redis
instance (local or [Upstash](https://upstash.com)), and one OpenAI-compatible
LLM endpoint. The LLM layer is provider-agnostic — anything speaking the OpenAI
chat-completions shape works, plus native Anthropic and Google adapters.

```bash
git clone https://github.com/Kyle-zhai/Hygge.git
cd Hygge
npm install
```

### 1 · Environment

Two env files, read by two different processes. Create **both** before running
anything — several worker tests construct a Supabase client at import time and
will fail to collect without `worker/.env`:

```bash
cp .env.example .env.local         # Next.js: Supabase, Stripe, analytics, worker URL
cp worker/.env.example worker/.env # Worker: LLM chain, Redis, service-role key
```

Both are documented inline. Minimum to boot the app is
`NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`; minimum to run a
decision end-to-end adds `REDIS_URL` and one `LLM_1_*` group in `worker/.env`.

### 2 · Database

```bash
npm run db:migrate   # apply migrations in order
# npm run db:reset   # drop and rebuild from scratch
```

### 3 · Run

```bash
npm run dev          # Next.js  → http://localhost:3000
npm run dev:worker   # Worker   (separate terminal)
```

The worker must be running for any decision to execute. Without it the chat
accepts messages but no intake or orchestrator job is ever consumed.

### 4 · Verify

```bash
npm run typecheck:all   # app + worker
npm test                # app-side vitest   — 35 tests
npm run test:worker     # worker-side vitest — 185 tests
npm run lint
```

---

## Configuration notes

**LLM fallback chain.** Up to ten numbered provider groups (`LLM_1_*` through
`LLM_10_*`) are tried in order. A permanent failure — 401, 403, 404, quota —
blocks that entry for the rest of the session rather than being retried.
Content refusals are treated as fallbackable, so if you serve bilingual traffic
keep at least one provider from a different jurisdiction in the chain.

**BYOK.** Users can save their own chain at `/settings/llm`, overriding the env
defaults per request. Keys are encrypted at rest with
`LLM_KEY_ENCRYPTION_SECRET` (any string ≥16 chars; `openssl rand -base64 32`).

**Web grounding.** `TAVILY_API_KEY` enables source-cited findings. Without it,
mechanisms that would cite external evidence emit "no authoritative source
found" instead of a citation.

**Admin panel.** `/admin` is deny-by-default — access requires an exact match
against the comma-separated `ADMIN_EMAILS` list.

---

## Database conventions

These bite people who assume otherwise:

- **`personas.id` is `TEXT`, not `UUID`.** Every FK referencing `personas(id)`
  must be `text` / `text[]`.
- **Decision briefs are immutable post-finalize.** A trigger blocks mutation of
  routing fields once `status` leaves `draft`. Use `/rerun` to create a child.
- **One draft brief per session**, enforced by a partial unique index that
  closes a TOCTOU window in the intake processor.
- **`parent_brief_id` chain depth is capped at 8** by a trigger.

---

## Security model

- Row-level security on every user-owned table; the service-role key never
  reaches the browser.
- All user-supplied text is wrapped in `<user_input>` fences before reaching a
  prompt, and LLM-returned enums and array shapes are re-validated against the
  schema before being persisted. `canonical_question` is capped at 1000 chars.
- LLM-trigger surfaces are rate limited: `decisionMessages` 60/min/user,
  `decisionRerun` 10/h/user.
- Stripe webhooks are idempotent and signature-verified.

---

## Deployment

The Next.js app deploys to Vercel (region `hkg1`, cron jobs declared in
`vercel.json`). The worker deploys independently — it ships with a `Dockerfile`
and a `railway.toml`, but anything running a long-lived Node process works.

They only need to agree on three things: the same Redis, the same Supabase
project, and a matching `WORKER_SHARED_SECRET`.

---

## Contributing

Issues and pull requests are welcome. Before opening a PR:

```bash
npm run typecheck:all && npm run lint && npm test && npm run test:worker
```

CI runs typecheck, lint, and the app-side test suite on every pull request.

---

## License

[MIT](LICENSE) © Yinan Zhai
