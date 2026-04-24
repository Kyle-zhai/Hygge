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
      {/* Layered atmosphere: aurora + ambient gold rim + grain */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 55% at 50% 28%, rgba(var(--atmosphere-cream-rgb),0.09), transparent 62%)",
        }}
      />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        animate={{ opacity: [0.35, 0.6, 0.35] }}
        transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
        style={{
          background:
            "radial-gradient(ellipse 55% 35% at 30% 70%, rgba(var(--atmosphere-warm-rgb),0.08), transparent 70%), radial-gradient(ellipse 45% 30% at 75% 65%, rgba(var(--atmosphere-cool-rgb),0.06), transparent 70%)",
        }}
      />
      {/* Top hairline highlight */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(var(--atmosphere-cream-rgb),0.25) 50%, transparent)",
        }}
      />
      {/* Grain overlay */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.035] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
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
          className="text-xs font-medium uppercase tracking-[0.08em] text-[color:var(--text-secondary)]"
        >
          {overline}
        </motion.span>

        {/* Word-by-word headline reveal */}
        <h1 className="max-w-4xl text-[clamp(2.5rem,6vw,4rem)] font-bold leading-[1.05] tracking-[-0.02em] text-[color:var(--text-primary)]">
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
          className="max-w-xl text-lg leading-relaxed text-[color:var(--text-secondary)]"
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
            className="btn-glow relative bg-[color:var(--accent-primary)] hover:bg-[color:var(--accent-primary-hover)] text-[color:var(--accent-ink)] rounded-xl px-8 h-12 text-base font-semibold transition-all duration-500 shadow-[0_20px_60px_-15px_rgba(var(--atmosphere-cream-rgb),0.35),0_0_0_1px_rgba(255,255,255,0.1)_inset] hover:shadow-[0_25px_70px_-15px_rgba(var(--atmosphere-cream-rgb),0.5),0_0_0_1px_rgba(255,255,255,0.2)_inset] hover:-translate-y-0.5"
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
