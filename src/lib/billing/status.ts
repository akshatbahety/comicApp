/** Shape of GET /api/billing/status, shared by the route and the client. */
export interface BillingStatus {
  /** The paywall is on (quota_settings.require_subscription). */
  required: boolean;
  /** The user may draw images right now (ignoring images left). */
  entitled: boolean;
  status: string | null;
  used: number;
  limit: number;
  periodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  /** Has a Dodo customer, so the billing portal can open. */
  canManage: boolean;
  /** Checkout is configured on the server. */
  checkoutAvailable: boolean;
}

export const PLAN = {
  name: "Panelforge Monthly",
  priceLabel: "$10/month",
  images: 30,
} as const;
