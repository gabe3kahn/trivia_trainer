-- 017_daily_challenge.sql — Compete M2: the shared Daily Challenge + leaderboard + streak.
--
-- Everyone plays the SAME set each day. The FE enforces a 30-second timer per
-- question (seconds_per_question below); the BE records per-question time (clamped
-- to 30s) and uses it only as a leaderboard tiebreak. Grading is client-side
-- (honor system) for Phase 1 — get_daily_challenge returns the full clue payload.

-- The app's "today" rolls over at midnight Pacific (handles PST/PDT). All daily
-- dates default to this so the challenge resets at PT midnight, not UTC.
create or replace function public.app_today()
returns date language sql stable set search_path = public as $$
  select (now() at time zone 'America/Los_Angeles')::date;
$$;

-- ---------------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------------
create table if not exists daily_challenges (
  challenge_date date primary key,
  question_ids   uuid[] not null,
  created_at     timestamptz not null default now()
);
alter table daily_challenges enable row level security;
drop policy if exists "daily_challenges_read_all" on daily_challenges;
create policy "daily_challenges_read_all" on daily_challenges for select using (true);

create table if not exists daily_challenge_attempts (
  id             uuid primary key default gen_random_uuid(),
  challenge_date date not null references daily_challenges(challenge_date) on delete cascade,
  user_id        uuid not null references profiles(id) on delete cascade,
  question_id    uuid not null references questions(id) on delete cascade,
  typed_response text,
  grade          attempt_grade not null,
  points         int not null default 0,
  time_ms        int,  -- per-question answer time, clamped to the 30s cap
  created_at     timestamptz not null default now(),
  unique (challenge_date, user_id, question_id)
);
alter table daily_challenge_attempts enable row level security;
drop policy if exists "dca_own_all" on daily_challenge_attempts;
create policy "dca_own_all" on daily_challenge_attempts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- Friends' rows are exposed only through get_daily_leaderboard (SECURITY DEFINER),
-- so a player can't read others' answers directly.

create index if not exists idx_dca_date on daily_challenge_attempts(challenge_date);

-- ---------------------------------------------------------------------------
-- 2. Generation — one shared set per day. get_daily_challenge also lazily
--    generates if the cron hasn't run yet, so a missed run never breaks play.
--    Pre-generate TOMORROW's set at mid-day PT (pg_cron is fixed-UTC; mid-day is
--    far from the date boundary, so this is DST-proof and the set is ready well
--    before midnight PT). Schedule once, after enabling pg_cron:
--      select cron.schedule('daily-challenge', '0 20 * * *',  -- 20:00 UTC ≈ noon PT
--        $$ select public.generate_daily_challenge(public.app_today() + 1); $$);
-- ---------------------------------------------------------------------------
create or replace function public.generate_daily_challenge(p_date date default app_today(), p_count int default 7)
returns void language plpgsql security definer set search_path = public as $$
declare v_qids uuid[]; v_recent uuid[];
begin
  if exists (select 1 from daily_challenges where challenge_date = p_date) then return; end if;

  -- Questions used in the last 30 days of challenges — avoid repeating them.
  select coalesce(array_agg(qid), '{}') into v_recent
  from (select unnest(question_ids) as qid from daily_challenges where challenge_date > p_date - 30) r;

  -- Primary mix: one question per category (variety), excluding recent ones, then
  -- p_count of those at random, ordered easy→hard so the set ramps in difficulty.
  select array_agg(id order by difficulty_rank) into v_qids
  from (
    select id, difficulty_rank
    from (
      select distinct on (q.category_id) q.id, q.difficulty_rank
      from questions q
      where q.is_active and q.answer not in ('True', 'False')
        and not (q.tags @> array['boolean']::text[])
        and not (q.id = any(v_recent))
      order by q.category_id, random()
    ) per_cat
    order by random()
    limit greatest(p_count, 1)
  ) picked;

  -- Fallback: too few distinct categories available -> flat random from the bank.
  if coalesce(array_length(v_qids, 1), 0) < p_count then
    select array_agg(id order by difficulty_rank) into v_qids
    from (
      select q.id, q.difficulty_rank from questions q
      where q.is_active and q.answer not in ('True', 'False')
        and not (q.tags @> array['boolean']::text[])
      order by random() limit greatest(p_count, 1)
    ) s;
  end if;

  if v_qids is null or array_length(v_qids, 1) < 1 then return; end if;
  insert into daily_challenges (challenge_date, question_ids) values (p_date, v_qids)
  on conflict (challenge_date) do nothing;
end; $$;

-- ---------------------------------------------------------------------------
-- 3. RPCs
-- ---------------------------------------------------------------------------
-- Play payload: the day's clue set + your attempts + the per-question time limit.
create or replace function public.get_daily_challenge(p_date date default app_today())
returns jsonb language plpgsql security definer set search_path = public as $$
declare g daily_challenges%rowtype; me uuid := auth.uid();
begin
  select * into g from daily_challenges where challenge_date = p_date;
  if not found then
    perform public.generate_daily_challenge(p_date);
    select * into g from daily_challenges where challenge_date = p_date;
    if not found then
      return jsonb_build_object('challenge_date', p_date, 'set_size', 0, 'seconds_per_question', 30, 'questions', '[]'::jsonb, 'my_attempts', '[]'::jsonb, 'completed', false);
    end if;
  end if;

  return jsonb_build_object(
    'challenge_date', g.challenge_date,
    'set_size', coalesce(array_length(g.question_ids, 1), 0),
    'seconds_per_question', 30,
    'questions', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', q.id, 'category_id', q.category_id, 'category_name', c.name,
        'subcategory_name', s.name, 'difficulty_rank', q.difficulty_rank,
        'mechanic', q.mechanic, 'constraint_text', q.constraint_text,
        'clue', q.clue, 'answer', q.answer, 'aliases', q.aliases,
        'image_url', q.image_url, 'answer_detail', q.answer_detail
      ) order by array_position(g.question_ids, q.id)), '[]'::jsonb)
      from questions q
      join categories c on c.id = q.category_id
      left join subcategories s on s.id = q.subcategory_id
      where q.id = any(g.question_ids)
    ),
    'my_attempts', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'question_id', a.question_id, 'grade', a.grade, 'points', a.points)), '[]'::jsonb)
      from daily_challenge_attempts a where a.challenge_date = p_date and a.user_id = me
    ),
    'completed', (
      select count(*) >= coalesce(array_length(g.question_ids, 1), 0)
      from daily_challenge_attempts a where a.challenge_date = p_date and a.user_id = me
    )
  );
end; $$;

-- Record one answer. points = difficulty rank (1-5) if correct, else 0 — the score
-- is difficulty-based, NOT the Jeopardy dollar value; time clamped to the 30s cap.
create or replace function public.submit_daily_attempt(
  p_date date, p_question uuid, p_response text, p_grade attempt_grade, p_time_ms int default null
)
returns void language plpgsql security definer set search_path = public as $$
declare g daily_challenges%rowtype; v_pts int; me uuid := auth.uid();
begin
  select * into g from daily_challenges where challenge_date = p_date;
  if not found or not (p_question = any(g.question_ids)) then raise exception 'question not in this day''s challenge'; end if;
  select case when p_grade = 'correct' then q.difficulty_rank else 0 end into v_pts from questions q where q.id = p_question;
  insert into daily_challenge_attempts (challenge_date, user_id, question_id, typed_response, grade, points, time_ms)
  values (p_date, me, p_question, p_response, p_grade, coalesce(v_pts, 0), least(coalesce(p_time_ms, 30000), 30000))
  on conflict (challenge_date, user_id, question_id) do nothing;
end; $$;

-- Leaderboard among you + accepted friends, for a given day. score → correct →
-- faster total time (the timer's payoff).
create or replace function public.get_daily_leaderboard(p_date date default app_today())
returns table (
  user_id uuid, display_name text, username text, avatar_url text,
  score int, correct int, total_time_ms bigint, completed boolean, is_me boolean
)
language sql stable security definer set search_path = public as $$
  with friends as (
    select case when f.requester_id = auth.uid() then f.addressee_id else f.requester_id end as fid
    from friendships f
    where f.status = 'accepted' and auth.uid() in (f.requester_id, f.addressee_id)
  ),
  pool as (select auth.uid() as uid union select fid from friends),
  set_size as (select coalesce(array_length(question_ids, 1), 0) as n from daily_challenges where challenge_date = p_date)
  select a.user_id, p.display_name, p.username, p.avatar_url,
    coalesce(sum(a.points), 0)::int as score,
    count(*) filter (where a.grade = 'correct')::int as correct,
    coalesce(sum(a.time_ms), 0)::bigint as total_time_ms,
    (count(*) >= (select n from set_size)) as completed,
    (a.user_id = auth.uid()) as is_me
  from daily_challenge_attempts a
  join profiles p on p.id = a.user_id
  where a.challenge_date = p_date and a.user_id in (select uid from pool)
  group by a.user_id, p.display_name, p.username, p.avatar_url
  order by score desc, correct desc, total_time_ms asc;
$$;

-- Streak = consecutive days (ending today or yesterday) the Daily Challenge was played.
create or replace function public.daily_streak(p_user uuid default auth.uid())
returns int language sql stable security definer set search_path = public as $$
  with played as (select distinct challenge_date as d from daily_challenge_attempts where user_id = p_user),
  islands as (select d, d - (row_number() over (order by d))::int as grp from played)
  select coalesce((
    select count(*)::int from islands
    where grp = (select grp from islands order by d desc limit 1)
      and (select max(d) from played) >= app_today() - 1
  ), 0);
$$;

-- ---------------------------------------------------------------------------
-- 4. Grants (client RPCs). generate_daily_challenge stays service/cron-only.
-- ---------------------------------------------------------------------------
grant execute on function
  public.app_today(),
  public.get_daily_challenge(date),
  public.submit_daily_attempt(date, uuid, text, attempt_grade, int),
  public.get_daily_leaderboard(date),
  public.daily_streak(uuid)
to authenticated;
