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
      <div className="text-xs font-medium text-[color:var(--text-primary)] mb-3">{t("heatmapTitle")}</div>
      <div className="flex items-end gap-2">
        <div className="flex flex-col-reverse text-[10px] text-[color:var(--text-tertiary)] py-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <div key={n} className="h-7 w-3 flex items-center justify-end pr-1">
              {n}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-5 grid-rows-5 gap-0.5 flex-1">
          {/* Render top-to-bottom for severity 5 down to 1 */}
          {[5, 4, 3, 2, 1].flatMap((sev) =>
            [1, 2, 3, 4, 5].map((prob) => {
              const count = grid[sev - 1][prob - 1];
              const intensity = max === 0 ? 0 : count / max;
              const danger = (sev * prob) / 25; // 0..1
              return (
                <div
                  key={`${sev}-${prob}`}
                  className="aspect-square rounded-sm flex items-center justify-center text-[10px] font-medium"
                  style={{
                    // rgb() with comma syntax does NOT allow `/ alpha`. The
                    // previous code used `rgb(R, G, B / A)` which browsers
                    // failed to parse, falling back to transparent — the
                    // entire heatmap rendered as empty cells. Use rgba()
                    // (legacy comma form) so it parses cleanly.
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
            })
          )}
        </div>
      </div>
      <div className="grid grid-cols-5 gap-0.5 ml-5 mt-1 text-[10px] text-[color:var(--text-tertiary)]">
        {[1, 2, 3, 4, 5].map((n) => (
          <div key={n} className="text-center">
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
