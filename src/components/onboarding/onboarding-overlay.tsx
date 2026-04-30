"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { Sparkles, MessageCircle, FileSignature, ScrollText, ArrowRight, X } from "lucide-react";

interface Step {
  icon: typeof Sparkles;
  titleZh: string;
  titleEn: string;
  bodyZh: string;
  bodyEn: string;
}

const STEPS: Step[] = [
  {
    icon: Sparkles,
    titleZh: "欢迎使用 Hygge",
    titleEn: "Welcome to Hygge",
    bodyZh:
      "把一个高风险决策放到桌上，召集一组立场各异的 AI 顾问真的吵一遍。结果不是一段聊天记录，而是一份能签字、能拿去给法务和董事会的审计报告。",
    bodyEn:
      "Put a high-stakes decision on the table. A group of AI advisors with sharply different stances actually argue it out. You walk away not with a chat log, but with a signed audit report you can hand to legal or your board.",
  },
  {
    icon: MessageCircle,
    titleZh: "开始一次圆桌讨论",
    titleEn: "Convene the round table",
    bodyZh:
      "用一段话描述你要决定什么——招聘、上线、政策变更、AI 功能发布都可以。系统自动选 3–8 位最相关的顾问,他们先单独表态,再当面交锋,最后给你共识、分歧和具体行动项。",
    bodyEn:
      "Describe the decision in one paragraph — a hire, a launch, a policy change, an AI feature ship. The system picks 3–8 relevant advisors. Each speaks alone first, then they confront each other on disagreement. You get consensus, conflict, and concrete action items.",
  },
  {
    icon: ScrollText,
    titleZh: "选一份审计模板",
    titleEn: "Pick an audit template",
    bodyZh:
      "针对合规、上线 Pre-Mortem、招聘决策这些场景,Hygge 内置 5 套模板——包含 EU AI Act 第14条、GDPR 第22条、EEOC 这些监管参照。模板带 Compliance Officer + Adversarial Red Team 角色。",
    bodyEn:
      "For compliance, launch pre-mortem, or hiring decisions, Hygge ships 5 templates — referencing EU AI Act Art.14, GDPR Art.22, EEOC. Each template includes a Compliance Officer and an Adversarial Red Team persona by default.",
  },
  {
    icon: FileSignature,
    titleZh: "签字、归档、可追溯",
    titleEn: "Sign, archive, defend",
    bodyZh:
      "每个发现都要明确处置——接受缓解、接受残余风险、驳回或延期。决策者和合规官各签一次,IP 哈希留痕。整个过程 SHA-256 哈希链串联,数据库 insert-only:任一行被改,整条链就断。这就是合规可信。",
    bodyEn:
      "Every finding gets an explicit disposition — accept-mitigation, accept-residual, reject, or defer. The decision owner and compliance signer each attest, with hashed IP. Everything is SHA-256 chained and insert-only at the database level. Tamper one row, the chain breaks. That's how it stays defensible.",
  },
];

export function OnboardingOverlay() {
  const router = useRouter();
  const locale = useLocale();
  const zh = locale === "zh";
  const [step, setStep] = useState(0);
  const [dismissing, setDismissing] = useState(false);

  const current = STEPS[step];
  const Icon = current.icon;
  const isLast = step === STEPS.length - 1;

  async function markComplete() {
    try {
      await fetch("/api/onboarding/complete", { method: "POST" });
    } catch {
      // Non-blocking — even if the call fails, the user has seen the flow.
    }
  }

  async function handleNext() {
    if (isLast) {
      setDismissing(true);
      await markComplete();
      router.push(`/${locale}/evaluate/new`);
      router.refresh();
      return;
    }
    setStep((s) => s + 1);
  }

  async function handleSkip() {
    setDismissing(true);
    await markComplete();
    router.refresh();
  }

  if (dismissing) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
      <div className="relative w-full max-w-lg rounded-2xl border border-[color:var(--border-default)] bg-[color:var(--bg-secondary)] p-8 shadow-2xl">
        <button
          type="button"
          onClick={handleSkip}
          aria-label={zh ? "跳过" : "Skip"}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-[color:var(--text-tertiary)] transition-colors hover:bg-[color:var(--bg-tertiary)] hover:text-[color:var(--text-primary)]"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-[rgb(var(--accent-warm-rgb)/0.10)] text-[color:var(--accent-warm)]">
          <Icon className="h-6 w-6" />
        </div>

        <h2 className="mb-2 text-xl font-semibold text-[color:var(--text-primary)] tracking-tight">
          {zh ? current.titleZh : current.titleEn}
        </h2>
        <p className="text-sm leading-relaxed text-[color:var(--text-secondary)]">
          {zh ? current.bodyZh : current.bodyEn}
        </p>

        <div className="mt-6 flex items-center justify-center gap-1.5">
          {STEPS.map((_, idx) => (
            <span
              key={idx}
              className={`h-1.5 rounded-full transition-all ${
                idx === step
                  ? "w-6 bg-[color:var(--accent-warm)]"
                  : idx < step
                  ? "w-1.5 bg-[rgb(var(--accent-warm-rgb)/0.50)]"
                  : "w-1.5 bg-[color:var(--border-default)]"
              }`}
            />
          ))}
        </div>

        <div className="mt-7 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleSkip}
            className="text-xs text-[color:var(--text-tertiary)] transition-colors hover:text-[color:var(--text-secondary)]"
          >
            {zh ? "跳过引导" : "Skip tour"}
          </button>
          <button
            type="button"
            onClick={handleNext}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[color:var(--accent-primary)] px-4 py-2 text-sm font-semibold text-[color:var(--bg-primary)] transition-colors hover:bg-[color:var(--accent-primary-hover)]"
          >
            {isLast
              ? zh ? "开始第一次评估" : "Start first evaluation"
              : zh ? "下一步" : "Next"}
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
