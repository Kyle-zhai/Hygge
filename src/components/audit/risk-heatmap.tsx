"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import type { AuditFinding } from "@/lib/audit/types";

interface Props {
  findings: AuditFinding[];
  locale: string;
}

export function RiskHeatmap({ findings }: Props) {
  const t = useTranslations("audit");

  const grid = useMemo(() => {
    // grid[severity-1][probability-1] = count
    const cells: number[][] = Array.from({ length: 5 }, () => Array(5).fill(0));
    for (const f of findings) {
      if (f.severity == null || f.probability == null) continue;
      if (f.severity < 1 || f.severity > 5 || f.probability < 1 || f.probability > 5) continue;
      cells[f.severity - 1][f.probability - 1] += 1;
    }
    return cells;
  }, [findings]);

  const max = useMemo(() => {
    let m = 0;
    for (const row of grid) for (const v of row) if (v > m) m = v;
    return m;
  }, [grid]);

  return (
    <div className="rounded-xl border border-[color:var(--border-default)] bg-[color:var(--bg-secondary)] p-4">
      <div className="text-xs font-medium text-[color:var(--text-primary)] mb-1">{t("heatmapTitle")}</div>
      <p className="text-[11px] text-[color:var(--text-tertiary)] leading-snug mb-3">
        {t("heatmapHelp")}
      </p>

      {/* Single grid where the first column is the severity labels and
          cols 2-6 are the heatmap cells. Sharing the row tracks keeps the
          labels and cells aligned regardless of cell size. */}
      <div
        className="grid gap-0.5"
        style={{ gridTemplateColumns: "auto repeat(5, minmax(0, 1fr))" }}
      >
        {[5, 4, 3, 2, 1].map((sev) => (
          <Row key={sev} sev={sev} grid={grid} max={max} />
        ))}
        {/* X-axis labels row */}
        <div />
        {[1, 2, 3, 4, 5].map((n) => (
          <div
            key={`x-${n}`}
            className="text-center text-[10px] text-[color:var(--text-tertiary)] pt-1"
          >
            {n}
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between mt-2 text-[10px] text-[color:var(--text-tertiary)]">
        <span>{t("heatmapAxisSeverity")} ↑</span>
        <span>{t("heatmapAxisProbability")} →</span>
      </div>
    </div>
  );
}

function Row({ sev, grid, max }: { sev: number; grid: number[][]; max: number }) {
  return (
    <>
      <div className="text-[10px] text-[color:var(--text-tertiary)] flex items-center justify-end pr-1.5">
        {sev}
      </div>
      {[1, 2, 3, 4, 5].map((prob) => {
        const count = grid[sev - 1][prob - 1];
        const intensity = max === 0 ? 0 : count / max;
        const danger = (sev * prob) / 25;
        return (
          <div
            key={prob}
            className="aspect-square rounded-md flex items-center justify-center text-[11px] font-semibold"
            style={{
              backgroundColor:
                count === 0
                  ? "rgba(180, 180, 180, 0.10)"
                  : `rgba(${Math.round(180 + 75 * danger)}, ${Math.round(140 - 80 * danger)}, ${Math.round(80 - 50 * danger)}, ${0.25 + 0.65 * intensity})`,
              color: count > 0 ? "white" : "transparent",
            }}
            title={`severity ${sev} × probability ${prob} — ${count}`}
          >
            {count > 0 ? count : ""}
          </div>
        );
      })}
    </>
  );
}
