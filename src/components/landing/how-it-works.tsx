"use client";

import { motion } from "framer-motion";
import {
  MessageSquare,
  Users,
  FileBarChart,
  ListChecks,
} from "lucide-react";
import { fadeInUp, staggerContainer, EASE_OUT_EXPO } from "@/lib/animations";

const iconMap = {
  MessageSquare,
  Users,
  FileBarChart,
  ListChecks,
} as const;

interface Step {
  step: string;
  iconName: keyof typeof iconMap;
  title: string;
  desc: string;
}

interface HowItWorksProps {
  heading: string;
  steps: Step[];
}

export function HowItWorks({ heading, steps }: HowItWorksProps) {
  return (
    <section className="relative px-4 py-32 overflow-hidden">
      {/* Atmosphere */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 50% 60% at 50% 50%, rgba(var(--atmosphere-cream-rgb),0.035), transparent 70%)",
        }}
      />
      <div className="relative mx-auto max-w-4xl">
        <motion.div
          variants={staggerContainer(0.06)}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="space-y-16"
        >
          {/* Heading */}
          <motion.h2
            variants={fadeInUp}
            className="text-center text-3xl font-semibold tracking-[-0.02em] text-[color:var(--text-primary)] sm:text-4xl"
          >
            {heading}
          </motion.h2>

          {/* Steps with connecting line */}
          <div className="relative">
            {/* Vertical connecting line — gradient fade at both ends */}
            <div
              className="absolute left-6 top-0 bottom-0 w-px md:left-1/2 md:-translate-x-px"
              style={{
                background:
                  "linear-gradient(180deg, transparent, var(--border-default) 12%, var(--border-default) 88%, transparent)",
              }}
            />
            {/* Soft glow behind the line */}
            <div
              className="pointer-events-none absolute left-6 top-0 bottom-0 w-px md:left-1/2 md:-translate-x-px"
              style={{
                background:
                  "linear-gradient(180deg, transparent, rgba(var(--atmosphere-cream-rgb),0.1) 50%, transparent)",
                filter: "blur(8px)",
              }}
            />

            <div className="space-y-12">
              {steps.map((step, i) => {
                const Icon = iconMap[step.iconName];
                return (
                  <motion.div
                    key={step.step}
                    initial={{ opacity: 0, y: 40 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-50px" }}
                    transition={{
                      delay: i * 0.1,
                      duration: 0.7,
                      ease: EASE_OUT_EXPO,
                    }}
                    className="relative flex items-start gap-6 md:gap-12"
                  >
                    {/* Step number circle on the line */}
                    <div className="relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[color:var(--border-default)] bg-gradient-to-br from-[color:var(--bg-tertiary)] to-[color:var(--panel-grad-bottom)] shadow-[0_0_24px_-4px_rgba(var(--atmosphere-cream-rgb),0.2),0_0_0_1px_rgba(var(--atmosphere-cream-rgb),0.06)_inset] md:absolute md:left-1/2 md:-translate-x-1/2">
                      <span className="text-sm font-semibold text-[color:var(--accent-primary)]">
                        {step.step}
                      </span>
                    </div>

                    {/* Content */}
                    <div
                      className={`group relative flex-1 overflow-hidden rounded-2xl border border-[color:var(--border-default)] bg-gradient-to-b from-[color:var(--panel-grad-top)] to-[color:var(--panel-grad-bottom)] p-6 transition-all duration-500 hover:border-[color:var(--border-hover)] hover:-translate-y-1 hover:shadow-[0_30px_80px_-30px_rgba(0,0,0,0.9),0_0_0_1px_rgba(var(--atmosphere-cream-rgb),0.05)_inset] ${
                        i % 2 === 0
                          ? "md:mr-[calc(50%+2rem)] md:ml-0"
                          : "md:ml-[calc(50%+2rem)] md:mr-0"
                      }`}
                      style={{ transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)" }}
                    >
                      {/* Spotlight */}
                      <div
                        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                        style={{
                          background:
                            "radial-gradient(circle at 50% 0%, rgba(var(--atmosphere-cream-rgb),0.08), transparent 70%)",
                        }}
                      />
                      <div className="relative mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[color:var(--bg-tertiary)] to-[color:var(--bg-secondary)] ring-1 ring-[color:var(--border-default)] transition-all duration-500 group-hover:ring-[color:var(--border-hover)] group-hover:shadow-[0_0_20px_-5px_rgba(var(--atmosphere-cream-rgb),0.15)]">
                        <Icon className="h-5 w-5 text-[color:var(--accent-primary)]" />
                      </div>
                      <h3 className="relative mb-2 text-lg font-semibold text-[color:var(--text-primary)]">
                        {step.title}
                      </h3>
                      <p className="relative text-sm leading-relaxed text-[color:var(--text-secondary)]">
                        {step.desc}
                      </p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
