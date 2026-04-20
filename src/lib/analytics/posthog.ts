// Lightweight Posthog wrapper: no-ops if NEXT_PUBLIC_POSTHOG_KEY is not set,
// so local dev and previews don't require an analytics account.
import posthog from "posthog-js";

let initialized = false;

export function initPosthog() {
  if (initialized) return;
  if (typeof window === "undefined") return;
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return;
  posthog.init(key, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
    capture_pageview: true,
    capture_pageleave: true,
    persistence: "localStorage+cookie",
  });
  initialized = true;
}

export type AnalyticsEvent =
  | "signup_completed"
  | "first_evaluation_created"
  | "upgrade_cta_clicked"
  | "checkout_completed"
  | "persona_created"
  | "debate_started"
  | "evaluation_shared"
  | "paywall_shown"
  | "evaluation_retried";

export function track(event: AnalyticsEvent, props?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  if (!initialized) return;
  posthog.capture(event, props);
}

export function identify(userId: string, props?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  if (!initialized) return;
  posthog.identify(userId, props);
}

export function reset() {
  if (typeof window === "undefined") return;
  if (!initialized) return;
  posthog.reset();
}
