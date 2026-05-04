// supabase/functions/stripe-webhook/index.ts
// Handles all Stripe events — upgrades, cancellations, renewals, failures
// Deploy: supabase functions deploy stripe-webhook

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@13.3.0?target=deno";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

// Admin client — bypasses RLS to update user plans
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// Map Stripe price IDs to plan names
const PRICE_TO_PLAN: Record<string, string> = {
  [Deno.env.get("STRIPE_PRO_MONTHLY_PRICE_ID")   || ""]: "pro",
  [Deno.env.get("STRIPE_PRO_ANNUAL_PRICE_ID")    || ""]: "pro",
  [Deno.env.get("STRIPE_ELITE_MONTHLY_PRICE_ID") || ""]: "elite",
  [Deno.env.get("STRIPE_ELITE_ANNUAL_PRICE_ID")  || ""]: "elite",
};

async function updateUserPlan(userId: string, plan: string, subscriptionId: string, status: string, expiresAt?: number) {
  const { error } = await supabase.from("profiles").update({
    plan,
    stripe_subscription_id: subscriptionId,
    subscription_status: status,
    plan_expires_at: expiresAt ? new Date(expiresAt * 1000).toISOString() : null,
    updated_at: new Date().toISOString(),
  }).eq("id", userId);

  if (error) console.error("Failed to update user plan:", error);
  else console.log(`Updated user ${userId} → plan: ${plan}, status: ${status}`);
}

serve(async (req) => {
  const signature = req.headers.get("stripe-signature");
  const body = await req.text();

  // Verify webhook signature
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature!, Deno.env.get("STRIPE_WEBHOOK_SECRET")!);
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  // Log event to DB (idempotency)
  const { error: logError } = await supabase.from("stripe_events").insert({
    stripe_event_id: event.id,
    type: event.type,
    data: event.data,
  });
  if (logError?.code === "23505") {
    console.log("Duplicate event, skipping:", event.id);
    return new Response("Already processed", { status: 200 });
  }

  console.log("Processing Stripe event:", event.type);

  try {
    switch (event.type) {

      // ── Subscription created / updated ──
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const userId = sub.metadata.supabase_user_id;
        const priceId = sub.items.data[0]?.price.id;
        const plan = PRICE_TO_PLAN[priceId] || "free";
        const status = sub.status; // active, trialing, past_due, canceled
        const activeStatuses = ["active", "trialing"];
        await updateUserPlan(userId, activeStatuses.includes(status) ? plan : "free", sub.id, status, sub.current_period_end);
        break;
      }

      // ── Subscription cancelled ──
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const userId = sub.metadata.supabase_user_id;
        await updateUserPlan(userId, "free", sub.id, "canceled");
        break;
      }

      // ── Payment succeeded ──
      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        const sub = await stripe.subscriptions.retrieve(invoice.subscription as string);
        const userId = sub.metadata.supabase_user_id;
        const priceId = sub.items.data[0]?.price.id;
        const plan = PRICE_TO_PLAN[priceId] || "free";
        await updateUserPlan(userId, plan, sub.id, "active", sub.current_period_end);
        console.log(`Payment succeeded for user ${userId}, plan: ${plan}`);
        break;
      }

      // ── Payment failed ──
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const sub = await stripe.subscriptions.retrieve(invoice.subscription as string);
        const userId = sub.metadata.supabase_user_id;
        await supabase.from("profiles").update({ subscription_status: "past_due" }).eq("id", userId);
        console.warn(`Payment failed for user ${userId} — marking past_due`);
        break;
      }

      // ── Checkout completed ──
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.CheckoutSession;
        const userId = session.metadata?.supabase_user_id;
        const customerId = session.customer as string;
        if (userId && customerId) {
          await supabase.from("profiles").update({ stripe_customer_id: customerId }).eq("id", userId);
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    // Mark event as processed
    await supabase.from("stripe_events").update({ processed: true }).eq("stripe_event_id", event.id);

  } catch (err) {
    console.error("Error processing event:", err);
    return new Response("Processing error", { status: 500 });
  }

  return new Response("OK", { status: 200 });
});
