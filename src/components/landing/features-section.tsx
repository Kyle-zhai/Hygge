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
          <h2 className="text-3xl font-semibold text-[#EAEAE8] sm:text-4xl tracking-[-0.02em]">
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
              className="card-glow relative rounded-2xl border border-[#2A2A2A] bg-[#141414] p-8 transition-all duration-300 hover:border-[#3A3A3A]"
            >
              <span className="mb-4 block text-sm font-semibold tracking-wider text-[#E2DDD5]">
                STEP {feature.step}
              </span>
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-[#1C1C1C]">
                {(() => {
                  const Icon = iconMap[feature.iconName];
                  return <Icon className="h-6 w-6 text-[#E2DDD5]" />;
                })()}
              </div>
              <h3 className="mb-2 text-lg font-semibold text-[#EAEAE8]">
                {feature.title}
              </h3>
              <p className="text-sm leading-relaxed text-[#9B9594]">
                {feature.desc}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
