import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe/client";
import { getPlanByPriceId, PLANS } from "@/lib/stripe/plans";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

function getAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "No signature" }, { status: 400 });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: any) {
    console.error("Webhook signature verification failed:", err.message);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const supabase = getAdminClient();

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const userId = session.metadata?.user_id;
      const customerId = session.customer as string;
      const subscriptionId = session.subscription as string;

      if (!userId) break;

      const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId);
      const item = stripeSubscription.items.data[0];
      const priceId = item?.price.id;
      const plan = getPlanByPriceId(priceId);

      if (plan && item) {
        await supabase
          .from("subscriptions")
          .update({
            plan: plan.name,
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            evaluations_limit: plan.evaluationsLimit,
            evaluations_used: 0,
            current_period_start: new Date(item.current_period_start * 1000).toISOString(),
            current_period_end: new Date(item.current_period_end * 1000).toISOString(),
          })
          .eq("user_id", userId);
      }
      break;
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object;
      const subItem = subscription.items.data[0];
      const priceId = subItem?.price.id;
      const plan = getPlanByPriceId(priceId);

      if (plan && subItem) {
        const newPeriodStart = new Date(subItem.current_period_start * 1000).toISOString();

        // Check if this is a period renewal (new billing cycle)
        const { data: existing } = await supabase
          .from("subscriptions")
          .select("current_period_start")
          .eq("stripe_subscription_id", subscription.id)
          .single();

        const isRenewal = existing && existing.current_period_start !== newPeriodStart;

        const updateData: Record<string, any> = {
          plan: plan.name,
          evaluations_limit: plan.evaluationsLimit,
          current_period_start: newPeriodStart,
          current_period_end: new Date(subItem.current_period_end * 1000).toISOString(),
        };

        if (isRenewal) {
          updateData.evaluations_used = 0;
        }

        await supabase
          .from("subscriptions")
          .update(updateData)
          .eq("stripe_subscription_id", subscription.id);
      }
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object;

      await supabase
        .from("subscriptions")
        .update({
          plan: "free",
          stripe_subscription_id: null,
          evaluations_limit: PLANS.free.evaluationsLimit,
        })
        .eq("stripe_subscription_id", subscription.id);
      break;
    }
  }

  return NextResponse.json({ received: true });
}
