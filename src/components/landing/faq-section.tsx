"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Minus } from "lucide-react";
import { fadeInUp, staggerContainer } from "@/lib/animations";

export interface FaqItem {
  q: string;
  a: string;
}

interface FaqSectionProps {
  overline: string;
  heading: string;
  subtitle: string;
  items: FaqItem[];
  footerLabel?: string;
  footerText?: string;
  footerHref?: string;
}

export function FaqSection({
  overline,
  heading,
  subtitle,
  items,
  footerLabel,
  footerText,
  footerHref,
}: FaqSectionProps) {
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  return (
    <section className="relative overflow-hidden px-4 py-28 sm:py-36">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 55% 40% at 50% 40%, rgba(var(--atmosphere-cream-rgb),0.025), transparent 70%)",
        }}
      />
      <div className="relative z-10 mx-auto grid max-w-5xl gap-14 lg:grid-cols-[1fr_1.4fr] lg:gap-16">
        <motion.div
          variants={staggerContainer(0.08)}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
        >
          <motion.span
            variants={fadeInUp}
            className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--accent-warm)]"
          >
            {overline}
          </motion.span>
          <motion.h2
            variants={fadeInUp}
            className="mt-4 text-3xl font-semibold tracking-[-0.02em] text-[color:var(--text-primary)] sm:text-[2.4rem] sm:leading-[1.1]"
          >
            {heading}
          </motion.h2>
          <motion.p
            variants={fadeInUp}
            className="mt-5 max-w-md text-base leading-relaxed text-[color:var(--text-secondary)]"
          >
            {subtitle}
          </motion.p>

          {footerLabel && footerText && footerHref && (
            <motion.div
              variants={fadeInUp}
              className="mt-8 rounded-xl border border-[color:var(--border-default)] bg-[color:var(--bg-secondary)] p-5"
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[color:var(--text-tertiary)]">
                {footerLabel}
              </p>
              <a
                href={footerHref}
                className="mt-2 inline-block text-sm font-medium text-[color:var(--text-primary)] underline decoration-[color:var(--border-hover)] decoration-[1.5px] underline-offset-4 transition-colors hover:text-[color:var(--accent-warm)]"
              >
                {footerText}
              </a>
            </motion.div>
          )}
        </motion.div>

        <motion.div
          variants={staggerContainer(0.05)}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          className="divide-y divide-[color:var(--border-default)] rounded-2xl border border-[color:var(--border-default)] bg-gradient-to-b from-[color:var(--panel-grad-top)] to-[color:var(--panel-grad-bottom)]"
        >
          {items.map((item, i) => {
            const open = openIdx === i;
            return (
              <motion.div key={item.q} variants={fadeInUp}>
                <button
                  type="button"
                  onClick={() => setOpenIdx(open ? null : i)}
                  className="flex w-full items-start justify-between gap-5 px-6 py-5 text-left transition-colors hover:bg-[color:var(--bg-hover)]/40"
                  aria-expanded={open}
                >
                  <span className="text-[15px] font-medium leading-snug text-[color:var(--text-primary)]">
                    {item.q}
                  </span>
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center text-[color:var(--text-secondary)]">
                    {open ? (
                      <Minus className="h-4 w-4" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                  </span>
                </button>
                <AnimatePresence initial={false}>
                  {open && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{
                        duration: 0.3,
                        ease: [0.16, 1, 0.3, 1],
                      }}
                      className="overflow-hidden"
                    >
                      <div className="px-6 pb-5 text-sm leading-relaxed text-[color:var(--text-secondary)]">
                        {item.a}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
