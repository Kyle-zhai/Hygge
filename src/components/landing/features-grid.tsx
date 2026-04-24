"use client";

import { motion } from "framer-motion";
import {
  Brain,
  Globe,
  BarChart3,
  Shield,
  Zap,
  Layers,
} from "lucide-react";
import { fadeInUp, staggerContainer } from "@/lib/animations";

const iconMap = {
  Brain,
  Globe,
  BarChart3,
  Shield,
  Zap,
  Layers,
} as const;

interface Feature {
  iconName: keyof typeof iconMap;
  title: string;
  desc: string;
}

interface FeaturesGridProps {
  overline?: string;
  heading: string;
  subtitle: string;
  features: Feature[];
}

export function FeaturesGrid({
  overline,
  heading,
  subtitle,
  features,
}: FeaturesGridProps) {
  return (
    <section className="relative overflow-hidden px-4 py-28 sm:py-36">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 40% at 50% 50%, rgba(var(--atmosphere-cream-rgb),0.025), transparent 70%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(var(--hairline-rgb),0.1) 50%, transparent)",
        }}
      />

      <div className="relative z-10 mx-auto max-w-6xl">
        <motion.div
          variants={staggerContainer(0.08)}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="mb-16 text-center"
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
            className="mx-auto mt-4 max-w-3xl text-3xl font-semibold tracking-[-0.02em] text-[color:var(--text-primary)] sm:text-[2.4rem] sm:leading-[1.1]"
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
          variants={staggerContainer(0.05)}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
          className="grid gap-px overflow-hidden rounded-2xl border border-[color:var(--border-default)] bg-[color:var(--border-default)] sm:grid-cols-2 lg:grid-cols-3"
        >
          {features.map((feature) => {
            const Icon = iconMap[feature.iconName];
            return (
              <motion.div
                key={feature.title}
                variants={fadeInUp}
                className="group relative bg-[color:var(--bg-primary)] p-7 transition-colors duration-300 hover:bg-[color:var(--bg-secondary)]/50"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[color:var(--bg-secondary)] ring-1 ring-[color:var(--border-default)] transition-colors duration-300 group-hover:ring-[color:var(--border-hover)]">
                  <Icon className="h-4 w-4 text-[color:var(--accent-warm)]" />
                </div>
                <h3 className="mt-5 text-[15px] font-semibold text-[color:var(--text-primary)]">
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[color:var(--text-secondary)]">
                  {feature.desc}
                </p>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
