This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Data flywheel — debate feedback

Every persona utterance — across round-table debates, 1v1 debates, and decision-flow mechanism transcripts — can receive a 👍/👎 + optional 1-line comment from the user who owns the conversation. Votes are stored in `public.persona_utterance_feedback` keyed by one of:

- Round-table: `(user_id, evaluation_id, round_number, message_index)`
- 1v1: `(user_id, debate_message_id)`
- Decision mechanism: `(user_id, decision_mechanism_run_id, utterance_index)` (added 2026-05-06 with the multi-agent decision flow)

This data feeds Phase 3 of the debate-realism roadmap (`docs/superpowers/specs/2026-04-28-debate-realism-moat-spec.md`) — persona-specific DPO fine-tunes once we have ~5k labels per archetype.

Monitor with `docs/superpowers/queries/feedback-flywheel-stats.sql`.

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
