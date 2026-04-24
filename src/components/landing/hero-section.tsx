"use client";

import Link from "next/link";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { wordReveal, EASE_OUT_EXPO } from "@/lib/animations";

interface HeroSectionProps {
  overline: string;
  headline: string;
  subtitle: string;
  ctaText: string;
  ctaHref: string;
  secondaryText?: string;
  secondaryHref?: string;
  trustRow?: { label: string; items: string[] };
}

export function HeroSection({
  overline,
  headline,
  subtitle,
  ctaText,
  ctaHref,
  secondaryText,
  secondaryHref,
  trustRow,
}: HeroSectionProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"],
  });

  const opacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);
  const y = useTransform(scrollYProgress, [0, 0.8], [0, -80]);

  const words = headline.split(" ");

  return (
    <section
      ref={sectionRef}
      className="relative flex min-h-[88vh] flex-col items-center justify-center gap-8 overflow-hidden px-4 pb-24 pt-32 text-center sm:pt-40"
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 85% 60% at 50% 30%, rgba(var(--atmosphere-cream-rgb),0.07), transparent 65%)",
        }}
      />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        animate={{ opacity: [0.3, 0.55, 0.3] }}
        transition={{ duration: 11, repeat: Infinity, ease: "easeInOut" }}
        style={{
          background:
            "radial-gradient(ellipse 50% 30% at 28% 72%, rgba(var(--atmosphere-warm-rgb),0.07), transparent 70%), radial-gradient(ellipse 42% 28% at 76% 68%, rgba(var(--atmosphere-cool-rgb),0.05), transparent 70%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(var(--hairline-rgb),0.18) 50%, transparent)",
        }}
      />

      <motion.div
        style={{ opacity, y }}
        className="relative z-10 flex flex-col items-center gap-7"
      >
        <motion.span
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: EASE_OUT_EXPO }}
          className="inline-flex items-center gap-2 rounded-full border border-[color:var(--border-default)] bg-[color:var(--bg-secondary)]/70 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-[color:var(--text-secondary)] backdrop-blur"
        >
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[color:var(--accent-warm)] opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[color:var(--accent-warm)]" />
          </span>
          {overline}
        </motion.span>

        <h1 className="max-w-4xl text-[clamp(2.4rem,5.6vw,4.2rem)] font-semibold leading-[1.04] tracking-[-0.025em] text-[color:var(--text-primary)]">
          <span className="flex flex-wrap justify-center gap-x-[0.28em] gap-y-[0.1em]">
            {words.map((word, i) => (
              <motion.span
                key={i}
                variants={wordReveal(i)}
                initial="hidden"
                animate="visible"
                className="inline-block"
              >
                {word}
              </motion.span>
            ))}
          </span>
        </h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            delay: words.length * 0.06 + 0.2,
            duration: 0.7,
            ease: EASE_OUT_EXPO,
          }}
          className="max-w-xl text-base leading-relaxed text-[color:var(--text-secondary)] sm:text-lg"
        >
          {subtitle}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            delay: words.length * 0.06 + 0.4,
            duration: 0.7,
            ease: EASE_OUT_EXPO,
          }}
          className="flex flex-col items-center gap-3 sm:flex-row"
        >
          <Button
            size="lg"
            asChild
            className="btn-glow relative h-11 rounded-lg bg-[color:var(--accent-primary)] px-6 text-[15px] font-semibold text-[color:var(--accent-ink)] transition-all duration-500 hover:-translate-y-0.5 hover:bg-[color:var(--accent-primary-hover)]"
          >
            <Link href={ctaHref}>
              {ctaText}
              <ArrowRight className="ml-1.5 h-4 w-4 transition-transform duration-500 group-hover:translate-x-1" />
            </Link>
          </Button>
          {secondaryText && secondaryHref && (
            <Link
              href={secondaryHref}
              className="group inline-flex h-11 items-center gap-1.5 rounded-lg border border-[color:var(--border-default)] bg-[color:var(--bg-secondary)]/60 px-5 text-[15px] font-medium text-[color:var(--text-primary)] backdrop-blur transition-all duration-300 hover:border-[color:var(--border-hover)] hover:bg-[color:var(--bg-hover)]"
            >
              {secondaryText}
              <ArrowRight className="h-3.5 w-3.5 opacity-60 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:opacity-100" />
            </Link>
          )}
        </motion.div>

        {trustRow && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              delay: words.length * 0.06 + 0.65,
              duration: 0.7,
              ease: EASE_OUT_EXPO,
            }}
            className="mt-3 flex flex-col items-center gap-3 text-[13px] text-[color:var(--text-tertiary)]"
          >
            <span className="text-[11px] font-medium uppercase tracking-[0.14em]">
              {trustRow.label}
            </span>
            <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 sm:gap-x-7">
              {trustRow.items.map((item) => (
                <span
                  key={item}
                  className="text-[color:var(--text-secondary)]"
                >
                  {item}
                </span>
              ))}
            </div>
          </motion.div>
        )}
      </motion.div>
    </section>
  );
}
