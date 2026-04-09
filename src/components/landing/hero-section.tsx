"use client";

import Link from "next/link";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { wordReveal, EASE_OUT_EXPO } from "@/lib/animations";

interface HeroSectionProps {
  overline: string;
  headline: string;
  subtitle: string;
  ctaText: string;
  ctaHref: string;
}

export function HeroSection({
  overline,
  headline,
  subtitle,
  ctaText,
  ctaHref,
}: HeroSectionProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"],
  });

  const opacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);
  const y = useTransform(scrollYProgress, [0, 0.8], [0, -80]);

  const words = headline.split(" ");

  return (
    <section
      ref={sectionRef}
      className="relative flex min-h-screen flex-col items-center justify-center gap-8 px-4 text-center overflow-hidden"
    >
      {/* Radial glow background */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 30%, rgba(226,221,213,0.06), transparent 60%)",
        }}
      />

      <motion.div
        style={{ opacity, y }}
        className="relative z-10 flex flex-col items-center gap-8"
      >
        {/* Overline */}
        <motion.span
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: EASE_OUT_EXPO }}
          className="text-xs font-medium uppercase tracking-[0.08em] text-[#9B9594]"
        >
          {overline}
        </motion.span>

        {/* Word-by-word headline reveal */}
        <h1 className="max-w-4xl text-[clamp(2.5rem,6vw,4rem)] font-bold leading-[1.05] tracking-[-0.02em] text-[#EAEAE8]">
          <span className="flex flex-wrap justify-center gap-x-[0.3em]">
            {words.map((word, i) => (
              <motion.span
                key={i}
                variants={wordReveal(i)}
                initial="hidden"
                animate="visible"
                className="inline-block"
              >
                {word}
              </motion.span>
            ))}
          </span>
        </h1>

        {/* Subtitle with delay */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            delay: words.length * 0.06 + 0.2,
            duration: 0.7,
            ease: EASE_OUT_EXPO,
          }}
          className="max-w-xl text-lg leading-relaxed text-[#9B9594]"
        >
          {subtitle}
        </motion.p>

        {/* CTA Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            delay: words.length * 0.06 + 0.4,
            duration: 0.7,
            ease: EASE_OUT_EXPO,
          }}
        >
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
