"use client";

import { useState } from "react";
import { Check, CreditCard } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { openBillingPortal, startCheckout } from "@/lib/billing/client";
import { PLAN } from "@/lib/billing/status";

const PERKS = [
  `${PLAN.images} images a month: about 6 four-panel comics`,
  "Panel redraws come out of the same images",
  "Cancel anytime from Manage billing",
];

/**
 * Shown when Generate is pressed without a plan (F-019). "Subscribe" saves the
 * draft via `onBeforeCheckout`, then goes to Dodo's hosted checkout.
 */
export function PaywallDialog({
  open,
  onOpenChange,
  imagesNeeded,
  onBeforeCheckout,
  checkoutAvailable,
  onHold = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imagesNeeded: number;
  onBeforeCheckout: () => void;
  checkoutAvailable: boolean;
  /** A renewal failed: fix the card in the portal rather than starting a second plan. */
  onHold?: boolean;
}) {
  const [loading, setLoading] = useState(false);

  async function subscribe() {
    setLoading(true);
    try {
      const { url } = onHold
        ? await openBillingPortal()
        : await startCheckout(window.location.pathname + window.location.search);
      onBeforeCheckout();
      window.location.assign(url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't open checkout");
      setLoading(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={(o) => !loading && onOpenChange(o)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{onHold ? "Update your card to keep drawing" : "Subscribe to draw your comic"}</AlertDialogTitle>
          <AlertDialogDescription>
            {onHold
              ? "Your last renewal payment didn't go through, so your plan is on hold. Update your card and it picks up again."
              : `Your script is ready. This comic needs ${imagesNeeded} images (the character plus each panel). Drawing them takes a plan.`}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="rounded-xl border bg-muted/40 p-4">
          <div className="flex items-baseline justify-between gap-3">
            <p className="font-medium">{PLAN.name}</p>
            <p className="text-lg font-semibold">{PLAN.priceLabel}</p>
          </div>
          <ul className="mt-3 flex flex-col gap-1.5 text-sm text-muted-foreground">
            {PERKS.map((perk) => (
              <li key={perk} className="flex items-start gap-2">
                <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                {perk}
              </li>
            ))}
          </ul>
        </div>

        {!checkoutAvailable && (
          <p className="text-sm text-destructive">Payments aren&apos;t set up yet. Please try again later.</p>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Not now</AlertDialogCancel>
          <Button onClick={subscribe} disabled={loading || !checkoutAvailable}>
            <CreditCard />{" "}
            {loading ? "Opening…" : onHold ? "Manage billing" : `Subscribe · ${PLAN.priceLabel}`}
          </Button>
        </AlertDialogFooter>
        <p className="text-center text-xs text-muted-foreground">
          Secure checkout by Dodo Payments. You&apos;ll come back here to draw.
        </p>
      </AlertDialogContent>
    </AlertDialog>
  );
}
