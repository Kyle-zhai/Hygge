"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fadeInUp, staggerContainer } from "@/lib/animations";


interface CtaSectionProps {
  headline: string;
  subtitle: string;
  ctaText: string;
  ctaHref: string;
}

export function CtaSection({
  headline,
  subtitle,
  ctaText,
  ctaHref,
}: CtaSectionProps) {
  return (
    <section className="relative px-4 py-32 overflow-hidden">
      {/* Multi-layer atmospheric gradient */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 55% at 50% 50%, rgba(var(--atmosphere-cream-rgb),0.1), transparent 65%)",
        }}
      />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        animate={{ opacity: [0.5, 0.85, 0.5] }}
        transition={{ duration: 11, repeat: Infinity, ease: "easeInOut" }}
        style={{
          background:
            "radial-gradient(ellipse 40% 30% at 25% 60%, rgba(var(--atmosphere-warm-rgb),0.07), transparent 70%), radial-gradient(ellipse 40% 30% at 75% 60%, rgba(var(--atmosphere-cool-rgb),0.05), transparent 70%)",
        }}
      />
      {/* Hairline separators */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(var(--atmosphere-cream-rgb),0.12) 50%, transparent)",
        }}
      />

      <motion.div
        variants={staggerContainer(0.1)}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-100px" }}
        className="relative z-10 mx-auto max-w-2xl text-center"
      >
        <motion.h2
          variants={fadeInUp}
          className="mb-5 text-3xl font-semibold text-[color:var(--text-primary)] sm:text-4xl tracking-[-0.02em]"
        >
          {headline}
        </motion.h2>
        <motion.p
          variants={fadeInUp}
          className="mb-8 text-base leading-relaxed text-[color:var(--text-secondary)]"
        >
          {subtitle}
        </motion.p>
        <motion.div variants={fadeInUp}>
          <Button
            size="lg"
            asChild
            className="btn-glow relative bg-[color:var(--accent-primary)] hover:bg-[color:var(--accent-primary-hover)] text-[color:var(--accent-ink)] rounded-xl px-8 h-12 text-base font-semibold transition-all duration-500 shadow-[0_20px_60px_-15px_rgba(var(--atmosphere-cream-rgb),0.4),0_0_0_1px_rgba(255,255,255,0.12)_inset] hover:shadow-[0_30px_80px_-15px_rgba(var(--atmosphere-cream-rgb),0.55),0_0_0_1px_rgba(255,255,255,0.22)_inset] hover:-translate-y-0.5"
          >
            <Link href={ctaHref}>
              {ctaText}
              <ArrowRight className="ml-2 h-4 w-4 transition-transform duration-500 group-hover:translate-x-1" />
            </Link>
          </Button>
        </motion.div>
      </motion.div>
    </section>
  );
}
