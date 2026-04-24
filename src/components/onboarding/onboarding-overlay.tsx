"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { Sparkles, MessageCircle, Users, Store, ArrowRight, X } from "lucide-react";

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
      "Hygge 让你用不同角色的视角评估你的想法、产品或话题 — 像是召集一屋子专家为你诚实反馈。",
    bodyEn:
      "Hygge lets you evaluate your ideas, products, or topics through the eyes of different personas — like a room of experts giving candid feedback.",
  },
  {
    icon: MessageCircle,
    titleZh: "开始一次评估",
    titleEn: "Start an evaluation",
    bodyZh:
      "描述你的想法或话题，选择 3–8 个角色，然后让他们写下详细反馈。你会得到评分、共识、关键分歧和合成报告。",
    bodyEn:
      "Describe your idea or topic, pick 3–8 personas, and let them write detailed feedback. You get scores, consensus, key disagreements, and a synthesized report.",
  },
  {
    icon: Users,
    titleZh: "与角色对话",
    titleEn: "Chat with a persona",
    bodyZh:
      "读完报告后，你可以和任意角色开始一对一对话来深入提问 — 他们会保持人设回答。",
    bodyEn:
      "After reading the report, open a one-on-one chat with any persona to dig deeper — they stay in character while answering.",
  },
  {
    icon: Store,
    titleZh: "探索角色市场",
    titleEn: "Explore the marketplace",
    bodyZh:
      "浏览社区发布的角色，收藏喜欢的，或者自己创建并分享。好角色 = 好反馈。",
    bodyEn:
      "Browse personas published by the community, save the ones you like, or create and share your own. Better personas → better feedback.",
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
