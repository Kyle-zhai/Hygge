# Update — 2026-04-28

Daily activity log for Hygge platform work. Records what shipped, what's pending, and what's built-but-unused, so future-me (or another contributor) can pick up without re-reading the chat.

---

## TL;DR

Implemented **Phase 2 of the debate-realism moat** (BeliefState + Active Listening — folded into the existing LLM call so call count stays at 4 per debate). Audited the worker for cost/speed/Redis-idle issues and shipped three architecture optimizations. Wrote two new specs (strategy + Phase 2 implementation).

Branch: `feedback-flywheel`. All tests green (worker 46/46, root 28/28). Pending: final commits + push.

---

## What shipped today

### 1. Phase 2 — BeliefState + Active Listening (folded design)

The headline behavior change. Each persona now carries a structured belief state across debate rounds — a **position** ([-1, +1]), **confidence** ([0, 1]), **evidence list**, and **shifts**. The LLM is shown its prior belief at the start of each round and is required to (a) summarize what it heard from others (active listening) and (b) emit an updated belief in the same JSON response.

**Files created**

- `supabase/migrations/041_persona_belief_states.sql` — new table with one row per `(evaluation_id, persona_id, round_number)`. RLS reads via `evaluations → projects.user_id`; writes via service role only.
- `worker/src/types/belief-state.ts` — `BeliefState`, `BeliefEvidence`, `BeliefShift`, `ActiveListening`, `BeliefUpdate` types plus `deriveInitialBeliefState()` (rule-based round-0 derivation, no LLM call) and `applyBeliefUpdate()` (clamping + shift recording).
- `worker/tests/processors/belief-state.test.ts` — 14 unit tests covering derivation edge cases, clamping, noise floor, malformed updates, and prompt injection.

**Files modified**

- `worker/src/prompts/round-table-debate.ts` — `buildDebateRoundPrompt()` now accepts an optional `beliefStates` map. When present, each persona's profile gains a `Current belief: lean support (position 0.50, confidence 70%). Last round: ...` line, and the JSON schema is extended with `active_listening` and `belief_update` fields.
- `worker/src/processors/round-table-debate.ts` — derives initial state from `persona_review` before round 1, persists each round's state to Supabase, parses `belief_update` from each message, and applies it. **Fail-soft**: missing `evaluationId` skips the whole pipeline; malformed updates skip just that persona; Supabase failures log a warning but the debate continues.
- `worker/src/processors/orchestrator.ts` — passes `evaluationId` into `runRoundTableDebate(...)`.

**Key design decision (folded vs separate calls):** the naive "BeliefState as its own call" design would 2.5× the LLM call count per debate (4 → 10). Folding into the same call costs only ~30% more output tokens because the prompt and most input tokens are shared. Quality tradeoff: the LLM doesn't *fully* introspect on its belief, but for this iteration the realism gain is enough.

### 2. Architecture audit — three optimizations

User reported "Redis 一直有 commands" (Redis always has commands flowing) when the system is idle. Root cause: 3 BullMQ workers each running BLPOP with aggressive `drainDelay` (300ms / 300ms / 60ms), producing roughly 10 BLPOP calls/sec while idle.

- **`worker/src/index.ts`** — bumped `drainDelay` to 1000 / 5000 / 1000 ms with an explanatory comment about BLPOP traffic math. ~70% reduction in idle Redis traffic.
- **`worker/src/queue.ts`** — `createWorker()` default `drainDelay` 300 → 1000 ms.
- **`worker/src/config.ts`** — `readChainFromEnv()` accepts an optional `prefix` parameter; added `auxChain` reading from `LLM_AUX_*` env vars.
- **`worker/src/llm/factory.ts`** — new `buildAuxLLM()`: returns the aux model chain when configured, else falls back to the primary chain. Lets us route low-stakes structured tasks (e.g. `classifyTopic`) to a cheap model without touching voice-fidelity tasks.
- **`worker/src/processors/orchestrator.ts`** — only `classifyTopic(...)` is currently routed through `buildAuxLLM(...)`. Persona reviews and debate generation stay on the primary model (where voice fidelity matters).

### 3. Documentation

- `docs/superpowers/specs/2026-04-28-debate-realism-strategy.md` — master strategy doc covering 3-phase moat, 6 Phase-2 algorithm sketches with pseudo-code, and 3 Phase-3 training paths (DashScope SFT / self-host Qwen / RAG). Written in response to "把目前的方案全部记录在md文档里，但是目前还用不了这块".
- `docs/superpowers/specs/2026-04-28-phase2-belief-state-implementation.md` — Phase-2-specific tech doc: design core (call count tradeoff), data model, flow (round 0 + per-round update), failure modes, prompt deltas, architecture optimizations (drainDelay rationale + aux model routing), test coverage, deployment checklist, expected realism gain (35–45% for this folded version vs 50–60% for full Phase 2), and known limitations.

---

## What's NOT done (deliberate scope cuts)

These were specced but are not in the code yet — Phase 2 ships the foundation only:

- **Argumentation Graph** (Phase 2 Module 3.3) — capturing claim → support / refute edges across rounds.
- **Stance Dynamics** (Phase 2 Module 3.4) — modelling how a persona's stance momentum changes over time, beyond the per-round shift snapshot.
- **Cross-persona Observation** (Phase 2 Module 3.5) — letting personas notice patterns in *other* personas' shifts ("Bob keeps backing down on data points").
- **Memory Tiers** (Phase 2 Module 3.6) — short-term vs long-term memory for personas across multiple debates.
- **Phase 3 training paths** — none of A (DashScope SFT) / B (self-host Qwen on GPU) / C (retrieval-augmented prompting) are started. Documented in `2026-04-28-debate-realism-strategy.md` for future work.
- **Streaming belief deltas to client** — the UI does not show "Alice shifted from +0.5 → +0.2 because of Bob's latency data" yet. The data is in `persona_belief_states` table, but no API endpoint or component renders it.
- **Persona profile caching** — each round still re-injects the full persona profile. Could be cached or reduced.

---

## Built but not (yet) wired up

These features landed in this commit-set but are inert until something else turns them on:

- **`LLM_AUX_*` env vars** — `worker/src/config.ts` reads `LLM_AUX_PRIMARY_PROVIDER`, `LLM_AUX_PRIMARY_MODEL`, etc., and `buildAuxLLM()` will use them. **But** if these env vars aren't set in production, `auxChain` is empty and `buildAuxLLM()` silently falls back to the primary chain. Cost optimization only kicks in once an operator sets the env vars (e.g., `LLM_AUX_PRIMARY_MODEL=qwen3.6-turbo`).
- **`persona_belief_states` table data** — written every round by the worker, but **no UI surface reads it** yet. It's there for later: timeline view, "why did this persona shift?" tooltip, training-data extraction.
- **`active_listening` field in debate JSON** — the LLM emits it, but we currently only consume `belief_update`. The `claims_heard_this_round` and `must_address` arrays are not surfaced to the UI or stored anywhere — they exist purely to nudge the LLM into a more deliberative response style.
- **`considered_alternatives` on `BeliefState`** — the column exists, the type field exists, but no code path populates it (would require the LLM to enumerate alternatives, which we elided to keep token cost down).

---

## Known limitations & gotchas

- **Rule-based initial derivation.** Round 0 belief comes from a simple `STANCE_TO_POSITION` map (±0.8 / ±0.5 / 0). It doesn't account for persona personality archetype or how strongly the strengths/weaknesses are phrased.
- **Hardcoded noise floor.** `applyBeliefUpdate()` only records a shift when |Δposition| > 0.01 or |Δconfidence| > 0.01. This is a magic number. Fine for now, but worth tuning once we have real data.
- **LLM doesn't know schema semantics.** We tell the LLM the field names (`new_position`, `new_confidence`, `shifted_because`) but not the semantic meaning of position values. It learns by example from the prompt's `Current belief: lean support (0.50, 70%)` line. Risk: positions may drift toward 0 over time as the LLM averages.
- **`evaluationId` silent fallback.** If a caller invokes `runRoundTableDebate(...)` without `evaluationId`, the entire belief pipeline silently no-ops. This is intentional (used for ad-hoc tests and the realism-eval harness) but easy to forget.
- **Test coverage is unit + mock only.** No end-to-end test exercises a real Qwen call to verify the LLM actually emits well-formed `belief_update` JSON. We rely on JSON-mode + the parser's tolerance.
- **Migration 041 not yet applied to remote Supabase.** It's in `supabase/migrations/` but needs `supabase db push` or equivalent before Phase 2 runs in production.

---

## Numbers

- **Files touched:** 7 modified + 4 created (excluding docs) + 2 spec docs
- **Tests:** worker 46/46 ✅, root 28/28 ✅
- **Typecheck:** worker ✅, root ✅
- **LLM call count per debate:** unchanged at 4 (selection + 3 rounds + outcome — outcome is shared with one round in the existing impl)
- **Output token delta:** approximately +30% per debate round (additional `active_listening` and `belief_update` blocks)
- **Idle Redis traffic:** approximately −70% (BLPOP rate dropped from ~10/sec to ~3/sec across the three workers)
- **Expected realism gain:** 35–45% over the Phase-1 baseline (subjective, will be measured once we have a labelled eval set from the feedback flywheel)

---

## Pending before push

- [x] Tech doc (Phase 2 + architecture)
- [x] Update.md (this file)
- [x] Re-run `pnpm test` + `pnpm typecheck` in root and worker
- [x] Commit in logical chunks (migration → types → prompt → processor → orchestrator → drainDelay → aux LLM → docs)
- [x] Push `feedback-flywheel` to origin if all green

---

## Afternoon session — provider migration + deploy config

After the Phase 2 push, switched LLM provider stack and wired up the Vercel ↔ Railway proxy that had been silently absent from production.

### LLM provider switch: Qwen / DashScope → MiMo / Xiaomi Token-Plan

Primary model is now `MiMo-V2.5-Pro` served from `https://token-plan-sgp.xiaomimimo.com/v1` (OpenAI-compatible). Fallback `MiMo-V2.5`. Vision `MiMo-V2-Omni`. API keys use `tp-` prefix.

**Files modified**

- `worker/.env`, `.env.local` — local chain rewritten as `LLM_1` (MiMo Pro) / `LLM_2` (MiMo V2.5) / `LLM_3` (Gemini 2.5-flash content-filter fallback). Legacy single-model `LLM_API_KEY` etc. deleted.
- `worker/.env.example`, `.env.example` — example chains updated; `worker/.env.example` documents *why* `LLM_3=Gemini` exists (MiMo and other Chinese providers refuse on sensitive topics; `fallback.ts` treats `data_inspection_failed` / `inappropriate_content` as fallbackable, so the chain hops to a non-CN entry).
- `src/app/[locale]/(app)/settings/llm/page.tsx` — MiMo added as the first BYOK preset (was Qwen). Qwen kept as a secondary preset for users with their own DashScope key.

**Why three entries, not two:** `LLM_1` and `LLM_2` are both MiMo, sharing the same Chinese content filter. Without a non-CN `LLM_3`, sensitive topics dead-end the chain. Gemini at `LLM_3` is the safety net.

### Migration 041 — `persona_id` type fix

Migration 041 was originally written with `persona_id UUID NOT NULL REFERENCES public.personas(id)`. Supabase rejected it with `ERROR: 42804: foreign key constraint cannot be implemented — incompatible types: uuid and text`.

**Root cause:** `personas.id` is `TEXT` in production, not `UUID`. The original `001_initial_schema.sql` declared it as `UUID`, but it was changed (see `018_fix_debates_persona_id.sql` comment "personas.id is text in production"). Persona seed data uses human-readable string IDs (`founder-pmf-coach`, `vc-skeptic`, etc.), which is why TEXT.

**Fix:** Changed line 22 of `041_persona_belief_states.sql` from `persona_id UUID` to `persona_id TEXT`. Pattern matches `040_persona_utterance_feedback.sql:16`.

### Production env configuration

The persona-recommend route (`src/app/api/personas/recommend/route.ts:46-54`) had been silently returning `"Default recommendation (worker not configured)"` because `WORKER_URL` and `WORKER_SHARED_SECRET` weren't set on Vercel. Fixed via CLI:

- **Railway** — set `WORKER_SHARED_SECRET=9C6C7MlXm2uv37Vf6e8OYcOXqGIzmfaAo0AquNhWYgY=`. Removed legacy `LLM_*` single-model vars (chain-only on Railway now).
- **Vercel** — set `WORKER_URL=https://hygge-production-233e.up.railway.app` + matching `WORKER_SHARED_SECRET` across Production / Preview / Development. Vercel does **not** read `LLM_*` chain vars directly (only the worker does); the `LLM_1/2/3` set on Vercel is harmless duplication kept for symmetry.

**Architecture clarification** (saved to memory for future sessions): Vercel never calls LLM providers directly. Two reasons — (1) MiMo / DashScope endpoints are CN-only and unreachable from Vercel's overseas regions, (2) long-running evaluation jobs run on BullMQ + Redis on the worker. Vercel routes either enqueue or proxy through `${WORKER_URL}/recommend`.

### Commit & verification

- Commit `43782ca` on `feedback-flywheel`: 041 FK type fix + MiMo migration (`.env.example` × 2 + `settings/llm/page.tsx` + migration 041).
- All tests re-run: Next.js 28/28 ✅, Worker 46/46 ✅ (including the 14 belief-state tests), typecheck clean.
- Pushed to `origin/feedback-flywheel` with upstream tracking.

### Pending (operator action, not code)

- Vercel `--prod` redeploy to pick up new `WORKER_URL` / `WORKER_SHARED_SECRET` (user said this was completed manually).
- Rotate exposed Gemini key `AIzaSy...CYBg` (was visible in a screenshot during config).
- Apply migration 041 to remote Supabase (the original blocker that triggered the FK-type fix — should now succeed on retry).
