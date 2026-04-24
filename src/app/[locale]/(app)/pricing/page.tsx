import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { PricingComparison } from "@/components/pricing/pricing-comparison";
import { ManageBillingButton } from "./manage-billing-button";
import { PricingBackButton } from "./back-button";

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

  return (
    <div className="min-h-screen bg-[color:var(--bg-primary)]">
      {/* Back button */}
      <div className="sticky top-0 z-10 border-b border-[color:var(--bg-tertiary)] bg-[rgb(var(--bg-primary-rgb)/0.90)] backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-5xl items-center px-4">
          <PricingBackButton />
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-14 text-center">
          <h1 className="text-3xl font-semibold text-[color:var(--text-primary)] sm:text-4xl tracking-[-0.02em] leading-tight max-w-2xl mx-auto">
            {t("title")}
          </h1>
          <p className="mt-3 text-[color:var(--text-secondary)] text-base">
            {t("subtitle")}
          </p>
        </div>

        <PricingComparison currentPlan={currentPlan} />

        {hasStripeSubscription && (
          <div className="mt-10 text-center">
            <ManageBillingButton label={t("manageBilling")} />
          </div>
        )}
      </div>
    </div>
  );
}
