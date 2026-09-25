-- =====================================================================
-- KAYPITAL STUDIOS — database schema
-- Replaces the beat-store schema (beats/licenses/custom_requests/etc).
-- `admins` is kept as-is from the original project — same auth gate.
-- =====================================================================

create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);

alter table public.admins enable row level security;

create policy "admins can read admins table"
  on public.admins for select
  using (auth.uid() in (select user_id from public.admins));

-- ---------------------------------------------------------------------
-- Collections  e.g. "ARCHIVE 001 — THE BEGINNING"
-- ---------------------------------------------------------------------
create table if not exists public.collections (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  tagline text,
  description text,
  sort_order int not null default 0,
  published boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.collections enable row level security;

create policy "public can read published collections"
  on public.collections for select
  using (published = true or auth.uid() in (select user_id from public.admins));

create policy "admins can write collections"
  on public.collections for all
  using (auth.uid() in (select user_id from public.admins))
  with check (auth.uid() in (select user_id from public.admins));

-- ---------------------------------------------------------------------
-- Products
-- ---------------------------------------------------------------------
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  collection_id uuid references public.collections(id) on delete set null,
  category text not null, -- t-shirt | hoodie | long-sleeve | sweatpants | shorts | outerwear | shoes | ...
  description text,
  price numeric(10,2) not null default 0,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.products enable row level security;

create policy "public can read published products"
  on public.products for select
  using (status = 'published' or auth.uid() in (select user_id from public.admins));

create policy "admins can write products"
  on public.products for all
  using (auth.uid() in (select user_id from public.admins))
  with check (auth.uid() in (select user_id from public.admins));

-- ---------------------------------------------------------------------
-- Product variants — one row per color x size combination.
-- A color is never its own product; it's a variant of one.
-- ---------------------------------------------------------------------
create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  color text not null,
  size text not null,
  sku text,
  available boolean not null default true,
  sort_order int not null default 0,
  unique (product_id, color, size)
);

alter table public.product_variants enable row level security;

create policy "public can read variants of visible products"
  on public.product_variants for select
  using (
    auth.uid() in (select user_id from public.admins)
    or product_id in (select id from public.products where status = 'published')
  );

create policy "admins can write variants"
  on public.product_variants for all
  using (auth.uid() in (select user_id from public.admins))
  with check (auth.uid() in (select user_id from public.admins));

-- ---------------------------------------------------------------------
-- Product images
-- ---------------------------------------------------------------------
create table if not exists public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  url text not null,
  image_type text not null default 'detail' check (image_type in ('main','front','back','detail')),
  sort_order int not null default 0
);

alter table public.product_images enable row level security;

create policy "public can read images of visible products"
  on public.product_images for select
  using (
    auth.uid() in (select user_id from public.admins)
    or product_id in (select id from public.products where status = 'published')
  );

create policy "admins can write images"
  on public.product_images for all
  using (auth.uid() in (select user_id from public.admins))
  with check (auth.uid() in (select user_id from public.admins));

-- ---------------------------------------------------------------------
-- Site content — small editable blocks (about text, contact info, etc)
-- so the admin panel can edit copy without a code deploy.
-- ---------------------------------------------------------------------
create table if not exists public.site_content (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.site_content enable row level security;

create policy "public can read site content"
  on public.site_content for select
  using (true);

create policy "admins can write site content"
  on public.site_content for all
  using (auth.uid() in (select user_id from public.admins))
  with check (auth.uid() in (select user_id from public.admins));

-- ---------------------------------------------------------------------
-- Storage: product-images bucket (public read, admin-only write via
-- signed upload — same pattern as the old previews/masters buckets).
-- Run this once via the Supabase dashboard or CLI if it doesn't exist:
--   insert into storage.buckets (id, name, public) values ('product-images','product-images', true);
-- ---------------------------------------------------------------------
create policy "public can read product images bucket"
  on storage.objects for select
  using (bucket_id = 'product-images');

create policy "admins can write product images bucket"
  on storage.objects for insert
  with check (
    bucket_id = 'product-images'
    and auth.uid() in (select user_id from public.admins)
  );

create policy "admins can delete product images bucket"
  on storage.objects for delete
  using (
    bucket_id = 'product-images'
    and auth.uid() in (select user_id from public.admins)
  );

-- ---------------------------------------------------------------------
-- Tables this REPLACES (drop these manually once you've confirmed the
-- new schema is working end to end — not auto-dropped here so nothing
-- destructive happens without you looking at it first):
--   drop table if exists public.beats cascade;
--   drop table if exists public.licenses cascade;
--   drop table if exists public.custom_requests cascade;
--   drop table if exists public.subscribers cascade;
-- And in storage: remove the `previews` and `masters` buckets once
-- confirmed unused.
-- ---------------------------------------------------------------------
