"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, X } from "lucide-react";
import { fadeInUp } from "@/lib/animations";

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
  hint?: string;
}

const AUTOPLAY_STEP_DEG = 12;
const AUTOPLAY_INTERVAL_MS = 3000;
const DRAG_FACTOR = 0.25;
const MOMENTUM = 0.1;
const CLICK_THRESHOLD_PX = 6;
const RADIUS_DESKTOP = 520;
const RADIUS_MOBILE = 340;
const CARD_W_DESKTOP = 210;
const CARD_H_DESKTOP = 280;
const CARD_W_MOBILE = 160;
const CARD_H_MOBILE = 210;

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
  return categoryColors[category] || "var(--text-secondary)";
}

export function PersonaShowcase({
  heading,
  viewAllText,
  viewAllHref,
  personas,
  hint,
}: PersonaShowcaseProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  const [selected, setSelected] = useState<PersonaPreview | null>(null);
  const [radius, setRadius] = useState(RADIUS_DESKTOP);
  const [cardSize, setCardSize] = useState({ w: CARD_W_DESKTOP, h: CARD_H_DESKTOP });

  const stateRef = useRef({
    rotateY: 0,
    isDragging: false,
    isHovered: false,
    isVisible: false,
    userEngaged: false,
    startX: 0,
    startRot: 0,
    dragDist: 0,
    autoTimer: null as ReturnType<typeof setInterval> | null,
    reduceMotion: false,
  });

  const stepDeg = 360 / Math.max(personas.length, 1);

  const apply = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    track.style.setProperty("--roll", `${stateRef.current.rotateY}deg`);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    stateRef.current.reduceMotion = mq.matches;
    const onChange = (e: MediaQueryListEvent) => {
      stateRef.current.reduceMotion = e.matches;
    };
    mq.addEventListener("change", onChange);

    const mqMobile = window.matchMedia("(max-width: 640px)");
    const applyResponsive = () => {
      if (mqMobile.matches) {
        setRadius(RADIUS_MOBILE);
        setCardSize({ w: CARD_W_MOBILE, h: CARD_H_MOBILE });
      } else {
        setRadius(RADIUS_DESKTOP);
        setCardSize({ w: CARD_W_DESKTOP, h: CARD_H_DESKTOP });
      }
    };
    applyResponsive();
    mqMobile.addEventListener("change", applyResponsive);

    return () => {
      mq.removeEventListener("change", onChange);
      mqMobile.removeEventListener("change", applyResponsive);
    };
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    const track = trackRef.current;
    const root = rootRef.current;
    if (!viewport || !track || !root) return;

    const state = stateRef.current;

    const stopAuto = () => {
      if (state.autoTimer) {
        clearInterval(state.autoTimer);
        state.autoTimer = null;
      }
    };
    const startAuto = () => {
      if (state.reduceMotion || state.userEngaged) return;
      stopAuto();
      state.autoTimer = setInterval(() => {
        if (state.isDragging || state.isHovered || !state.isVisible || state.userEngaged) return;
        state.rotateY -= AUTOPLAY_STEP_DEG;
        apply();
      }, AUTOPLAY_INTERVAL_MS);
    };
    const disableAuto = () => {
      state.userEngaged = true;
      stopAuto();
    };

    const onDown = (clientX: number) => {
      state.isDragging = true;
      state.startX = clientX;
      state.startRot = state.rotateY;
      state.dragDist = 0;
      track.classList.add("is-dragging");
      disableAuto();
    };
    const onMove = (clientX: number) => {
      if (!state.isDragging) return;
      const delta = clientX - state.startX;
      state.dragDist = Math.max(state.dragDist, Math.abs(delta));
      state.rotateY = state.startRot + delta * DRAG_FACTOR;
      apply();
    };
    const onUp = (clientX: number) => {
      if (!state.isDragging) return;
      state.isDragging = false;
      track.classList.remove("is-dragging");
      const momentum = (clientX - state.startX) * MOMENTUM;
      state.rotateY += momentum;
      apply();
    };

    const mouseDown = (e: MouseEvent) => {
      onDown(e.clientX);
      e.preventDefault();
    };
    const mouseMove = (e: MouseEvent) => onMove(e.clientX);
    const mouseUp = (e: MouseEvent) => onUp(e.clientX);
    const touchStart = (e: TouchEvent) => onDown(e.touches[0].clientX);
    const touchMove = (e: TouchEvent) => onMove(e.touches[0].clientX);
    const touchEnd = (e: TouchEvent) => {
      const t = e.changedTouches[0];
      onUp(t?.clientX ?? state.startX);
    };
    const mouseEnter = () => {
      state.isHovered = true;
      stopAuto();
    };
    const mouseLeave = () => {
      state.isHovered = false;
    };
    const wheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        e.preventDefault();
        state.rotateY -= e.deltaX * 0.5;
        apply();
        disableAuto();
      }
    };

    viewport.addEventListener("mousedown", mouseDown);
    window.addEventListener("mousemove", mouseMove);
    window.addEventListener("mouseup", mouseUp);
    viewport.addEventListener("touchstart", touchStart, { passive: true });
    viewport.addEventListener("touchmove", touchMove, { passive: true });
    viewport.addEventListener("touchend", touchEnd);
    viewport.addEventListener("mouseenter", mouseEnter);
    viewport.addEventListener("mouseleave", mouseLeave);
    viewport.addEventListener("wheel", wheel, { passive: false });

    const io = new IntersectionObserver(
      ([entry]) => {
        state.isVisible = entry.isIntersecting;
        if (entry.isIntersecting) startAuto();
        else stopAuto();
      },
      { threshold: 0.2 },
    );
    io.observe(root);

    return () => {
      viewport.removeEventListener("mousedown", mouseDown);
      window.removeEventListener("mousemove", mouseMove);
      window.removeEventListener("mouseup", mouseUp);
      viewport.removeEventListener("touchstart", touchStart);
      viewport.removeEventListener("touchmove", touchMove);
      viewport.removeEventListener("touchend", touchEnd);
      viewport.removeEventListener("mouseenter", mouseEnter);
      viewport.removeEventListener("mouseleave", mouseLeave);
      viewport.removeEventListener("wheel", wheel);
      io.disconnect();
      stopAuto();
    };
  }, [apply]);

  const handleCardClick = (p: PersonaPreview) => {
    if (stateRef.current.dragDist > CLICK_THRESHOLD_PX) return;
    setSelected(p);
  };

  return (
    <section
      ref={rootRef}
      className="relative overflow-hidden px-4 py-24 sm:py-32"
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 0%, rgba(var(--atmosphere-cream-rgb),0.04), transparent 50%)",
        }}
      />

      <div className="relative z-10 mx-auto max-w-6xl">
        <motion.div
          variants={fadeInUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="mb-12 text-center"
        >
          <h2 className="text-3xl font-semibold tracking-[-0.02em] text-[color:var(--text-primary)] sm:text-4xl">
            {heading}
          </h2>
          {hint && (
            <p className="mt-3 text-xs font-medium uppercase tracking-[0.18em] text-[color:var(--accent-warm)]">
              {hint}
            </p>
          )}
        </motion.div>
      </div>

      <div
        className="relative mx-auto h-[420px] w-full select-none sm:h-[560px]"
        style={{ touchAction: "pan-y" }}
      >
        <div
          className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24"
          style={{
            background:
              "linear-gradient(90deg, var(--bg-primary), transparent)",
          }}
        />
        <div
          className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24"
          style={{
            background:
              "linear-gradient(-90deg, var(--bg-primary), transparent)",
          }}
        />

        <div
          ref={viewportRef}
          className="absolute inset-0 flex cursor-grab items-center justify-center active:cursor-grabbing"
          style={{ perspective: "1400px" }}
        >
          <div
            ref={trackRef}
            className="persona-carousel-track relative"
            style={{
              width: "1600px",
              height: "340px",
              transformStyle: "preserve-3d",
              transform: "rotateY(var(--roll, 0deg))",
              transition: "transform 0.8s cubic-bezier(0.16, 1, 0.3, 1)",
              willChange: "transform",
            }}
          >
            {personas.map((p, i) => {
              const catColor = getCategoryColor(p.category);
              const angle = i * stepDeg;
              return (
                <div
                  key={p.name}
                  className="absolute"
                  style={{
                    left: "50%",
                    top: "50%",
                    width: `${cardSize.w}px`,
                    height: `${cardSize.h}px`,
                    transform: `translate(-50%, -50%) rotateY(${angle}deg) translateZ(${radius}px)`,
                    backfaceVisibility: "hidden",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => handleCardClick(p)}
                    className="group relative block h-full w-full overflow-hidden rounded-2xl border border-[color:var(--border-default)] bg-gradient-to-b from-[color:var(--panel-grad-top)] to-[color:var(--panel-grad-bottom)] p-4 text-left transition-transform duration-300 hover:scale-[1.03] hover:border-[color:var(--border-hover)]"
                  >
                    <div
                      className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                      style={{
                        background: `radial-gradient(circle at 50% 0%, ${catColor}22, transparent 60%)`,
                      }}
                    />
                    <div className="relative mb-3 aspect-square w-full overflow-hidden rounded-xl bg-[color:var(--bg-tertiary)]">
                      <Image
                        src={p.avatar}
                        alt={p.name}
                        width={400}
                        height={400}
                        className="h-full w-full object-contain"
                        draggable={false}
                      />
                    </div>
                    <p className="relative truncate text-sm font-semibold text-[color:var(--text-primary)]">
                      {p.name}
                    </p>
                    <p className="relative mt-0.5 truncate text-xs text-[color:var(--text-tertiary)]">
                      {p.tagline}
                    </p>
                    <span
                      className="relative mt-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium"
                      style={{
                        backgroundColor: `${catColor}20`,
                        color: catColor,
                      }}
                    >
                      {p.category}
                    </span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="relative z-10 mx-auto mt-10 flex max-w-6xl justify-center">
        <Link
          href={viewAllHref}
          className="group inline-flex items-center gap-1.5 text-sm font-medium text-[color:var(--text-secondary)] transition-colors hover:text-[color:var(--accent-primary)]"
        >
          {viewAllText}
          <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1" />
        </Link>
      </div>

      <style jsx>{`
        .persona-carousel-track.is-dragging {
          transition: none !important;
        }
      `}</style>

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
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-[color:var(--border-default)] bg-[color:var(--bg-secondary)] shadow-2xl"
            >
              <button
                onClick={() => setSelected(null)}
                className="absolute right-4 top-4 z-10 rounded-full bg-[color:var(--bg-primary)]/60 p-1.5 text-[color:var(--text-secondary)] backdrop-blur-sm transition-colors hover:text-[color:var(--text-primary)]"
              >
                <X className="h-4 w-4" />
              </button>
              <div
                className="h-1"
                style={{ backgroundColor: getCategoryColor(selected.category) }}
              />
              <div className="relative aspect-square w-full bg-[color:var(--bg-primary)]">
                <Image
                  src={selected.avatar}
                  alt={selected.name}
                  width={512}
                  height={512}
                  className="h-full w-full object-contain"
                />
              </div>
              <div className="p-6">
                <div className="flex items-center gap-3">
                  <h3 className="text-xl font-bold text-[color:var(--text-primary)]">
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
                <p className="mt-1 text-sm font-medium text-[color:var(--text-secondary)]">
                  {selected.tagline}
                </p>
                {selected.description && (
                  <p className="mt-4 text-sm leading-relaxed text-[color:var(--text-secondary)]">
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
