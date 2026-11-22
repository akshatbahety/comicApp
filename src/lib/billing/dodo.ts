import "server-only";
import DodoPayments from "dodopayments";
import type { Subscription } from "dodopayments/resources/subscriptions";
import { createAdminSupabase } from "@/lib/supabase/admin";

/**
 * Dodo Payments: the $10/month Panelforge plan (F-019). Dodo is the source of
 * truth for a subscription; we mirror it into `public.subscriptions`, which
 * `reserve_image` reads before every image is drawn.
 */

export class BillingNotConfiguredError extends Error {
  constructor() {
    super("Payments aren't set up yet. Please try again later.");
  }
}

export function billingConfigured() {
  return Boolean(
    process.env.DODO_PAYMENTS_API_KEY && process.env.DODO_PRODUCT_ID && process.env.SUPABASE_SECRET_KEY
  );
}

export function dodo() {
  if (!billingConfigured()) throw new BillingNotConfiguredError();
  return new DodoPayments({
    bearerToken: process.env.DODO_PAYMENTS_API_KEY,
    webhookKey: process.env.DODO_PAYMENTS_WEBHOOK_KEY ?? null,
    environment: process.env.DODO_PAYMENTS_ENVIRONMENT === "live_mode" ? "live_mode" : "test_mode",
  });
}

export const productId = () => process.env.DODO_PRODUCT_ID!;

/**
 * Fetches the subscription from Dodo and writes it to Supabase. The owner is the
 * `user_id` we put in checkout metadata, else the Panelforge account with the
 * same email. Returns who it was saved for and Dodo's status, or null if none matched.
 *
 * `expectedUserId` (the return-page sync) refuses to attach someone else's subscription.
 */
export async function syncSubscription(
  subscriptionId: string,
  expectedUserId?: string
): Promise<{ userId: string; status: string } | null> {
  const sub = await dodo().subscriptions.retrieve(subscriptionId);
  if (sub.product_id !== productId()) return null;

  const admin = createAdminSupabase();
  let userId = typeof sub.metadata?.user_id === "string" ? sub.metadata.user_id : null;
  if (!userId && sub.customer?.email) {
    const { data } = await admin.rpc("user_id_by_email", { p_email: sub.customer.email });
    userId = (data as string | null) ?? null;
  }
  if (!userId || (expectedUserId && userId !== expectedUserId)) return null;

  // One row per user: an event about an old, ended subscription must not
  // overwrite a newer one that still works.
  const { data: existing } = await admin
    .from("subscriptions")
    .select("dodo_subscription_id, status")
    .eq("user_id", userId)
    .maybeSingle();
  const working = (s: string) => s === "active" || s === "past_due";
  if (
    existing?.dodo_subscription_id &&
    existing.dodo_subscription_id !== sub.subscription_id &&
    working(existing.status) &&
    !working(sub.status)
  )
    return { userId, status: sub.status };

  const { error } = await admin.from("subscriptions").upsert(toRow(userId, sub), { onConflict: "user_id" });
  if (error) throw new Error(`Saving subscription failed: ${error.message}`);
  return { userId, status: sub.status };
}

function toRow(userId: string, sub: Subscription) {
  return {
    user_id: userId,
    status: sub.status,
    dodo_subscription_id: sub.subscription_id,
    dodo_customer_id: sub.customer?.customer_id ?? null,
    product_id: sub.product_id,
    period_start: sub.previous_billing_date ?? null,
    period_end: sub.next_billing_date ?? null,
    cancel_at_period_end: sub.cancel_at_next_billing_date ?? false,
    updated_at: new Date().toISOString(),
  };
}
