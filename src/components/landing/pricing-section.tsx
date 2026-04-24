"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Check, Sparkles } from "lucide-react";
import { fadeInUp, staggerContainer } from "@/lib/animations";

export interface PricingTier {
  key: string;
  name: string;
  price: string;
  period?: string;
  tagline: string;
  features: string[];
  ctaText: string;
  ctaHref: string;
  highlight?: boolean;
  badge?: string;
  footnote?: string;
}

interface PricingSectionProps {
  overline: string;
  heading: string;
  subtitle: string;
  tiers: PricingTier[];
}

export function PricingSection({
  overline,
  heading,
  subtitle,
  tiers,
}: PricingSectionProps) {
  return (
    <section className="relative overflow-hidden px-4 py-28 sm:py-36">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 45% at 50% 20%, rgba(var(--atmosphere-cream-rgb),0.035), transparent 70%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(var(--hairline-rgb),0.12) 50%, transparent)",
        }}
      />

      <div className="relative z-10 mx-auto max-w-6xl">
        <motion.div
          variants={staggerContainer(0.08)}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="mb-14 text-center"
        >
          <motion.span
            variants={fadeInUp}
            className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--accent-warm)]"
          >
            {overline}
          </motion.span>
          <motion.h2
            variants={fadeInUp}
            className="mx-auto mt-4 max-w-3xl text-3xl font-semibold tracking-[-0.02em] text-[color:var(--text-primary)] sm:text-[2.6rem] sm:leading-[1.08]"
          >
            {heading}
          </motion.h2>
          <motion.p
            variants={fadeInUp}
            className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-[color:var(--text-secondary)]"
          >
            {subtitle}
          </motion.p>
        </motion.div>

        <motion.div
          variants={staggerContainer(0.08)}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          className="grid items-stretch gap-5 md:grid-cols-3"
        >
          {tiers.map((tier) => (
            <motion.div
              key={tier.key}
              variants={fadeInUp}
              className={`relative flex flex-col overflow-hidden rounded-2xl border p-7 transition-colors ${
                tier.highlight
                  ? "border-[color:var(--accent-warm)]/40 bg-[color:var(--bg-secondary)] shadow-[0_40px_80px_-40px_rgba(var(--atmosphere-warm-rgb),0.3)]"
                  : "border-[color:var(--border-default)] bg-gradient-to-b from-[color:var(--panel-grad-top)] to-[color:var(--panel-grad-bottom)] hover:border-[color:var(--border-hover)]"
              }`}
            >
              {tier.highlight && (
                <div
                  className="pointer-events-none absolute inset-0 opacity-80"
                  style={{
                    background:
                      "radial-gradient(ellipse 80% 40% at 50% 0%, rgba(var(--atmosphere-warm-rgb),0.08), transparent 70%)",
                  }}
                />
              )}

              {tier.badge && (
                <span className="relative inline-flex w-fit items-center gap-1 rounded-full bg-[color:var(--accent-warm)]/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-[color:var(--accent-warm)]">
                  <Sparkles className="h-3 w-3" />
                  {tier.badge}
                </span>
              )}

              <div className="relative mt-1">
                <h3 className="text-lg font-semibold text-[color:var(--text-primary)]">
                  {tier.name}
                </h3>
                <p className="mt-1 text-sm text-[color:var(--text-secondary)]">
                  {tier.tagline}
                </p>
                <div className="mt-5 flex items-baseline gap-1.5">
                  <span className="text-[2.25rem] font-semibold tracking-[-0.02em] text-[color:var(--text-primary)]">
                    {tier.price}
                  </span>
                  {tier.period && (
                    <span className="text-sm text-[color:var(--text-tertiary)]">
                      {tier.period}
                    </span>
                  )}
                </div>
              </div>

              <div className="relative my-6 h-px bg-[color:var(--border-default)]" />

              <ul className="relative flex-1 space-y-3">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm">
                    <Check
                      className={`mt-0.5 h-4 w-4 shrink-0 ${
                        tier.highlight
                          ? "text-[color:var(--accent-warm)]"
                          : "text-[color:var(--text-secondary)]"
                      }`}
                    />
                    <span className="text-[color:var(--text-secondary)]">
                      {f}
                    </span>
                  </li>
                ))}
              </ul>

              <Link
                href={tier.ctaHref}
                className={`relative mt-7 inline-flex h-10 items-center justify-center rounded-lg text-sm font-semibold transition-all duration-300 ${
                  tier.highlight
                    ? "bg-[color:var(--accent-primary)] text-[color:var(--accent-ink)] hover:bg-[color:var(--accent-primary-hover)]"
                    : "border border-[color:var(--border-default)] bg-[color:var(--bg-secondary)] text-[color:var(--text-primary)] hover:border-[color:var(--border-hover)] hover:bg-[color:var(--bg-hover)]"
                }`}
              >
                {tier.ctaText}
              </Link>

              {tier.footnote && (
                <p className="relative mt-3 text-center text-[11px] text-[color:var(--text-tertiary)]">
                  {tier.footnote}
                </p>
              )}
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
