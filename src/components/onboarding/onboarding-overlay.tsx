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
      "贴上你正在面对的产品决策，让一组 AI persona 通过六种分析机制把它拆开看。你拿到的不是一段对话，而是一份每条结论都能追溯到具体机制和 persona 的结构化报告。",
    bodyEn:
      "Paste a product decision you're facing. A panel of AI personas runs it through six analysis mechanisms and returns a structured report where every conclusion traces back to the specific mechanism and persona that produced it.",
  },
  {
    icon: MessageCircle,
    titleZh: "对话式 intake",
    titleEn: "Conversational intake",
    bodyZh:
      "你说一句你要决定什么。系统不会抽冷子开跑——它先抽取你已经说过的信息，最多再问 3 个真正能改变路由的问题，然后给你一份 panel 预览（用哪些 persona、哪些机制），你确认后再花算力。",
    bodyEn:
      "You describe the decision once. The system extracts what you've already said, asks at most 3 high-info-gain follow-ups, then shows you a panel preview (which personas, which mechanisms) before spending any compute. You confirm, then it runs.",
  },
  {
    icon: ScrollText,
    titleZh: "六种分析机制并行",
    titleEn: "Six mechanisms run in parallel",
    bodyZh:
      "圆桌辩论、场景模拟、心智理论、交叉挑战、独立评审、反思排序——按你的决策类型自动选 3–6 种跑。流式出结论，机制之间打架的地方系统会单独标出来。",
    bodyEn:
      "Round-table debate, scenario simulation, theory-of-mind, cross-challenge, independent persona review, reflection ranker — 3–6 of these run in parallel based on your decision type. Conclusions stream in. Where mechanisms disagree, the system flags it as a conflict.",
  },
  {
    icon: FileSignature,
    titleZh: "Show your work",
    titleEn: "Show your work",
    bodyZh:
      "报告顶部是结论先行：建议 + 三大风险。下面按机制分块——每条结论都能点开看是哪个 persona、在哪一轮辩论、从哪个场景推出来的。改条件再问一轮也只是一键的事，旧报告依然在那。",
    bodyEn:
      "The report opens with the bottom line: a recommendation plus the top three risks. Below that, every conclusion is grouped by mechanism — click any of them to drill into the persona, the debate round, the scenario it came from. Re-running with new conditions is one click, and the prior report stays in the chat.",
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
