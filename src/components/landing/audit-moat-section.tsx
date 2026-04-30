"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ScrollText,
  ShieldCheck,
  FileSignature,
  ArrowRight,
} from "lucide-react";
import { fadeInUp, staggerContainer } from "@/lib/animations";

interface AuditTemplate {
  slug: string;
  title: string;
  desc: string;
  regulator?: string;
}

interface AuditMoatSectionProps {
  overline: string;
  heading: string;
  subtitle: string;
  templates: AuditTemplate[];
  ctaText: string;
  ctaHref: string;
  pillars: { title: string; desc: string; iconName: "ScrollText" | "ShieldCheck" | "FileSignature" }[];
}

const iconMap = { ScrollText, ShieldCheck, FileSignature } as const;

export function AuditMoatSection({
  overline,
  heading,
  subtitle,
  templates,
  ctaText,
  ctaHref,
  pillars,
}: AuditMoatSectionProps) {
  return (
    <section className="relative overflow-hidden px-4 py-28 sm:py-36">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 50% at 50% 30%, rgba(var(--accent-warm-rgb),0.04), transparent 70%)",
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
          className="grid gap-px overflow-hidden rounded-2xl border border-[color:var(--border-default)] bg-[color:var(--border-default)] sm:grid-cols-3"
        >
          {pillars.map((pillar) => {
            const Icon = iconMap[pillar.iconName];
            return (
              <motion.div
                key={pillar.title}
                variants={fadeInUp}
                className="group relative bg-[color:var(--bg-primary)] p-7"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[color:var(--bg-secondary)] ring-1 ring-[color:var(--border-default)]">
                  <Icon className="h-4.5 w-4.5 text-[color:var(--accent-warm)]" />
                </div>
                <h3 className="mt-5 text-[15px] font-semibold text-[color:var(--text-primary)]">
                  {pillar.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[color:var(--text-secondary)]">
                  {pillar.desc}
                </p>
              </motion.div>
            );
          })}
        </motion.div>

        <motion.div
          variants={staggerContainer(0.04)}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
          className="mt-10 grid gap-3 sm:grid-cols-2"
        >
          {templates.map((tpl) => (
            <motion.div
              key={tpl.slug}
              variants={fadeInUp}
              className="rounded-xl border border-[color:var(--border-default)] bg-[color:var(--bg-primary)] p-5 transition-colors hover:border-[color:var(--border-hover)]"
            >
              <div className="flex items-baseline justify-between gap-3">
                <h4 className="text-sm font-semibold text-[color:var(--text-primary)]">
                  {tpl.title}
                </h4>
                {tpl.regulator && (
                  <span className="shrink-0 rounded-full border border-[color:var(--border-default)] bg-[color:var(--bg-secondary)] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-[color:var(--text-tertiary)]">
                    {tpl.regulator}
                  </span>
                )}
              </div>
              <p className="mt-2 text-sm leading-relaxed text-[color:var(--text-secondary)]">
                {tpl.desc}
              </p>
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mt-12 flex justify-center"
        >
          <Link
            href={ctaHref}
            className="group inline-flex items-center gap-2 rounded-full bg-[color:var(--text-primary)] px-6 py-3 text-sm font-medium text-[color:var(--bg-primary)] transition-transform hover:-translate-y-0.5"
          >
            {ctaText}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
