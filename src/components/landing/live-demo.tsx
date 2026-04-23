"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { motion, useInView } from "framer-motion";
import { FileText } from "lucide-react";
import { EASE_OUT_EXPO } from "@/lib/animations";

interface DemoPersona {
  id: string;
  name: string;
  role: string;
  avatar: string;
  stance: "support" | "oppose" | "neutral";
  quote: string;
  tags: { kind: "up" | "down"; label: string }[];
}

interface DemoScript {
  topicOverline: string;
  topicTitle: string;
  perspectivesLabel: string;
  personas: DemoPersona[];
  summaryLabel: string;
  summaryText: string;
  consensusLabel: string;
  thinkingLabel: string;
  waitingLabel: string;
}

const STANCE_STYLE: Record<DemoPersona["stance"], { label: string; color: string }> = {
  support: { label: "Supportive", color: "#4ADE80" },
  oppose: { label: "Opposed", color: "#F87171" },
  neutral: { label: "Neutral", color: "#FBBF24" },
};

const STEP_INTERVAL_MS = 2200;
const SUMMARY_DELAY_MS = 1400;
const REPLAY_DELAY_MS = 5000;

function WaveDots() {
  return (
    <span className="ml-1.5 inline-flex items-center gap-[2px]" aria-hidden>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="inline-block h-[4px] w-[4px] rounded-full bg-[#C4A882]"
          style={{
            animation: "wave-bounce 1.4s ease-in-out infinite",
            animationDelay: `${i * 0.16}s`,
          }}
        />
      ))}
    </span>
  );
}

function PersonaAvatar({ persona }: { persona: DemoPersona }) {
  return (
    <div className="relative flex h-9 w-9 shrink-0 overflow-hidden rounded-full bg-[#1C1C1C]">
      <Image
        src={persona.avatar}
        alt=""
        fill
        sizes="36px"
        className="object-cover"
      />
    </div>
  );
}

function SkeletonBody({ muted }: { muted?: boolean }) {
  const base = muted ? "bg-[#222222]" : "bg-[#2A2A2A]";
  return (
    <div className="mt-3 space-y-2 pl-12">
      <div className={`h-3 w-[95%] rounded ${base}`} />
      <div className={`h-3 w-[82%] rounded ${base}`} />
      <div className="flex gap-1.5 pt-1">
        <div className={`h-4 w-20 rounded ${base}`} />
        <div className={`h-4 w-24 rounded ${base}`} />
      </div>
    </div>
  );
}

function ThinkingCard({ persona, thinkingLabel }: { persona: DemoPersona; thinkingLabel: string }) {
  return (
    <div
      className="rounded-xl p-[1px]"
      style={{
        background:
          "conic-gradient(from var(--border-angle), transparent 60%, #C4A882 100%)",
        animation: "border-rotate 2s linear infinite",
      }}
    >
      <div className="rounded-[11px] bg-[#141414] p-4">
        <div className="flex items-center gap-3">
          <PersonaAvatar persona={persona} />
          <div className="flex-1">
            <div className="text-sm font-medium text-[#EAEAE8]">{persona.name}</div>
            <div className="text-xs text-[#666462]">{persona.role}</div>
          </div>
          <span className="flex items-center text-xs text-[#C4A882]">
            {thinkingLabel}
            <WaveDots />
          </span>
        </div>
        <SkeletonBody />
      </div>
    </div>
  );
}

function WaitingCard({ persona, waitingLabel }: { persona: DemoPersona; waitingLabel: string }) {
  return (
    <div className="rounded-xl border border-[#2A2A2A] bg-[#141414] p-4 opacity-60">
      <div className="flex items-center gap-3">
        <PersonaAvatar persona={persona} />
        <div className="flex-1">
          <div className="text-sm font-medium text-[#EAEAE8]">{persona.name}</div>
          <div className="text-xs text-[#666462]">{persona.role}</div>
        </div>
        <span className="text-xs text-[#9B9594]">{waitingLabel}</span>
      </div>
      <SkeletonBody muted />
    </div>
  );
}

function CompletedCard({ persona }: { persona: DemoPersona }) {
  const stance = STANCE_STYLE[persona.stance];
  return (
    <div className="rounded-xl border border-[#4ADE80]/20 bg-[#4ADE80]/[0.03] p-4">
      <div className="flex items-center gap-3">
        <PersonaAvatar persona={persona} />
        <div className="flex-1">
          <div className="text-sm font-medium text-[#EAEAE8]">{persona.name}</div>
          <div className="text-xs text-[#666462]">{persona.role}</div>
        </div>
        <span
          className="rounded-full px-2.5 py-0.5 text-xs font-medium"
          style={{ backgroundColor: `${stance.color}20`, color: stance.color }}
        >
          {stance.label}
        </span>
      </div>
      <div className="mt-3 pl-12">
        <p className="text-sm leading-relaxed text-[#9B9594]">&ldquo;{persona.quote}&rdquo;</p>
        {persona.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {persona.tags.map((tag, i) => (
              <span
                key={i}
                className="rounded-md px-2 py-0.5 text-xs"
                style={{
                  color: tag.kind === "up" ? "#4ADE80" : "#F87171",
                  backgroundColor: tag.kind === "up" ? "rgba(74,222,128,0.1)" : "rgba(248,113,113,0.1)",
                }}
              >
                {tag.label}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export interface LiveDemoProps {
  script: DemoScript;
}

export function LiveDemo({ script }: LiveDemoProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const inView = useInView(containerRef, { amount: 0.35, once: false });
  const [revealedCount, setRevealedCount] = useState(0);
  const [showSummary, setShowSummary] = useState(false);
  const [cycleKey, setCycleKey] = useState(0);

  useEffect(() => {
    if (!inView) return;

    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: reset demo-reveal state when the section scrolls into view so the animation restarts
    setRevealedCount(0);
    setShowSummary(false);
    const timers: ReturnType<typeof setTimeout>[] = [];

    script.personas.forEach((_, i) => {
      timers.push(
        setTimeout(() => setRevealedCount(i + 1), (i + 1) * STEP_INTERVAL_MS),
      );
    });
    timers.push(
      setTimeout(
        () => setShowSummary(true),
        script.personas.length * STEP_INTERVAL_MS + SUMMARY_DELAY_MS,
      ),
    );

    return () => {
      for (const t of timers) clearTimeout(t);
    };
  }, [inView, cycleKey, script.personas.length]);

  useEffect(() => {
    if (!showSummary) return;
    if (!inView) return;
    const timer = setTimeout(() => {
      setCycleKey((k) => k + 1);
    }, REPLAY_DELAY_MS);
    return () => clearTimeout(timer);
  }, [showSummary, inView]);

  return (
    <section className="relative px-4 py-20 sm:py-28">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 40%, rgba(196,168,130,0.05), transparent 55%)",
        }}
      />
      <div
        ref={containerRef}
        className="relative mx-auto flex max-w-3xl flex-col gap-6"
      >
        <div className="text-center">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#C4A882]">
            {script.topicOverline}
          </p>
          <h2 className="mt-3 text-2xl font-semibold tracking-[-0.02em] text-[#EAEAE8] sm:text-3xl">
            {script.topicTitle}
          </h2>
          <p className="mt-1 text-sm text-[#9B9594]">
            {script.perspectivesLabel}
          </p>
        </div>

        <div className="space-y-3">
          {script.personas.map((persona, index) => {
            const isCompleted = index < revealedCount;
            const isThinking = index === revealedCount;
            return (
              <div key={persona.id} className="min-h-[156px]">
                <motion.div
                  key={`${cycleKey}-${persona.id}-${isCompleted ? "c" : isThinking ? "t" : "w"}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.45, ease: EASE_OUT_EXPO }}
                >
                  {isCompleted ? (
                    <CompletedCard persona={persona} />
                  ) : isThinking ? (
                    <ThinkingCard persona={persona} thinkingLabel={script.thinkingLabel} />
                  ) : (
                    <WaitingCard persona={persona} waitingLabel={script.waitingLabel} />
                  )}
                </motion.div>
              </div>
            );
          })}
        </div>

        <motion.div
          aria-hidden={!showSummary}
          initial={false}
          animate={{ opacity: showSummary ? 1 : 0, y: showSummary ? 0 : 8 }}
          transition={{ duration: 0.6, ease: EASE_OUT_EXPO }}
          className="rounded-xl border border-[#E2DDD5]/20 bg-[#E2DDD5]/[0.03] p-5"
        >
          <div className="mb-3 flex items-center gap-2">
            <FileText className="h-4 w-4 text-[#E2DDD5]" />
            <span className="text-sm font-semibold text-[#EAEAE8]">
              {script.summaryLabel}
            </span>
            <span className="ml-auto rounded-full bg-[#E2DDD5]/15 px-2.5 py-0.5 text-xs font-medium text-[#E2DDD5]">
              {script.consensusLabel}
            </span>
          </div>
          <p className="text-sm leading-relaxed text-[#9B9594]">
            {script.summaryText}
          </p>
        </motion.div>
      </div>
    </section>
  );
}
