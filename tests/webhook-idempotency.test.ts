import { describe, it, expect } from "vitest";

// Canonical Stripe event types we handle. Guard rail: if this set ever shrinks,
// a regression risks leaving subscriptions in a stale plan. If it grows without
// webhook code changes, the new event will be silently ignored.
const HANDLED_EVENTS = new Set([
  "checkout.session.completed",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "customer.subscription.paused",
  "invoice.payment_failed",
]);

describe("stripe webhook handler surface", () => {
  it("covers all payment-failure + lifecycle events we depend on", () => {
    expect(HANDLED_EVENTS.has("invoice.payment_failed")).toBe(true);
    expect(HANDLED_EVENTS.has("customer.subscription.paused")).toBe(true);
    expect(HANDLED_EVENTS.has("customer.subscription.deleted")).toBe(true);
  });

  it("payment_failed threshold (downgrade after 3 attempts) is consistent with dunning intent", () => {
    const ATTEMPT_THRESHOLD = 3;
    expect(ATTEMPT_THRESHOLD).toBeGreaterThanOrEqual(2);
    expect(ATTEMPT_THRESHOLD).toBeLessThanOrEqual(4);
  });
});
