-- Martinčina kuchařka – databázové schéma pro Supabase
-- Vložte celé do Supabase → SQL Editor → New query a klikněte na Run.
-- Skript lze spustit opakovaně, nic nesmaže.

create extension if not exists pgcrypto;

-- Recepty --------------------------------------------------------------
create table if not exists public.recipes (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  categories    text[] not null default '{}',  -- např. {Obědy,Večeře}
  tags          text[] not null default '{}',
  servings      numeric,
  time_minutes  integer,
  ingredients   jsonb not null default '[]',   -- [{qty, unit, name}] nebo {section}
  steps         jsonb not null default '[]',   -- ["krok 1", "krok 2", ...]
  notes         text,
  source        text,
  photos        text[] not null default '{}',  -- cesty v úložišti recipe-photos
  favorite      boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Nákupní seznam -------------------------------------------------------
create table if not exists public.shopping_items (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  amount        text,
  recipe_id     uuid references public.recipes(id) on delete set null,
  recipe_title  text,
  checked       boolean not null default false,
  created_at    timestamptz not null default now()
);

-- Automatická aktualizace updated_at
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists recipes_touch on public.recipes;
create trigger recipes_touch before update on public.recipes
  for each row execute function public.touch_updated_at();

-- Přístup: jen přihlášení uživatelé (vy dva), nikdo jiný ------------------
grant select, insert, update, delete on public.recipes, public.shopping_items to authenticated;
revoke all on public.recipes, public.shopping_items from anon;

alter table public.recipes        enable row level security;
alter table public.shopping_items enable row level security;

drop policy if exists "prihlaseni_recepty" on public.recipes;
create policy "prihlaseni_recepty" on public.recipes
  for all to authenticated using (true) with check (true);

drop policy if exists "prihlaseni_nakup" on public.shopping_items;
create policy "prihlaseni_nakup" on public.shopping_items
  for all to authenticated using (true) with check (true);

-- Živá synchronizace nákupního seznamu mezi telefony
do $$
begin
  alter publication supabase_realtime add table public.shopping_items;
exception when duplicate_object then null;
end $$;

-- Úložiště fotek (soukromé) ------------------------------------------
insert into storage.buckets (id, name, public)
values ('recipe-photos', 'recipe-photos', false)
on conflict (id) do nothing;

drop policy if exists "prihlaseni_fotky" on storage.objects;
create policy "prihlaseni_fotky" on storage.objects
  for all to authenticated
  using (bucket_id = 'recipe-photos')
  with check (bucket_id = 'recipe-photos');
