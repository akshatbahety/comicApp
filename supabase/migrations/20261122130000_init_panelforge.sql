-- Panelforge F-010: per-user comics, characters and panel images.
-- Images live in the private `comics` Storage bucket under {user_id}/...; rows keep the path.

create table public.characters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  description text not null default '',
  prompt text not null default '',
  storage_path text not null,
  source_url text,
  width integer not null,
  height integer not null,
  style text not null,
  quality text not null,
  model text not null,
  face jsonb
);

create table public.generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  title text not null,
  idea text not null,
  script jsonb,
  settings jsonb not null,
  model text not null,
  character_id uuid references public.characters (id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'done', 'failed')),
  error text,
  saved boolean not null default false
);

create table public.panel_images (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  generation_id uuid not null references public.generations (id) on delete cascade,
  created_at timestamptz not null default now(),
  panel_index integer not null check (panel_index >= 0),
  prompt text not null default '',
  caption text not null default '',
  storage_path text not null,
  source_url text,
  width integer not null,
  height integer not null,
  superseded_by uuid references public.panel_images (id) on delete set null
);

create index characters_user_id_idx on public.characters (user_id, created_at desc);
create index generations_user_id_idx on public.generations (user_id, created_at desc);
create index generations_character_id_idx on public.generations (character_id);
create index panel_images_user_id_idx on public.panel_images (user_id);
create index panel_images_generation_id_idx on public.panel_images (generation_id, panel_index);
create index panel_images_superseded_by_idx on public.panel_images (superseded_by);

alter table public.characters enable row level security;
alter table public.generations enable row level security;
alter table public.panel_images enable row level security;

-- Owner-only access. Signed-out (anon) users get nothing.
create policy "own characters: select" on public.characters for select to authenticated using ((select auth.uid()) = user_id);
create policy "own characters: insert" on public.characters for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "own characters: update" on public.characters for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own characters: delete" on public.characters for delete to authenticated using ((select auth.uid()) = user_id);

create policy "own generations: select" on public.generations for select to authenticated using ((select auth.uid()) = user_id);
create policy "own generations: insert" on public.generations for insert to authenticated with check (
  (select auth.uid()) = user_id
  and (character_id is null or exists (select 1 from public.characters c where c.id = character_id and c.user_id = (select auth.uid())))
);
create policy "own generations: update" on public.generations for update to authenticated using ((select auth.uid()) = user_id) with check (
  (select auth.uid()) = user_id
  and (character_id is null or exists (select 1 from public.characters c where c.id = character_id and c.user_id = (select auth.uid())))
);
create policy "own generations: delete" on public.generations for delete to authenticated using ((select auth.uid()) = user_id);

create policy "own panel images: select" on public.panel_images for select to authenticated using ((select auth.uid()) = user_id);
create policy "own panel images: insert" on public.panel_images for insert to authenticated with check (
  (select auth.uid()) = user_id
  and exists (select 1 from public.generations g where g.id = generation_id and g.user_id = (select auth.uid()))
);
create policy "own panel images: update" on public.panel_images for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own panel images: delete" on public.panel_images for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on public.characters, public.generations, public.panel_images from anon;
grant select, insert, update, delete on public.characters, public.generations, public.panel_images to authenticated;

-- Private image bucket: 10 MB per file, images only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('comics', 'comics', false, 10485760, array['image/jpeg', 'image/png', 'image/webp']);

create policy "comics: read own" on storage.objects for select to authenticated
  using (bucket_id = 'comics' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "comics: upload own" on storage.objects for insert to authenticated
  with check (bucket_id = 'comics' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "comics: update own" on storage.objects for update to authenticated
  using (bucket_id = 'comics' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "comics: delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'comics' and (storage.foldername(name))[1] = (select auth.uid())::text);
