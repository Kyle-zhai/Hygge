"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowRight, Check, Scale, Sparkles } from "lucide-react";

export interface CompareItem {
  evaluationId: string;
  projectId: string;
  title: string;
  mode: "product" | "topic";
  completedAt: string | null;
  createdAt: string;
  overallScore: number | null;
  marketReadiness: string | null;
  multiDimensional: Array<{
    dimension?: string;
    name?: string;
    score?: number;
    key_finding?: string;
  }>;
  personaAnalysis: {
    consensus?: Array<{ point?: string; text?: string } | string>;
    disagreements?: Array<{ point?: string; text?: string } | string>;
  } | null;
  actionItems: Array<{
    title?: string;
    description?: string;
    priority?: string;
    impact?: string;
    difficulty?: string;
  }>;
}

interface CompareViewProps {
  items: CompareItem[];
  locale: string;
}

function pointText(raw: unknown): string {
  if (typeof raw === "string") return raw;
  if (raw && typeof raw === "object") {
    const obj = raw as { point?: string; text?: string };
    return obj.point || obj.text || "";
  }
  return "";
}

function scoreColor(score: number | null): string {
  if (score === null) return "#666462";
  if (score >= 7) return "#4ADE80";
  if (score >= 5) return "#C4A882";
  return "#F87171";
}

function formatDate(iso: string | null, locale: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(locale === "zh" ? "zh-CN" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function CompareView({ items, locale }: CompareViewProps) {
  const t = useTranslations("evaluation");
  const tCommon = useTranslations("common");
  const [leftId, setLeftId] = useState<string | null>(items[0]?.evaluationId ?? null);
  const [rightId, setRightId] = useState<string | null>(items[1]?.evaluationId ?? null);

  const left = items.find((i) => i.evaluationId === leftId) ?? null;
  const right = items.find((i) => i.evaluationId === rightId) ?? null;

  const scoreDelta = useMemo(() => {
    if (left?.overallScore == null || right?.overallScore == null) return null;
    return right.overallScore - left.overallScore;
  }, [left, right]);

  if (items.length < 2) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#1C1C1C]">
            <Scale className="h-6 w-6 text-[#666462]" />
          </div>
          <h1 className="text-2xl font-semibold text-[#EAEAE8] tracking-[-0.02em]">
            {t("compareTitle")}
          </h1>
          <p className="mt-2 text-sm text-[#9B9594]">{t("compareEmpty")}</p>
          <Link
            href={`/${locale}/evaluate/new?mode=topic`}
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[#E2DDD5] px-4 py-2 text-sm font-medium text-[#0C0C0C] hover:bg-[#D4CFC7]"
          >
            {tCommon("newEvaluation")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Scale className="h-5 w-5 text-[#C4A882]" />
          <h1 className="text-2xl font-semibold text-[#EAEAE8] tracking-[-0.02em]">
            {t("compareTitle")}
          </h1>
        </div>
        <p className="text-sm text-[#9B9594]">{t("compareSubtitle")}</p>
      </div>

      {/* Slot pickers */}
      <div className="grid gap-4 md:grid-cols-2">
        <SlotPicker
          label={t("compareSlotA")}
          items={items}
          selectedId={leftId}
          otherId={rightId}
          onSelect={setLeftId}
          locale={locale}
        />
        <SlotPicker
          label={t("compareSlotB")}
          items={items}
          selectedId={rightId}
          otherId={leftId}
          onSelect={setRightId}
          locale={locale}
        />
      </div>

      {left && right && (
        <div className="space-y-5">
          {/* Header card */}
          <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr] items-center">
            <SlotHeader item={left} locale={locale} t={t} />
            <div className="hidden md:flex items-center justify-center">
              <ArrowRight className="h-5 w-5 text-[#666462]" />
            </div>
            <SlotHeader item={right} locale={locale} t={t} />
          </div>

          {/* Overall score delta */}
          {left.overallScore != null && right.overallScore != null && (
            <div className="rounded-xl border border-[#2A2A2A] bg-[#141414] p-5">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#666462]">
                {t("overallScore")}
              </p>
              <div className="flex items-end justify-between gap-6">
                <div>
                  <div
                    className="text-4xl font-semibold tracking-[-0.02em]"
                    style={{ color: scoreColor(left.overallScore) }}
                  >
                    {left.overallScore.toFixed(1)}
                  </div>
                  <p className="mt-1 text-xs text-[#666462] truncate max-w-[240px]">{left.title}</p>
                </div>
                {scoreDelta !== null && (
                  <div className="text-center">
                    <div
                      className="text-lg font-medium"
                      style={{
                        color:
                          scoreDelta > 0 ? "#4ADE80" : scoreDelta < 0 ? "#F87171" : "#9B9594",
                      }}
                    >
                      {scoreDelta > 0 ? "+" : ""}
                      {scoreDelta.toFixed(1)}
                    </div>
                    <p className="text-[10px] uppercase text-[#666462]">Δ</p>
                  </div>
                )}
                <div className="text-right">
                  <div
                    className="text-4xl font-semibold tracking-[-0.02em]"
                    style={{ color: scoreColor(right.overallScore) }}
                  >
                    {right.overallScore.toFixed(1)}
                  </div>
                  <p className="mt-1 text-xs text-[#666462] truncate max-w-[240px] ml-auto">{right.title}</p>
                </div>
              </div>
            </div>
          )}

          {/* Dimensions diff */}
          {left.multiDimensional.length > 0 && right.multiDimensional.length > 0 && (
            <DimensionsDiff left={left} right={right} t={t} />
          )}

          {/* Consensus + disagreements side-by-side */}
          <div className="grid gap-4 md:grid-cols-2">
            <PointsPanel
              title={t("consensus")}
              leftPoints={(left.personaAnalysis?.consensus ?? []).map(pointText).filter(Boolean)}
              rightPoints={(right.personaAnalysis?.consensus ?? []).map(pointText).filter(Boolean)}
              accent="#4ADE80"
              leftLabel={left.title}
              rightLabel={right.title}
            />
            <PointsPanel
              title={t("disagreements")}
              leftPoints={(left.personaAnalysis?.disagreements ?? []).map(pointText).filter(Boolean)}
              rightPoints={(right.personaAnalysis?.disagreements ?? []).map(pointText).filter(Boolean)}
              accent="#F87171"
              leftLabel={left.title}
              rightLabel={right.title}
            />
          </div>

          {/* Action items side-by-side */}
          <div className="grid gap-4 md:grid-cols-2">
            <ActionItemsPanel item={left} t={t} />
            <ActionItemsPanel item={right} t={t} />
          </div>
        </div>
      )}
    </div>
  );
}

function SlotPicker({
  label,
  items,
  selectedId,
  otherId,
  onSelect,
  locale,
}: {
  label: string;
  items: CompareItem[];
  selectedId: string | null;
  otherId: string | null;
  onSelect: (id: string) => void;
  locale: string;
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#666462]">{label}</p>
      <div className="relative">
        <select
          value={selectedId ?? ""}
          onChange={(e) => onSelect(e.target.value)}
          className="w-full appearance-none rounded-lg border border-[#2A2A2A] bg-[#141414] px-3 py-2.5 text-sm text-[#EAEAE8] focus:outline-none focus:border-[#3A3A3A]"
        >
          {items.map((item) => (
            <option key={item.evaluationId} value={item.evaluationId} disabled={item.evaluationId === otherId}>
              {item.title} · {formatDate(item.completedAt || item.createdAt, locale)}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function SlotHeader({
  item,
  locale,
  t,
}: {
  item: CompareItem;
  locale: string;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <div className="rounded-xl border border-[#2A2A2A] bg-[#141414] p-4">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[10px] font-semibold uppercase text-[#666462]">
          {item.mode === "product" ? t("modeProduct") : t("modeTopic")}
        </span>
        <span className="text-[10px] text-[#666462]">·</span>
        <span className="text-[10px] text-[#666462]">
          {formatDate(item.completedAt || item.createdAt, locale)}
        </span>
      </div>
      <p className="text-sm font-medium text-[#EAEAE8] line-clamp-2">{item.title}</p>
    </div>
  );
}

function DimensionsDiff({
  left,
  right,
  t,
}: {
  left: CompareItem;
  right: CompareItem;
  t: ReturnType<typeof useTranslations>;
}) {
  const dims = new Set<string>();
  for (const d of left.multiDimensional) {
    const key = (d.dimension || d.name || "").toString();
    if (key) dims.add(key);
  }
  for (const d of right.multiDimensional) {
    const key = (d.dimension || d.name || "").toString();
    if (key) dims.add(key);
  }
  if (dims.size === 0) return null;

  function getScore(item: CompareItem, key: string): number | null {
    const match = item.multiDimensional.find(
      (d) => (d.dimension || d.name || "").toString() === key,
    );
    return typeof match?.score === "number" ? match.score : null;
  }

  return (
    <div className="rounded-xl border border-[#2A2A2A] bg-[#141414] p-5">
      <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-[#666462]">
        {t("dimensionAnalysis")}
      </p>
      <div className="space-y-3">
        {Array.from(dims).map((key) => {
          const a = getScore(left, key);
          const b = getScore(right, key);
          const delta = a != null && b != null ? b - a : null;
          return (
            <div key={key} className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
              <div className="text-right">
                <span
                  className="text-base font-medium tabular-nums"
                  style={{ color: scoreColor(a) }}
                >
                  {a != null ? a.toFixed(1) : "—"}
                </span>
              </div>
              <div className="text-center min-w-[100px]">
                <p className="text-xs text-[#9B9594]">{key}</p>
                {delta !== null && (
                  <p
                    className="text-[10px] tabular-nums"
                    style={{
                      color: delta > 0 ? "#4ADE80" : delta < 0 ? "#F87171" : "#666462",
                    }}
                  >
                    {delta > 0 ? "+" : ""}
                    {delta.toFixed(1)}
                  </p>
                )}
              </div>
              <div className="text-left">
                <span
                  className="text-base font-medium tabular-nums"
                  style={{ color: scoreColor(b) }}
                >
                  {b != null ? b.toFixed(1) : "—"}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PointsPanel({
  title,
  leftPoints,
  rightPoints,
  accent,
  leftLabel,
  rightLabel,
}: {
  title: string;
  leftPoints: string[];
  rightPoints: string[];
  accent: string;
  leftLabel: string;
  rightLabel: string;
}) {
  const overlap = leftPoints.filter((p) =>
    rightPoints.some((q) => q.toLowerCase().trim() === p.toLowerCase().trim()),
  );
  const leftUnique = leftPoints.filter(
    (p) => !rightPoints.some((q) => q.toLowerCase().trim() === p.toLowerCase().trim()),
  );
  const rightUnique = rightPoints.filter(
    (p) => !leftPoints.some((q) => q.toLowerCase().trim() === p.toLowerCase().trim()),
  );

  return (
    <div className="rounded-xl border border-[#2A2A2A] bg-[#141414] p-5">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#666462]">{title}</p>
      <div className="space-y-3">
        {overlap.length > 0 && (
          <div>
            <p className="mb-1.5 text-[10px] uppercase text-[#9B9594]">Shared</p>
            <ul className="space-y-1.5">
              {overlap.slice(0, 3).map((p, i) => (
                <li key={i} className="flex gap-2 text-xs text-[#EAEAE8]">
                  <Check className="h-3 w-3 mt-0.5 shrink-0" style={{ color: accent }} />
                  <span className="line-clamp-2">{p}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {leftUnique.length > 0 && (
          <div>
            <p className="mb-1.5 text-[10px] uppercase text-[#9B9594] truncate">A · {leftLabel}</p>
            <ul className="space-y-1.5">
              {leftUnique.slice(0, 3).map((p, i) => (
                <li key={i} className="flex gap-2 text-xs text-[#9B9594]">
                  <span className="text-[#666462]">·</span>
                  <span className="line-clamp-2">{p}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {rightUnique.length > 0 && (
          <div>
            <p className="mb-1.5 text-[10px] uppercase text-[#9B9594] truncate">B · {rightLabel}</p>
            <ul className="space-y-1.5">
              {rightUnique.slice(0, 3).map((p, i) => (
                <li key={i} className="flex gap-2 text-xs text-[#9B9594]">
                  <span className="text-[#666462]">·</span>
                  <span className="line-clamp-2">{p}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {overlap.length === 0 && leftUnique.length === 0 && rightUnique.length === 0 && (
          <p className="text-xs text-[#666462]">—</p>
        )}
      </div>
    </div>
  );
}

function ActionItemsPanel({
  item,
  t,
}: {
  item: CompareItem;
  t: ReturnType<typeof useTranslations>;
}) {
  const items = item.actionItems.slice(0, 4);
  return (
    <div className="rounded-xl border border-[#2A2A2A] bg-[#141414] p-5">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#666462] truncate">
        {t("actionItems")} · {item.title}
      </p>
      {items.length === 0 ? (
        <p className="text-xs text-[#666462]">—</p>
      ) : (
        <ul className="space-y-2">
          {items.map((a, i) => (
            <li key={i} className="flex gap-2 text-xs">
              <Sparkles className="h-3 w-3 mt-0.5 shrink-0 text-[#C4A882]" />
              <div className="min-w-0">
                <p className="text-[#EAEAE8] line-clamp-2">{a.title || a.description || "—"}</p>
                {a.priority && (
                  <p className="mt-0.5 text-[10px] uppercase text-[#666462]">{a.priority}</p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
