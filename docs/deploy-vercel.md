# Deploying Panelforge to Vercel

Production = `main` on GitHub (`akshatbahety/comicApp`), auto-deployed by Vercel.
Other branches get preview deploys. Previews and production share the one Supabase
project (`panelforge`, ref `lticonipwzicvaruhsxd`) for now.

## One-time setup (owner)

1. vercel.com → **Add New… → Project** → import `akshatbahety/comicApp`.
   Framework: Next.js (auto-detected). Leave build/output settings at their defaults.
2. Before the first deploy, add **Environment Variables** (all environments):

   | Name | Value |
   |---|---|
   | `FAL_KEY` | your fal.ai key (same as `.env.local`) |
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://lticonipwzicvaruhsxd.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | the `sb_publishable_…` key from `.env.local` |

   Do **not** set `NEXT_PUBLIC_AI_MODE` (that's the offline mock).
   `QA_TEST_*` values in `.env.local` are local test logins only and stay local.
3. Deploy. Project name `panelforge` gives `https://panelforge.vercel.app` if it's free.
4. Supabase → Authentication → **URL Configuration**:
   - Site URL: the production URL (e.g. `https://panelforge.vercel.app`)
   - Redirect URLs: add `https://panelforge.vercel.app/**` and `https://*-<vercel-team-slug>.vercel.app/**` (previews)
     and keep `http://localhost:3000/**`.

## Limits that protect the fal bill

- Every image (character or panel) is reserved against **30 per user per UTC day** and
  **300 site-wide per UTC day** before fal is called; failures are given back.
- Change limits in the Supabase SQL editor:
  `update public.quota_settings set user_daily_images = 50, global_daily_images = 500;`
- See today's usage: `select count(*) from public.image_usage where created_at >= date_trunc('day', now());`

## Payments (F-019, Dodo Payments)

Drawing needs the **Panelforge Monthly** plan: $10/month, 30 images per billing period
(character + each panel; redraws count). Script writing is free. Comped accounts
(`status = 'comped'` in `public.subscriptions`) get 30 images per calendar month free.

1. Add these Vercel env vars (Production uses live keys; Preview can use test-mode keys
   and a test-mode copy of the product):

   | Name | Value |
   |---|---|
   | `SUPABASE_SECRET_KEY` | Supabase → Project Settings → API Keys → **Secret key** (`sb_secret_…`) |
   | `DODO_PAYMENTS_ENVIRONMENT` | `live_mode` (Production) / `test_mode` (Preview) |
   | `DODO_PAYMENTS_API_KEY` | Dodo dashboard → Developer → API Keys |
   | `DODO_PAYMENTS_WEBHOOK_KEY` | from the webhook below |
   | `DODO_PRODUCT_ID` | live: `pdt_0NsVkQ6LJndbO61vaCoc6` |

2. Dodo dashboard → Developer → **Webhooks** → add `https://<production-url>/api/webhooks/dodo`,
   subscribe to all `subscription.*` events, copy its signing secret into `DODO_PAYMENTS_WEBHOOK_KEY`.
3. Deploy, then turn the paywall on (it was left off so live users didn't hit it before the new code shipped):
   `update public.quota_settings set require_subscription = true;`
4. Comp an account: `insert into public.subscriptions (user_id, status) values ('<user id>', 'comped');`
   Change the monthly allowance: `update public.quota_settings set monthly_images = 40;`

Paying users still count toward the 300-images-a-day site-wide cap (`global_daily_images`);
raise it before launch if needed.

Without the webhook the plan still activates: the checkout return page (`/billing/return`)
asks Dodo for the subscription and saves it. Renewals and cancellations need the webhook.

## After each production deploy

Sign up, draw a Draft comic, reload, regenerate a panel, download, delete the comic,
and confirm `POST /api/character` without signing in returns 401. With the paywall on,
a signed-in account with no plan gets the Subscribe dialog on "Approve and draw" and
`POST /api/character` returns 402.
