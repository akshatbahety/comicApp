import { badRequest } from "@/lib/ai/request";
import { billingConfigured, syncSubscription } from "@/lib/billing/dodo";
import type { BillingStatus } from "@/lib/billing/status";
import { createServerSupabase, getUserId } from "@/lib/supabase/server";

type Row = {
  required: boolean;
  entitled: boolean;
  status: string | null;
  used: number;
  monthly_limit: number;
  period_end: string | null;
  cancel_at_period_end: boolean;
  has_customer: boolean;
};

async function readStatus() {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("billing_status").single<Row>();
  return { data, error };
}

/** GET /api/billing/status — the signed-in user's plan and images left this period. */
export async function GET() {
  const userId = await getUserId();
  if (!userId) return badRequest("Sign in to see your plan.", 401);

  let { data, error } = await readStatus();
  if (error || !data) {
    console.error("[billing] status failed", error);
    return badRequest("Couldn't load your plan. Try again.", 500);
  }

  // Self-heal a missed renewal webhook: once the period has passed, ask Dodo.
  if (billingConfigured() && data.status && data.status !== "comped" && data.period_end && new Date(data.period_end) < new Date()) {
    const supabase = await createServerSupabase();
    const { data: row } = await supabase.from("subscriptions").select("dodo_subscription_id").maybeSingle();
    if (row?.dodo_subscription_id) {
      try {
        await syncSubscription(row.dodo_subscription_id, userId);
        ({ data, error } = await readStatus());
      } catch (err) {
        console.error("[billing] refresh failed", err);
      }
    }
  }
  if (!data) return badRequest("Couldn't load your plan. Try again.", 500);

  const body: BillingStatus = {
    required: data.required,
    entitled: data.entitled,
    status: data.status,
    used: data.used,
    limit: data.monthly_limit,
    periodEnd: data.period_end,
    cancelAtPeriodEnd: data.cancel_at_period_end,
    canManage: data.has_customer,
    checkoutAvailable: billingConfigured(),
  };
  return Response.json(body);
}
