import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { PlanCard } from "@/components/pricing/plan-card";

export default async function PricingPage() {
  const t = await getTranslations("pricing");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let currentPlan = "free";
  if (user) {
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("plan")
      .eq("user_id", user.id)
      .single();
    if (sub) currentPlan = sub.plan;
  }

  const plans = [
    {
      key: "free",
      name: t("free"),
      price: "$0",
      features: [
        t("evaluationsPerMonth", { count: 1 }),
        t("personasPerEvaluation", { count: 3 }),
        t("briefReport"),
      ],
    },
    {
      key: "pro",
      name: t("pro"),
      price: "$20",
      isPopular: true,
      features: [
        t("evaluationsPerMonth", { count: 10 }),
        t("personasPerEvaluation", { count: 10 }),
        t("fullReport"),
      ],
    },
    {
      key: "max",
      name: t("max"),
      price: "$100",
      features: [
        t("evaluationsPerMonth", { count: 40 }),
        t("personasPerEvaluation", { count: 20 }),
        t("fullReportPlus"),
      ],
    },
  ];

  return (
    <div className="mx-auto max-w-4xl py-8">
      <h1 className="mb-8 text-center text-3xl font-bold">{t("title")}</h1>
      <div className="grid gap-6 md:grid-cols-3">
        {plans.map((plan) => (
          <PlanCard
            key={plan.key}
            name={plan.name}
            price={plan.price}
            perMonth={t("perMonth")}
            features={plan.features}
            isCurrent={currentPlan === plan.key}
            isPopular={plan.isPopular}
            currentPlanLabel={t("currentPlan")}
            upgradeLabel={t("upgrade")}
            popularLabel={t("mostPopular")}
          />
        ))}
      </div>
    </div>
  );
}
