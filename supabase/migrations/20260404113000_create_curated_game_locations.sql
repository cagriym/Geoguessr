create table if not exists public.game_locations (
  id text primary key,
  slug text not null unique,
  status text not null default 'draft' check (status in ('draft', 'ready')),
  label text not null,
  country_code text not null,
  country_name text not null,
  region_name text,
  locality text,
  latitude double precision not null,
  longitude double precision not null,
  heading double precision not null default 0,
  pitch double precision not null default 0,
  view_zoom smallint not null default 1 check (view_zoom between 0 and 5),
  difficulty text not null default 'medium' check (difficulty in ('easy', 'medium', 'hard')),
  summary text not null,
  verification_state text not null default 'seeded' check (verification_state in ('seeded', 'audited')),
  verification_notes text not null default '',
  tags text[] not null default '{}',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.location_clues (
  id text primary key,
  location_id text not null references public.game_locations(id) on delete cascade,
  timing text not null check (timing in ('playing', 'revealed')),
  category text not null check (category in ('language', 'road-layout', 'street-furniture', 'architecture', 'vehicles', 'environment')),
  title text not null,
  short_text text not null,
  details text not null,
  position_hint text,
  confidence text not null check (confidence in ('high', 'medium', 'low')),
  distinctiveness smallint not null check (distinctiveness between 1 and 5),
  sort_order smallint not null default 0,
  tags text[] not null default '{}',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists game_locations_status_idx on public.game_locations (status);
create index if not exists game_locations_country_code_idx on public.game_locations (country_code);
create index if not exists game_locations_difficulty_idx on public.game_locations (difficulty);
create index if not exists game_locations_tags_gin_idx on public.game_locations using gin (tags);
create index if not exists location_clues_location_id_idx on public.location_clues (location_id);
create index if not exists location_clues_timing_idx on public.location_clues (timing);
create index if not exists location_clues_tags_gin_idx on public.location_clues using gin (tags);

drop trigger if exists set_game_locations_updated_at on public.game_locations;
create trigger set_game_locations_updated_at
before update on public.game_locations
for each row
execute procedure public.set_updated_at();

drop trigger if exists set_location_clues_updated_at on public.location_clues;
create trigger set_location_clues_updated_at
before update on public.location_clues
for each row
execute procedure public.set_updated_at();

alter table public.game_locations enable row level security;
alter table public.location_clues enable row level security;

drop policy if exists "Public read clue categories" on public.clue_categories;
drop policy if exists "Public read country profiles" on public.country_profiles;
drop policy if exists "Public read clues" on public.clues;
