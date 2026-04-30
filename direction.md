# Hygge — Product Direction (2026-04-30)

> An honest, founder-facing audit of what's actually shipping vs. what's pretending to ship. Written after a user-reported bug exposed a deeper positioning problem.

---

## 1. The trigger for this doc

User tried the **决策审计 (Decision Audit)** feature. Two things broke at once:

1. The input box placeholder says *"也支持文件和链接"* (supports files and links). The UI is a plain `<textarea>`. There is no file upload, no URL parser, no link unfurling. **The placeholder lies.**
2. User typed text and submitted. Got *"审计失败，请重试或联系支持。"* No retry, no support, no useful diagnostic.

I traced bug #2 to the root cause: migration `045_seed_audit_templates.sql` declares default council personas (`audit-compliance-officer`, `audit-adversarial-red-team`, `audit-senior-engineer`, etc.). **These personas are never seeded anywhere in the codebase.** The worker (`worker/src/processors/audit-council.ts:84-88`) does `select * from personas where id in (...)`, gets zero rows, throws `"personas lookup failed: no personas matched"`. BullMQ retries three times, each fails identically, the session flips to `status='failed'`, the user sees the generic red banner.

The audit feature was shipped to the UI nav, given an i18n string set, given a hash-chained verifier, given a public verification page — and the underlying data dependency was never wired up. **This feature has never worked end-to-end, in any environment.**

That is the immediate bug. The deeper problem is what it tells us about the product.

---

## 2. The positioning problem

Pulling on this one thread surfaces the broader pattern. From a complete code inventory:

| Surface | State | Evidence |
| --- | --- | --- |
| Evaluation engine (`/evaluate/new`, orchestrator, 17 worker processors) | **Works.** Core loop is solid. | Tests pass, used daily, this is the moat. |
| 1v1 Debate (`/debates`, debate-response worker) | **Works.** Polished. | Reply language detection, feedback flywheel, persona ToM. |
| Persona system (CRUD, recommendation, marketplace flag) | **Works.** | Recommend endpoint, async generation, taxonomy. |
| Compare evaluations (`/compare`) | **Works.** | Real users hit it. |
| **Decision Audit** | **Broken end-to-end.** Personas missing, placeholder lies, error UI is a dead end. | User just hit it. Migration 045 alone proves the seed is missing. |
| Persona Squads (`/api/squads/*`, `persona_squads` table) | **Orphaned.** Schema + API exist; zero UI. | No component imports it. |
| Referral system (`/api/referrals/*`, `referral_codes` table) | **Orphaned.** Full schema + API logic; zero UI. | No nav, no entry, no test. |
| Marketplace + Publications | **Feature-flagged off.** | `NEXT_PUBLIC_ENABLE_MARKETPLACE=false` in `.env`. |
| Workspaces / teams (`/settings/workspaces`) | **Works** but isolated; no team flow elsewhere uses it. | Works in isolation. |
| Onboarding | **Thin.** | `026_onboarding_state.sql` exists; not much UX around it. |

**Three things are pretending to be features.** Audit, squads, referrals.

Each of these does damage on its own:
- **Audit** is in the sidebar nav. Every user who clicks it hits a broken flow. That's worse than the feature not existing — it teaches users the product is unreliable.
- **Squads** + **Referrals** add ~600 lines of dead code, ~6 unused tables, and ~8 unused API routes. They cost zero CPU but cost cognitive load every time someone reads the codebase, and they cost positioning when an investor or new dev sees `/api/referrals` and asks "what's the growth model?"
- **Marketplace + Publications** flagged off is fine — that's a *plan*, not a *lie*. But they should be `archived/` or behind a feature folder, not commingled with shipped code.

### The positioning question, sharp

A user who lands on hygge today sees a sidebar with: **Dashboard, General Discussion, Product Evaluation, Compare, Debates, Audit, Personas, Settings**.

That sidebar tells two different stories:

- **Story A (the working one):** "We are a structured deliberation engine. Submit a question, get five expert perspectives, watch them disagree, see how their views shift. Take the output to your team."
- **Story B (the audit one):** "We are also a regulated decision audit / compliance tool that produces hash-chained, regulator-verifiable audit trails."

These are different products for different buyers. Story A sells to PMs, founders, teams that want better thinking. Story B sells to legal, risk, and compliance buyers under EU AI Act / ISO 42001 pressure. The moat is different. The pricing is different. The pitch is different.

**Right now hygge claims both, ships only A, and the broken B is the first thing a user touches if they came in expecting "decision audit."**

---

## 3. Keep / Fix-or-Cut / Cut

### Keep (this is the product)

| Feature | Why it stays |
| --- | --- |
| **Multi-persona evaluation engine** (orchestrator + 17 processors) | Working, novel, defensible. The reason anyone uses Hygge. |
| **1v1 Debate** | Highest-quality interaction surface; feeds the feedback flywheel that becomes training data. |
| **Comparison view** | Direct user value; real users hit it. |
| **Persona CRUD + recommendation** | Necessary scaffolding for the engine. |
| **Onboarding state + auth + workspaces** | Plumbing. Keep but don't sell. |
| **Billing + BYOK** | Required for revenue. |
| **Hash chain + verifier infrastructure (the *code*, not the audit feature)** | The hash-chain primitives are useful for evaluations too. Keep `src/lib/audit/hash-chain.ts` as a generic immutability utility; we'll reuse it. |

### Fix-or-cut (the audit decision)

This is the hard call. **Decision Audit** has three options:

**Option A — Fix it properly (2-3 weeks of focus).**
- Seed 5 audit personas in a new migration (data fix, ~half a day).
- Either remove the file/link claim from the placeholder (15 min), OR actually build file upload + link unfurl (1 week+, plus storage cost, plus DLP, plus legal).
- Add real error surfacing in the audit detail page (no more generic "审计失败"). Show which step failed and why.
- Get one real customer (legal / risk / compliance buyer) to run an audit end-to-end and sign it off.
- Build the verify-this-PDF demo that converts a regulator on first contact.

This is a defensible regulated-AI play. EU AI Act enforcement starts biting in 2026. There is real budget here. But it is *its own product* and demands *its own buyer* and *its own pricing*.

**Option B — Cut it cleanly (one afternoon).**
- Remove `Audit` from the sidebar nav.
- Hide `/audit/*` routes behind a feature flag (`NEXT_PUBLIC_ENABLE_AUDIT=false`).
- Keep the migrations and worker code as a parked branch. Don't delete; don't ship.
- Ship the focused product: "Hygge = multi-persona deliberation for hard decisions."

**My honest read:** Option B unless you have an audit pilot LoI in hand or a co-founder who wants to own the regulated-AI go-to-market. Audit is a real opportunity, but a half-broken one in the sidebar today is *negative* — it tells users the product doesn't work. **Decide, then commit. Stop being two products.**

### Cut (low ambiguity)

| Feature | Action | Why |
| --- | --- | --- |
| **Persona Squads** (`/api/squads/*`, table, code) | Delete. Park in branch if sentimental. | Zero UI, zero callers, dead weight. |
| **Referrals** (`/api/referrals/*`, tables, code) | Delete. | Same as squads. Comes back when there's a growth motion to attach it to. |
| **Marketplace + Publications scaffolding** | Move into `experimental/` folder or feature-flag at the route level so they can't accidentally ship. | Plans, not products. |
| **Misleading copy** like the audit placeholder | Audit sweep across i18n: every claim must match what the UI does. | Trust debt accumulates per click. |

---

## 4. The two-product trap, named

Hygge is currently in the classic "two halves of two products" trap. Half of an evaluation tool. Half of an audit/compliance tool. The evaluation half is good. The audit half is broken. Adding a third surface (squads/referrals/marketplace) doesn't help; it just spreads the brand thinner.

The fix is not to do more. The fix is to delete.

**Ship Hygge as one product:** "Five expert perspectives on the hard decision you can't think alone. Watch them disagree. See where you're missing context. Take notes that update as you read."

That product works today. It just has too much company in the sidebar.

---

## 5. Recommended next moves

In order:

1. **Today:** Cut the lying placeholder. One-line i18n change. Costs nothing, removes a per-user trust debt.
2. **Today:** Hide `Audit` from the sidebar (feature flag). The feature is live in DB but invisible to users until we decide.
3. **This week:** Decide Option A vs Option B on audit. If A, write the audit personas seed migration + e2e test + customer pilot plan. If B, branch-park the audit code.
4. **This week:** Delete squads + referrals scaffolding (or move to `archived/`).
5. **This week:** Wire real error surfacing on every async job (audit, evaluation, debate-response). Generic "失败" is a product failure.
6. **Next week:** One-page positioning doc that names the product, the buyer, the use case. Remove every sidebar item that doesn't serve that one.

---

## 6. What this doc is *not*

This is not a decision yet. It's a forced choice document. The two open calls are:

- **Audit: in or out?** Fix-or-cut, no middle ground, no "we'll get to it later."
- **Squads / referrals: confirm cut?** Default is yes; flag if there's a roadmap reason I'm missing.

Once those two are decided, the next round of code work writes itself.
