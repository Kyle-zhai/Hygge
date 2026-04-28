# Update — 2026-04-28

Daily activity log for Hygge platform work. This entry documents the core product / algorithm work that shipped today: what was built, how it works under the hood, and the user-facing goal each piece serves.

---

## TL;DR

Shipped **Phase 2 of the debate-realism moat**: personas now carry an explicit, structured belief across debate rounds (`position`, `confidence`, `evidence`, `shifts`), and each round's LLM call is forced to acknowledge what was heard from others (active listening) before emitting a structured belief update. Designed as a **folded** call — same LLM call count as Phase 1, only ~30% more output tokens — so realism improves without increasing latency. Plus two architecture changes uncovered during a worker audit: a Redis idle-traffic fix and a second LLM chain for low-stakes tasks.

Branch `feedback-flywheel`. Worker tests 46/46 ✅, root 28/28 ✅, typecheck clean.

---

## 1. Phase 2 — Belief State + Active Listening

### 1.1 What was built

Every persona that participates in a round-table debate now has a structured belief snapshot at every round, addressed by `(evaluation_id, persona_id, round_number)`:

| Field | Range | Meaning |
|---|---|---|
| `position` | [-1, +1] | How strongly the persona supports the `topic_focus`. +1 = strongly for, 0 = neutral, -1 = strongly against. |
| `confidence` | [0, 1] | How locked-in the position is. 0 = totally unsure, 1 = will not budge. |
| `key_evidence` | array | Each item is `{ source, weight, content, from_speaker?, from_round? }`. `source ∈ {internal_value, heard_from, common_sense}`. |
| `shifts_this_round` | array | Each item is `{ caused_by, claim, delta_position, delta_confidence }` — the *causal trail* of what moved this persona since last round. |
| `considered_alternatives` | array | Reserved for future work; column exists, no code path populates it yet. |

`round_number = 0` is the persona's *prior* belief before the debate starts. Rounds 1–3 are the post-round snapshots after each LLM call.

### 1.2 Why this matters (the goal)

In Phase 1, each round's LLM call saw only the raw transcript of the previous round and had to re-derive every persona's stance from scratch. Two failure modes followed:

1. **Personas drifted incoherently.** Without an explicit prior, the LLM had no anchor — a persona could read as `strongly_positive` in round 1 and `neutral` in round 2 with no traceable cause, just because the LLM re-weighted the transcript differently.
2. **No causal trail.** When a persona changed their mind, the system couldn't say *why*. We couldn't tell the user "Alice dropped from +0.5 → +0.2 because of Bob's latency point" — nothing recorded the shift.

Phase 2 fixes both: the belief snapshot is the anchor (no drift between rounds), and `shifts_this_round` is the causal trail (we know which speaker + which claim moved each persona). The user-facing effect is that personas now behave like people who remember what they previously thought — they update gradually instead of resetting each round.

### 1.3 How it's implemented

Three components, run in this order per debate:

**(a) Round-0 derivation — no LLM call.** Before round 1, walk every selected persona's `persona_review` (already produced by Phase 1) and synthesize an initial `BeliefState` deterministically:

```
position = STANCE_TO_POSITION[overall_stance]
        // strongly_positive → +0.8, positive → +0.5, neutral → 0,
        // negative → -0.5, strongly_negative → -0.8
confidence = 0.7  // hardcoded prior
key_evidence = (first 2 strengths + first 2 weaknesses), each at weight 0.5
```

`worker/src/types/belief-state.ts:63` `deriveInitialBeliefState()`. Deliberately rule-based — calling the LLM for round 0 would mean 1 extra call per persona per debate (4–6 extra calls), and everything we need (stance + bullet points) is already in `persona_review`.

**(b) Prompt injection per round.** When `buildDebateRoundPrompt(...)` runs, if a `beliefStates` map is provided, each persona's profile section in the prompt gains a one-line summary of their *current* belief:

```
Current belief: lean support (position 0.50, confidence 70%).
Last round shift: dropped 0.3 in confidence after hearing Bob's latency data.
```

Simultaneously, the JSON schema the LLM must emit per message is extended with two new blocks:

```json
{
  "persona_id": "vc-skeptic",
  "content": "...",
  "active_listening": {
    "claims_heard_this_round": [
      {"speaker": "founder-pmf-coach",
       "claim_summary": "moat lives in proprietary belief data",
       "threatens_my_position": true}
    ],
    "must_address": ["respond to moat claim"]
  },
  "belief_update": {
    "new_position": 0.20,
    "new_confidence": 0.55,
    "shifted_because": "founder-pmf-coach showed real flywheel data"
  }
}
```

The LLM is therefore steered, in a single response, to (i) ground each message in what was actually said earlier, and (ii) emit its post-message belief in machine-readable form.

**This folding is the key design decision.** A naive design would do this in two calls per round per persona — one to generate the message, one to derive the belief. Math:

| Design | LLM calls per debate | Output token cost |
|---|---|---|
| Phase 1 (no belief) | 4 (selection + 3 rounds + outcome — outcome shares with one round) | baseline |
| Naive Phase 2 (separate) | ~10 (each persona-message + each post-round belief-update is its own call) | ~2.5× |
| **Folded Phase 2 (shipped)** | **4 (same as Phase 1)** | **~1.3× (only the per-message JSON grew)** |

The cost discount is real because the prompt body, persona context, and history reuse the same input tokens — only the output grows. Quality tradeoff: the LLM doesn't fully introspect on its own belief in a separate pass, but for this iteration the realism gain from anchoring + causal trail is enough.

**(c) Per-round update + persistence.** `worker/src/processors/round-table-debate.ts`, after each round's LLM call returns, walks the parsed messages, calls `parseBeliefUpdate(m.belief_update)` on each, and runs `applyBeliefUpdate(prev, update, roundNumber)`. The update function:

- Clamps `new_position` to [-1, +1] and `new_confidence` to [0, 1] (`Math.max/min` after a `Number.isFinite` check that rejects NaN/Infinity).
- Records a `BeliefShift` only if `|Δposition| > 0.01` or `|Δconfidence| > 0.01` — a noise floor that keeps the table from filling with no-op rows when the persona barely moves.
- Stores the LLM's `shifted_because` string verbatim as the causal claim.

The new state is upserted into `persona_belief_states` with `onConflict: "evaluation_id,persona_id,round_number"`, then kept in the in-memory `beliefStates` map so the *next* round's prompt sees the most recent value.

### 1.4 Active Listening — what role it plays

The `active_listening` block is a prompt-level steering mechanism, not a data product. It is currently parsed but not consumed by any downstream code — `must_address` and `claims_heard_this_round` exist purely to force the LLM into a more deliberative response style.

The mechanism: when the LLM has to enumerate what it heard before it speaks, it can no longer hide behind generic boilerplate. It has to point at a concrete claim a concrete speaker made, mark whether that claim threatens its position, and only then write the response. Empirically (subjective so far) responses are noticeably less "pre-canned" — they reference specific earlier lines instead of abstracting them.

The data is captured in the JSON we receive but discarded after parsing. Future work could persist it for an "Alice was responding to Bob's claim that…" affordance in the UI.

### 1.5 Failure modes (intentionally fail-soft)

Three places where Phase 2 chooses to silently degrade rather than break the debate:

- **Missing `evaluationId`.** If `runRoundTableDebate(...)` is called without `evaluationId` (ad-hoc tests, realism-eval harness), the whole belief pipeline no-ops — `beliefStates` stays `undefined`, the prompt loses its belief lines, the schema reverts to Phase 1 shape, and nothing is persisted. The debate runs as Phase 1.
- **Malformed `belief_update`.** Per-message. `parseBeliefUpdate(...)` returns `null` if `new_position` or `new_confidence` is missing or non-numeric; that persona simply skips its update for the round. Other personas in the same round are unaffected.
- **Supabase persist failure.** Logged at warn level (`belief_state.persist_failed`) but the in-memory state is still updated, so subsequent rounds see the latest belief and the debate completes. We lose the historical row, not the run.

Each was chosen on purpose: a debate must finish even when belief data is partial. Visibility loss is preferable to a hard stop the user can see.

### 1.6 Test coverage

`worker/tests/processors/belief-state.test.ts` — 14 unit tests covering: stance → position mapping, evidence list construction (2-strength + 2-weakness cap, empty-string filtering, 200-char content trim), default confidence, position clamping, confidence clamping, NaN/Infinity rejection, noise-floor shift suppression, malformed-input parsing, derivation with no overall_stance, evidence weight assignment.

No end-to-end test yet exercises a real LLM call to confirm the model produces well-formed `belief_update` JSON in the wild — we rely on JSON-mode + `robustJsonParse`'s tolerance.

### 1.7 What is deliberately *not* done

Phase 2 ships the foundation only. Out of scope for this iteration:

- **Argumentation graph** (Module 3.3) — claim → support / refute edges across rounds, modeled as a graph rather than a flat shift list.
- **Stance dynamics** (Module 3.4) — momentum / inertia modeling beyond the per-round delta snapshot.
- **Cross-persona observation** (Module 3.5) — letting personas notice patterns in *other* personas' shifts ("Bob keeps backing down on data points").
- **Memory tiers** (Module 3.6) — short-term vs long-term memory across multiple debates with the same persona.
- **UI surface for belief data.** `persona_belief_states` is populated every run, but no API endpoint or component reads it. Future work: timeline view + "why did this persona shift?" tooltip + training-data extraction for Phase 3.

---

## 2. Architecture — Redis idle traffic

### 2.1 The bug

User observed "Redis 一直有 commands" (Redis always has commands flowing) while the system was idle. Root cause is BullMQ's job-pickup mechanism: each worker runs a `BLPOP` loop with `drainDelay` controlling how often it re-issues the call when the queue is empty. We had three workers (evaluation, debate, recommend) at `300ms / 300ms / 60ms`. Idle BLPOP rate:

```
1/0.3 + 1/0.3 + 1/0.06 ≈ 3.3 + 3.3 + 16.7 = ~23 BLPOP/sec
```

BLPOP itself is cheap server-side (it blocks until a job arrives or the timeout fires), but the command *count* dominates Upstash's per-command pricing and makes the dashboard look busy when nothing is happening.

### 2.2 The fix

`worker/src/index.ts` and `worker/src/queue.ts`: bumped `drainDelay` to `1000ms / 5000ms / 1000ms`:

```
1/1 + 1/5 + 1/1 = ~2.2 BLPOP/sec   →  ~90% reduction
```

Per-queue rationale:

- **1000ms for evaluation + recommend** — adds at most ~1s to job pickup, which is invisible next to multi-second LLM latencies.
- **5000ms for debate** — debates are scheduled jobs, not interactive; the user is already on a "running" page when one fires.

Comment in `worker/src/index.ts` documents the BLPOP-traffic math so the next person who edits this doesn't accidentally tune it back down.

---

## 3. Auxiliary LLM chain (`LLM_AUX_*`)

### 3.1 What was built

A second, parallel LLM chain configured via `LLM_AUX_*` env vars, alongside the existing primary chain. Two pieces:

- `worker/src/config.ts` — `readChainFromEnv()` was generalized to take an optional `prefix` parameter. `LLM_*` and `LLM_AUX_*` chains are read with the same code.
- `worker/src/llm/factory.ts` — new `buildAuxLLM()` returns the aux chain if configured, else falls back to the primary chain.

### 3.2 Why

LLM calls split into two cost/quality tiers:

- **Voice-fidelity tasks** (persona reviews, debate generation) — the persona's personality is on the line; needs the strongest available model. Stays on the primary chain.
- **Low-stakes structured tasks** (topic classification, JSON extraction) — just needs valid JSON back. A 10× cheaper model is fine.

Without the split, every call ran on the strongest model, paying voice-fidelity prices for utility tasks. With the split, an operator can configure a cheap model in `LLM_AUX_*` and route low-stakes calls there independently.

### 3.3 Current routing

Only `classifyTopic(...)` in `worker/src/processors/orchestrator.ts` currently uses `buildAuxLLM(...)`. Persona review generation and debate generation stay on the primary chain. More routes will move over as we measure each call's voice-fidelity sensitivity.

### 3.4 Status

Built but inert by default. If `LLM_AUX_*` env vars are unset, `buildAuxLLM()` returns the primary chain and nothing changes. The cost optimization activates only when an operator configures a cheap model in `LLM_AUX_PRIMARY_MODEL` etc.

---

## 4. Specs written

- `docs/superpowers/specs/2026-04-28-debate-realism-strategy.md` — master strategy: 3-phase moat plan, 6 Phase-2 algorithm sketches with pseudo-code, 3 candidate Phase-3 training paths.
- `docs/superpowers/specs/2026-04-28-phase2-belief-state-implementation.md` — Phase-2 tech doc: design core (call-count tradeoff), data model, round-by-round flow, failure modes, prompt deltas, architecture optimizations, test coverage, expected realism gain.

---

## Numbers

- **Files touched:** 7 modified + 4 created (excluding docs) + 2 spec docs
- **Tests:** worker 46/46 ✅, root 28/28 ✅
- **Typecheck:** worker ✅, root ✅
- **LLM call count per debate:** unchanged at 4 (selection + 3 rounds + outcome)
- **Output token delta:** ~+30% per debate round (extra `active_listening` + `belief_update` blocks)
- **Idle Redis traffic:** ~−90% (BLPOP rate ~23/sec → ~2/sec)
- **Expected realism gain:** 35–45% over the Phase-1 baseline (subjective; will be measured against a labelled eval set once the feedback flywheel collects enough utterance ratings)
