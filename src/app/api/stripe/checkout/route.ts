import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe/client";
import { PLANS } from "@/lib/stripe/plans";
import { enforceRateLimit } from "@/lib/rate-limit";

type StripeCheckoutSessionCreateParams = NonNullable<
  Parameters<NonNullable<typeof stripe>["checkout"]["sessions"]["create"]>[0]
>;

export const maxDuration = 10;

const TRIAL_DAYS = Number(process.env.STRIPE_TRIAL_DAYS ?? 0);

export async function POST(request: Request) {
  if (!stripe) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limitResponse = await enforceRateLimit("personas", user.id);
  if (limitResponse) return limitResponse;

  const { plan } = await request.json();

  if (!plan || !PLANS[plan] || !PLANS[plan].stripePriceId) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .single();

  const sessionParams: StripeCheckoutSessionCreateParams = {
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [{ price: PLANS[plan].stripePriceId, quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/en/pricing?success=true`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/en/pricing?canceled=true`,
    metadata: { user_id: user.id, plan },
    allow_promotion_codes: true,
  };

  if (TRIAL_DAYS > 0) {
    sessionParams.subscription_data = { trial_period_days: TRIAL_DAYS };
  }

  if (subscription?.stripe_customer_id) {
    sessionParams.customer = subscription.stripe_customer_id;
  } else {
    sessionParams.customer_email = user.email;
  }

  const session = await stripe.checkout.sessions.create(sessionParams);

  return NextResponse.json({ url: session.url });
}
