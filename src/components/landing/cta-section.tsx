"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fadeInUp, staggerContainer } from "@/lib/animations";

interface CtaSectionProps {
  overline?: string;
  headline: string;
  subtitle: string;
  ctaText: string;
  ctaHref: string;
  secondaryText?: string;
  secondaryHref?: string;
  footnote?: string;
}

export function CtaSection({
  overline,
  headline,
  subtitle,
  ctaText,
  ctaHref,
  secondaryText,
  secondaryHref,
  footnote,
}: CtaSectionProps) {
  return (
    <section className="relative overflow-hidden px-4 py-28 sm:py-36">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 65% 55% at 50% 50%, rgba(var(--atmosphere-cream-rgb),0.06), transparent 65%)",
        }}
      />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        animate={{ opacity: [0.4, 0.75, 0.4] }}
        transition={{ duration: 13, repeat: Infinity, ease: "easeInOut" }}
        style={{
          background:
            "radial-gradient(ellipse 38% 28% at 28% 58%, rgba(var(--atmosphere-warm-rgb),0.06), transparent 70%), radial-gradient(ellipse 38% 28% at 72% 58%, rgba(var(--atmosphere-cool-rgb),0.04), transparent 70%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(var(--hairline-rgb),0.12) 50%, transparent)",
        }}
      />

      <motion.div
        variants={staggerContainer(0.08)}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-100px" }}
        className="relative z-10 mx-auto flex max-w-3xl flex-col items-center text-center"
      >
        {overline && (
          <motion.span
            variants={fadeInUp}
            className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--accent-warm)]"
          >
            {overline}
          </motion.span>
        )}
        <motion.h2
          variants={fadeInUp}
          className="mt-4 text-3xl font-semibold tracking-[-0.025em] text-[color:var(--text-primary)] sm:text-[2.8rem] sm:leading-[1.06]"
        >
          {headline}
        </motion.h2>
        <motion.p
          variants={fadeInUp}
          className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-[color:var(--text-secondary)]"
        >
          {subtitle}
        </motion.p>
        <motion.div
          variants={fadeInUp}
          className="mt-9 flex flex-col items-center gap-3 sm:flex-row"
        >
          <Button
            size="lg"
            asChild
            className="btn-glow group relative h-11 rounded-lg bg-[color:var(--accent-primary)] px-6 text-[15px] font-semibold text-[color:var(--accent-ink)] transition-all duration-500 hover:-translate-y-0.5 hover:bg-[color:var(--accent-primary-hover)]"
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
        {footnote && (
          <motion.p
            variants={fadeInUp}
            className="mt-5 text-[12px] text-[color:var(--text-tertiary)]"
          >
            {footnote}
          </motion.p>
        )}
      </motion.div>
    </section>
  );
}
