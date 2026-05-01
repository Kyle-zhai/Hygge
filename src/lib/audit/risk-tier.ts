// Risk tier derivation from severity × probability.
//
// We bucket each finding into one of four named tiers so the UI can
// surface "how bad is this" at a glance without forcing the user to
// math S×P themselves. Bands match the standard 5×5 likelihood-impact
// matrix used in most enterprise risk registers (NIST RMF, COSO ERM):
//
//   CRITICAL  20-25   acute / immediate exposure   (red)
//   HIGH      12-19   serious / likely impact      (orange)
//   MEDIUM     6-11   meaningful / plausible       (amber)
//   LOW        1-5    minor / unlikely             (green)
//   UNRATED    null   missing severity / probability fields
//
// Color tokens are produced as raw rgb() so they slot directly into
// inline styles — Tailwind's color palette doesn't reach the exact
// shades the heatmap uses, and we want both to feel consistent.

export type RiskTier = "critical" | "high" | "medium" | "low" | "unrated";

export interface RiskTierInfo {
  tier: RiskTier;
  /** Numeric severity × probability score, or null when either is missing. */
  score: number | null;
  /** Solid badge background. */
  bg: string;
  /** Translucent surface for row tinting (left bar / hover). */
  bgSoft: string;
  /** Solid badge text color (white on filled tiers, theme-aware on unrated). */
  fg: string;
  /** Border color matching the badge — used for chip outlines. */
  border: string;
}

const TIER_STYLE: Record<RiskTier, Omit<RiskTierInfo, "score">> = {
  critical: {
    tier: "critical",
    bg: "rgb(220, 38, 38)",
    bgSoft: "rgba(220, 38, 38, 0.10)",
    fg: "rgb(255, 255, 255)",
    border: "rgb(220, 38, 38)",
  },
  high: {
    tier: "high",
    bg: "rgb(234, 88, 12)",
    bgSoft: "rgba(234, 88, 12, 0.10)",
    fg: "rgb(255, 255, 255)",
    border: "rgb(234, 88, 12)",
  },
  medium: {
    tier: "medium",
    bg: "rgb(202, 138, 4)",
    bgSoft: "rgba(202, 138, 4, 0.10)",
    fg: "rgb(255, 255, 255)",
    border: "rgb(202, 138, 4)",
  },
  low: {
    tier: "low",
    bg: "rgb(34, 139, 84)",
    bgSoft: "rgba(34, 139, 84, 0.10)",
    fg: "rgb(255, 255, 255)",
    border: "rgb(34, 139, 84)",
  },
  unrated: {
    tier: "unrated",
    bg: "rgba(120, 120, 120, 0.55)",
    bgSoft: "rgba(120, 120, 120, 0.10)",
    fg: "rgb(255, 255, 255)",
    border: "rgba(120, 120, 120, 0.55)",
  },
};

export function riskTier(
  severity: number | null | undefined,
  probability: number | null | undefined,
): RiskTierInfo {
  if (severity == null || probability == null) {
    return { ...TIER_STYLE.unrated, score: null };
  }
  const score = severity * probability;
  if (score >= 20) return { ...TIER_STYLE.critical, score };
  if (score >= 12) return { ...TIER_STYLE.high, score };
  if (score >= 6) return { ...TIER_STYLE.medium, score };
  return { ...TIER_STYLE.low, score };
}

/** Sort comparator: highest risk first; ties keep input order. */
export function compareByRiskDesc<T extends { severity: number | null; probability: number | null; display_order: number }>(
  a: T,
  b: T,
): number {
  const sa = (a.severity ?? 0) * (a.probability ?? 0);
  const sb = (b.severity ?? 0) * (b.probability ?? 0);
  if (sa !== sb) return sb - sa;
  return a.display_order - b.display_order;
}
