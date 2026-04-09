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
      {/* Atmospheric radial gradient */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 50%, rgba(226,221,213,0.08), transparent 60%)",
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
          className="mb-5 text-3xl font-semibold text-[#EAEAE8] sm:text-4xl tracking-[-0.02em]"
        >
          {headline}
        </motion.h2>
        <motion.p
          variants={fadeInUp}
          className="mb-8 text-base leading-relaxed text-[#9B9594]"
        >
          {subtitle}
        </motion.p>
        <motion.div variants={fadeInUp}>
          <Button
            size="lg"
            asChild
            className="btn-glow bg-[#E2DDD5] hover:bg-[#D4CFC7] text-[#0C0C0C] rounded-xl px-8 h-12 text-base font-semibold transition-all duration-300"
          >
            <Link href={ctaHref}>
              {ctaText}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </motion.div>
      </motion.div>
    </section>
  );
}
