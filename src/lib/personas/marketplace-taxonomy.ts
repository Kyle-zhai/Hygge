import {
  SUB_DOMAINS,
  DOMAINS,
  PRODUCT_CATEGORIES,
  type DomainKey,
  type SubDomainKey,
  type ProductCategoryKey,
} from "./taxonomy";

export type MarketplaceKind = "topic" | "product" | "general";

export const KIND_LABEL: Record<MarketplaceKind, { en: string; zh: string }> = {
  topic: { en: "Topic", zh: "话题" },
  product: { en: "Product", zh: "产品" },
  general: { en: "General", zh: "通用" },
};

export interface TopicSubOption {
  value: SubDomainKey;
  domain: DomainKey;
  label_en: string;
  label_zh: string;
}

export function topicSubOptions(): TopicSubOption[] {
  return SUB_DOMAINS.map((s) => ({
    value: s.key,
    domain: s.domain,
    label_en: s.label_en,
    label_zh: s.label_zh,
  }));
}

export function topicSubOptionsByDomain(): Array<{
  domain: DomainKey;
  label_en: string;
  label_zh: string;
  subs: TopicSubOption[];
}> {
  return DOMAINS.map((d) => ({
    domain: d.key,
    label_en: d.label_en,
    label_zh: d.label_zh,
    subs: topicSubOptions().filter((s) => s.domain === d.key),
  }));
}

export interface ProductOption {
  value: ProductCategoryKey;
  label_en: string;
  label_zh: string;
}

export function productOptions(): ProductOption[] {
  return PRODUCT_CATEGORIES.map((c) => ({
    value: c.key,
    label_en: c.label_en,
    label_zh: c.label_zh,
  }));
}

export function isDomainKey(v: unknown): v is DomainKey {
  return v === "physical" || v === "social" || v === "intellectual" || v === "utility";
}

export function isSubDomainKey(v: unknown): v is SubDomainKey {
  return SUB_DOMAINS.some((s) => s.key === v);
}

export function isProductCategoryKey(v: unknown): v is ProductCategoryKey {
  return v === "utility" || v === "market" || v === "novelty" || v === "reliability";
}

export function isMarketplaceKind(v: unknown): v is MarketplaceKind {
  return v === "topic" || v === "product" || v === "general";
}
