create extension if not exists pgcrypto;

do $$ begin
  create type session_mode as enum ('weakness', 'random', 'selected', 'review', 'wordplay', 'daily', 'challenge');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type attempt_grade as enum ('correct', 'close', 'missed', 'unknown');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type review_state as enum ('learning', 'due', 'suspended', 'mastered');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type friendship_status as enum ('pending', 'accepted', 'blocked');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type game_status as enum ('pending', 'active', 'completed', 'expired', 'canceled');
exception when duplicate_object then null;
end $$;

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  username text unique,
  created_at timestamptz not null default now(),
  last_active_at timestamptz
);

create table if not exists categories (
  id text primary key,
  name text not null unique,
  sort_order int not null
);

create table if not exists subcategories (
  id uuid primary key default gen_random_uuid(),
  category_id text not null references categories(id) on delete cascade,
  name text not null,
  sort_order int not null,
  unique (category_id, name)
);

create table if not exists questions (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'manual_seed',
  source_url text,
  external_id text,
  category_id text not null references categories(id),
  subcategory_id uuid references subcategories(id),
  value int not null check (value in (200, 400, 600, 800, 1000)),
  difficulty_rank int not null check (difficulty_rank between 1 and 5),
  mechanic text not null default 'standard',
  constraint_text text,
  clue text not null,
  answer text not null,
  aliases text[] not null default '{}',
  tags text[] not null default '{}',
  is_active boolean not null default true,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create unique index if not exists questions_source_external_unique_idx
  on questions(source, external_id)
  where external_id is not null;

create table if not exists practice_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  mode session_mode not null,
  selected_categories text[] not null default '{}',
  selected_subcategories uuid[] not null default '{}',
  selected_values int[] not null default '{}',
  selected_mechanics text[] not null default '{}',
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  question_count int not null default 0
);

create table if not exists session_questions (
  session_id uuid not null references practice_sessions(id) on delete cascade,
  question_id uuid not null references questions(id) on delete cascade,
  position int not null,
  primary key (session_id, question_id),
  unique (session_id, position)
);

create table if not exists practice_attempts (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references practice_sessions(id) on delete set null,
  user_id uuid not null references profiles(id) on delete cascade,
  question_id uuid not null references questions(id) on delete cascade,
  typed_response text,
  grade attempt_grade not null,
  confidence int check (confidence between 1 and 5),
  time_to_answer_ms int check (time_to_answer_ms is null or time_to_answer_ms >= 0),
  points_awarded int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists practice_attempts_user_created_idx on practice_attempts(user_id, created_at desc);
create index if not exists practice_attempts_question_idx on practice_attempts(question_id);

create table if not exists review_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  question_id uuid not null references questions(id) on delete cascade,
  source_attempt_id uuid references practice_attempts(id) on delete set null,
  state review_state not null default 'learning',
  due_at timestamptz not null default now(),
  last_reviewed_at timestamptz,
  review_count int not null default 0,
  ease numeric(4, 2) not null default 2.50,
  created_at timestamptz not null default now(),
  unique (user_id, question_id)
);

create index if not exists review_items_due_idx on review_items(user_id, state, due_at);

create table if not exists category_competencies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  dimension_type text not null check (dimension_type in ('overall', 'category', 'subcategory', 'value', 'mechanic', 'tag')),
  dimension_key text not null,
  score int not null default 0 check (score between 0 and 100),
  tier text not null default 'unmapped',
  attempts int not null default 0,
  correct_rate numeric(5, 2) not null default 0,
  avg_correct_value int not null default 0,
  due_review_count int not null default 0,
  seven_day_delta int not null default 0,
  thirty_day_delta int not null default 0,
  updated_at timestamptz not null default now(),
  unique (user_id, dimension_type, dimension_key)
);

create table if not exists daily_activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  activity_date date not null,
  reps int not null default 0,
  review_reps int not null default 0,
  challenge_reps int not null default 0,
  review_cleared boolean not null default false,
  challenge_played boolean not null default false,
  categories_touched text[] not null default '{}',
  daily_goal_met boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (user_id, activity_date)
);

create table if not exists badges (
  key text primary key,
  name text not null,
  description text not null,
  criteria jsonb not null default '{}',
  tier text
);

create table if not exists user_badges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  badge_key text not null references badges(key) on delete cascade,
  earned_at timestamptz not null default now(),
  metadata jsonb not null default '{}',
  unique (user_id, badge_key)
);

create table if not exists friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references profiles(id) on delete cascade,
  addressee_id uuid not null references profiles(id) on delete cascade,
  status friendship_status not null default 'pending',
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  check (requester_id <> addressee_id),
  unique (requester_id, addressee_id)
);

create table if not exists games (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references profiles(id) on delete cascade,
  opponent_id uuid references profiles(id) on delete cascade,
  status game_status not null default 'pending',
  mode text not null default 'head_to_head',
  question_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  completed_at timestamptz
);

create table if not exists game_attempts (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  question_id uuid not null references questions(id) on delete cascade,
  typed_response text,
  grade attempt_grade not null,
  points int not null default 0,
  created_at timestamptz not null default now(),
  unique (game_id, user_id, question_id)
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, username)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    lower(regexp_replace(coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)), '[^a-zA-Z0-9_]', '', 'g'))
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table profiles enable row level security;
alter table categories enable row level security;
alter table subcategories enable row level security;
alter table questions enable row level security;
alter table practice_sessions enable row level security;
alter table session_questions enable row level security;
alter table practice_attempts enable row level security;
alter table review_items enable row level security;
alter table category_competencies enable row level security;
alter table daily_activity enable row level security;
alter table badges enable row level security;
alter table user_badges enable row level security;
alter table friendships enable row level security;
alter table games enable row level security;
alter table game_attempts enable row level security;

create policy "profiles_select_own" on profiles for select using (auth.uid() = id);
create policy "profiles_update_own" on profiles for update using (auth.uid() = id) with check (auth.uid() = id);

create policy "categories_read_all" on categories for select using (true);
create policy "subcategories_read_all" on subcategories for select using (true);
create policy "questions_read_active" on questions for select using (is_active);

create policy "sessions_own_all" on practice_sessions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "session_questions_own_read" on session_questions for select using (
  exists (
    select 1 from practice_sessions s
    where s.id = session_questions.session_id
      and s.user_id = auth.uid()
  )
);
create policy "session_questions_own_insert" on session_questions for insert with check (
  exists (
    select 1 from practice_sessions s
    where s.id = session_questions.session_id
      and s.user_id = auth.uid()
  )
);

create policy "attempts_own_all" on practice_attempts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "review_items_own_all" on review_items for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "competencies_own_read" on category_competencies for select using (auth.uid() = user_id);
create policy "daily_activity_own_read" on daily_activity for select using (auth.uid() = user_id);
create policy "badges_read_all" on badges for select using (true);
create policy "user_badges_own_read" on user_badges for select using (auth.uid() = user_id);

create policy "friendships_involved_read" on friendships for select using (auth.uid() in (requester_id, addressee_id));
create policy "friendships_request_insert" on friendships for insert with check (auth.uid() = requester_id);
create policy "friendships_involved_update" on friendships for update using (auth.uid() in (requester_id, addressee_id));

create policy "games_involved_read" on games for select using (auth.uid() in (creator_id, opponent_id));
create policy "games_creator_insert" on games for insert with check (auth.uid() = creator_id);
create policy "games_involved_update" on games for update using (auth.uid() in (creator_id, opponent_id));

create policy "game_attempts_own_all" on game_attempts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
