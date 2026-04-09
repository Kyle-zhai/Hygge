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
      <div className="mx-auto max-w-4xl">
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
            className="text-center text-3xl font-semibold tracking-[-0.02em] text-[#EAEAE8] sm:text-4xl"
          >
            {heading}
          </motion.h2>

          {/* Steps with connecting line */}
          <div className="relative">
            {/* Vertical connecting line */}
            <div className="absolute left-6 top-0 bottom-0 w-px bg-[#2A2A2A] md:left-1/2 md:-translate-x-px" />

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
                    <div className="relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[#2A2A2A] bg-[#141414] md:absolute md:left-1/2 md:-translate-x-1/2">
                      <span className="text-sm font-semibold text-[#E2DDD5]">
                        {step.step}
                      </span>
                    </div>

                    {/* Content */}
                    <div
                      className={`flex-1 rounded-2xl border border-[#2A2A2A] bg-[#141414] p-6 transition-all duration-300 hover:border-[#3A3A3A] ${
                        i % 2 === 0
                          ? "md:mr-[calc(50%+2rem)] md:ml-0"
                          : "md:ml-[calc(50%+2rem)] md:mr-0"
                      }`}
                      style={{ transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)" }}
                    >
                      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-[#1C1C1C]">
                        <Icon className="h-5 w-5 text-[#E2DDD5]" />
                      </div>
                      <h3 className="mb-2 text-lg font-semibold text-[#EAEAE8]">
                        {step.title}
                      </h3>
                      <p className="text-sm leading-relaxed text-[#9B9594]">
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
