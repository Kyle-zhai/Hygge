"use client";

import { motion } from "framer-motion";
import {
  Layers,
  FileBarChart,
  Swords,
  Check,
  Sparkles,
} from "lucide-react";
import { fadeInUp, staggerContainer } from "@/lib/animations";

export type ShowcaseCopy = {
  sectionOverline: string;
  sectionHeading: string;
  sectionSubhead: string;
  items: {
    reportBadge: string;
    reportTitle: string;
    reportBody: string;
    reportBullets: string[];
    debateBadge: string;
    debateTitle: string;
    debateBody: string;
    debateBullets: string[];
    compareBadge: string;
    compareTitle: string;
    compareBody: string;
    compareBullets: string[];
  };
  mock: {
    reportHeading: string;
    reportConsensus: string;
    reportConsensusValue: string;
    reportDimensions: { label: string; score: number }[];
    reportSummary: string;
    reportPersonaA: string;
    reportPersonaARole: string;
    reportPersonaAQuote: string;
    reportPersonaB: string;
    reportPersonaBRole: string;
    reportPersonaBQuote: string;
    debateTopic: string;
    debateRoundLabel: string;
    debateLeft: string;
    debateLeftRole: string;
    debateLeftQuote: string;
    debateRight: string;
    debateRightRole: string;
    debateRightQuote: string;
    debateTag: string;
    compareBefore: string;
    compareAfter: string;
    compareRowLabel: string;
    compareDelta: string;
    compareRows: {
      persona: string;
      before: string;
      after: string;
      shifted: boolean;
    }[];
  };
};

export function ProductShowcase({ copy }: { copy: ShowcaseCopy }) {
  return (
    <section className="relative overflow-hidden px-4 py-28 sm:py-36">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 50% at 50% 0%, rgba(var(--atmosphere-cream-rgb),0.04), transparent 60%)",
        }}
      />

      <div className="relative z-10 mx-auto max-w-6xl">
        <motion.div
          variants={staggerContainer(0.08)}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="mb-20 text-center"
        >
          <motion.span
            variants={fadeInUp}
            className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--accent-warm)]"
          >
            {copy.sectionOverline}
          </motion.span>
          <motion.h2
            variants={fadeInUp}
            className="mx-auto mt-4 max-w-3xl text-3xl font-semibold tracking-[-0.02em] text-[color:var(--text-primary)] sm:text-[2.6rem] sm:leading-[1.08]"
          >
            {copy.sectionHeading}
          </motion.h2>
          <motion.p
            variants={fadeInUp}
            className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-[color:var(--text-secondary)]"
          >
            {copy.sectionSubhead}
          </motion.p>
        </motion.div>

        <ShowcaseRow
          iconName="report"
          badge={copy.items.reportBadge}
          title={copy.items.reportTitle}
          body={copy.items.reportBody}
          bullets={copy.items.reportBullets}
          mock={<ReportMock copy={copy.mock} />}
        />
        <div className="h-20 sm:h-28" />
        <ShowcaseRow
          iconName="debate"
          badge={copy.items.debateBadge}
          title={copy.items.debateTitle}
          body={copy.items.debateBody}
          bullets={copy.items.debateBullets}
          mock={<DebateMock copy={copy.mock} />}
          flipped
        />
        <div className="h-20 sm:h-28" />
        <ShowcaseRow
          iconName="compare"
          badge={copy.items.compareBadge}
          title={copy.items.compareTitle}
          body={copy.items.compareBody}
          bullets={copy.items.compareBullets}
          mock={<CompareMock copy={copy.mock} />}
        />
      </div>
    </section>
  );
}

function ShowcaseRow({
  iconName,
  badge,
  title,
  body,
  bullets,
  mock,
  flipped,
}: {
  iconName: "report" | "debate" | "compare";
  badge: string;
  title: string;
  body: string;
  bullets: string[];
  mock: React.ReactNode;
  flipped?: boolean;
}) {
  const Icon =
    iconName === "report" ? FileBarChart : iconName === "debate" ? Swords : Layers;

  return (
    <motion.div
      variants={staggerContainer(0.08)}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-80px" }}
      className={`grid items-center gap-10 lg:grid-cols-[1fr_1.15fr] lg:gap-16 ${
        flipped ? "lg:[&>*:first-child]:order-2" : ""
      }`}
    >
      <motion.div variants={fadeInUp} className="max-w-lg">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--border-default)] bg-[color:var(--bg-secondary)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[color:var(--text-secondary)]">
          <Icon className="h-3.5 w-3.5 text-[color:var(--accent-warm)]" />
          {badge}
        </span>
        <h3 className="mt-5 text-2xl font-semibold leading-[1.15] tracking-[-0.02em] text-[color:var(--text-primary)] sm:text-[1.85rem]">
          {title}
        </h3>
        <p className="mt-4 text-base leading-relaxed text-[color:var(--text-secondary)]">
          {body}
        </p>
        <ul className="mt-6 space-y-2.5">
          {bullets.map((bullet) => (
            <li
              key={bullet}
              className="flex items-start gap-2.5 text-sm text-[color:var(--text-secondary)]"
            >
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--accent-warm)]" />
              <span>{bullet}</span>
            </li>
          ))}
        </ul>
      </motion.div>

      <motion.div variants={fadeInUp} className="relative">
        <div
          className="pointer-events-none absolute -inset-8 rounded-[40px] opacity-60"
          style={{
            background:
              "radial-gradient(ellipse 60% 45% at 50% 50%, rgba(var(--atmosphere-cream-rgb),0.08), transparent 70%)",
          }}
        />
        {mock}
      </motion.div>
    </motion.div>
  );
}

function MockFrame({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-[color:var(--border-default)] bg-gradient-to-b from-[color:var(--panel-grad-top)] to-[color:var(--panel-grad-bottom)] shadow-[0_40px_80px_-40px_rgba(0,0,0,0.55),0_0_0_1px_rgba(var(--atmosphere-cream-rgb),0.04)_inset]"
    >
      <div className="flex items-center justify-between border-b border-[color:var(--border-default)] bg-[color:var(--bg-secondary)]/60 px-4 py-3">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[color:var(--border-hover)]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[color:var(--border-hover)]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[color:var(--border-hover)]" />
        </div>
        <div className="text-[11px] font-medium text-[color:var(--text-tertiary)]">
          hygge.app
        </div>
        <div className="h-2.5 w-8" />
      </div>
      <div className="p-5 sm:p-6">{children}</div>
    </div>
  );
}

function ReportMock({ copy }: { copy: ShowcaseCopy["mock"] }) {
  return (
    <MockFrame>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[color:var(--bg-tertiary)] ring-1 ring-[color:var(--border-default)]">
            <FileBarChart className="h-4 w-4 text-[color:var(--accent-warm)]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[color:var(--text-primary)]">
              {copy.reportHeading}
            </p>
            <p className="text-[11px] text-[color:var(--text-tertiary)]">
              {copy.reportConsensus}
            </p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-[color:var(--accent-warm)]/15 px-2.5 py-1 text-[11px] font-semibold text-[color:var(--accent-warm)]">
          <Sparkles className="h-3 w-3" />
          {copy.reportConsensusValue}
        </span>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2">
        {copy.reportDimensions.map((d) => (
          <div
            key={d.label}
            className="rounded-lg border border-[color:var(--border-default)] bg-[color:var(--bg-secondary)]/60 p-2.5"
          >
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-[color:var(--text-secondary)]">
                {d.label}
              </span>
              <span className="font-semibold text-[color:var(--text-primary)]">
                {d.score}
              </span>
            </div>
            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-[color:var(--bg-tertiary)]">
              <div
                className="h-full rounded-full bg-[color:var(--accent-warm)]/60"
                style={{ width: `${d.score}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 rounded-lg border border-[color:var(--border-default)] bg-[color:var(--bg-secondary)]/50 p-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[color:var(--text-tertiary)]">
          Summary
        </p>
        <p className="mt-1.5 line-clamp-3 text-[13px] leading-relaxed text-[color:var(--text-secondary)]">
          {copy.reportSummary}
        </p>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <PersonaQuoteMini
          name={copy.reportPersonaA}
          role={copy.reportPersonaARole}
          quote={copy.reportPersonaAQuote}
          stance="support"
        />
        <PersonaQuoteMini
          name={copy.reportPersonaB}
          role={copy.reportPersonaBRole}
          quote={copy.reportPersonaBQuote}
          stance="oppose"
        />
      </div>
    </MockFrame>
  );
}

function PersonaQuoteMini({
  name,
  role,
  quote,
  stance,
}: {
  name: string;
  role: string;
  quote: string;
  stance: "support" | "oppose" | "neutral";
}) {
  const stanceColor =
    stance === "support"
      ? "#4ADE80"
      : stance === "oppose"
        ? "#F87171"
        : "#C4A882";
  return (
    <div className="rounded-lg border border-[color:var(--border-default)] bg-[color:var(--bg-secondary)]/60 p-2.5">
      <div className="flex items-center gap-2">
        <div
          className="h-2 w-2 rounded-full"
          style={{ backgroundColor: stanceColor }}
        />
        <p className="text-xs font-semibold text-[color:var(--text-primary)]">
          {name}
        </p>
        <p className="text-[10px] text-[color:var(--text-tertiary)]">{role}</p>
      </div>
      <p className="mt-1.5 line-clamp-2 text-[12px] leading-snug text-[color:var(--text-secondary)]">
        &ldquo;{quote}&rdquo;
      </p>
    </div>
  );
}

function DebateMock({ copy }: { copy: ShowcaseCopy["mock"] }) {
  return (
    <MockFrame>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[color:var(--bg-tertiary)] ring-1 ring-[color:var(--border-default)]">
            <Swords className="h-4 w-4 text-[color:var(--accent-warm)]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[color:var(--text-primary)]">
              {copy.debateTopic}
            </p>
            <p className="text-[11px] text-[color:var(--text-tertiary)]">
              {copy.debateRoundLabel}
            </p>
          </div>
        </div>
        <span className="rounded-full bg-[color:var(--bg-tertiary)] px-2.5 py-1 text-[11px] font-medium text-[color:var(--text-secondary)]">
          {copy.debateTag}
        </span>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <DebateBubble
          name={copy.debateLeft}
          role={copy.debateLeftRole}
          quote={copy.debateLeftQuote}
          stance="support"
          align="left"
        />
        <DebateBubble
          name={copy.debateRight}
          role={copy.debateRightRole}
          quote={copy.debateRightQuote}
          stance="oppose"
          align="right"
        />
      </div>

      <div className="mt-4 flex items-center justify-center gap-2 text-[11px] text-[color:var(--text-tertiary)]">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[color:var(--accent-warm)] opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[color:var(--accent-warm)]" />
        </span>
        Round 2 rebuttal drafting…
      </div>
    </MockFrame>
  );
}

function DebateBubble({
  name,
  role,
  quote,
  stance,
  align,
}: {
  name: string;
  role: string;
  quote: string;
  stance: "support" | "oppose";
  align: "left" | "right";
}) {
  const stanceColor = stance === "support" ? "#4ADE80" : "#F87171";
  return (
    <div
      className={`relative rounded-xl border border-[color:var(--border-default)] bg-[color:var(--bg-secondary)]/60 p-3 ${
        align === "right" ? "sm:text-right" : ""
      }`}
    >
      <div
        className={`flex items-center gap-2 ${align === "right" ? "sm:flex-row-reverse" : ""}`}
      >
        <div
          className="h-2 w-2 rounded-full"
          style={{ backgroundColor: stanceColor }}
        />
        <p className="text-xs font-semibold text-[color:var(--text-primary)]">
          {name}
        </p>
        <p className="text-[10px] text-[color:var(--text-tertiary)]">{role}</p>
      </div>
      <p className="mt-2 text-[12px] leading-snug text-[color:var(--text-secondary)]">
        &ldquo;{quote}&rdquo;
      </p>
    </div>
  );
}

function CompareMock({ copy }: { copy: ShowcaseCopy["mock"] }) {
  return (
    <MockFrame>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[color:var(--bg-tertiary)] ring-1 ring-[color:var(--border-default)]">
            <Layers className="h-4 w-4 text-[color:var(--accent-warm)]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[color:var(--text-primary)]">
              {copy.compareRowLabel}
            </p>
            <p className="text-[11px] text-[color:var(--text-tertiary)]">
              {copy.compareDelta}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-[color:var(--text-tertiary)]">
        <span>{copy.compareBefore}</span>
        <span className="text-center text-[color:var(--accent-warm)]">→</span>
        <span className="text-right">{copy.compareAfter}</span>
      </div>

      <div className="mt-3 space-y-2">
        {copy.compareRows.map((row) => {
          const beforeColor = stanceDotColor(row.before);
          const afterColor = stanceDotColor(row.after);
          return (
            <div
              key={row.persona}
              className={`grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-lg border p-2.5 transition-colors ${
                row.shifted
                  ? "border-[color:var(--accent-warm)]/35 bg-[color:var(--accent-warm)]/5"
                  : "border-[color:var(--border-default)] bg-[color:var(--bg-secondary)]/60"
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: beforeColor }}
                />
                <span className="text-xs text-[color:var(--text-secondary)]">
                  {row.before}
                </span>
              </div>
              <span className="text-[11px] text-[color:var(--text-tertiary)]">
                {row.persona}
              </span>
              <div className="flex items-center justify-end gap-2">
                <span className="text-xs text-[color:var(--text-primary)]">
                  {row.after}
                </span>
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: afterColor }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </MockFrame>
  );
}

function stanceDotColor(label: string) {
  const lower = label.toLowerCase();
  if (
    lower.includes("support") ||
    lower.includes("for") ||
    lower.includes("赞成") ||
    lower.includes("支持")
  )
    return "#4ADE80";
  if (
    lower.includes("oppose") ||
    lower.includes("against") ||
    lower.includes("反对")
  )
    return "#F87171";
  return "#C4A882";
}

