"use client";

import { motion } from "framer-motion";
import { Users, FileBarChart, ListChecks } from "lucide-react";
import { cardReveal, staggerContainer } from "@/lib/animations";

const iconMap = { Users, FileBarChart, ListChecks } as const;

interface Feature {
  step: string;
  iconName: keyof typeof iconMap;
  title: string;
  desc: string;
}

interface FeaturesSectionProps {
  features: Feature[];
}

export function FeaturesSection({ features }: FeaturesSectionProps) {
  return (
    <section className="px-4 py-24">
      <div className="mx-auto max-w-5xl">
        <div className="mb-16 text-center">
          <h2 className="text-3xl font-semibold text-[color:var(--text-primary)] sm:text-4xl tracking-[-0.02em]">
            How It Works
          </h2>
        </div>

        <motion.div
          variants={staggerContainer(0.06)}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="grid gap-5 md:grid-cols-3"
        >
          {features.map((feature, i) => (
            <motion.div
              key={i}
              variants={cardReveal(i)}
              className="card-glow relative rounded-2xl border border-[color:var(--border-default)] bg-[color:var(--bg-secondary)] p-8 transition-all duration-300 hover:border-[color:var(--border-hover)]"
            >
              <span className="mb-4 block text-sm font-semibold tracking-wider text-[color:var(--accent-primary)]">
                STEP {feature.step}
              </span>
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-[color:var(--bg-tertiary)]">
                {(() => {
                  const Icon = iconMap[feature.iconName];
                  return <Icon className="h-6 w-6 text-[color:var(--accent-primary)]" />;
                })()}
              </div>
              <h3 className="mb-2 text-lg font-semibold text-[color:var(--text-primary)]">
                {feature.title}
              </h3>
              <p className="text-sm leading-relaxed text-[color:var(--text-secondary)]">
                {feature.desc}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
