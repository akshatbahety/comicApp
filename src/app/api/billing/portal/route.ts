import { badRequest } from "@/lib/ai/request";
import { BillingNotConfiguredError, dodo } from "@/lib/billing/dodo";
import { createServerSupabase, getUserId } from "@/lib/supabase/server";

/** POST /api/billing/portal — Dodo's customer portal, to update the card or cancel. */
export async function POST(request: Request) {
  const userId = await getUserId();
  if (!userId) return badRequest("Sign in first.", 401);
  const supabase = await createServerSupabase();
  const { data } = await supabase.from("subscriptions").select("dodo_customer_id").maybeSingle();
  if (!data?.dodo_customer_id) return badRequest("No subscription to manage.", 404);

  try {
    const portal = await dodo().customers.customerPortal.create(data.dodo_customer_id, {
      return_url: new URL("/create", request.url).toString(),
    });
    return Response.json({ url: portal.link });
  } catch (err) {
    if (err instanceof BillingNotConfiguredError) return badRequest(err.message, 503);
    console.error("[billing] portal failed", err);
    return badRequest("Couldn't open billing. Try again.", 502);
  }
}
