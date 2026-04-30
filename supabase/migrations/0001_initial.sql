-- ─── Extensions ──────────────────────────────────────────
create extension if not exists "pgcrypto";

-- ─── Tables ──────────────────────────────────────────────

create table public.people (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references auth.users(id) on delete cascade not null,
  display_name   text not null,
  photo_url      text,
  phone_numbers  text[] default '{}',
  emails         text[] default '{}',
  group_key      text check (group_key in (
    'family','work','friend','business','acquaintance','community','other'
  )),
  role_key       text check (role_key in (
    'key','gatekeeper','connector','mentor','dormant','none'
  )) default 'none',
  tags           text[] default '{}',
  strength       smallint check (strength between 1 and 5) default 3,
  last_contact   date,
  met_at         text,
  notes          text,
  sources        jsonb default '[]'::jsonb,
  archived       boolean default false,
  pinned_x       real,
  pinned_y       real,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

create table public.connections (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  from_id     uuid references public.people(id) on delete cascade not null,
  to_id       uuid references public.people(id) on delete cascade not null,
  type        text check (type in (
    'family','work','friend','business','acquaintance','community','bridge','other'
  )),
  directed    boolean not null default false,
  strength    smallint check (strength between 1 and 5),
  context     text,
  confidence  text check (confidence in ('confirmed','inferred','suggested')) default 'confirmed',
  created_at  timestamptz default now(),
  unique (user_id, from_id, to_id),
  check (from_id <> to_id)
);

create table public.groups_custom (
  id       uuid primary key default gen_random_uuid(),
  user_id  uuid references auth.users(id) on delete cascade not null,
  key      text not null,
  label    text not null,
  color    text not null,
  icon     text,
  unique (user_id, key)
);

-- ─── Updated-at trigger ──────────────────────────────────
create or replace function public.set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger people_updated_at before update on public.people
  for each row execute function public.set_updated_at();

-- ─── Indexes ─────────────────────────────────────────────
create index people_user_archived_idx on public.people (user_id, archived);
create index people_group_idx        on public.people (user_id, group_key);
create index people_role_idx         on public.people (user_id, role_key);
create index people_name_idx         on public.people using gin (to_tsvector('simple', display_name));
create index connections_user_from   on public.connections (user_id, from_id);
create index connections_user_to     on public.connections (user_id, to_id);
create unique index connections_user_undirected_pair_idx
  on public.connections (user_id, least(from_id, to_id), greatest(from_id, to_id))
  where directed = false;

-- ─── Row Level Security ──────────────────────────────────
alter table public.people         enable row level security;
alter table public.connections    enable row level security;
alter table public.groups_custom  enable row level security;

create policy "own_people"       on public.people        for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own_connections"  on public.connections   for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own_groups"       on public.groups_custom for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
