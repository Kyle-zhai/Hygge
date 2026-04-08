import { getTranslations } from "next-intl/server";

interface UsageBarProps {
  used: number;
  limit: number;
  plan: string;
}

export async function UsageBar({ used, limit, plan }: UsageBarProps) {
  const t = await getTranslations("dashboard");
  const percentage = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          {t("evaluationsUsed", { used, limit })}
        </span>
        <span className="font-medium">{t("plan", { plan: plan.toUpperCase() })}</span>
      </div>
      <div className="mt-2 h-2 rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
