# Plan 4: Stripe Payments — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate Stripe subscriptions so users can upgrade from Free to Pro ($20/mo) or Max ($100/mo), with webhook-driven subscription lifecycle management.

**Architecture:** Stripe Checkout Sessions for payment, Stripe Customer Portal for management, Stripe Webhooks for lifecycle events (created, updated, deleted). The `subscriptions` table is the source of truth — webhooks keep it in sync with Stripe. No client-side Stripe.js needed (Checkout is hosted by Stripe).

**Tech Stack:** stripe@22 (server-side SDK), Next.js API routes, Supabase (subscriptions table)

---

## File Structure

```
src/
├── lib/
│   └── stripe/
│       ├── client.ts                 # Stripe SDK instance
│       └── plans.ts                  # Plan config (price IDs, limits)
├── app/
│   └── api/
│       └── stripe/
│           ├── checkout/route.ts     # POST: create Checkout Session
│           ├── portal/route.ts       # POST: create Customer Portal session
│           └── webhook/route.ts      # POST: handle Stripe webhook events
├── components/
│   └── pricing/
│       └── plan-card.tsx             # Modify: add onClick handler for upgrade
├── app/[locale]/(app)/
│   └── pricing/page.tsx              # Modify: wire up upgrade buttons
messages/
├── zh.json                           # Modify: add billing translation keys
└── en.json                           # Modify: add billing translation keys
```

---

### Task 1: Stripe Client + Plan Config

**Files:**
- Create: `src/lib/stripe/client.ts`
- Create: `src/lib/stripe/plans.ts`

- [ ] **Step 1: Create `src/lib/stripe/client.ts`**

```ts
import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  typescript: true,
});
```

- [ ] **Step 2: Create `src/lib/stripe/plans.ts`**

This maps our plan names to Stripe Price IDs and defines limits. Price IDs come from env vars so they work across test/production.

```ts
export interface PlanConfig {
  name: "free" | "pro" | "max";
  stripePriceId: string | null;
  price: number;
  evaluationsLimit: number;
  maxPersonas: number;
}

export const PLANS: Record<string, PlanConfig> = {
  free: {
    name: "free",
    stripePriceId: null,
    price: 0,
    evaluationsLimit: 1,
    maxPersonas: 3,
  },
  pro: {
    name: "pro",
    stripePriceId: process.env.STRIPE_PRO_PRICE_ID || "",
    price: 2000, // cents
    evaluationsLimit: 10,
    maxPersonas: 10,
  },
  max: {
    name: "max",
    stripePriceId: process.env.STRIPE_MAX_PRICE_ID || "",
    price: 10000, // cents
    evaluationsLimit: 40,
    maxPersonas: 20,
  },
};

export function getPlanByPriceId(priceId: string): PlanConfig | undefined {
  return Object.values(PLANS).find((p) => p.stripePriceId === priceId);
}
```

- [ ] **Step 3: Verify build**

Run:
```bash
cd /Users/pinan/Desktop/persona && npm run build
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/stripe/
git commit -m "feat: add Stripe client and plan configuration"
```

---

### Task 2: Checkout Session API Route

**Files:**
- Create: `src/app/api/stripe/checkout/route.ts`

**Context:**
- When a user clicks "Upgrade" on the pricing page, we create a Stripe Checkout Session.
- If the user already has a `stripe_customer_id`, we reuse it. Otherwise Stripe creates a new customer.
- After checkout, Stripe redirects to our success URL which goes back to pricing page.
- The webhook (Task 4) handles the actual subscription creation/update in our DB.

- [ ] **Step 1: Create `src/app/api/stripe/checkout/route.ts`**

```ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe/client";
import { PLANS } from "@/lib/stripe/plans";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { plan } = await request.json();

  if (!plan || !PLANS[plan] || !PLANS[plan].stripePriceId) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .single();

  const sessionParams: Record<string, any> = {
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [{ price: PLANS[plan].stripePriceId, quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/zh/pricing?success=true`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/zh/pricing?canceled=true`,
    metadata: { user_id: user.id, plan },
  };

  if (subscription?.stripe_customer_id) {
    sessionParams.customer = subscription.stripe_customer_id;
  } else {
    sessionParams.customer_email = user.email;
  }

  const session = await stripe.checkout.sessions.create(sessionParams);

  return NextResponse.json({ url: session.url });
}
```

- [ ] **Step 2: Verify build**

Run:
```bash
cd /Users/pinan/Desktop/persona && npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/stripe/checkout/route.ts
git commit -m "feat: add Stripe Checkout Session API route"
```

---

### Task 3: Customer Portal API Route

**Files:**
- Create: `src/app/api/stripe/portal/route.ts`

**Context:**
- Stripe Customer Portal lets users manage their subscription (change plan, cancel, update payment method).
- Only works if user already has a `stripe_customer_id`.

- [ ] **Step 1: Create `src/app/api/stripe/portal/route.ts`**

```ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe/client";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .single();

  if (!subscription?.stripe_customer_id) {
    return NextResponse.json({ error: "No active subscription" }, { status: 400 });
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: subscription.stripe_customer_id,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/zh/pricing`,
  });

  return NextResponse.json({ url: session.url });
}
```

- [ ] **Step 2: Verify build**

Run:
```bash
cd /Users/pinan/Desktop/persona && npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/stripe/portal/route.ts
git commit -m "feat: add Stripe Customer Portal API route"
```

---

### Task 4: Webhook Handler

**Files:**
- Create: `src/app/api/stripe/webhook/route.ts`

**Context:**
- Stripe sends POST requests to `/api/stripe/webhook` for subscription events.
- We handle: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`.
- The webhook must verify the Stripe signature using `STRIPE_WEBHOOK_SECRET`.
- Next.js API routes auto-parse the body as JSON, but Stripe needs the raw body for signature verification. We must use `request.text()` and parse manually.
- Supabase admin client (service role) is needed since webhooks have no user session. Use `@supabase/supabase-js` directly with `SUPABASE_SERVICE_ROLE_KEY`.

- [ ] **Step 1: Create `src/app/api/stripe/webhook/route.ts`**

```ts
import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe/client";
import { getPlanByPriceId, PLANS } from "@/lib/stripe/plans";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Admin client for webhook (no user session)
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

      // Fetch the subscription to get the price ID
      const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId);
      const priceId = stripeSubscription.items.data[0]?.price.id;
      const plan = getPlanByPriceId(priceId);

      if (plan) {
        await supabase
          .from("subscriptions")
          .update({
            plan: plan.name,
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            evaluations_limit: plan.evaluationsLimit,
            evaluations_used: 0,
            current_period_start: new Date(stripeSubscription.current_period_start * 1000).toISOString(),
            current_period_end: new Date(stripeSubscription.current_period_end * 1000).toISOString(),
          })
          .eq("user_id", userId);
      }
      break;
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object;
      const priceId = subscription.items.data[0]?.price.id;
      const plan = getPlanByPriceId(priceId);

      if (plan) {
        await supabase
          .from("subscriptions")
          .update({
            plan: plan.name,
            evaluations_limit: plan.evaluationsLimit,
            current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
          })
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
```

- [ ] **Step 2: Verify build**

Run:
```bash
cd /Users/pinan/Desktop/persona && npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/stripe/webhook/route.ts
git commit -m "feat: add Stripe webhook handler for subscription lifecycle"
```

---

### Task 5: Wire Up Pricing Page

**Files:**
- Modify: `src/components/pricing/plan-card.tsx`
- Modify: `src/app/[locale]/(app)/pricing/page.tsx`
- Modify: `messages/zh.json`
- Modify: `messages/en.json`

**Context:**
- The PlanCard currently has a disabled upgrade button. We need to make it call the checkout API.
- For users on a paid plan, show a "Manage Subscription" button that opens the Stripe Customer Portal.
- Add `manageBilling` translation key.

- [ ] **Step 1: Add billing translation keys to `messages/zh.json`**

Add under the `pricing` namespace:

```json
"manageBilling": "管理订阅"
```

- [ ] **Step 2: Add billing translation keys to `messages/en.json`**

Add under the `pricing` namespace:

```json
"manageBilling": "Manage Billing"
```

- [ ] **Step 3: Update `src/components/pricing/plan-card.tsx`**

Replace the entire file with:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, Loader2 } from "lucide-react";

interface PlanCardProps {
  name: string;
  planKey: string;
  price: string;
  perMonth: string;
  features: string[];
  isCurrent: boolean;
  isPopular?: boolean;
  currentPlanLabel: string;
  upgradeLabel: string;
  popularLabel: string;
}

export function PlanCard({
  name,
  planKey,
  price,
  perMonth,
  features,
  isCurrent,
  isPopular,
  currentPlanLabel,
  upgradeLabel,
  popularLabel,
}: PlanCardProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleUpgrade() {
    if (planKey === "free" || isCurrent) return;
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planKey }),
      });
      const data = await res.json();
      if (data.url) {
        router.push(data.url);
      }
    } catch {
      setLoading(false);
    }
  }

  return (
    <Card className={`relative ${isPopular ? "border-primary shadow-md" : ""}`}>
      {isPopular && (
        <Badge className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground">
          {popularLabel}
        </Badge>
      )}
      <CardHeader className="text-center">
        <CardTitle className="text-xl">{name}</CardTitle>
        <div className="mt-2">
          <span className="text-4xl font-bold">{price}</span>
          {price !== "$0" && <span className="text-muted-foreground">{perMonth}</span>}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="space-y-2">
          {features.map((feature, i) => (
            <li key={i} className="flex items-start gap-2 text-sm">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              {feature}
            </li>
          ))}
        </ul>
        <Button
          className="w-full"
          variant={isCurrent ? "outline" : "default"}
          disabled={isCurrent || planKey === "free" || loading}
          onClick={handleUpgrade}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : isCurrent ? (
            currentPlanLabel
          ) : (
            upgradeLabel
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 4: Update `src/app/[locale]/(app)/pricing/page.tsx`**

Replace the entire file with:

```tsx
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
      <h1 className="mb-8 text-center text-3xl font-bold">{t("title")}</h1>
      <div className="grid gap-6 md:grid-cols-3">
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
```

- [ ] **Step 5: Create `src/app/[locale]/(app)/pricing/manage-billing-button.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

export function ManageBillingButton({ label }: { label: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = await res.json();
      if (data.url) {
        router.push(data.url);
      }
    } catch {
      setLoading(false);
    }
  }

  return (
    <Button variant="outline" onClick={handleClick} disabled={loading}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : label}
    </Button>
  );
}
```

- [ ] **Step 6: Verify build**

Run:
```bash
cd /Users/pinan/Desktop/persona && npm run build
```

- [ ] **Step 7: Commit**

```bash
git add src/components/pricing/plan-card.tsx src/app/\\[locale\\]/\\(app\\)/pricing/ messages/zh.json messages/en.json
git commit -m "feat: wire up Stripe Checkout and Customer Portal to pricing page"
```

---

### Task 6: Subscription Period Reset

**Files:**
- Create: `src/app/api/stripe/webhook/route.ts` (already created in Task 4 — this step extends the `customer.subscription.updated` handler)

**Context:**
- When a subscription renews (new billing period), `evaluations_used` should reset to 0.
- Stripe fires `customer.subscription.updated` on renewal with a new `current_period_start`.
- We detect renewal by comparing the new `current_period_start` with what's stored in our DB.

- [ ] **Step 1: Update the `customer.subscription.updated` case in `src/app/api/stripe/webhook/route.ts`**

In the `customer.subscription.updated` case, replace:

```ts
    case "customer.subscription.updated": {
      const subscription = event.data.object;
      const priceId = subscription.items.data[0]?.price.id;
      const plan = getPlanByPriceId(priceId);

      if (plan) {
        await supabase
          .from("subscriptions")
          .update({
            plan: plan.name,
            evaluations_limit: plan.evaluationsLimit,
            current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
          })
          .eq("stripe_subscription_id", subscription.id);
      }
      break;
    }
```

With:

```ts
    case "customer.subscription.updated": {
      const subscription = event.data.object;
      const priceId = subscription.items.data[0]?.price.id;
      const plan = getPlanByPriceId(priceId);

      if (plan) {
        const newPeriodStart = new Date(subscription.current_period_start * 1000).toISOString();

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
          current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
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
```

- [ ] **Step 2: Verify build**

Run:
```bash
cd /Users/pinan/Desktop/persona && npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/stripe/webhook/route.ts
git commit -m "feat: reset evaluation usage on subscription period renewal"
```

---

### Task 7: Environment Variables Documentation

**Files:**
- Create: `.env.example`

**Context:**
- Document all required environment variables so developers know what to set up.

- [ ] **Step 1: Create `.env.example`**

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Anthropic (AI)
ANTHROPIC_API_KEY=your-anthropic-key

# Redis (Worker)
REDIS_URL=redis://localhost:6379

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRO_PRICE_ID=price_...
STRIPE_MAX_PRICE_ID=price_...
```

- [ ] **Step 2: Verify `.env.example` is NOT in `.gitignore`**

Run:
```bash
grep ".env.example" .gitignore
```

If it IS in `.gitignore`, remove it. `.env.example` should be committed (it has no secrets — only placeholders).

- [ ] **Step 3: Commit**

```bash
git add .env.example
git commit -m "docs: add .env.example with all required environment variables"
```

---

### Task 8: Final Verification + Build Check

**Files:**
- None new

- [ ] **Step 1: Run full build**

Run:
```bash
cd /Users/pinan/Desktop/persona && npm run build
```

Fix any TypeScript or build errors.

- [ ] **Step 2: Verify all routes**

Check build output includes:
- `/api/stripe/checkout`
- `/api/stripe/portal`
- `/api/stripe/webhook`

Plus all existing routes from Plan 3.

- [ ] **Step 3: Final commit (if any fixes were needed)**

```bash
cd /Users/pinan/Desktop/persona
git add -A
git commit -m "fix: resolve build issues — Plan 4 complete"
```

---

## Summary

Plan 4 delivers:
- **Stripe client + plan config** — centralized plan definitions with price IDs from env vars
- **Checkout Session API** — creates Stripe Checkout for Pro/Max upgrades
- **Customer Portal API** — lets users manage their subscription via Stripe-hosted portal
- **Webhook handler** — processes `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted` events
- **Period reset** — resets `evaluations_used` to 0 on billing cycle renewal
- **Wired pricing page** — upgrade buttons call Checkout, "Manage Billing" button opens portal
- **Environment docs** — `.env.example` with all required vars

## Required Stripe Setup (Manual)

After implementation, the developer needs to:
1. Create Stripe products/prices for Pro ($20/mo) and Max ($100/mo) in the Stripe Dashboard
2. Copy the Price IDs to `STRIPE_PRO_PRICE_ID` and `STRIPE_MAX_PRICE_ID` env vars
3. Set up a webhook endpoint in Stripe Dashboard pointing to `{APP_URL}/api/stripe/webhook`
4. Subscribe to events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`
5. Copy the webhook signing secret to `STRIPE_WEBHOOK_SECRET`
6. Configure the Customer Portal in Stripe Dashboard (enable subscription changes + cancellation)
