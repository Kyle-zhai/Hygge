export interface PlanConfig {
  name: "free" | "pro" | "max";
  stripePriceId: string | null;
  price: number;
  evaluationsLimit: number;
  maxPersonas: number;
}

export const PLANS: Record<string, PlanConfig> = {
  free: {
    name: "free",
    stripePriceId: null,
    price: 0,
    evaluationsLimit: 1,
    maxPersonas: 3,
  },
  pro: {
    name: "pro",
    stripePriceId: process.env.STRIPE_PRO_PRICE_ID || "",
    price: 2000,
    evaluationsLimit: 10,
    maxPersonas: 10,
  },
  max: {
    name: "max",
    stripePriceId: process.env.STRIPE_MAX_PRICE_ID || "",
    price: 10000,
    evaluationsLimit: 40,
    maxPersonas: 20,
  },
};

export function getPlanByPriceId(priceId: string): PlanConfig | undefined {
  return Object.values(PLANS).find((p) => p.stripePriceId === priceId);
}
