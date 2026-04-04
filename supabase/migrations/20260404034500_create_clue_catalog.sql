create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.clue_categories (
  slug text primary key,
  label text not null,
  description text not null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.country_profiles (
  code text primary key,
  name text not null,
  guide_summary text not null,
  seo_description text not null,
  compare_country_codes text[] not null default '{}',
  confused_with_country_codes text[] not null default '{}',
  featured_clue_ids text[] not null default '{}',
  strongest_beginner_clue_ids text[] not null default '{}',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint country_profiles_code_length check (char_length(code) = 2)
);

create table if not exists public.clues (
  id text primary key,
  slug text not null unique,
  country_code text not null references public.country_profiles(code) on delete cascade,
  country_name text not null,
  region_name text,
  category_slug text not null references public.clue_categories(slug) on delete restrict,
  title text not null,
  summary text not null,
  description text not null,
  confidence text not null check (confidence in ('high', 'medium', 'low')),
  distinctiveness smallint not null check (distinctiveness between 1 and 5),
  beginner_friendly boolean not null default false,
  tags text[] not null default '{}',
  common_confusion_country_codes text[] not null default '{}',
  source_refs jsonb not null default '[]'::jsonb,
  visual_example_alt text not null,
  visual_example_caption text not null,
  visual_example_image_url text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists clues_country_code_idx on public.clues (country_code);
create index if not exists clues_category_slug_idx on public.clues (category_slug);
create index if not exists clues_beginner_friendly_idx on public.clues (beginner_friendly);
create index if not exists clues_tags_gin_idx on public.clues using gin (tags);
create index if not exists country_profiles_compare_codes_gin_idx on public.country_profiles using gin (compare_country_codes);

drop trigger if exists set_country_profiles_updated_at on public.country_profiles;
create trigger set_country_profiles_updated_at
before update on public.country_profiles
for each row
execute procedure public.set_updated_at();

drop trigger if exists set_clues_updated_at on public.clues;
create trigger set_clues_updated_at
before update on public.clues
for each row
execute procedure public.set_updated_at();

alter table public.clue_categories enable row level security;
alter table public.country_profiles enable row level security;
alter table public.clues enable row level security;

drop policy if exists "Public read clue categories" on public.clue_categories;
create policy "Public read clue categories"
on public.clue_categories
for select
to anon, authenticated
using (true);

drop policy if exists "Public read country profiles" on public.country_profiles;
create policy "Public read country profiles"
on public.country_profiles
for select
to anon, authenticated
using (true);

drop policy if exists "Public read clues" on public.clues;
create policy "Public read clues"
on public.clues
for select
to anon, authenticated
using (true);
