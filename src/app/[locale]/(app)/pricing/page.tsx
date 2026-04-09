import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { PlanCard } from "@/components/pricing/plan-card";
import { ManageBillingButton } from "./manage-billing-button";

export default async function PricingPage() {
  const t = await getTranslations("pricing");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let currentPlan = "free";
  let hasStripeSubscription = false;
  if (user) {
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("plan, stripe_customer_id")
      .eq("user_id", user.id)
      .single();
    if (sub) {
      currentPlan = sub.plan;
      hasStripeSubscription = !!sub.stripe_customer_id;
    }
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
      <div className="mb-12 text-center">
        <h1 className="text-3xl font-semibold text-[#EAEAE8] sm:text-4xl tracking-[-0.02em]">
          {t("title")}
        </h1>
      </div>
      <div className="grid items-start gap-6 md:grid-cols-3">
        {plans.map((plan) => (
          <PlanCard
            key={plan.key}
            name={plan.name}
            planKey={plan.key}
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
      {hasStripeSubscription && (
        <div className="mt-8 text-center">
          <ManageBillingButton label={t("manageBilling")} />
        </div>
      )}
    </div>
  );
}
