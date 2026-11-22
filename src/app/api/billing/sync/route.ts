import { badRequest, readJson } from "@/lib/ai/request";
import { BillingNotConfiguredError, syncSubscription } from "@/lib/billing/dodo";
import { getUserId } from "@/lib/supabase/server";

/**
 * POST /api/billing/sync { subscriptionId } — called by the checkout return page
 * so the plan works straight away, even before (or without) the webhook. The
 * subscription is fetched from Dodo; the query string alone grants nothing.
 */
export async function POST(request: Request) {
  const userId = await getUserId();
  if (!userId) return badRequest("Sign in first.", 401);
  const body = await readJson(request);
  const id = typeof body?.subscriptionId === "string" ? body.subscriptionId : "";
  if (!/^sub_[A-Za-z0-9]+$/.test(id)) return badRequest("Unknown subscription.");

  try {
    const saved = await syncSubscription(id, userId);
    if (!saved) return badRequest("That subscription isn't linked to this account.", 403);
    return Response.json({ status: saved.status });
  } catch (err) {
    if (err instanceof BillingNotConfiguredError) return badRequest(err.message, 503);
    console.error("[billing] sync failed", err);
    return badRequest("Couldn't confirm your subscription yet. Try again in a moment.", 502);
  }
}
