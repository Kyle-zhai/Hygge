import type { TemplateAutoMatchResult } from "./types";

const RULES: Array<{ slug: string; patterns: RegExp[]; weight: number }> = [
  {
    slug: "ai-feature-release",
    weight: 3,
    patterns: [
      /\b(model|llm|gpt|claude|inference|embedding|fine-?tune|rag|prompt)\b/i,
      /\b(ai feature|ml feature|recommendation|classifier|generation|content moderation)\b/i,
      /(模型|微调|推理|嵌入|生成式|内容审核|提示词)/,
    ],
  },
  {
    slug: "eu-aia-art14",
    weight: 4,
    patterns: [
      /\b(eu ai act|gdpr|article 14|annex iii|high[- ]risk ai|human oversight|conformity assessment)\b/i,
      /(欧盟|ai法案|高风险|人工监督|合规)/,
    ],
  },
  {
    slug: "hiring-decision-audit",
    weight: 3,
    patterns: [
      /\b(hire|hiring|candidate|offer letter|promotion|termination|firing|layoff|pip|pay band)\b/i,
      /(招聘|简历|候选人|晋升|裁员|解雇|绩效)/,
    ],
  },
  {
    slug: "product-launch-premortem",
    weight: 2,
    patterns: [
      /\b(launch|ship|release|prd|product spec|go[- ]to[- ]market|gtm)\b/i,
      /(上线|发布|产品需求文档|市场策略)/,
    ],
  },
  {
    slug: "strategy-premortem",
    weight: 1,
    patterns: [
      /\b(strategy|policy|reorg|merger|acquisition|pivot|fundraise|board memo)\b/i,
      /(战略|政策|重组|并购|融资|董事会)/,
    ],
  },
];

export function matchTemplate(decisionText: string): TemplateAutoMatchResult {
  const sample = decisionText.slice(0, 2000);
  const scores = new Map<string, number>();

  for (const rule of RULES) {
    let score = 0;
    for (const pattern of rule.patterns) {
      const re = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : pattern.flags + "g");
      const matches = sample.match(re);
      if (matches) score += rule.weight * matches.length;
    }
    if (score > 0) scores.set(rule.slug, score);
  }

  if (scores.size === 0) {
    return {
      primary_slug: "strategy-premortem",
      alternates: [
        "product-launch-premortem",
        "eu-aia-art14",
        "hiring-decision-audit",
        "ai-feature-release",
      ],
      confidence: 0.2,
    };
  }

  const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1]);
  const top = ranked[0];
  const alternates: string[] = ranked.slice(1).map(([slug]) => slug);
  for (const rule of RULES) {
    if (rule.slug !== top[0] && !alternates.includes(rule.slug)) {
      alternates.push(rule.slug);
    }
  }
  const totalScore = ranked.reduce((sum, [, s]) => sum + s, 0);
  const confidence = Math.min(1, top[1] / Math.max(1, totalScore));

  return {
    primary_slug: top[0],
    alternates,
    confidence,
  };
}
