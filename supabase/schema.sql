-- RoV LAB Supabase schema (MVP)
-- Run in the Supabase SQL editor, or via `supabase db push` once the CLI is linked.

create extension if not exists "pgcrypto";

-- ========== Reference / lookup ==========

create table patches (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,          -- e.g. "1.51"
  released_at date,
  notes text
);

create table guide_categories (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name_th text not null
);

-- ========== Heroes ==========

create table heroes (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  name_th text not null,
  role text not null check (role in ('assassin','fighter','mage','marksman','support','tank')),
  lane text not null check (lane in ('slayer','jungle','mid','abyssal','support')),
  difficulty text not null check (difficulty in ('easy','medium','hard')),
  icon_url text,
  description text,
  strengths text[] default '{}',
  weaknesses text[] default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table hero_abilities (
  id uuid primary key default gen_random_uuid(),
  hero_id uuid not null references heroes(id) on delete cascade,
  slot text not null,                 -- "passive" | "1" | "2" | "3" | "ultimate"
  name text not null,
  description text not null,
  sort_order int not null default 0
);

create table hero_stats (
  id uuid primary key default gen_random_uuid(),
  hero_id uuid not null references heroes(id) on delete cascade,
  patch_id uuid not null references patches(id) on delete cascade,
  rank_tier text not null,            -- e.g. "Diamond+", "All ranks"
  win_rate numeric(5,2) not null,
  pick_rate numeric(5,2) not null,
  ban_rate numeric(5,2) not null,
  tier text not null check (tier in ('S+','S','A','B','C')),
  matches int not null default 0,
  unique (hero_id, patch_id, rank_tier)
);
create index on hero_stats (patch_id, rank_tier, tier);

create table hero_counters (
  id uuid primary key default gen_random_uuid(),
  hero_id uuid not null references heroes(id) on delete cascade,       -- the hero being countered
  counter_hero_id uuid not null references heroes(id) on delete cascade, -- the hero that counters it
  strength text not null check (strength in ('best','good','situational')),
  reason text not null,
  lane_tip text,
  unique (hero_id, counter_hero_id)
);

create table hero_synergies (
  id uuid primary key default gen_random_uuid(),
  hero_id uuid not null references heroes(id) on delete cascade,
  partner_hero_id uuid not null references heroes(id) on delete cascade,
  reason text not null,
  unique (hero_id, partner_hero_id)
);

-- ========== Items & builds ==========

create table items (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  name_th text not null,
  cost int not null,
  stats text[] default '{}',
  passive text,
  role_tags text[] default '{}',      -- optional: which roles typically build this
  patch_id uuid references patches(id)
);

create table arcana (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text
);

create table item_builds (
  id uuid primary key default gen_random_uuid(),
  hero_id uuid not null references heroes(id) on delete cascade,
  patch_id uuid not null references patches(id) on delete cascade,
  source text not null default 'curated' check (source in ('curated','heuristic')),
  arcana_id uuid references arcana(id),
  created_at timestamptz default now()
);

create table item_build_items (
  id uuid primary key default gen_random_uuid(),
  build_id uuid not null references item_builds(id) on delete cascade,
  item_id uuid not null references items(id) on delete cascade,
  phase text not null check (phase in ('early','core','situational')),
  reason text not null,
  sort_order int not null default 0
);

-- ========== Matchups & tier lists ==========

create table matchups (
  id uuid primary key default gen_random_uuid(),
  hero_a_id uuid not null references heroes(id) on delete cascade,
  hero_b_id uuid not null references heroes(id) on delete cascade,
  lane text not null,
  difficulty text not null check (difficulty in ('ง่าย','ปานกลาง','ยาก')),
  early text, mid text, late text,
  win_condition text,
  tips text,
  source text not null default 'curated' check (source in ('curated','heuristic')),
  unique (hero_a_id, hero_b_id)
);

create table tier_lists (
  id uuid primary key default gen_random_uuid(),
  patch_id uuid not null references patches(id) on delete cascade,
  rank_tier text not null,
  lane text,                           -- null = overall
  created_at timestamptz default now(),
  unique (patch_id, rank_tier, lane)
);

create table tier_list_entries (
  id uuid primary key default gen_random_uuid(),
  tier_list_id uuid not null references tier_lists(id) on delete cascade,
  hero_id uuid not null references heroes(id) on delete cascade,
  tier text not null check (tier in ('S+','S','A','B','C')),
  reason text,
  unique (tier_list_id, hero_id)
);

-- ========== Guides ==========

create table guides (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  cover_url text,
  category_id uuid references guide_categories(id),
  difficulty text check (difficulty in ('easy','medium','hard')),
  reading_minutes int,
  content text not null,               -- markdown
  hero_refs uuid[] default '{}',       -- hero ids referenced
  item_refs uuid[] default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ========== Users & social ==========
-- profiles.id mirrors auth.users.id (1:1), created via trigger below.

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  preferred_roles text[] default '{}',
  preferred_heroes uuid[] default '{}',
  created_at timestamptz default now()
);

create table favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  hero_slug text not null references heroes(slug) on delete cascade,
  created_at timestamptz default now(),
  unique (user_id, hero_slug)
);

create table saved_builds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  hero_slug text not null references heroes(slug) on delete cascade,
  name text not null,
  items jsonb not null,                -- snapshot of chosen items/phases
  arcana jsonb,
  created_at timestamptz default now()
);

create table saved_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  name text,
  my_team jsonb not null,              -- array of hero_slug | null, length 5
  enemy_team jsonb not null,
  created_at timestamptz default now()
);

create table comments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  hero_slug text references heroes(slug) on delete cascade,
  guide_id uuid references guides(id) on delete cascade,
  body text not null,
  created_at timestamptz default now(),
  check (hero_slug is not null or guide_id is not null)
);

-- Auto-create a profile row whenever a new auth user signs up.
create function public.handle_new_user() returns trigger as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ========== Row Level Security ==========

alter table profiles enable row level security;
alter table favorites enable row level security;
alter table saved_builds enable row level security;
alter table saved_drafts enable row level security;
alter table comments enable row level security;

-- Reference/content tables: public read, no public write (admin writes via service role).
alter table heroes enable row level security;
alter table hero_stats enable row level security;
alter table hero_counters enable row level security;
alter table hero_synergies enable row level security;
alter table items enable row level security;
alter table item_builds enable row level security;
alter table item_build_items enable row level security;
alter table matchups enable row level security;
alter table tier_lists enable row level security;
alter table tier_list_entries enable row level security;
alter table guides enable row level security;

create policy "public read heroes" on heroes for select using (true);
create policy "public read hero_stats" on hero_stats for select using (true);
create policy "public read hero_counters" on hero_counters for select using (true);
create policy "public read hero_synergies" on hero_synergies for select using (true);
create policy "public read items" on items for select using (true);
create policy "public read item_builds" on item_builds for select using (true);
create policy "public read item_build_items" on item_build_items for select using (true);
create policy "public read matchups" on matchups for select using (true);
create policy "public read tier_lists" on tier_lists for select using (true);
create policy "public read tier_list_entries" on tier_list_entries for select using (true);
create policy "public read guides" on guides for select using (true);

-- profiles: user can read/update only their own row (add a public-read policy later if profiles become public).
create policy "own profile select" on profiles for select using (auth.uid() = id);
create policy "own profile update" on profiles for update using (auth.uid() = id);

-- favorites / saved_builds / saved_drafts: strictly owner-only.
create policy "own favorites" on favorites for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own saved_builds" on saved_builds for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own saved_drafts" on saved_drafts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- comments: anyone can read, only the author can write/edit/delete their own.
alter table comments enable row level security;
create policy "public read comments" on comments for select using (true);
create policy "insert own comments" on comments for insert with check (auth.uid() = user_id);
create policy "update own comments" on comments for update using (auth.uid() = user_id);
create policy "delete own comments" on comments for delete using (auth.uid() = user_id);
