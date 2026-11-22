-- F-011 (first slice): daily image quota so a public deploy can't run up the fal bill.
-- One row per image the API is about to draw. Nobody can read or write the
-- table directly; only the functions below (security definer) touch it. Ids
-- stay server-side, so a user can't release a reservation for an image they got.

create table public.image_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  kind text not null check (kind in ('character', 'panel'))
);

create index image_usage_user_day_idx on public.image_usage (user_id, created_at desc);
create index image_usage_day_idx on public.image_usage (created_at desc);

alter table public.image_usage enable row level security;
revoke all on public.image_usage from anon, authenticated;

-- Limits live in the database (not the API) so nobody can call the function
-- with bigger numbers. Change them with:
--   update public.quota_settings set user_daily_images = 50;
create table public.quota_settings (
  id boolean primary key default true check (id),
  user_daily_images integer not null default 30,
  global_daily_images integer not null default 300
);
insert into public.quota_settings default values;
alter table public.quota_settings enable row level security;
revoke all on public.quota_settings from anon, authenticated;

-- Reserves one image for the signed-in user if both the per-user and the
-- site-wide limits for the current UTC day allow it. Returns the reservation
-- id, or raises 'quota_user' / 'quota_global'.
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
  user_limit integer;
  global_limit integer;
begin
  if uid is null then
    raise exception 'not_signed_in';
  end if;
  -- Serialise reservations so parallel panel requests can't overshoot the limits.
  perform pg_advisory_xact_lock(hashtext('panelforge:image_quota'));
  select user_daily_images, global_daily_images into user_limit, global_limit from public.quota_settings;
  if (select count(*) from public.image_usage where user_id = uid and created_at >= day_start) >= user_limit then
    raise exception 'quota_user';
  end if;
  if (select count(*) from public.image_usage where created_at >= day_start) >= global_limit then
    raise exception 'quota_global';
  end if;
  insert into public.image_usage (user_id, kind) values (uid, p_kind) returning id into new_id;
  return new_id;
end;
$$;

-- Gives a reservation back when fal failed, so failures don't eat the quota.
create or replace function public.release_image(p_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.image_usage
  where id = p_id and user_id = auth.uid() and created_at > now() - interval '10 minutes';
$$;

revoke all on function public.reserve_image(text) from public, anon;
revoke all on function public.release_image(uuid) from public, anon;
grant execute on function public.reserve_image(text) to authenticated;
grant execute on function public.release_image(uuid) to authenticated;
