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
      {/* Subtle glow */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 100%, rgba(226,221,213,0.04), transparent 50%)",
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
              className="text-3xl font-semibold tracking-[-0.02em] text-[#EAEAE8] sm:text-4xl"
            >
              {heading}
            </motion.h2>
            <motion.p
              variants={fadeInUp}
              className="mx-auto mt-4 max-w-xl text-base text-[#9B9594]"
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
                  className="group rounded-2xl border border-[#2A2A2A] bg-[#141414] p-6 transition-all duration-300 hover:border-[#3A3A3A] hover:-translate-y-1"
                  style={{ transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)" }}
                >
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-[#1C1C1C] transition-colors group-hover:bg-[#222222]">
                    <Icon className="h-5 w-5 text-[#E2DDD5]" />
                  </div>
                  <h3 className="mb-2 text-base font-semibold text-[#EAEAE8]">
                    {feature.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-[#9B9594]">
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
