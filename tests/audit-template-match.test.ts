import { describe, expect, it } from "vitest";
import { matchTemplate } from "../src/lib/audit/template-match";

describe("matchTemplate", () => {
  it("classifies AI/LLM feature decisions to ai-feature-release", () => {
    const text =
      "We're shipping a new GPT-4 powered chatbot to all enterprise customers next week. " +
      "The model is fine-tuned on customer support tickets and will auto-respond to L1 issues. " +
      "Inference happens server-side; we capture transcripts for retraining.";
    const result = matchTemplate(text);
    expect(result.primary_slug).toBe("ai-feature-release");
    expect(result.confidence).toBeGreaterThan(0.3);
  });

  it("classifies EU AI Act human oversight decisions to eu-aia-art14", () => {
    const text =
      "Per Article 14 of the EU AI Act we need to ensure human oversight on this " +
      "credit-scoring model. The system will flag high-risk applicants for manual review. " +
      "Our compliance team must approve the deployment before go-live.";
    const result = matchTemplate(text);
    expect(result.primary_slug).toBe("eu-aia-art14");
  });

  it("classifies hiring decisions to hiring-decision", () => {
    const text =
      "We're hiring a Staff Engineer to lead the platform team. The candidate has 12 years " +
      "of experience and previously led a similar team at Stripe. Compensation: $280k base + equity. " +
      "Manager: VP Engineering. Onboarding date: next month.";
    const result = matchTemplate(text);
    expect(result.primary_slug).toBe("hiring-decision-audit");
  });

  it("falls back to strategy-premortem with low confidence on unmatched text", () => {
    const result = matchTemplate("we should buy more office plants");
    expect(result.primary_slug).toBe("strategy-premortem");
    expect(result.confidence).toBeLessThan(0.5);
  });

  it("returns alternates that are not the same as the primary", () => {
    const text =
      "Launching a new pricing tier next quarter targeting mid-market SaaS customers. " +
      "Includes our LLM agent, a model fine-tuned on industry data, and an inference API.";
    const result = matchTemplate(text);
    expect(result.alternates).not.toContain(result.primary_slug);
    expect(new Set(result.alternates).size).toBe(result.alternates.length);
  });

  it("classifies Chinese AI hiring decisions to hiring-decision-audit", () => {
    const text =
      "我们要在下周三发布一个 AI 招聘助手，自动筛选 1000 份简历并打分。" +
      "算法是 Llama 3 微调，未做偏差测试。HR 部门要求 7 天内上线。";
    const result = matchTemplate(text);
    expect(result.primary_slug).toBe("hiring-decision-audit");
    expect(result.alternates).toContain("ai-feature-release");
  });

  it("surfaces every non-primary template as an alternate", () => {
    const text =
      "Per Article 14 of the EU AI Act we need to ensure human oversight on this " +
      "credit-scoring model.";
    const result = matchTemplate(text);
    expect(result.alternates).toContain("ai-feature-release");
    expect(result.alternates).toContain("hiring-decision-audit");
    expect(result.alternates).toContain("product-launch-premortem");
    expect(result.alternates).toContain("strategy-premortem");
  });

  it("only inspects the first 2000 chars (long preambles do not skew the match)", () => {
    const padding = "x ".repeat(1500);
    const text = padding + "we are deploying a new LLM model to inference at scale";
    const result = matchTemplate(text);
    // The LLM/model/inference signals are past 2000 chars, so should not match ai-feature-release.
    expect(result.primary_slug).not.toBe("ai-feature-release");
  });
});
