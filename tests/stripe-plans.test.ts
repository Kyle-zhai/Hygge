import { describe, it, expect } from "vitest";
import { PLANS, getPlanByPriceId } from "@/lib/stripe/plans";

describe("stripe/plans", () => {
  it("exposes the expected plan keys", () => {
    expect(Object.keys(PLANS).sort()).toEqual(["free", "max", "pro"].sort());
  });

  it("free plan has smaller caps than pro, pro has smaller caps than max", () => {
    expect(PLANS.free.evaluationsLimit).toBeLessThan(PLANS.pro.evaluationsLimit);
    expect(PLANS.pro.evaluationsLimit).toBeLessThanOrEqual(PLANS.max.evaluationsLimit);
    expect(PLANS.free.maxPersonas).toBeLessThanOrEqual(PLANS.pro.maxPersonas);
  });

  it("returns undefined for unknown price ids", () => {
    expect(getPlanByPriceId("price_does_not_exist")).toBeUndefined();
    expect(getPlanByPriceId(undefined)).toBeUndefined();
  });
});
