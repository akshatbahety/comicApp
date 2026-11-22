# F-019 — Paid plan (Dodo Payments)

**Status:** in-dev · **Priority:** P0

## Why
Every image costs us fal credits. Nobody should get images drawn without paying.

## What
- One plan: **Panelforge Monthly**, $10/month (USD, tax inclusive), Dodo product
  `pdt_0NsVkQ6LJndbO61vaCoc6` (live). 30 images per billing period ≈ 6 four-panel comics
  (a comic uses 1 character image + 1 per panel; panel redraws count).
- Writing and editing the script stays free. The paywall appears when the user presses
  **Approve and draw** (review on) or **Generate N images** (review off).
- The idea, settings and script are kept across the trip to checkout; after paying the
  user lands back on Create with the script in review and a "You're subscribed" toast.
- Sidebar shows "N of 30 images left" and **Manage billing** (Dodo customer portal: card, cancel).

## User flow
1. Write the idea → script (free) → Approve and draw.
2. No plan → dialog "Subscribe to draw your comic" → Subscribe → Dodo hosted checkout.
3. Dodo returns to `/billing/return?subscription_id=…&status=active&next=/create`.
   The server fetches the subscription from Dodo, checks it belongs to this user, saves it.
4. Back on `/create` → Approve and draw → comic is drawn.
5. Not enough images left for this comic → toast with the count; nothing is drawn.

## How it's enforced
- `public.subscriptions` (one row per user, read-own RLS, written only with the secret key).
- `reserve_image` raises `quota_unpaid` (API → 402, `code: subscription_required`) or
  `quota_monthly` (API → 429) before any fal call. The UI check is only a convenience.
- Usage window: `previous_billing_date` from Dodo; cancelled plans work until the period ends;
  `past_due` (Dodo's grace period) keeps working; comped accounts use the calendar month.
- Webhook `POST /api/webhooks/dodo` (Standard Webhooks signature) re-reads the subscription
  from Dodo on every `subscription.*` event. `GET /api/billing/status` re-syncs once a period
  has passed, in case a renewal webhook was missed.
- Switch: `quota_settings.require_subscription` (off = old daily limits only).

## Acceptance criteria
- AC-1 A signed-in user without a plan can write and edit a script but gets the paywall on Approve and draw; no generation row or image is created.
- AC-2 `POST /api/character` / `/api/panels` without a plan return 402.
- AC-3 After checkout the plan is active without the webhook (return sync), and the reviewed script is restored.
- AC-4 The 31st image in a period returns 429; the UI blocks a comic that needs more images than are left.
- AC-5 Comped accounts draw without paying.
- AC-6 Manage billing opens the Dodo customer portal for subscribers.
- AC-7 `/api/billing/sync` refuses a subscription that belongs to another account (403).
- AC-8 Checkout returns 409 for an account that already has a plan (active, past_due, comped) or is on hold (fix card in portal instead).
- AC-9 The return page only says "subscribed" once Dodo reports the plan active; while pending it keeps checking, then says it's processing.

## Test plan (QA)
Use Dodo **test mode** (test API key + a test copy of the product) — never pay in live mode.
First test-mode checkout, check before anything else: does the subscription carry
`metadata.user_id` (Dodo dashboard → subscription → metadata)? Does `?next=` survive on the
return URL next to Dodo's own parameters? Without metadata, linking falls back to the email,
which checkout locks (`allow_customer_editing_email: false`).
Accounts: `panelforge.qa1` is comped; `panelforge.qa2` has no plan.
Test card: Dodo's published test card numbers.

## Implementation notes
- Code: `src/lib/billing/*`, `src/app/api/billing/*`, `src/app/api/webhooks/dodo`, `src/app/billing/return`,
  `src/components/billing/paywall-dialog.tsx`, gate in `CreateView.ensureCanDraw`.
- Migration: `supabase/migrations/20261122200000_subscriptions.sql`.
- Env: `SUPABASE_SECRET_KEY`, `DODO_PAYMENTS_ENVIRONMENT`, `DODO_PAYMENTS_API_KEY`, `DODO_PAYMENTS_WEBHOOK_KEY`, `DODO_PRODUCT_ID`.
