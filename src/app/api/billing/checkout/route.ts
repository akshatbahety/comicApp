import { badRequest, readJson } from "@/lib/ai/request";
import { BillingNotConfiguredError, dodo, productId } from "@/lib/billing/dodo";
import { createServerSupabase } from "@/lib/supabase/server";

/** Only same-site paths may be used as the page to come back to. */
const safeNext = (value: unknown) =>
  typeof value === "string" && value.startsWith("/") && !value.startsWith("//") ? value : "/create";

/**
 * POST /api/billing/checkout — starts a Dodo hosted checkout for the monthly
 * plan and returns its URL. Dodo sends the user back to /billing/return.
 */
export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub as string | undefined;
  const email = data?.claims?.email as string | undefined;
  if (!userId) return badRequest("Sign in to subscribe.", 401);

  const body = (await readJson(request)) ?? {};
  const origin = new URL(request.url).origin;
  const back = new URL("/billing/return", origin);
  back.searchParams.set("next", safeNext(body.next));

  // Don't open a second subscription next to one that works or can recover.
  const { data: existing } = await supabase.from("subscriptions").select("status, dodo_customer_id").maybeSingle();
  if (existing && ["active", "past_due", "comped"].includes(existing.status))
    return badRequest("You already have a plan.", 409);
  if (existing?.status === "on_hold" && existing.dodo_customer_id)
    return badRequest("Your last payment failed. Update your card in Manage billing to keep your plan.", 409);

  try {
    const session = await dodo().checkoutSessions.create({
      product_cart: [{ product_id: productId(), quantity: 1 }],
      ...(email ? { customer: { email } } : {}),
      metadata: { user_id: userId },
      // The email links the payment to this account if metadata doesn't carry over.
      feature_flags: { allow_customer_editing_email: false },
      return_url: back.toString(),
      cancel_url: new URL(safeNext(body.next), origin).toString(),
    });
    if (!session.checkout_url) throw new Error("Dodo returned no checkout URL");
    return Response.json({ url: session.checkout_url });
  } catch (err) {
    if (err instanceof BillingNotConfiguredError) return badRequest(err.message, 503);
    console.error("[billing] checkout failed", err);
    return badRequest("Couldn't open checkout. Try again.", 502);
  }
}
