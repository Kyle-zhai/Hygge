"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, X } from "lucide-react";
import { cardReveal, staggerContainer, fadeInUp, EASE_OUT_EXPO } from "@/lib/animations";

interface PersonaPreview {
  name: string;
  category: string;
  tagline: string;
  avatar: string;
  mbti?: string;
  description?: string;
}

interface PersonaShowcaseProps {
  heading: string;
  viewAllText: string;
  viewAllHref: string;
  personas: PersonaPreview[];
  categories: { key: string; label: string }[];
  allLabel: string;
}

const categoryColors: Record<string, string> = {
  technical: "#60A5FA",
  developer: "#60A5FA",
  design: "#C084FC",
  designer: "#C084FC",
  marketer: "#F97316",
  product: "#34D399",
  data: "#22D3EE",
  writer: "#FB923C",
  end_user: "#FACC15",
  business: "#FB7185",
  entrepreneur: "#FACC15",
  support: "#FB7185",
};

function getCategoryColor(category: string): string {
  return categoryColors[category] || "#9B9594";
}

export function PersonaShowcase({
  heading,
  viewAllText,
  viewAllHref,
  personas,
  categories,
  allLabel,
}: PersonaShowcaseProps) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [selected, setSelected] = useState<PersonaPreview | null>(null);

  const filtered = activeCategory
    ? personas.filter((p) => p.category === activeCategory)
    : personas;

  return (
    <section className="relative px-4 py-32 overflow-hidden">
      {/* Subtle glow */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 0%, rgba(226,221,213,0.04), transparent 50%)",
        }}
      />

      <div className="relative z-10 mx-auto max-w-6xl">
        <motion.div
          variants={staggerContainer(0.06)}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="space-y-10"
        >
          {/* Section heading */}
          <motion.h2
            variants={fadeInUp}
            className="text-center text-3xl font-semibold tracking-[-0.02em] text-[#EAEAE8] sm:text-4xl"
          >
            {heading}
          </motion.h2>

          {/* Category filter pills */}
          <motion.div
            variants={fadeInUp}
            className="flex flex-wrap justify-center gap-2"
          >
            <button
              onClick={() => setActiveCategory(null)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all duration-300 ${
                activeCategory === null
                  ? "bg-[#E2DDD5] text-[#0C0C0C]"
                  : "bg-[#1C1C1C] text-[#9B9594] hover:bg-[#222222] hover:text-[#EAEAE8]"
              }`}
              style={{ transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)" }}
            >
              {allLabel}
            </button>
            {categories.map((cat) => (
              <button
                key={cat.key}
                onClick={() =>
                  setActiveCategory(activeCategory === cat.key ? null : cat.key)
                }
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all duration-300 ${
                  activeCategory === cat.key
                    ? "bg-[#E2DDD5] text-[#0C0C0C]"
                    : "bg-[#1C1C1C] text-[#9B9594] hover:bg-[#222222] hover:text-[#EAEAE8]"
                }`}
                style={{ transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)" }}
              >
                {cat.label}
              </button>
            ))}
          </motion.div>

          {/* Persona card grid */}
          <motion.div
            variants={staggerContainer(0.06)}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:gap-5"
          >
            {filtered.slice(0, 16).map((persona, i) => {
              const catColor = getCategoryColor(persona.category);
              return (
                <motion.div
                  key={persona.name + persona.category}
                  variants={cardReveal(i)}
                  onClick={() => setSelected(persona)}
                  className="group cursor-pointer rounded-2xl border border-[#2A2A2A] bg-[#141414] p-4 transition-all duration-300 hover:border-[#3A3A3A] hover:-translate-y-1"
                  style={{ transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)" }}
                >
                  {/* Avatar — contain full image, no cropping */}
                  <div className="mb-3 aspect-square w-full overflow-hidden rounded-xl bg-[#1C1C1C]">
                    <Image
                      src={persona.avatar}
                      alt={persona.name}
                      width={512}
                      height={512}
                      className="h-full w-full object-contain"
                    />
                  </div>
                  {/* Name */}
                  <p className="text-sm font-semibold text-[#EAEAE8] truncate">
                    {persona.name}
                  </p>
                  {/* Tagline */}
                  <p className="mt-0.5 text-xs text-[#666462] truncate">
                    {persona.tagline}
                  </p>
                  {/* Category badge */}
                  <span
                    className="mt-2.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium"
                    style={{
                      backgroundColor: `${catColor}20`,
                      color: catColor,
                    }}
                  >
                    {persona.category}
                  </span>
                </motion.div>
              );
            })}
          </motion.div>

          {/* View all link */}
          <motion.div variants={fadeInUp} className="flex justify-center">
            <Link
              href={viewAllHref}
              className="group inline-flex items-center gap-1.5 text-sm font-medium text-[#9B9594] transition-colors hover:text-[#E2DDD5]"
            >
              {viewAllText}
              <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
          </motion.div>
        </motion.div>
      </div>

      {/* Detail Modal */}
      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={() => setSelected(null)}
          >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

            {/* Modal card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-[#2A2A2A] bg-[#141414] shadow-2xl"
            >
              {/* Close button */}
              <button
                onClick={() => setSelected(null)}
                className="absolute right-4 top-4 z-10 rounded-full bg-[#0C0C0C]/60 p-1.5 text-[#9B9594] backdrop-blur-sm transition-colors hover:text-[#EAEAE8]"
              >
                <X className="h-4 w-4" />
              </button>

              {/* Category color bar */}
              <div
                className="h-1"
                style={{ backgroundColor: getCategoryColor(selected.category) }}
              />

              {/* Full image */}
              <div className="relative aspect-square w-full bg-[#0C0C0C]">
                <Image
                  src={selected.avatar}
                  alt={selected.name}
                  width={512}
                  height={512}
                  className="h-full w-full object-contain"
                />
              </div>

              {/* Info */}
              <div className="p-6">
                <div className="flex items-center gap-3">
                  <h3 className="text-xl font-bold text-[#EAEAE8]">
                    {selected.name}
                  </h3>
                  {selected.mbti && (
                    <span
                      className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
                      style={{
                        backgroundColor: `${getCategoryColor(selected.category)}20`,
                        color: getCategoryColor(selected.category),
                      }}
                    >
                      {selected.mbti}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm font-medium text-[#9B9594]">
                  {selected.tagline}
                </p>
                {selected.description && (
                  <p className="mt-4 text-sm leading-relaxed text-[#9B9594]">
                    {selected.description}
                  </p>
                )}
                <div className="mt-4 flex items-center gap-2">
                  <span
                    className="rounded-full px-3 py-1 text-xs font-medium"
                    style={{
                      backgroundColor: `${getCategoryColor(selected.category)}20`,
                      color: getCategoryColor(selected.category),
                    }}
                  >
                    {selected.category}
                  </span>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
