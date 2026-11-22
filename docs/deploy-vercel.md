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

## After each production deploy

Sign up, draw a Draft comic, reload, regenerate a panel, download, delete the comic,
and confirm `POST /api/character` without signing in returns 401.
