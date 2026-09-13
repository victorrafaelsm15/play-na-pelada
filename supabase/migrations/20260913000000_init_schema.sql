-- Play na Pelada — schema inicial (tabelas + RLS)
-- Convenção de erros nas funções RPC: 'CODIGO: mensagem em português',
-- consumido pelo cliente em src/services/supabase/services.ts.

create extension if not exists pgcrypto;

-- ═══════════════════════════════════════════ profiles
create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete cascade,
  public_id text unique,
  username text unique,
  name text not null,
  avatar_url text,
  bio text,
  position text check (position in ('goleiro','zagueiro','lateral','volante','meia','ponta','atacante','coringa')),
  dominant_foot text check (dominant_foot in ('direito','esquerdo','ambos')),
  city text,
  social_links jsonb not null default '{"others":[]}'::jsonb,
  titles jsonb not null default '[]'::jsonb,
  videos jsonb not null default '[]'::jsonb,
  skill smallint check (skill between 1 and 5),
  is_guest boolean not null default false,
  created_at timestamptz not null default now(),
  constraint username_format check (username is null or username ~ '^[a-z0-9._]{3,20}$'),
  constraint guest_or_identifiable check (is_guest or (public_id is not null and username is not null))
);
create index profiles_username_idx on public.profiles (username);
create index profiles_public_id_idx on public.profiles (public_id);

-- ═══════════════════════════════════════════ friendships
create table public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  addressee_id uuid not null references public.profiles(id) on delete cascade,
  status text not null check (status in ('pending','accepted')) default 'pending',
  created_at timestamptz not null default now(),
  pair_key text generated always as (
    case when requester_id < addressee_id then requester_id::text || ':' || addressee_id::text
         else addressee_id::text || ':' || requester_id::text end
  ) stored,
  constraint no_self_friend check (requester_id <> addressee_id)
);
create unique index friendships_pair_unique on public.friendships (pair_key);
create index friendships_addressee_idx on public.friendships (addressee_id);

-- ═══════════════════════════════════════════ events
create table public.events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  organizer_id uuid not null references public.profiles(id) on delete cascade,
  date text not null check (date ~ '^\d{4}-\d{2}-\d{2}$'),
  time text not null check (time ~ '^\d{2}:\d{2}$'),
  location jsonb not null,
  privacy text not null check (privacy in ('public','private')) default 'public',
  join_policy text not null check (join_policy in ('auto','approval')) default 'auto',
  max_players int not null check (max_players > 0),
  players_per_team int not null check (players_per_team > 0),
  teams_count int not null check (teams_count >= 2),
  match_duration_min int not null check (match_duration_min > 0),
  price_cents int check (price_cents >= 0),
  notes text,
  rotation_rule text not null check (rotation_rule in ('winner-stays','round-robin')) default 'winner-stays',
  status text not null check (status in ('waiting','confirmed','live','finished','cancelled')) default 'waiting',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index events_organizer_idx on public.events (organizer_id);
create index events_date_idx on public.events (date);

-- ═══════════════════════════════════════════ participants
create table public.participants (
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null check (status in ('confirmed','pending','invited','declined')),
  role text not null check (role in ('owner','organizer','moderator','player')) default 'player',
  joined_at timestamptz not null default now(),
  primary key (event_id, user_id)
);
create index participants_user_idx on public.participants (user_id);
create index participants_event_status_idx on public.participants (event_id, status);

-- ═══════════════════════════════════════════ invitations
create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  receiver_id uuid not null references public.profiles(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  status text not null check (status in ('pending','accepted','declined')) default 'pending',
  created_at timestamptz not null default now()
);
create index invitations_receiver_idx on public.invitations (receiver_id, status);
create unique index invitations_pending_unique on public.invitations (event_id, receiver_id) where status = 'pending';

-- ═══════════════════════════════════════════ teams
create table public.teams (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null,
  color text not null check (color in ('amarelo','branco','verde','vermelho','azul','preto','laranja','roxo')),
  player_ids uuid[] not null default '{}'
);
create index teams_event_idx on public.teams (event_id);

-- ═══════════════════════════════════════════ rotations
create table public.rotations (
  event_id uuid primary key references public.events(id) on delete cascade,
  queue uuid[] not null default '{}'
);

-- ═══════════════════════════════════════════ games
create table public.games (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  round int not null,
  team_a_id uuid not null references public.teams(id) on delete cascade,
  team_b_id uuid not null references public.teams(id) on delete cascade,
  score_a int not null default 0,
  score_b int not null default 0,
  timer jsonb not null default '{"durationMs":0,"accumulatedMs":0,"runningSince":null}'::jsonb,
  started_at timestamptz,
  finished_at timestamptz,
  status text not null check (status in ('scheduled','live','paused','finished')) default 'scheduled',
  winner_team_id uuid references public.teams(id),
  events jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index games_event_idx on public.games (event_id);

-- ═══════════════════════════════════════════ notifications
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('event_invite','join_request','join_approved','event_updated','game_soon','added_to_event','friend_request','friend_accepted')),
  title text not null,
  body text not null,
  link text,
  actor_id uuid references public.profiles(id) on delete set null,
  ref_id text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, read);
