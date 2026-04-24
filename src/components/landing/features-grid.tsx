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
import { cardReveal, staggerContainer, fadeInUp } from "@/lib/animations";

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
  heading: string;
  subtitle: string;
  features: Feature[];
}

export function FeaturesGrid({
  heading,
  subtitle,
  features,
}: FeaturesGridProps) {
  return (
    <section className="relative px-4 py-32 overflow-hidden">
      {/* Atmospheric layers */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 50% at 30% 0%, rgba(var(--atmosphere-warm-rgb),0.05), transparent 60%), radial-gradient(ellipse 60% 50% at 75% 100%, rgba(var(--atmosphere-cream-rgb),0.05), transparent 60%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(var(--atmosphere-cream-rgb),0.15) 50%, transparent)",
        }}
      />

      <div className="relative z-10 mx-auto max-w-6xl">
        <motion.div
          variants={staggerContainer(0.06)}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="space-y-12"
        >
          {/* Heading */}
          <div className="text-center">
            <motion.h2
              variants={fadeInUp}
              className="text-3xl font-semibold tracking-[-0.02em] text-[color:var(--text-primary)] sm:text-4xl"
            >
              {heading}
            </motion.h2>
            <motion.p
              variants={fadeInUp}
              className="mx-auto mt-4 max-w-xl text-base text-[color:var(--text-secondary)]"
            >
              {subtitle}
            </motion.p>
          </div>

          {/* 2x3 grid */}
          <motion.div
            variants={staggerContainer(0.06)}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
          >
            {features.map((feature, i) => {
              const Icon = iconMap[feature.iconName];
              return (
                <motion.div
                  key={feature.title}
                  variants={cardReveal(i)}
                  className="group relative overflow-hidden rounded-2xl border border-[color:var(--border-default)] bg-gradient-to-b from-[color:var(--panel-grad-top)] to-[color:var(--panel-grad-bottom)] p-6 transition-all duration-500 hover:border-[color:var(--border-hover)] hover:-translate-y-1 hover:shadow-[0_30px_80px_-30px_rgba(0,0,0,0.9),0_0_0_1px_rgba(var(--atmosphere-cream-rgb),0.05)_inset]"
                  style={{ transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)" }}
                >
                  {/* Hover spotlight */}
                  <div
                    className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                    style={{
                      background:
                        "radial-gradient(circle at 50% 0%, rgba(var(--atmosphere-cream-rgb),0.08), transparent 70%)",
                    }}
                  />
                  {/* Top hairline that brightens on hover */}
                  <div
                    className="pointer-events-none absolute inset-x-6 top-0 h-px opacity-40 transition-opacity duration-500 group-hover:opacity-100"
                    style={{
                      background:
                        "linear-gradient(90deg, transparent, rgba(var(--atmosphere-cream-rgb),0.5), transparent)",
                    }}
                  />
                  <div className="relative mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[color:var(--bg-tertiary)] to-[color:var(--bg-secondary)] ring-1 ring-[color:var(--border-default)] transition-all duration-500 group-hover:ring-[color:var(--border-hover)] group-hover:shadow-[0_0_20px_-5px_rgba(var(--atmosphere-cream-rgb),0.15)]">
                    <Icon className="h-5 w-5 text-[color:var(--accent-primary)]" />
                  </div>
                  <h3 className="relative mb-2 text-base font-semibold text-[color:var(--text-primary)]">
                    {feature.title}
                  </h3>
                  <p className="relative text-sm leading-relaxed text-[color:var(--text-secondary)]">
                    {feature.desc}
                  </p>
                </motion.div>
              );
            })}
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
