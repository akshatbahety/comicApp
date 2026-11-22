"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CircleAlert, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { confirmSubscription } from "@/lib/billing/client";

const safeNext = (value: string | null) =>
  value && value.startsWith("/") && !value.startsWith("//") ? value : "/create";

/**
 * Where Dodo's checkout sends the user back. Confirms the subscription with the
 * server (which asks Dodo; the query string is only a hint), then returns to the
 * page they came from with `?subscribed=1`.
 */
export function ReturnView() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const subscriptionId = params.get("subscription_id");
  const status = params.get("status");
  const declined = !subscriptionId || (!!status && !["active", "succeeded", "processing", "pending"].includes(status));
  const [syncError, setSyncError] = useState<string | null>(null);
  const error = declined ? "The payment didn't go through. You haven't been charged for a plan." : syncError;
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const back = (flag: string) => router.replace(`${next}${next.includes("?") ? "&" : "?"}${flag}`);

    if (declined || !subscriptionId) return;
    // A fresh subscription can take a while to turn active (some cards settle
    // later), so poll; only an active plan counts as subscribed.
    (async () => {
      const tries = 8;
      let lastError = "";
      for (let attempt = 0; attempt < tries; attempt++) {
        try {
          const { status: current } = await confirmSubscription(subscriptionId);
          if (current === "active" || current === "past_due") return back("subscribed=1");
          if (["failed", "cancelled", "expired"].includes(current)) {
            setSyncError("The payment didn't go through. You haven't been charged for a plan.");
            return;
          }
          lastError = "";
        } catch (err) {
          lastError = err instanceof Error ? err.message : "Couldn't confirm your subscription.";
        }
        if (attempt < tries - 1) await new Promise((r) => setTimeout(r, 2500));
      }
      setSyncError(lastError || "Your payment is still processing. Your plan switches on automatically when it clears.");
    })();
  }, [declined, next, router, subscriptionId]);

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 pt-16">
      <Card>
        <CardContent className="flex flex-col items-center gap-3 text-center">
          {error ? (
            <>
              <CircleAlert className="size-6 text-destructive" aria-hidden />
              <p className="text-sm">{error}</p>
              <p className="text-xs text-muted-foreground">
                If you were charged, your plan will show up within a minute. Your script is still saved.
              </p>
              <Button asChild>
                <Link href={next}>Back to your comic</Link>
              </Button>
            </>
          ) : (
            <>
              <LoaderCircle className="size-6 animate-spin text-primary" aria-hidden />
              <p className="text-sm">Confirming your subscription…</p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
