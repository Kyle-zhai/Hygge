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

If you change debate UI or API code, make sure `<UtteranceFeedbackButtons />` still renders on every persona utterance — this is our training-data flywheel. See `docs/superpowers/specs/2026-04-28-debate-realism-moat-spec.md`.
