-- F-019: paid plan. Drawing images needs an active Panelforge subscription
-- ($10/month via Dodo Payments) that includes `monthly_images` images per
-- billing period. Script writing stays free.
--
-- Rows are written only by the server (webhook / return sync) with the
-- Supabase secret key; users can read their own row and nothing else.

create table public.subscriptions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  -- 'comped' rows are free accounts (owner, QA) with no Dodo subscription.
  status text not null check (status in ('pending', 'active', 'on_hold', 'paused', 'cancelled', 'failed', 'expired', 'past_due', 'comped')),
  dodo_subscription_id text unique,
  dodo_customer_id text,
  product_id text,
  period_start timestamptz,
  period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;
revoke all on public.subscriptions from anon, authenticated;
grant select on public.subscriptions to authenticated;
create policy "Users read their own subscription"
  on public.subscriptions for select to authenticated
  using ((select auth.uid()) = user_id);

-- Images included per billing period, and a switch for the paywall itself.
-- Turn the paywall off in an emergency with:
--   update public.quota_settings set require_subscription = false;
alter table public.quota_settings
  add column monthly_images integer not null default 30,
  add column require_subscription boolean not null default true;

-- The window a user's monthly images are counted in, or null if they have no
-- plan that allows drawing. Cancelled plans keep working until the period ends;
-- past_due is Dodo's grace period, so it keeps working too.
create or replace function public.billing_window(p_uid uuid)
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when s.status = 'comped' then date_trunc('month', now() at time zone 'utc') at time zone 'utc'
    when s.status in ('active', 'past_due') then coalesce(s.period_start, s.updated_at)
    when s.status = 'cancelled' and s.period_end > now() then coalesce(s.period_start, s.updated_at)
    else null
  end
  from public.subscriptions s
  where s.user_id = p_uid;
$$;

-- What the UI shows: plan status and images left this period.
create or replace function public.billing_status()
returns table (
  required boolean,
  entitled boolean,
  status text,
  used integer,
  monthly_limit integer,
  period_end timestamptz,
  cancel_at_period_end boolean,
  has_customer boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with w as (select public.billing_window(auth.uid()) as start_at)
  select
    q.require_subscription,
    (not q.require_subscription) or w.start_at is not null,
    s.status,
    coalesce((select count(*)::integer from public.image_usage u
              where u.user_id = auth.uid() and w.start_at is not null and u.created_at >= w.start_at), 0),
    q.monthly_images,
    s.period_end,
    coalesce(s.cancel_at_period_end, false),
    s.dodo_customer_id is not null
  from public.quota_settings q
  cross join w
  left join public.subscriptions s on s.user_id = auth.uid();
$$;

-- Same as before, plus the subscription check. New errors:
--   'quota_unpaid'  no plan that allows drawing
--   'quota_monthly' this period's images are used up
create or replace function public.reserve_image(p_kind text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  day_start timestamptz := date_trunc('day', now() at time zone 'utc') at time zone 'utc';
  new_id uuid;
  settings public.quota_settings%rowtype;
  window_start timestamptz;
begin
  if uid is null then
    raise exception 'not_signed_in';
  end if;
  perform pg_advisory_xact_lock(hashtext('panelforge:image_quota'));
  select * into settings from public.quota_settings;

  if settings.require_subscription then
    window_start := public.billing_window(uid);
    if window_start is null then
      raise exception 'quota_unpaid';
    end if;
    if (select count(*) from public.image_usage where user_id = uid and created_at >= window_start) >= settings.monthly_images then
      raise exception 'quota_monthly';
    end if;
  end if;

  if (select count(*) from public.image_usage where user_id = uid and created_at >= day_start) >= settings.user_daily_images then
    raise exception 'quota_user';
  end if;
  if (select count(*) from public.image_usage where created_at >= day_start) >= settings.global_daily_images then
    raise exception 'quota_global';
  end if;
  insert into public.image_usage (user_id, kind) values (uid, p_kind) returning id into new_id;
  return new_id;
end;
$$;

-- Used by the webhook (secret key only) when a subscription carries no user id.
create or replace function public.user_id_by_email(p_email text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from auth.users where lower(email) = lower(p_email) limit 1;
$$;

revoke all on function public.billing_window(uuid) from public, anon, authenticated;
revoke all on function public.billing_status() from public, anon;
revoke all on function public.user_id_by_email(text) from public, anon, authenticated;
grant execute on function public.billing_status() to authenticated;
grant execute on function public.user_id_by_email(text) to service_role;

-- Rollout on the hosted project (run by hand, not part of a fresh setup):
--   update public.quota_settings set require_subscription = false;  -- until the new code is deployed
--   insert into public.subscriptions (user_id, status) values ('<owner or QA user id>', 'comped');
