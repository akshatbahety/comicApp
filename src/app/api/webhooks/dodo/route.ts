import { billingConfigured, dodo, syncSubscription } from "@/lib/billing/dodo";

/**
 * POST /api/webhooks/dodo — Dodo Payments webhook (Standard Webhooks signature).
 * Every subscription event re-reads the subscription from Dodo and mirrors it,
 * so out-of-order or repeated deliveries end in the same state.
 */
export async function POST(request: Request) {
  if (!billingConfigured() || !process.env.DODO_PAYMENTS_WEBHOOK_KEY)
    return Response.json({ error: "Webhook not configured" }, { status: 503 });

  const raw = await request.text();
  const headers = {
    "webhook-id": request.headers.get("webhook-id") ?? "",
    "webhook-signature": request.headers.get("webhook-signature") ?? "",
    "webhook-timestamp": request.headers.get("webhook-timestamp") ?? "",
  };

  let event;
  try {
    event = dodo().webhooks.unwrap(raw, { headers });
  } catch {
    return Response.json({ error: "Invalid signature" }, { status: 401 });
  }

  if (event.type.startsWith("subscription.")) {
    const id = (event.data as { subscription_id?: string }).subscription_id;
    if (id) {
      try {
        const saved = await syncSubscription(id);
        if (!saved) console.warn(`[billing] ${event.type} for ${id}: no matching user`);
      } catch (err) {
        console.error(`[billing] ${event.type} sync failed`, err);
        return Response.json({ error: "Sync failed" }, { status: 500 }); // Dodo retries.
      }
    }
  }
  return Response.json({ received: true });
}
