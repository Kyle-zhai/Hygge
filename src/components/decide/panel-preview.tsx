"use client";

// Static "panel preview" shown on /decide/new before the user even
// submits — the wedge moment that signals "this isn't ChatGPT, it's a
// panel of N personas × 6 mechanisms." Pure presentational, no API
// calls. The real personas + mechanisms get picked by the routing agent
// once intake runs.

import { useLocale, useTranslations } from "next-intl";
import {
  ALL_MECHANISMS_LIST,
  MECHANISM_ICONS,
  MECHANISM_LABELS_EN,
  MECHANISM_LABELS_ZH,
} from "@/lib/decide/types";

export function PanelPreview() {
  const t = useTranslations("decide");
  const locale = useLocale();
  const labels = locale === "zh" ? MECHANISM_LABELS_ZH : MECHANISM_LABELS_EN;

  return (
    <div className="rounded-lg border bg-muted/30 p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        {t("panelPreviewLabel")}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {ALL_MECHANISMS_LIST.map((kind) => (
          <span
            key={kind}
            className="inline-flex items-center gap-1 rounded-md border bg-background px-2 py-1 text-xs"
          >
            <span aria-hidden="true">{MECHANISM_ICONS[kind]}</span>
            {labels[kind]}
          </span>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        · {t("panelPreviewMechanisms")} · {t("panelPreviewPersonas")}
      </p>
    </div>
  );
}
