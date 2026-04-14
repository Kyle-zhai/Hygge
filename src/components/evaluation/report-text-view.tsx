"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useTranslations } from "next-intl";
import { motion, AnimatePresence, useInView } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import {
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  AlertTriangle,
  Target,
  TrendingUp,
  Lightbulb,
  Shield,
  Zap,
  ArrowRight,
  ChevronRight,
  List,
  Circle,
  BarChart3,
  MessageSquare,
  Users,
  BookOpen,
} from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

interface PersonaData {
  id: string;
  identity: any;
  demographics: any;
  category: string;
}

interface ReviewData {
  id: string;
  persona_id: string;
  scores: Record<string, number | string>;
  review_text: string;
  strengths: string[];
  weaknesses: string[];
  overall_stance?: string | null;
}

interface ReportData {
  overall_score: number;
  market_readiness: string;
  persona_analysis: {
    entries?: Array<{
      persona_id: string;
      persona_name?: string;
      core_viewpoint: string;
      scoring_rationale: string;
    }>;
    consensus: Array<{ point: string; supporting_personas?: string[] }>;
    disagreements: Array<{
      point: string;
      reason: string;
      sides?: Array<{ persona_ids?: string[]; position: string }>;
    }>;
  };
  multi_dimensional_analysis: Array<{
    dimension: string;
    label_en?: string;
    label_zh?: string;
    score?: number;
    analysis: string;
    strengths?: string[];
    weaknesses?: string[];
    overall_leaning?: string;
    positive_count?: number;
    negative_count?: number;
    neutral_count?: number;
    support_count?: number;
    oppose_count?: number;
    key_arguments?: { positive?: string; negative?: string; for?: string; against?: string };
  }>;
  readiness_label_en?: string;
  readiness_label_zh?: string;
  goal_assessment: Array<{
    goal: string;
    achievable: boolean;
    current_status: string;
    gaps?: string[];
  }>;
  if_not_feasible: {
    direction: string;
    modifications?: string[];
    priorities?: string[];
    reference_cases?: string[];
  };
  if_feasible: {
    next_steps?: string[];
    optimizations?: string[];
    risks?: string[];
  };
  action_items: Array<{
    description: string;
    priority: string;
    expected_impact: string;
    difficulty: string;
  }>;
  scenario_simulation?: {
    summary: string;
    adoption_rate_shift: number;
    initial_adoption?: Array<{ persona_id: string; stance: string }>;
    final_adoption?: Array<{ persona_id: string; stance: string }>;
    influence_events?: Array<{
      influencer_id: string;
      influenced_id: string;
      shift: string;
      reason: string;
    }>;
  };
  round_table_debate?: {
    selected_persona_ids: string[];
    topic_focus: string;
    rounds: Array<{
      round: number;
      theme: string;
      messages: Array<{
        persona_id: string;
        content: string;
        responding_to?: string;
        stance_shift?: string;
      }>;
    }>;
    outcome: {
      consensus_reached: boolean;
      key_insights: string[];
      remaining_disagreements: string[];
    };
  } | null;
  opinion_drift?: Array<{
    persona_id: string;
    initial_leaning: string;
    final_leaning: string;
    shift_magnitude: "none" | "small" | "large";
    reasoning: string;
  }> | null;
  // Topic mode fields
  consensus_score?: number | null;
  synthesis?: string | null;
  debate_highlights?: DebateHighlight[] | null;
  positions?: {
    question: string;
    positive_label: string;
    positive_summary: string;
    negative_label: string;
    negative_summary: string;
  } | null;
  references?: Array<{
    title: string;
    detail: string;
    source?: string;
    persona_name?: string;
  }> | null;
}

interface TopicClassification {
  topic_type: string;
  dimensions: Array<{ key: string; label_en: string; label_zh: string; description: string }>;
  readiness_label_en: string;
  readiness_label_zh: string;
}

interface DebateHighlight {
  topic: string;
  perspectives: { persona_name: string; stance: string }[];
  significance: string;
}

interface ReportTextViewProps {
  report: ReportData | null;
  reviews: ReviewData[];
  personas: PersonaData[];
  locale: string;
  onViewScores?: () => void;
  onViewSimulation?: () => void;
  onViewDebate?: () => void;
  onStartDebate?: (personaId: string) => void;
  evaluationId?: string;
  topicClassification?: TopicClassification | null;
  mode?: "topic" | "product";
}

// ═══════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════

function safeArray<T>(val: unknown): T[] {
  return Array.isArray(val) ? val : [];
}

function reconstructFromStrings(arr: any[], requiredKey: string): any[] {
  if (!arr.length || typeof arr[0] !== "string") return arr.filter((e: any) => typeof e === "object" && e !== null);
  const objects: any[] = [];
  let current: any = null;
  for (const s of arr) {
    if (typeof s !== "string") continue;
    const colonIdx = s.indexOf(": ");
    if (colonIdx === -1) continue;
    const key = s.slice(0, colonIdx).trim();
    const value = s.slice(colonIdx + 2).trim();
    if (key === requiredKey) {
      if (current) objects.push(current);
      current = { [key]: value };
    } else if (current) {
      current[key] = value;
    }
  }
  if (current) objects.push(current);
  return objects;
}

function scoreColor(score: number) {
  if (score >= 7)
    return {
      text: "text-[#4ADE80]",
      bg: "bg-[#4ADE80]",
      border: "border-[#4ADE80]",
      hex: "#4ADE80",
    };
  if (score >= 5)
    return {
      text: "text-[#FBBF24]",
      bg: "bg-[#FBBF24]",
      border: "border-[#FBBF24]",
      hex: "#FBBF24",
    };
  return {
    text: "text-[#F87171]",
    bg: "bg-[#F87171]",
    border: "border-[#F87171]",
    hex: "#F87171",
  };
}

function readinessColor(readiness: string) {
  switch (readiness) {
    case "high":
      return {
        text: "text-[#4ADE80]",
        bg: "bg-[#4ADE80]/10",
        border: "border-[#4ADE80]/30",
      };
    case "medium":
      return {
        text: "text-[#FBBF24]",
        bg: "bg-[#FBBF24]/10",
        border: "border-[#FBBF24]/30",
      };
    default:
      return {
        text: "text-[#F87171]",
        bg: "bg-[#F87171]/10",
        border: "border-[#F87171]/30",
      };
  }
}

function priorityStyle(priority: string) {
  switch (priority?.toLowerCase()) {
    case "critical":
      return {
        dot: "bg-[#F87171]",
        badge: "border-[#F87171]/30 bg-[#F87171]/10 text-[#F87171]",
      };
    case "high":
      return {
        dot: "bg-[#FBBF24]",
        badge: "border-[#FBBF24]/30 bg-[#FBBF24]/10 text-[#FBBF24]",
      };
    case "medium":
      return {
        dot: "bg-[#C4A882]",
        badge: "border-[#C4A882]/30 bg-[#C4A882]/10 text-[#C4A882]",
      };
    default:
      return {
        dot: "bg-[#666462]",
        badge: "border-[#666462]/30 bg-[#666462]/10 text-[#666462]",
      };
  }
}

function difficultyBadge(difficulty: string) {
  switch (difficulty?.toLowerCase()) {
    case "hard":
      return "border-[#F87171]/30 bg-[#F87171]/10 text-[#F87171]";
    case "medium":
      return "border-[#FBBF24]/30 bg-[#FBBF24]/10 text-[#FBBF24]";
    default:
      return "border-[#4ADE80]/30 bg-[#4ADE80]/10 text-[#4ADE80]";
  }
}

function scoreGradientCSS(score: number): string {
  if (score >= 8) return "linear-gradient(90deg, #4ADE80, #34D399)";
  if (score >= 6) return "linear-gradient(90deg, #FBBF24, #F59E0B)";
  if (score >= 4) return "linear-gradient(90deg, #FBBF24, #F97316)";
  return "linear-gradient(90deg, #F87171, #EF4444)";
}

// ═══════════════════════════════════════════════════════════════════════════
// Sub-components
// ═══════════════════════════════════════════════════════════════════════════

/* ── Animated Section Wrapper ────────────────────────────────────────── */

function AnimatedSection({
  id,
  children,
  className = "",
  delay = 0,
}: {
  id: string;
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <motion.section
      id={id}
      ref={ref}
      initial={{ opacity: 0, y: 24 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }}
      transition={{ duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.section>
  );
}

/* ── Score Arc (SVG ring) ────────────────────────────────────────────── */

function ScoreArc({ score, size = 112 }: { score: number; size?: number }) {
  const radius = (size - 14) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min((score ?? 0) / 10, 1);
  const strokeDashoffset = circumference * (1 - progress);
  const colors = scoreColor(score ?? 0);

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#1C1C1C"
          strokeWidth={5}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={colors.hex}
          strokeWidth={5}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          className={`text-2xl font-bold tabular-nums ${colors.text}`}
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.8 }}
        >
          {score != null ? score.toFixed(1) : "--"}
        </motion.span>
        <span className="text-[10px] text-[#666462] -mt-0.5">/10</span>
      </div>
    </div>
  );
}

/* ── Consensus Arc (topic mode: 0-100%) ────────────────────────────── */

function ConsensusArc({ score, size = 112 }: { score: number; size?: number }) {
  const radius = (size - 14) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min((score ?? 0) / 100, 1);
  const strokeDashoffset = circumference * (1 - progress);
  const hex = score >= 70 ? "#4ADE80" : score >= 40 ? "#FBBF24" : "#F87171";
  const textColor = score >= 70 ? "text-[#4ADE80]" : score >= 40 ? "text-[#FBBF24]" : "text-[#F87171]";

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#1C1C1C"
          strokeWidth={5}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={hex}
          strokeWidth={5}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          className={`text-2xl font-bold tabular-nums ${textColor}`}
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.8 }}
        >
          {score != null ? `${score}%` : "--"}
        </motion.span>
      </div>
    </div>
  );
}

/* ── Persona Avatar Pill ─────────────────────────────────────────────── */

function PersonaPill({
  personaId,
  personaMap,
  locale,
  small = false,
}: {
  personaId: string;
  personaMap: Map<string, PersonaData>;
  locale: string;
  small?: boolean;
}) {
  let persona = personaMap.get(personaId);

  if (!persona) {
    for (const [, p] of personaMap) {
      const loc = p.identity?.locale_variants?.[locale] || p.identity;
      if (loc?.name === personaId || p.identity?.name === personaId) {
        persona = p;
        break;
      }
    }
  }

  const localized = persona
    ? persona.identity?.locale_variants?.[locale] || persona.identity
    : null;
  const name = localized?.name || personaId || "Unknown";
  const avatar = persona?.identity?.avatar || "?";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border border-[#2A2A2A] bg-[#1C1C1C] ${
        small ? "px-1.5 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs"
      } text-[#9B9594] whitespace-nowrap`}
    >
      <span className={small ? "text-[11px]" : "text-sm"}>{avatar}</span>
      <span className="truncate max-w-[72px]">{name}</span>
    </span>
  );
}

/* ── Section Title ───────────────────────────────────────────────────── */

function SectionTitle({
  icon: Icon,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 mb-6">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#1C1C1C] border border-[#2A2A2A]">
        <Icon className="h-4 w-4 text-[#C4A882]" />
      </div>
      <h2 className="text-xl font-semibold text-[#EAEAE8] tracking-tight">
        {children}
      </h2>
      <div className="flex-1 h-px bg-gradient-to-r from-[#2A2A2A] to-transparent" />
    </div>
  );
}

/* ── Callout Box ─────────────────────────────────────────────────────── */

function Callout({
  children,
  variant = "info",
}: {
  children: React.ReactNode;
  variant?: "info" | "success" | "warning";
}) {
  const border = {
    info: "border-[#C4A882]/30",
    success: "border-[#4ADE80]/30",
    warning: "border-[#FBBF24]/30",
  };
  const bg = {
    info: "bg-[#C4A882]/[0.04]",
    success: "bg-[#4ADE80]/[0.04]",
    warning: "bg-[#FBBF24]/[0.04]",
  };
  const iconColor = {
    info: "text-[#C4A882]",
    success: "text-[#4ADE80]",
    warning: "text-[#FBBF24]",
  };

  return (
    <div
      className={`rounded-lg border ${border[variant]} ${bg[variant]} px-4 py-3 flex gap-3`}
    >
      <Lightbulb
        className={`h-4 w-4 mt-0.5 shrink-0 ${iconColor[variant]}`}
      />
      <div className="text-sm text-[#EAEAE8] leading-relaxed">{children}</div>
    </div>
  );
}

/* ── TOC Item ────────────────────────────────────────────────────────── */

interface TocItem {
  id: string;
  label: string;
}

/* ── Leaning Pill (opinion drift) ───────────────────────────────────── */

function LeaningPill({ leaning, highlighted }: { leaning: string; highlighted?: boolean }) {
  const map: Record<string, { label: string; color: string }> = {
    positive: { label: "Positive", color: "#4ADE80" },
    negative: { label: "Negative", color: "#F87171" },
    neutral: { label: "Neutral", color: "#C4A882" },
    mixed: { label: "Mixed", color: "#9B9594" },
    // Legacy
    support: { label: "Positive", color: "#4ADE80" },
    oppose: { label: "Negative", color: "#F87171" },
  };
  const entry = map[leaning] ?? { label: leaning, color: "#9B9594" };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase ${
        highlighted ? "ring-1 ring-[#C4A882]/40" : ""
      }`}
      style={{
        color: entry.color,
        backgroundColor: `${entry.color}15`,
        borderColor: `${entry.color}40`,
        borderWidth: "1px",
      }}
    >
      {entry.label}
    </span>
  );
}

/* ── Desktop Sidebar TOC ─────────────────────────────────────────────── */

function TableOfContents({
  items,
  activeId,
  onItemClick,
  label,
}: {
  items: TocItem[];
  activeId: string;
  onItemClick: (id: string) => void;
  label: string;
}) {
  return (
    <nav className="space-y-1">
      <h3 className="text-[10px] font-semibold uppercase tracking-widest text-[#666462] mb-3 px-3">
        {label}
      </h3>
      {items.map((item) => (
        <button
          key={item.id}
          onClick={() => onItemClick(item.id)}
          className={`block w-full text-left rounded-lg px-3 py-2 text-[13px] transition-all duration-200 ${
            activeId === item.id
              ? "bg-[#1C1C1C] text-[#E2DDD5] font-medium border-l-2 border-[#C4A882] pl-[10px]"
              : "text-[#666462] hover:text-[#9B9594] hover:bg-[#141414]"
          }`}
        >
          {item.label}
        </button>
      ))}
    </nav>
  );
}

/* ── Mobile TOC (floating bottom bar) ────────────────────────────────── */

function MobileToc({
  items,
  activeId,
  onItemClick,
  label,
}: {
  items: TocItem[];
  activeId: string;
  onItemClick: (id: string) => void;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const activeItem = items.find((i) => i.id === activeId);

  return (
    <div className="fixed bottom-4 left-4 right-4 z-40 lg:hidden">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.2 }}
            className="mb-2 rounded-xl border border-[#2A2A2A] bg-[#141414]/95 backdrop-blur-xl p-2 shadow-lg"
          >
            {items.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  onItemClick(item.id);
                  setOpen(false);
                }}
                className={`block w-full text-left rounded-lg px-3 py-2.5 text-sm transition-colors ${
                  activeId === item.id
                    ? "bg-[#1C1C1C] text-[#E2DDD5] font-medium"
                    : "text-[#666462] hover:text-[#9B9594]"
                }`}
              >
                {item.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between rounded-xl border border-[#2A2A2A] bg-[#141414]/95 backdrop-blur-xl px-4 py-3 shadow-lg"
      >
        <div className="flex items-center gap-2">
          <List className="h-4 w-4 text-[#C4A882]" />
          <span className="text-sm text-[#9B9594]">
            {activeItem?.label ?? label}
          </span>
        </div>
        <ChevronUp
          className={`h-4 w-4 text-[#666462] transition-transform duration-200 ${
            open ? "" : "rotate-180"
          }`}
        />
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════════════════

export function ReportTextView({
  report,
  reviews,
  personas,
  locale,
  onViewScores,
  onViewSimulation,
  onViewDebate,
  onStartDebate,
  evaluationId,
  topicClassification,
  mode = "product",
}: ReportTextViewProps) {
  const isTopicMode = mode === "topic";
  const t = useTranslations("evaluation");
  const [activeSection, setActiveSection] = useState("executive-summary");
  const [expandedPersonas, setExpandedPersonas] = useState<Set<string>>(
    new Set()
  );

  // Build persona map once
  const personaMap = useMemo(
    () => new Map(personas.map((p) => [p.id, p])),
    [personas]
  );

  // Persona helpers (locale-aware)
  const getPersonaName = useCallback(
    (persona: PersonaData | undefined): string => {
      if (!persona) return "Unknown";
      const localized =
        persona.identity?.locale_variants?.[locale] || persona.identity;
      return localized?.name || "Unknown";
    },
    [locale]
  );

  const getPersonaOccupation = useCallback(
    (persona: PersonaData | undefined): string => {
      if (!persona) return "";
      if (locale === "zh") return persona.demographics?.occupation || "";
      return persona.identity?.locale_variants?.en?.tagline || persona.demographics?.occupation || "";
    },
    [locale]
  );

  const getPersonaAvatar = useCallback(
    (persona: PersonaData | undefined): string => {
      return persona?.identity?.avatar || "?";
    },
    []
  );

  // ── TOC items ──
  const tocItems: TocItem[] = useMemo(() => {
    if (!report) return [];
    const items: TocItem[] = [
      { id: "executive-summary", label: t("executiveSummary") },
    ];
    if (isTopicMode && report.positions) {
      items.push({ id: "positions", label: locale === "zh" ? "观点框架" : "Positions" });
    }
    items.push(
      { id: "persona-perspectives", label: t("personaPerspectives") },
      { id: "consensus-disagreements", label: t("consensusAndDisagreements") },
    );
    if (report.multi_dimensional_analysis?.length > 0) {
      items.push({ id: "deep-analysis", label: t("deepAnalysis") });
    }
    if (report.opinion_drift && report.opinion_drift.length > 0) {
      items.push({ id: "opinion-drift", label: t("opinionDrift") });
    }
    if (isTopicMode) {
      if (report.synthesis) {
        items.push({ id: "synthesis", label: locale === "zh" ? "综合结论" : "Synthesis" });
      }
      if (report.debate_highlights?.length) {
        items.push({ id: "debate-highlights", label: locale === "zh" ? "讨论亮点" : "Debate Highlights" });
      }
    } else {
      items.push({ id: "recommendations", label: t("recommendations") });
      if (report.action_items?.length > 0) {
        items.push({ id: "action-items", label: t("actionItems") });
      }
    }
    if (report.references && report.references.length > 0) {
      items.push({ id: "references", label: locale === "zh" ? "参考资料" : "References" });
    }
    return items;
  }, [report, t, isTopicMode, locale]);

  // ── Intersection Observer for active section ──
  useEffect(() => {
    if (!report) return;
    const sectionIds = tocItems.map((item) => item.id);
    const observers: IntersectionObserver[] = [];

    sectionIds.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              setActiveSection(id);
            }
          });
        },
        { rootMargin: "-20% 0px -70% 0px" }
      );

      observer.observe(el);
      observers.push(observer);
    });

    return () => observers.forEach((o) => o.disconnect());
  }, [tocItems, report]);

  // ── Scroll to section ──
  const scrollToSection = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  // ── Toggle persona expansion ──
  const togglePersona = useCallback((id: string) => {
    setExpandedPersonas((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // ── Early return ──
  if (!report) return null;

  // ── Derived data (safe access, handles malformed LLM output) ──
  const entries = reconstructFromStrings(safeArray<any>(report.persona_analysis?.entries), "persona_id");
  const consensusPoints = reconstructFromStrings(safeArray<any>(report.persona_analysis?.consensus), "point");
  const disagreements = reconstructFromStrings(safeArray<any>(report.persona_analysis?.disagreements), "point");
  const dimensions = safeArray<any>(report.multi_dimensional_analysis);
  const goals = safeArray<any>(report.goal_assessment);
  const actionItems = safeArray<any>(report.action_items);
  const ifFeasible = report.if_feasible;
  const ifNotFeasible = report.if_not_feasible;
  const keyTakeaways = consensusPoints.slice(0, 3);

  return (
    <div className="relative flex gap-8">
      {/* ── Desktop Sidebar TOC ─────────────────────────────────────── */}
      <aside className="hidden lg:block w-52 shrink-0">
        <div className="sticky top-24">
          <TableOfContents
            items={tocItems}
            activeId={activeSection}
            onItemClick={scrollToSection}
            label={t("tableOfContents")}
          />
        </div>
      </aside>

      {/* ── Mobile TOC ──────────────────────────────────────────────── */}
      <MobileToc
        items={tocItems}
        activeId={activeSection}
        onItemClick={scrollToSection}
        label={t("tableOfContents")}
      />

      {/* ── Main Content ────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 max-w-[72ch] space-y-16 pb-24">
        {/* ════════════════════════════════════════════════════════════
            EXECUTIVE SUMMARY
        ════════════════════════════════════════════════════════════ */}
        <AnimatedSection id="executive-summary" className="relative">
          {/* Warm radial glow */}
          <div className="absolute -inset-6 rounded-3xl pointer-events-none bg-[radial-gradient(ellipse_at_50%_0%,rgba(196,168,130,0.05),transparent_70%)]" />

          <div className="relative">
            <SectionTitle icon={Target}>{t("executiveSummary")}</SectionTitle>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 mb-8">
              {/* Score Arc / Consensus Arc */}
              <div className="flex flex-col items-center gap-1.5 shrink-0">
                {isTopicMode ? (
                  <>
                    <ConsensusArc score={report.consensus_score ?? 0} />
                    <span className="text-[11px] text-[#666462]">
                      {locale === "zh" ? "观点统一度" : "Consensus"}
                    </span>
                  </>
                ) : (
                  <>
                    <ScoreArc score={report.overall_score ?? 0} />
                    <span className="text-[11px] text-[#666462]">
                      {t("overallScore")}
                    </span>
                  </>
                )}
              </div>

              {/* Market Readiness + Key Findings */}
              <div className="flex-1 min-w-0 space-y-4">
                {report.market_readiness && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-[#666462]">
                      {report.readiness_label_en
                        ? (locale === "zh" ? (report.readiness_label_zh || report.readiness_label_en) : report.readiness_label_en)
                        : t("marketReadiness")}:
                    </span>
                    <Badge
                      className={`border text-xs font-medium ${
                        readinessColor(report.market_readiness).bg
                      } ${readinessColor(report.market_readiness).text} ${
                        readinessColor(report.market_readiness).border
                      }`}
                    >
                      {t(
                        report.market_readiness as
                          | "low"
                          | "medium"
                          | "high"
                      )}
                    </Badge>
                  </div>
                )}

                {keyTakeaways.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-[10px] font-semibold uppercase tracking-widest text-[#C4A882]">
                      {t("keyFindings")}
                    </h3>
                    {keyTakeaways.map((item, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -12 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.4 + i * 0.15 }}
                        className="flex gap-2 items-start"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0 text-[#4ADE80]" />
                        <p className="text-sm text-[#EAEAE8] leading-relaxed">
                          {item.point}
                        </p>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </AnimatedSection>

        {/* ════════════════════════════════════════════════════════════
            POSITIONS FRAMING (topic mode only)
        ════════════════════════════════════════════════════════════ */}
        {isTopicMode && report.positions && (
          <AnimatedSection id="positions">
            <div className="rounded-xl border border-[#2A2A2A] bg-[#141414] p-5">
              <p className="text-xs font-medium uppercase tracking-widest text-[#C4A882] mb-3">
                {locale === "zh" ? "观点框架" : "Positions"}
              </p>
              <p className="text-sm text-[#9B9594] mb-4">{report.positions.question}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-[#4ADE80]/20 bg-[#4ADE80]/5 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-2.5 w-2.5 rounded-full bg-[#4ADE80]" />
                    <span className="text-sm font-semibold text-[#4ADE80]">{report.positions.positive_label}</span>
                  </div>
                  <p className="text-xs text-[#9B9594] leading-relaxed">{report.positions.positive_summary}</p>
                </div>
                <div className="rounded-lg border border-[#F87171]/20 bg-[#F87171]/5 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-2.5 w-2.5 rounded-full bg-[#F87171]" />
                    <span className="text-sm font-semibold text-[#F87171]">{report.positions.negative_label}</span>
                  </div>
                  <p className="text-xs text-[#9B9594] leading-relaxed">{report.positions.negative_summary}</p>
                </div>
              </div>
            </div>
          </AnimatedSection>
        )}

        {/* ════════════════════════════════════════════════════════════
            PERSONA PERSPECTIVES
        ════════════════════════════════════════════════════════════ */}
        <AnimatedSection id="persona-perspectives">
          <SectionTitle icon={Target}>{t("personaPerspectives")}</SectionTitle>

          <div className="space-y-5">
            {(entries.length > 0 ? entries : reviews).map(
              (item: any, i: number) => {
                const personaId = item.persona_id;
                let persona = personaMap.get(personaId);
                if (!persona) {
                  for (const [, p] of personaMap) {
                    const loc = p.identity?.locale_variants?.[locale] || p.identity;
                    if (loc?.name === personaId || p.identity?.name === personaId) {
                      persona = p;
                      break;
                    }
                  }
                }
                const review = reviews.find(
                  (r) => r.persona_id === personaId || r.persona_id === persona?.id
                );
                const analysisEntry = entries.find(
                  (e: any) => e.persona_id === personaId
                );
                const isExpanded = expandedPersonas.has(personaId);

                const name =
                  analysisEntry?.persona_name ??
                  getPersonaName(persona);
                const avatar = getPersonaAvatar(persona);
                const occupation = getPersonaOccupation(persona);

                // Average score (product mode) or overall stance (topic mode)
                const scoreValues = review?.scores ? Object.values(review.scores) : [];
                const isStance = scoreValues.length > 0 && typeof scoreValues[0] === "string";
                const avgScore = !isStance && scoreValues.length > 0
                  ? (scoreValues as number[]).reduce((a, b) => a + b, 0) / scoreValues.length
                  : null;

                const stanceOrder = ["strongly_negative", "negative", "neutral", "positive", "strongly_positive"];
                const legacyMap: Record<string, string> = {
                  strongly_support: "strongly_positive", support: "positive", oppose: "negative", strongly_oppose: "strongly_negative",
                };
                const stanceLabels: Record<string, { text: string; color: string; hex: string }> = {
                  strongly_positive: { text: "text-[#34D399]", color: "Strongly Positive", hex: "#34D399" },
                  positive: { text: "text-[#4ADE80]", color: "Positive", hex: "#4ADE80" },
                  neutral: { text: "text-[#FBBF24]", color: "Neutral", hex: "#FBBF24" },
                  negative: { text: "text-[#F97316]", color: "Negative", hex: "#F97316" },
                  strongly_negative: { text: "text-[#F87171]", color: "Strongly Negative", hex: "#F87171" },
                };
                let overallStance: string | null = review?.overall_stance
                  ? (legacyMap[review.overall_stance] ?? review.overall_stance)
                  : null;
                if (!overallStance && isStance) {
                  const mapped = (scoreValues as string[]).map(v => legacyMap[v] ?? v);
                  const nums = mapped.map(v => stanceOrder.indexOf(v)).filter(v => v >= 0);
                  if (nums.length > 0) {
                    overallStance = stanceOrder[Math.round(nums.reduce((a, b) => a + b, 0) / nums.length)];
                  }
                }

                return (
                  <motion.div
                    key={personaId ?? i}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      delay: i * 0.08,
                      duration: 0.4,
                      ease: [0.16, 1, 0.3, 1],
                    }}
                    className="rounded-xl border border-[#2A2A2A] bg-[#141414] transition-colors duration-300 hover:border-[#3A3A3A] overflow-hidden"
                  >
                    {/* Header & Content */}
                    <div className="p-5 pb-4">
                      {/* Avatar row */}
                      <div className="flex items-start gap-3 mb-4">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#1C1C1C] border border-[#2A2A2A] text-lg">
                          {avatar}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-[#EAEAE8]">
                              {name}
                            </span>
                            {overallStance ? (
                              <Badge
                                className="border text-[10px] font-medium bg-transparent"
                                style={{
                                  color: stanceLabels[overallStance]?.hex ?? "#FBBF24",
                                  borderColor: `${stanceLabels[overallStance]?.hex ?? "#FBBF24"}30`,
                                }}
                              >
                                {stanceLabels[overallStance]?.color ?? overallStance}
                              </Badge>
                            ) : avgScore != null && (
                              <Badge
                                className={`border text-[10px] font-mono font-medium ${
                                  scoreColor(avgScore).text
                                } bg-transparent`}
                                style={{
                                  borderColor: `${scoreColor(avgScore).hex}30`,
                                }}
                              >
                                {avgScore.toFixed(1)}
                              </Badge>
                            )}
                          </div>
                          {occupation && (
                            <p className="text-xs text-[#666462] mt-0.5">
                              {occupation}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Core Viewpoint (quote style) */}
                      {analysisEntry?.core_viewpoint && (
                        <div className="relative pl-4 mb-4">
                          <div className="absolute left-0 top-0 bottom-0 w-0.5 rounded-full bg-[#C4A882]/40" />
                          <p className="text-sm text-[#EAEAE8] leading-relaxed italic">
                            &ldquo;{analysisEntry.core_viewpoint}&rdquo;
                          </p>
                        </div>
                      )}

                      {/* Scoring Rationale */}
                      {analysisEntry?.scoring_rationale && (
                        <div>
                          <h4 className="text-[10px] font-semibold text-[#666462] uppercase tracking-widest mb-1">
                            {t("rationale")}
                          </h4>
                          <p className="text-sm text-[#9B9594] leading-relaxed">
                            {analysisEntry.scoring_rationale}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Expandable detail */}
                    {review && (
                      <>
                        <button
                          onClick={() => togglePersona(personaId)}
                          className="flex items-center gap-1.5 px-5 py-2.5 w-full text-left text-xs text-[#666462] hover:text-[#9B9594] transition-colors border-t border-[#2A2A2A]/50 hover:bg-[#1C1C1C]/30"
                        >
                          {isExpanded ? (
                            <ChevronUp className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5" />
                          )}
                          <span>
                            {isExpanded
                              ? t("collapseDetails")
                              : t("expandDetails")}
                          </span>
                        </button>

                        <AnimatePresence>
                          {isExpanded && (
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
                              <div className="px-5 pb-5 pt-3 space-y-4 border-t border-[#2A2A2A]/50">
                                {/* Full review text */}
                                {review.review_text && (
                                  <p className="text-sm text-[#9B9594] leading-[1.75]">
                                    {review.review_text}
                                  </p>
                                )}

                                {/* Strengths & Weaknesses */}
                                <div className="grid gap-3 sm:grid-cols-2">
                                  {Array.isArray(review.strengths) && review.strengths.length > 0 && (
                                    <div className="rounded-lg border border-[#4ADE80]/15 bg-[#4ADE80]/[0.03] p-3">
                                      <h5 className="text-[10px] font-semibold text-[#4ADE80] uppercase tracking-wider mb-2">
                                        {t("strengths")}
                                      </h5>
                                      <ul className="space-y-1.5">
                                        {review.strengths.map(
                                          (s: string, si: number) => (
                                            <li
                                              key={si}
                                              className="flex gap-1.5 text-xs text-[#9B9594] leading-relaxed"
                                            >
                                              <span className="text-[#4ADE80] shrink-0">
                                                +
                                              </span>
                                              {s}
                                            </li>
                                          )
                                        )}
                                      </ul>
                                    </div>
                                  )}
                                  {Array.isArray(review.weaknesses) && review.weaknesses.length > 0 && (
                                    <div className="rounded-lg border border-[#F87171]/15 bg-[#F87171]/[0.03] p-3">
                                      <h5 className="text-[10px] font-semibold text-[#F87171] uppercase tracking-wider mb-2">
                                        {t("weaknesses")}
                                      </h5>
                                      <ul className="space-y-1.5">
                                        {review.weaknesses.map(
                                          (w: string, wi: number) => (
                                            <li
                                              key={wi}
                                              className="flex gap-1.5 text-xs text-[#9B9594] leading-relaxed"
                                            >
                                              <span className="text-[#F87171] shrink-0">
                                                -
                                              </span>
                                              {w}
                                            </li>
                                          )
                                        )}
                                      </ul>
                                    </div>
                                  )}
                                </div>

                                {/* Individual score bars */}
                                {review.scores && (
                                  <div className="space-y-2 pt-1">
                                    {Object.entries(
                                      review.scores as Record<string, number>
                                    ).map(([dim, score]) => {
                                      const dimLabel = topicClassification
                                        ? topicClassification.dimensions.find(d => d.key === dim)
                                        : null;
                                      return (
                                      <div
                                        key={dim}
                                        className="flex items-center gap-2"
                                      >
                                        <span className="w-20 text-[11px] text-[#666462] truncate">
                                          {dimLabel ? (locale === "zh" ? dimLabel.label_zh : dimLabel.label_en) : t(dim as any)}
                                        </span>
                                        <div className="h-1.5 flex-1 rounded-full bg-[#1C1C1C]">
                                          <motion.div
                                            className="h-full rounded-full"
                                            style={{
                                              background: scoreGradientCSS(
                                                score as number
                                              ),
                                            }}
                                            initial={{ width: 0 }}
                                            animate={{
                                              width: `${
                                                (score as number) * 10
                                              }%`,
                                            }}
                                            transition={{
                                              duration: 0.6,
                                              ease: "easeOut",
                                            }}
                                          />
                                        </div>
                                        <span
                                          className={`w-5 text-right text-[11px] font-mono font-medium ${
                                            scoreColor(score as number).text
                                          }`}
                                        >
                                          {score}
                                        </span>
                                      </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </>
                    )}
                  </motion.div>
                );
              }
            )}
          </div>

          {/* View Numerical Scores button */}
          {onViewScores && (
            <div className="mt-6 flex justify-center">
              <button
                onClick={onViewScores}
                className="inline-flex items-center gap-2 rounded-lg border border-[#2A2A2A] bg-[#1C1C1C] px-5 py-2.5 text-sm font-medium text-[#E2DDD5] transition-all duration-200 hover:border-[#3A3A3A] hover:bg-[#222222]"
              >
                <BarChart3 className="h-4 w-4" />
                {locale === "zh" ? "查看数值评分详情" : "View Numerical Scores"}
              </button>
            </div>
          )}
        </AnimatedSection>

        {/* ════════════════════════════════════════════════════════════
            CONSENSUS & DISAGREEMENTS
        ════════════════════════════════════════════════════════════ */}
        <AnimatedSection id="consensus-disagreements">
          <SectionTitle icon={TrendingUp}>
            {t("consensusAndDisagreements")}
          </SectionTitle>

          {/* Consensus */}
          {consensusPoints.length > 0 && (
            <div className="mb-10">
              <h3 className="text-sm font-semibold text-[#4ADE80] mb-4 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                {t("consensus")}
              </h3>
              <div className="space-y-3">
                {consensusPoints.map((item, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.06 }}
                    className="rounded-lg border border-[#4ADE80]/15 bg-[#4ADE80]/[0.03] p-4"
                  >
                    <p className="text-sm text-[#EAEAE8] leading-relaxed mb-2">
                      {item.point}
                    </p>
                    {item.supporting_personas &&
                      item.supporting_personas.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] text-[#666462]">
                            {t("supportedBy")}:
                          </span>
                          {safeArray<string>(item.supporting_personas).map((pid) => (
                            <PersonaPill
                              key={pid}
                              personaId={pid}
                              personaMap={personaMap}
                              locale={locale}
                              small
                            />
                          ))}
                        </div>
                      )}
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* Disagreements */}
          {disagreements.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-[#FBBF24] mb-4 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                {t("disagreements")}
              </h3>
              <div className="space-y-4">
                {disagreements.map((item, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.06 }}
                    className="rounded-lg border border-[#FBBF24]/15 bg-[#FBBF24]/[0.03] p-4"
                  >
                    <p className="text-sm font-medium text-[#EAEAE8] mb-3">
                      {item.point}
                    </p>

                    {/* Debate sides (if structured data available) */}
                    {Array.isArray(item.sides) && item.sides.length >= 2 ? (
                      <div className="grid gap-3 sm:grid-cols-2 mb-3">
                        {item.sides.map((side: any, si: number) => (
                          <div
                            key={si}
                            className={`rounded-lg p-3 ${
                              si === 0
                                ? "bg-[#4ADE80]/[0.04] border border-[#4ADE80]/10"
                                : "bg-[#F87171]/[0.04] border border-[#F87171]/10"
                            }`}
                          >
                            <p
                              className={`text-xs font-medium mb-2 ${
                                si === 0
                                  ? "text-[#4ADE80]"
                                  : "text-[#F87171]"
                              }`}
                            >
                              {side.position}
                            </p>
                            {Array.isArray(side.persona_ids) && (
                              <div className="flex flex-wrap gap-1">
                                {side.persona_ids.map((pid: string) => (
                                  <PersonaPill
                                    key={pid}
                                    personaId={pid}
                                    personaMap={personaMap}
                                    locale={locale}
                                    small
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : null}

                    {item.reason && (
                      <p className="text-xs text-[#666462] leading-relaxed italic">
                        {item.reason}
                      </p>
                    )}
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {consensusPoints.length === 0 && disagreements.length === 0 && (
            <p className="text-sm text-[#666462] italic">
              {locale === "zh"
                ? "暂无共识或分歧数据"
                : "No consensus or disagreement data available."}
            </p>
          )}
        </AnimatedSection>


        {/* ════════════════════════════════════════════════════════════
            DEEP ANALYSIS
        ════════════════════════════════════════════════════════════ */}
        {dimensions.length > 0 && (
          <AnimatedSection id="deep-analysis">
            <SectionTitle icon={Zap}>{t("deepAnalysis")}</SectionTitle>

            <div className="space-y-8">
              {dimensions.map((dim, i) => {
                const isStanceMode = isTopicMode && dim.overall_leaning;
                const dimScore = dim.score ?? 0;
                const colors = scoreColor(dimScore);

                const leaningStyles: Record<string, { color: string; label: string; labelZh: string }> = {
                  strongly_positive: { color: "#34D399", label: "Strongly Positive", labelZh: "强烈正面" },
                  positive: { color: "#4ADE80", label: "Positive", labelZh: "正面" },
                  neutral: { color: "#FBBF24", label: "Neutral", labelZh: "中立" },
                  negative: { color: "#F97316", label: "Negative", labelZh: "负面" },
                  strongly_negative: { color: "#F87171", label: "Strongly Negative", labelZh: "强烈负面" },
                  // Legacy
                  strongly_support: { color: "#34D399", label: "Strongly Positive", labelZh: "强烈正面" },
                  support: { color: "#4ADE80", label: "Positive", labelZh: "正面" },
                  oppose: { color: "#F97316", label: "Negative", labelZh: "负面" },
                  strongly_oppose: { color: "#F87171", label: "Strongly Negative", labelZh: "强烈负面" },
                };
                const leaning = leaningStyles[dim.overall_leaning ?? ""] || leaningStyles.neutral;

                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.06 }}
                  >
                    {/* Dimension header */}
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-base font-semibold text-[#EAEAE8]">
                        {(locale === "zh" ? dim.label_zh : dim.label_en) || dim.dimension}
                      </h3>
                      {isStanceMode ? (
                        <Badge
                          className="border text-[10px] font-medium bg-transparent"
                          style={{ borderColor: `${leaning.color}30`, color: leaning.color }}
                        >
                          {locale === "zh" ? leaning.labelZh : leaning.label}
                        </Badge>
                      ) : (
                        <Badge
                          className={`border text-[10px] font-mono font-medium ${colors.text} bg-transparent`}
                          style={{ borderColor: `${colors.hex}30` }}
                        >
                          {dimScore.toFixed(1)}
                        </Badge>
                      )}
                    </div>

                    {/* Stance distribution bar */}
                    {isStanceMode && (dim.positive_count != null || dim.support_count != null) && (() => {
                      const pos = dim.positive_count ?? dim.support_count ?? 0;
                      const neg = dim.negative_count ?? dim.oppose_count ?? 0;
                      const neu = dim.neutral_count ?? 0;
                      const total = pos + neg + neu;
                      if (total === 0) return null;
                      return (
                        <div className="flex items-center gap-2 mb-3">
                          <div className="flex h-2 flex-1 overflow-hidden rounded-full bg-[#1C1C1C]">
                            {neg > 0 && <div className="bg-[#F87171]" style={{ width: `${(neg / total) * 100}%` }} />}
                            {neu > 0 && <div className="bg-[#FBBF24]" style={{ width: `${(neu / total) * 100}%` }} />}
                            {pos > 0 && <div className="bg-[#4ADE80]" style={{ width: `${(pos / total) * 100}%` }} />}
                          </div>
                          <span className="text-[10px] text-[#666462] shrink-0">
                            {pos}{locale === "zh" ? "正面" : "P"} · {neu}{locale === "zh" ? "中立" : "N"} · {neg}{locale === "zh" ? "负面" : "Neg"}
                          </span>
                        </div>
                      );
                    })()}

                    {/* Analysis paragraph */}
                    {dim.analysis && (
                      <p className="text-sm text-[#9B9594] leading-[1.8] mb-4">
                        {dim.analysis}
                      </p>
                    )}

                    {/* Key arguments (topic) or Strengths & Weaknesses (product) */}
                    {isStanceMode && dim.key_arguments ? (
                      <div className="flex flex-col sm:flex-row gap-4">
                        {(dim.key_arguments.positive || dim.key_arguments.for) && (
                          <div className="flex-1 rounded-lg bg-[#4ADE80]/5 border border-[#4ADE80]/10 p-3">
                            <span className="text-[10px] font-semibold text-[#4ADE80] uppercase">{locale === "zh" ? "正面论点" : "Positive"}</span>
                            <p className="mt-1.5 text-xs text-[#9B9594] leading-relaxed">{dim.key_arguments.positive || dim.key_arguments.for}</p>
                          </div>
                        )}
                        {(dim.key_arguments.negative || dim.key_arguments.against) && (
                          <div className="flex-1 rounded-lg bg-[#F87171]/5 border border-[#F87171]/10 p-3">
                            <span className="text-[10px] font-semibold text-[#F87171] uppercase">{locale === "zh" ? "负面论点" : "Negative"}</span>
                            <p className="mt-1.5 text-xs text-[#9B9594] leading-relaxed">{dim.key_arguments.negative || dim.key_arguments.against}</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-col sm:flex-row gap-4">
                        {Array.isArray(dim.strengths) && dim.strengths.length > 0 && (
                          <div className="flex-1">
                            <ul className="space-y-1">
                              {dim.strengths.map((s: string, si: number) => (
                                <li
                                  key={si}
                                  className="flex gap-2 text-xs text-[#9B9594] leading-relaxed"
                                >
                                  <Circle className="h-1.5 w-1.5 mt-1.5 shrink-0 fill-[#4ADE80] text-[#4ADE80]" />
                                  {s}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {Array.isArray(dim.weaknesses) && dim.weaknesses.length > 0 && (
                          <div className="flex-1">
                            <ul className="space-y-1">
                              {dim.weaknesses.map((w: string, wi: number) => (
                                <li
                                  key={wi}
                                  className="flex gap-2 text-xs text-[#9B9594] leading-relaxed"
                                >
                                  <Circle className="h-1.5 w-1.5 mt-1.5 shrink-0 fill-[#F87171] text-[#F87171]" />
                                  {w}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Separator */}
                    {i < dimensions.length - 1 && (
                      <div className="mt-6 h-px bg-gradient-to-r from-[#2A2A2A] via-[#2A2A2A]/50 to-transparent" />
                    )}
                  </motion.div>
                );
              })}
            </div>
          </AnimatedSection>
        )}

        {/* ════════════════════════════════════════════════════════════
            OPINION DRIFT (both modes)
        ════════════════════════════════════════════════════════════ */}
        {report.opinion_drift && report.opinion_drift.length > 0 && (
          <AnimatedSection id="opinion-drift">
            <SectionTitle icon={TrendingUp}>{t("opinionDrift")}</SectionTitle>
            <p className="mb-6 text-sm text-[#9B9594] max-w-3xl leading-relaxed">
              {t("opinionDriftSubtitle")}
            </p>
            <div className="space-y-3">
              {report.opinion_drift.map((drift, i) => {
                const persona = personas.find((p) => p.id === drift.persona_id);
                const name = persona?.identity?.locale_variants?.[locale as "zh" | "en"]?.name
                  || persona?.identity?.name
                  || "—";
                const avatar = persona?.identity?.avatar || "?";
                const shifted = drift.shift_magnitude !== "none" && drift.initial_leaning !== drift.final_leaning;
                return (
                  <motion.div
                    key={drift.persona_id}
                    initial={{ opacity: 0, y: 6 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.04 }}
                    className="rounded-xl border border-[#2A2A2A] bg-[#141414] p-4"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-xl">{avatar}</span>
                      <span className="text-sm font-medium text-[#EAEAE8]">{name}</span>
                      <div className="ml-auto flex items-center gap-2 text-xs">
                        <LeaningPill leaning={drift.initial_leaning} />
                        <ArrowRight className={`h-3 w-3 ${shifted ? "text-[#C4A882]" : "text-[#3A3A3A]"}`} />
                        <LeaningPill leaning={drift.final_leaning} highlighted={shifted} />
                      </div>
                    </div>
                    <p className="text-xs text-[#9B9594] leading-relaxed pl-9">{drift.reasoning}</p>
                  </motion.div>
                );
              })}
            </div>
          </AnimatedSection>
        )}

        {/* ════════════════════════════════════════════════════════════
            SYNTHESIS (topic mode only)
        ════════════════════════════════════════════════════════════ */}
        {isTopicMode && report.synthesis && (
          <AnimatedSection id="synthesis">
            <SectionTitle icon={MessageSquare}>
              {locale === "zh" ? "综合结论" : "Synthesis"}
            </SectionTitle>

            <div className="rounded-xl border border-[#C4A882]/15 bg-[#C4A882]/[0.02] p-6">
              <p className="text-sm text-[#EAEAE8] leading-[1.9] whitespace-pre-line">
                {report.synthesis}
              </p>
            </div>
          </AnimatedSection>
        )}

        {/* ════════════════════════════════════════════════════════════
            DEBATE HIGHLIGHTS (topic mode only)
        ════════════════════════════════════════════════════════════ */}
        {isTopicMode && report.debate_highlights && report.debate_highlights.length > 0 && (
          <AnimatedSection id="debate-highlights">
            <SectionTitle icon={Users}>
              {locale === "zh" ? "讨论亮点" : "Debate Highlights"}
            </SectionTitle>

            <div className="space-y-6">
              {report.debate_highlights.map((highlight, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08 }}
                  className="rounded-xl border border-[#2A2A2A] bg-[#141414] overflow-hidden"
                >
                  {/* Highlight topic */}
                  <div className="px-5 pt-5 pb-3">
                    <h3 className="text-sm font-semibold text-[#EAEAE8]">
                      {highlight.topic}
                    </h3>
                  </div>

                  {/* Perspectives (multi-angle, not just pro/con) */}
                  <div className="px-5 pb-3 space-y-2">
                    {highlight.perspectives.map((p, pi) => {
                      const colors = [
                        "border-[#4ADE80]/15 bg-[#4ADE80]/[0.03]",
                        "border-[#FBBF24]/15 bg-[#FBBF24]/[0.03]",
                        "border-[#C4A882]/15 bg-[#C4A882]/[0.03]",
                        "border-[#F87171]/15 bg-[#F87171]/[0.03]",
                        "border-[#60A5FA]/15 bg-[#60A5FA]/[0.03]",
                      ];
                      const nameColors = [
                        "text-[#4ADE80]",
                        "text-[#FBBF24]",
                        "text-[#C4A882]",
                        "text-[#F87171]",
                        "text-[#60A5FA]",
                      ];
                      return (
                        <div
                          key={pi}
                          className={`rounded-lg border ${colors[pi % colors.length]} p-3`}
                        >
                          <span className={`text-xs font-semibold ${nameColors[pi % nameColors.length]}`}>
                            {p.persona_name}
                          </span>
                          <p className="text-xs text-[#9B9594] mt-1 leading-relaxed">
                            {p.stance}
                          </p>
                        </div>
                      );
                    })}
                  </div>

                  {/* Significance */}
                  {highlight.significance && (
                    <div className="px-5 pb-5 pt-1">
                      <div className="flex gap-2 items-start">
                        <Lightbulb className="h-3.5 w-3.5 mt-0.5 shrink-0 text-[#C4A882]" />
                        <p className="text-xs text-[#666462] leading-relaxed italic">
                          {highlight.significance}
                        </p>
                      </div>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </AnimatedSection>
        )}

        {/* ════════════════════════════════════════════════════════════
            RECOMMENDATIONS (product mode only)
        ════════════════════════════════════════════════════════════ */}
        {!isTopicMode && <AnimatedSection id="recommendations">
          <SectionTitle icon={Shield}>{t("recommendations")}</SectionTitle>

          {/* Goal Assessment */}
          {goals.length > 0 && (
            <div className="mb-8">
              <h3 className="text-sm font-semibold text-[#E2DDD5] mb-4">
                {t("goalAssessment")}
              </h3>
              <div className="space-y-3">
                {goals.map((goal, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-[#2A2A2A] bg-[#141414] p-4"
                  >
                    <div className="flex items-start gap-2.5 mb-2">
                      {goal.achievable ? (
                        <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-[#4ADE80]" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-[#F87171]" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#EAEAE8]">
                          {goal.goal}
                        </p>
                        <Badge
                          className={`mt-1.5 border text-[10px] font-medium ${
                            goal.achievable
                              ? "border-[#4ADE80]/30 bg-[#4ADE80]/10 text-[#4ADE80]"
                              : "border-[#F87171]/30 bg-[#F87171]/10 text-[#F87171]"
                          }`}
                        >
                          {goal.achievable
                            ? t("achievable")
                            : t("notAchievable")}
                        </Badge>
                      </div>
                    </div>

                    {goal.current_status && (
                      <p className="text-xs text-[#9B9594] mt-2 ml-[26px]">
                        <span className="text-[#666462]">
                          {t("currentStatus")}:
                        </span>{" "}
                        {goal.current_status}
                      </p>
                    )}

                    {Array.isArray(goal.gaps) && goal.gaps.length > 0 && (
                      <div className="mt-2 ml-[26px]">
                        <span className="text-[10px] text-[#666462] uppercase tracking-wider">
                          {t("gaps")}:
                        </span>
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {goal.gaps.map((gap: string, gi: number) => (
                            <span
                              key={gi}
                              className="inline-block rounded-md border border-[#F87171]/20 bg-[#F87171]/[0.04] px-2 py-0.5 text-[10px] text-[#F87171]"
                            >
                              {gap}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Feasibility Paths (side by side) */}
          <div className="grid gap-5 sm:grid-cols-2">
            {/* If Feasible */}
            {ifFeasible && (
              <div className="rounded-xl border border-[#4ADE80]/15 bg-[#4ADE80]/[0.02] p-5">
                <h4 className="text-sm font-semibold text-[#4ADE80] mb-4 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  {t("ifFeasible")}
                </h4>

                {Array.isArray(ifFeasible.next_steps) && ifFeasible.next_steps.length > 0 && (
                  <div className="mb-4">
                    <h5 className="text-[10px] font-semibold text-[#666462] uppercase tracking-wider mb-2">
                      {t("nextSteps")}
                    </h5>
                    <ol className="space-y-1.5">
                      {ifFeasible.next_steps.map((step, i) => (
                        <li
                          key={i}
                          className="flex gap-2 text-xs text-[#9B9594] leading-relaxed"
                        >
                          <span className="text-[#4ADE80] font-mono shrink-0">
                            {i + 1}.
                          </span>
                          {step}
                        </li>
                      ))}
                    </ol>
                  </div>
                )}

                {Array.isArray(ifFeasible.optimizations) &&
                  ifFeasible.optimizations.length > 0 && (
                    <div className="mb-4">
                      <h5 className="text-[10px] font-semibold text-[#666462] uppercase tracking-wider mb-2">
                        {t("optimizations")}
                      </h5>
                      <ul className="space-y-1">
                        {ifFeasible.optimizations.map((opt, i) => (
                          <li
                            key={i}
                            className="flex gap-2 text-xs text-[#9B9594] leading-relaxed"
                          >
                            <ArrowRight className="h-3 w-3 mt-0.5 shrink-0 text-[#4ADE80]" />
                            {opt}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                {Array.isArray(ifFeasible.risks) && ifFeasible.risks.length > 0 && (
                  <div>
                    <h5 className="text-[10px] font-semibold text-[#666462] uppercase tracking-wider mb-2">
                      {t("risks")}
                    </h5>
                    <ul className="space-y-1">
                      {ifFeasible.risks.map((risk, i) => (
                        <li
                          key={i}
                          className="flex gap-2 text-xs text-[#9B9594] leading-relaxed"
                        >
                          <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0 text-[#FBBF24]" />
                          {risk}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* If Not Feasible */}
            {ifNotFeasible && (
              <div className="rounded-xl border border-[#C4A882]/15 bg-[#C4A882]/[0.02] p-5">
                <h4 className="text-sm font-semibold text-[#C4A882] mb-4 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  {t("ifNotFeasible")}
                </h4>

                {ifNotFeasible.direction && (
                  <div className="mb-4">
                    <h5 className="text-[10px] font-semibold text-[#666462] uppercase tracking-wider mb-2">
                      {t("direction")}
                    </h5>
                    <p className="text-xs text-[#9B9594] leading-relaxed">
                      {ifNotFeasible.direction}
                    </p>
                  </div>
                )}

                {Array.isArray(ifNotFeasible.modifications) &&
                  ifNotFeasible.modifications.length > 0 && (
                    <div className="mb-4">
                      <h5 className="text-[10px] font-semibold text-[#666462] uppercase tracking-wider mb-2">
                        {t("modifications")}
                      </h5>
                      <ul className="space-y-1">
                        {ifNotFeasible.modifications.map((mod, i) => (
                          <li
                            key={i}
                            className="flex gap-2 text-xs text-[#9B9594] leading-relaxed"
                          >
                            <ArrowRight className="h-3 w-3 mt-0.5 shrink-0 text-[#C4A882]" />
                            {mod}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                {Array.isArray(ifNotFeasible.priorities) &&
                  ifNotFeasible.priorities.length > 0 && (
                    <div className="mb-4">
                      <h5 className="text-[10px] font-semibold text-[#666462] uppercase tracking-wider mb-2">
                        {t("priorities")}
                      </h5>
                      <ol className="space-y-1">
                        {ifNotFeasible.priorities.map((p, i) => (
                          <li
                            key={i}
                            className="flex gap-2 text-xs text-[#9B9594] leading-relaxed"
                          >
                            <span className="text-[#C4A882] font-mono shrink-0">
                              {i + 1}.
                            </span>
                            {p}
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}

                {Array.isArray(ifNotFeasible.reference_cases) &&
                  ifNotFeasible.reference_cases.length > 0 && (
                    <div>
                      <h5 className="text-[10px] font-semibold text-[#666462] uppercase tracking-wider mb-2">
                        {t("referenceCases")}
                      </h5>
                      <ul className="space-y-1">
                        {ifNotFeasible.reference_cases.map((ref, i) => (
                          <li
                            key={i}
                            className="flex gap-2 text-xs text-[#9B9594] leading-relaxed"
                          >
                            <ChevronRight className="h-3 w-3 mt-0.5 shrink-0 text-[#C4A882]" />
                            {ref}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
              </div>
            )}
          </div>

          {!ifFeasible && !ifNotFeasible && goals.length === 0 && (
            <p className="text-sm text-[#666462] italic">
              {locale === "zh"
                ? "暂无建议数据"
                : "No recommendation data available."}
            </p>
          )}
        </AnimatedSection>}

        {/* ════════════════════════════════════════════════════════════
            ACTION ITEMS (product mode only)
        ════════════════════════════════════════════════════════════ */}
        {!isTopicMode && actionItems.length > 0 && (
          <AnimatedSection id="action-items">
            <SectionTitle icon={Lightbulb}>{t("actionItems")}</SectionTitle>

            <div className="space-y-3">
              {actionItems.map((item, i) => {
                const pStyle = priorityStyle(item.priority);
                const dStyle = difficultyBadge(item.difficulty);

                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="rounded-lg border border-[#2A2A2A] bg-[#141414] p-4 flex gap-3"
                  >
                    {/* Priority dot */}
                    <div className="mt-1.5 shrink-0">
                      <div className={`h-2 w-2 rounded-full ${pStyle.dot}`} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[#EAEAE8] leading-relaxed mb-2">
                        {item.description}
                      </p>

                      <div className="flex flex-wrap gap-1.5">
                        <Badge
                          className={`border text-[10px] font-medium ${pStyle.badge}`}
                        >
                          {t("priority")}:{" "}
                          {t(
                            item.priority?.toLowerCase() as
                              | "critical"
                              | "high"
                              | "medium"
                              | "low"
                          )}
                        </Badge>
                        {item.expected_impact && (
                          <Badge className="border text-[10px] font-medium border-[#E2DDD5]/20 bg-[#E2DDD5]/[0.04] text-[#E2DDD5]">
                            {t("impact")}: {item.expected_impact}
                          </Badge>
                        )}
                        {item.difficulty && (
                          <Badge
                            className={`border text-[10px] font-medium ${dStyle}`}
                          >
                            {t("difficulty")}:{" "}
                            {t(
                              item.difficulty?.toLowerCase() as
                                | "easy"
                                | "medium"
                                | "hard"
                            )}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </AnimatedSection>
        )}

        {/* ════════════════════════════════════════════════════════════
            REFERENCES
        ════════════════════════════════════════════════════════════ */}
        {report.references && report.references.length > 0 && (
          <AnimatedSection id="references">
            <SectionTitle icon={BookOpen}>
              {locale === "zh" ? "参考资料" : "References & Sources"}
            </SectionTitle>
            <div className="space-y-3">
              {report.references.map((ref, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 6 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.04 }}
                  className="rounded-xl border border-[#2A2A2A] bg-[#141414] p-4"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#1C1C1C] text-[10px] font-mono text-[#666462]">
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#EAEAE8]">{ref.title}</p>
                      <p className="mt-1 text-xs text-[#9B9594] leading-relaxed">{ref.detail}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {ref.source && (
                          <span className="rounded-md bg-[#C4A882]/10 px-2 py-0.5 text-[10px] text-[#C4A882]">
                            {ref.source}
                          </span>
                        )}
                        {ref.persona_name && (
                          <span className="rounded-md bg-[#1C1C1C] px-2 py-0.5 text-[10px] text-[#666462]">
                            {locale === "zh" ? "引用者" : "Cited by"}: {ref.persona_name}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </AnimatedSection>
        )}

        {/* ════════════════════════════════════════════════════════════
            MAX FEATURE CTAs — Scenario Simulation + Round Table Debate
        ════════════════════════════════════════════════════════════ */}
        {(onViewSimulation || onViewDebate) && (
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
            {report.scenario_simulation && onViewSimulation && (
              <button
                onClick={onViewSimulation}
                className="group inline-flex w-full sm:w-auto items-center gap-3 rounded-xl border border-[#C4A882]/30 bg-[#C4A882]/5 px-6 py-4 transition-all duration-200 hover:border-[#C4A882]/50 hover:bg-[#C4A882]/10"
              >
                <TrendingUp className="h-5 w-5 text-[#C4A882]" />
                <div className="text-left flex-1">
                  <div className="text-sm font-semibold text-[#EAEAE8]">
                    {t("scenarioSimulation")}
                  </div>
                  <div className="text-xs text-[#9B9594]">
                    {locale === "zh" ? "模拟真实场景中角色如何相互影响" : "See how personas influence each other"}
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-[#C4A882] transition-transform group-hover:translate-x-1" />
              </button>
            )}
            {report.round_table_debate && onViewDebate && (
              <button
                onClick={onViewDebate}
                className="group inline-flex w-full sm:w-auto items-center gap-3 rounded-xl border border-[#C4A882]/30 bg-[#C4A882]/5 px-6 py-4 transition-all duration-200 hover:border-[#C4A882]/50 hover:bg-[#C4A882]/10"
              >
                <Users className="h-5 w-5 text-[#C4A882]" />
                <div className="text-left flex-1">
                  <div className="text-sm font-semibold text-[#EAEAE8]">
                    {t("roundTable")}
                  </div>
                  <div className="text-xs text-[#9B9594]">
                    {locale === "zh" ? "观看持不同意见的角色激烈辩论" : "Watch divergent personas debate each other"}
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-[#C4A882] transition-transform group-hover:translate-x-1" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
