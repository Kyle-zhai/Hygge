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
    evaluationsLimit: 3,
    maxPersonas: 5,
  },
  pro: {
    name: "pro",
    stripePriceId: process.env.STRIPE_PRO_PRICE_ID || "",
    price: 2000,
    evaluationsLimit: 15,
    maxPersonas: 12,
  },
  max: {
    name: "max",
    stripePriceId: process.env.STRIPE_MAX_PRICE_ID || "",
    price: 10000,
    evaluationsLimit: 60,
    maxPersonas: 25,
  },
};

export function getPlanByPriceId(priceId: string): PlanConfig | undefined {
  return Object.values(PLANS).find((p) => p.stripePriceId === priceId);
}
