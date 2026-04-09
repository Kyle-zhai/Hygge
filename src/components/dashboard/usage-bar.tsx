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
    <div className="rounded-xl border border-[#2A2A2A] bg-[#141414] p-5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-[#9B9594]">
          {t("evaluationsUsed", { used, limit })}
        </span>
        <span className="font-semibold text-[#E2DDD5]">
          {t("plan", { plan: plan.toUpperCase() })}
        </span>
      </div>
      <div className="mt-3 h-2 rounded-full bg-[#1C1C1C]">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${percentage}%`,
            background: percentage > 80
              ? "linear-gradient(90deg, #FBBF24, #F87171)"
              : "linear-gradient(90deg, #E2DDD5, #C4A882)",
          }}
        />
      </div>
    </div>
  );
}
