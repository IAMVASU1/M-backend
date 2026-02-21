create extension if not exists pgcrypto;

-- Allowed emails table (server-side allowlist)
create table if not exists public.allowed_emails (
  email text primary key
);

-- SECURITY DEFINER allow check (so you don't need to expose allowed_emails)
create or replace function public.is_allowed_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.allowed_emails ae
    where lower(ae.email) = lower(auth.jwt() ->> 'email')
  );
$$;

-- Albums
create table if not exists public.albums (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  title text not null,
  created_at timestamptz not null default now()
);

-- Media items (posts)
create table if not exists public.media (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  album_id uuid null references public.albums(id) on delete set null,
  storage_path text not null,          -- path in Storage bucket
  caption text null,
  mime_type text null,
  size_bytes bigint null,
  width int null,
  height int null,
  created_at timestamptz not null default now()
);

create index if not exists idx_media_created_at on public.media(created_at desc);
create index if not exists idx_media_album on public.media(album_id);

-- RLS
alter table public.albums enable row level security;
alter table public.media  enable row level security;

-- Albums: allowed users can read all; only owner can write
drop policy if exists "albums_read_allowed" on public.albums;
create policy "albums_read_allowed"
on public.albums
for select
to authenticated
using (public.is_allowed_user());

drop policy if exists "albums_insert_owner" on public.albums;
create policy "albums_insert_owner"
on public.albums
for insert
to authenticated
with check (public.is_allowed_user() and owner_id = auth.uid());

drop policy if exists "albums_update_owner" on public.albums;
create policy "albums_update_owner"
on public.albums
for update
to authenticated
using (public.is_allowed_user() and owner_id = auth.uid())
with check (public.is_allowed_user() and owner_id = auth.uid());

drop policy if exists "albums_delete_owner" on public.albums;
create policy "albums_delete_owner"
on public.albums
for delete
to authenticated
using (public.is_allowed_user() and owner_id = auth.uid());

-- Media: allowed users can read all; only owner can write
drop policy if exists "media_read_allowed" on public.media;
create policy "media_read_allowed"
on public.media
for select
to authenticated
using (public.is_allowed_user());

drop policy if exists "media_insert_owner" on public.media;
create policy "media_insert_owner"
on public.media
for insert
to authenticated
with check (public.is_allowed_user() and owner_id = auth.uid());

drop policy if exists "media_update_owner" on public.media;
create policy "media_update_owner"
on public.media
for update
to authenticated
using (public.is_allowed_user() and owner_id = auth.uid())
with check (public.is_allowed_user() and owner_id = auth.uid());

drop policy if exists "media_delete_owner" on public.media;
create policy "media_delete_owner"
on public.media
for delete
to authenticated
using (public.is_allowed_user() and owner_id = auth.uid());

-- Random feed helper (small group use; OK)
create or replace function public.feed_random(p_limit int, p_offset int default 0)
returns setof public.media
language sql
stable
as $$
  select *
  from public.media
  where public.is_allowed_user()
  order by random()
  limit p_limit offset p_offset;
$$;

-- Storage policies (bucket: gallery) - private bucket with signed URLs
-- Policies go on storage.objects.
-- Allow all allowed users to read any object in bucket.
drop policy if exists "gallery_read_allowed" on storage.objects;
create policy "gallery_read_allowed"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'gallery'
  and public.is_allowed_user()
);

-- Allow upload only by allowed user, and only owning their object (owner_id = auth.uid()).
drop policy if exists "gallery_insert_owner" on storage.objects;
create policy "gallery_insert_owner"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'gallery'
  and public.is_allowed_user()
  and owner_id = auth.uid()
);

-- Allow delete/update only for owner
drop policy if exists "gallery_update_owner" on storage.objects;
create policy "gallery_update_owner"
on storage.objects
for update
to authenticated
using (bucket_id='gallery' and public.is_allowed_user() and owner_id = auth.uid())
with check (bucket_id='gallery' and public.is_allowed_user() and owner_id = auth.uid());

drop policy if exists "gallery_delete_owner" on storage.objects;
create policy "gallery_delete_owner"
on storage.objects
for delete
to authenticated
using (bucket_id='gallery' and public.is_allowed_user() and owner_id = auth.uid());

-- Seed allowed emails (EDIT THESE):
-- insert into public.allowed_emails(email) values
-- ('you@gmail.com'), ('friend1@gmail.com'), ('friend2@gmail.com');