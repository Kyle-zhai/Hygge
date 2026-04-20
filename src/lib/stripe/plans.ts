export interface PlanFeatures {
  opinionDrift: boolean;
  positions: boolean;
  references: boolean;
  scenarioSimulation: boolean;
  roundTableDebate: boolean;
  pdfExport: boolean;
  customPersonas: boolean;
  marketplacePublish: boolean;
  marketplaceFeatured: boolean;
}

export interface PlanConfig {
  name: "free" | "pro" | "max";
  stripePriceId: string | null;
  price: number;
  evaluationsLimit: number;
  maxPersonas: number;
  customPersonasLimit: number;
  features: PlanFeatures;
}

export const PLANS: Record<string, PlanConfig> = {
  free: {
    name: "free",
    stripePriceId: null,
    price: 0,
    evaluationsLimit: 10,
    maxPersonas: 5,
    customPersonasLimit: 0,
    features: {
      opinionDrift: false,
      positions: false,
      references: false,
      scenarioSimulation: false,
      roundTableDebate: false,
      pdfExport: false,
      customPersonas: false,
      marketplacePublish: false,
      marketplaceFeatured: false,
    },
  },
  pro: {
    name: "pro",
    stripePriceId: process.env.STRIPE_PRO_PRICE_ID || "",
    price: 2000,
    evaluationsLimit: 20,
    maxPersonas: 12,
    customPersonasLimit: 10,
    features: {
      opinionDrift: true,
      positions: true,
      references: true,
      scenarioSimulation: false,
      roundTableDebate: false,
      pdfExport: true,
      customPersonas: true,
      marketplacePublish: true,
      marketplaceFeatured: false,
    },
  },
  max: {
    name: "max",
    stripePriceId: process.env.STRIPE_MAX_PRICE_ID || "",
    price: 5000,
    evaluationsLimit: 60,
    maxPersonas: 20,
    customPersonasLimit: -1,
    features: {
      opinionDrift: true,
      positions: true,
      references: true,
      scenarioSimulation: true,
      roundTableDebate: true,
      pdfExport: true,
      customPersonas: true,
      marketplacePublish: true,
      marketplaceFeatured: true,
    },
  },
};

export function getPlanByPriceId(priceId: string | undefined | null): PlanConfig | undefined {
  if (!priceId) return undefined;
  return Object.values(PLANS).find((p) => p.stripePriceId === priceId);
}
