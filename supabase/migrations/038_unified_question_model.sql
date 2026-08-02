-- 038: unified per-user×question model (full unify) + adaptive `balanced` mode.
--
-- Replaces the three split attempt tables (practice_attempts / game_attempts /
-- daily_challenge_attempts) and review_items with TWO structures:
--
--   • user_question_attempts — one immutable row per attempt (the event log, the
--     single source of truth). Recency-weighted competency needs per-attempt
--     timestamps, so this stays granular.
--   • user_questions        — per-(user,question) rollup / read model: serve
--     tracking (last_served_at, serve_count), answer counts, last grade, and the
--     folded SM-2 review scheduling that used to live in review_items.
--
-- ── Compatibility strategy (important) ────────────────────────────────────────
-- The three old table NAMES are recreated as security-invoker VIEWS over the event
-- log, projecting each source back into its original column shape. This keeps every
-- existing reader working UNCHANGED — finalize_game, get_game, get_daily_leaderboard,
-- daily_streak, list_games, get_activity_summary, get_competency_timeseries — so the
-- only functions rewritten here are the three attempt WRITERS, the competency recalc,
-- get_recommended_questions, and the attempt trigger. review_items has only three
-- readers (recalc, get_recommended, the practice trigger), all rewritten below.
--
-- Requires Postgres 15+ (security_invoker views). Supabase is PG15+.
--
-- ── Safety (no-staging prod apply) ────────────────────────────────────────────
-- Two nets, because this drops straight onto prod:
--   1. Runs as ONE transaction with a PARITY GATE at the end — it recomputes competency
--      from the new model and compares to a pre-migration snapshot; a mismatch RAISEs and
--      rolls the WHOLE migration back (nothing renamed/committed). A failed apply is inert.
--   2. The old tables are NOT dropped — they are RENAMED to *_legacy and kept as a frozen
--      rollback/verification copy. Migration 039 drops them once you've confirmed prod is
--      healthy (duels / daily / leaderboards / activity / timeseries). Take a Supabase
--      backup / PITR checkpoint before applying regardless.
-- Depends on migration 037 (attempt_source enum + session_mode 'balanced').

------------------------------------------------------------------------------------
-- 0. Snapshot competency from the CURRENT (old) model at migration-time `now()`.
--    We recompute now (rather than trust stored rows, which were computed at an
--    older now() with different recency weights) so the parity comparison is
--    apples-to-apples against the new-model recompute a few statements later.
------------------------------------------------------------------------------------
do $$
declare r record;
begin
  for r in select distinct user_id from (
    select user_id from practice_attempts
    union select user_id from game_attempts
    union select user_id from daily_challenge_attempts
  ) u loop
    perform public.recalculate_user_competencies(r.user_id);
  end loop;
end $$;

create temp table _competency_snapshot on commit drop as
select user_id, dimension_type, dimension_key, score
from category_competencies;

------------------------------------------------------------------------------------
-- 1. New tables.
------------------------------------------------------------------------------------
create table if not exists user_question_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  question_id uuid not null references questions(id) on delete cascade,
  source attempt_source not null,
  -- Nullable context, set per source (practice run / duel / daily):
  session_id uuid references practice_sessions(id) on delete set null,
  game_id uuid references games(id) on delete cascade,
  challenge_date date references daily_challenges(challenge_date) on delete cascade,
  typed_response text,
  grade attempt_grade not null,
  confidence int check (confidence between 1 and 5),
  time_ms int check (time_ms is null or time_ms >= 0),
  points int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists uqa_user_created_idx on user_question_attempts(user_id, created_at desc);
create index if not exists uqa_question_idx on user_question_attempts(question_id);
create index if not exists uqa_user_question_idx on user_question_attempts(user_id, question_id);
-- Partial unique indexes reproduce the old per-source uniqueness the writers rely on
-- (duel/daily used `on conflict do nothing` to ignore a re-submitted answer).
create unique index if not exists uqa_duel_unique
  on user_question_attempts(game_id, user_id, question_id) where source = 'duel';
create unique index if not exists uqa_daily_unique
  on user_question_attempts(challenge_date, user_id, question_id) where source = 'daily';

create table if not exists user_questions (
  user_id uuid not null references profiles(id) on delete cascade,
  question_id uuid not null references questions(id) on delete cascade,
  -- Serve tracking (written by record_served_questions at run start).
  last_served_at timestamptz,
  serve_count int not null default 0,
  -- Answer rollup (written by the attempt trigger).
  attempt_count int not null default 0,
  correct_count int not null default 0,
  missed_count int not null default 0,
  last_grade attempt_grade,
  last_answered_at timestamptz,
  -- Folded SM-2 review scheduling (formerly review_items). due_at stays NULL until a
  -- question is missed at least once — i.e. NULL due_at == "not in the review cycle",
  -- faithfully mirroring "no review_items row existed".
  review_state review_state not null default 'learning',
  due_at timestamptz,
  ease numeric(4, 2) not null default 2.50,
  review_count int not null default 0,
  last_reviewed_at timestamptz,
  primary key (user_id, question_id)
);

create index if not exists user_questions_due_idx on user_questions(user_id, due_at);
create index if not exists user_questions_served_idx on user_questions(user_id, last_served_at);

------------------------------------------------------------------------------------
-- 2. Backfill the event log from the three old tables (stamped by source).
------------------------------------------------------------------------------------
insert into user_question_attempts
  (id, user_id, question_id, source, session_id, game_id, challenge_date,
   typed_response, grade, confidence, time_ms, points, created_at)
select id, user_id, question_id, 'practice'::attempt_source, session_id, null, null,
       typed_response, grade, confidence, time_to_answer_ms, points_awarded, created_at
from practice_attempts;

insert into user_question_attempts
  (id, user_id, question_id, source, session_id, game_id, challenge_date,
   typed_response, grade, confidence, time_ms, points, created_at)
select id, user_id, question_id, 'duel'::attempt_source, null, game_id, null,
       typed_response, grade, null, time_ms, points, created_at
from game_attempts;

insert into user_question_attempts
  (id, user_id, question_id, source, session_id, game_id, challenge_date,
   typed_response, grade, confidence, time_ms, points, created_at)
select id, user_id, question_id, 'daily'::attempt_source, null, null, challenge_date,
       typed_response, grade, null, time_ms, points, created_at
from daily_challenge_attempts;

------------------------------------------------------------------------------------
-- 3. Backfill the rollup: answer counts from the event log, review fields from
--    review_items. (Every review_items question was a practice attempt, so it's a
--    subset of the event log's questions.)
------------------------------------------------------------------------------------
insert into user_questions
  (user_id, question_id, attempt_count, correct_count, missed_count,
   last_grade, last_answered_at,
   review_state, due_at, ease, review_count, last_reviewed_at)
select
  a.user_id,
  a.question_id,
  count(*)::int,
  count(*) filter (where a.grade = 'correct')::int,
  count(*) filter (where a.grade in ('close', 'missed', 'unknown'))::int,
  (array_agg(a.grade order by a.created_at desc))[1],
  max(a.created_at),
  coalesce(r.state, 'learning'),
  r.due_at,
  coalesce(r.ease, 2.50),
  coalesce(r.review_count, 0),
  r.last_reviewed_at
from user_question_attempts a
left join review_items r on r.user_id = a.user_id and r.question_id = a.question_id
group by a.user_id, a.question_id, r.state, r.due_at, r.ease, r.review_count, r.last_reviewed_at;

------------------------------------------------------------------------------------
-- 4. Drop the practice trigger, then RENAME the old tables to *_legacy (after backfill).
--    Renaming (not dropping) keeps a frozen rollback/verification copy and frees the
--    original names for the compat views in section 5; migration 039 drops them later.
--    FKs follow the rename automatically (incl. review_items -> practice_attempts), and
--    the *_legacy tables become inert — nothing writes to them post-migration.
------------------------------------------------------------------------------------
drop trigger if exists on_practice_attempt_insert on practice_attempts;

alter table review_items rename to review_items_legacy;
alter table practice_attempts rename to practice_attempts_legacy;
alter table game_attempts rename to game_attempts_legacy;
alter table daily_challenge_attempts rename to daily_challenge_attempts_legacy;

------------------------------------------------------------------------------------
-- 5. Compatibility views (security_invoker so RLS applies to the caller — own rows
--    for authenticated clients, all rows inside SECURITY DEFINER RPCs). Each projects
--    the event log back into the original column shape the old readers expect.
------------------------------------------------------------------------------------
create view practice_attempts with (security_invoker = true) as
  select id, session_id, user_id, question_id, typed_response, grade, confidence,
         time_ms as time_to_answer_ms, points as points_awarded, created_at
  from user_question_attempts where source = 'practice';

create view game_attempts with (security_invoker = true) as
  select id, game_id, user_id, question_id, typed_response, grade, points, time_ms, created_at
  from user_question_attempts where source = 'duel';

create view daily_challenge_attempts with (security_invoker = true) as
  select id, challenge_date, user_id, question_id, typed_response, grade, points, time_ms, created_at
  from user_question_attempts where source = 'daily';

------------------------------------------------------------------------------------
-- 6. RLS + grants.
------------------------------------------------------------------------------------
alter table user_question_attempts enable row level security;
create policy uqa_own_all on user_question_attempts
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table user_questions enable row level security;
create policy user_questions_own_all on user_questions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select on user_question_attempts to authenticated;
grant select on user_questions to authenticated;
grant select on practice_attempts, game_attempts, daily_challenge_attempts to authenticated;

------------------------------------------------------------------------------------
-- 7. Attempt trigger: maintain the rollup (counts + SM-2 review + daily_activity).
--    Fires on every event-log insert. The review scheduling + daily_activity write
--    apply to source='practice' only, exactly as the old practice trigger did.
------------------------------------------------------------------------------------
create or replace function public.handle_question_attempt_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_category_id text;
  v_correct int := case when new.grade = 'correct' then 1 else 0 end;
  v_missed  int := case when new.grade in ('close', 'missed', 'unknown') then 1 else 0 end;
begin
  -- Rollup counts (all sources).
  insert into user_questions (
    user_id, question_id, attempt_count, correct_count, missed_count,
    last_grade, last_answered_at
  )
  values (new.user_id, new.question_id, 1, v_correct, v_missed, new.grade, new.created_at)
  on conflict (user_id, question_id) do update set
    attempt_count = user_questions.attempt_count + 1,
    correct_count = user_questions.correct_count + v_correct,
    missed_count = user_questions.missed_count + v_missed,
    last_grade = new.grade,
    last_answered_at = new.created_at;

  if new.source = 'practice' then
    -- SM-2 review scheduling, folded from the old review_items logic.
    if new.grade in ('close', 'missed', 'unknown') then
      update user_questions set
        review_state = 'learning',
        due_at = now() + (case new.grade
          when 'close' then interval '3 days'
          when 'missed' then interval '1 day'
          else interval '12 hours' end),
        ease = greatest(1.30, ease - 0.20)
      where user_id = new.user_id and question_id = new.question_id;
    elsif new.grade = 'correct' then
      -- Only advances questions ALREADY in the review cycle (due_at not null),
      -- mirroring the old UPDATE that touched only existing review_items rows.
      update user_questions set
        review_state = (case when review_count >= 2 then 'mastered' else 'due' end)::review_state,
        last_reviewed_at = now(),
        review_count = review_count + 1,
        due_at = now() + interval '14 days',
        ease = least(3.00, ease + 0.10)
      where user_id = new.user_id and question_id = new.question_id
        and due_at is not null;
    end if;

    select category_id into v_category_id from questions where id = new.question_id;

    insert into daily_activity (
      user_id, activity_date, reps, review_reps, challenge_reps, review_cleared,
      challenge_played, categories_touched, daily_goal_met, updated_at
    )
    values (
      new.user_id,
      (new.created_at at time zone 'UTC')::date,
      1,
      case when exists (
        select 1 from user_questions uq
        where uq.user_id = new.user_id and uq.question_id = new.question_id
          and uq.due_at is not null
      ) then 1 else 0 end,
      0, false, false,
      array[v_category_id],
      false,
      now()
    )
    on conflict (user_id, activity_date) do update set
      reps = daily_activity.reps + 1,
      review_reps = daily_activity.review_reps + excluded.review_reps,
      categories_touched = (
        select array_agg(distinct category_id)
        from unnest(daily_activity.categories_touched || excluded.categories_touched) as category_id
      ),
      daily_goal_met = (daily_activity.reps + 1) >= 30,
      updated_at = now();
  end if;

  return new;
end;
$$;

drop trigger if exists on_question_attempt_insert on user_question_attempts;
create trigger on_question_attempt_insert
  after insert on user_question_attempts
  for each row execute function public.handle_question_attempt_insert();

------------------------------------------------------------------------------------
-- 8. Attempt writers — same signatures, now inserting into the event log. The
--    compat views + partial unique indexes preserve the old on-conflict behavior,
--    and the batch run wrappers (submit_*_run, 033) are unchanged since they call
--    these and recalc.
------------------------------------------------------------------------------------
create or replace function public.submit_practice_attempt(
  p_session_id uuid,
  p_question_id uuid,
  p_typed_response text,
  p_grade attempt_grade,
  p_confidence int default null,
  p_time_to_answer_ms int default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt_id uuid;
  v_value int;
  v_points int;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select value into v_value from questions where id = p_question_id and is_active;
  if v_value is null then
    raise exception 'Question not found';
  end if;

  if p_session_id is not null and not exists (
    select 1 from practice_sessions where id = p_session_id and user_id = auth.uid()
  ) then
    raise exception 'Session not found';
  end if;

  v_points := case p_grade
    when 'correct' then v_value
    when 'close' then floor(v_value * 0.5)::int
    else 0
  end;

  insert into user_question_attempts (
    user_id, question_id, source, session_id, typed_response, grade, confidence, time_ms, points
  )
  values (
    auth.uid(), p_question_id, 'practice', p_session_id, p_typed_response, p_grade,
    p_confidence, p_time_to_answer_ms, v_points
  )
  returning id into v_attempt_id;

  return v_attempt_id;
end;
$$;

create or replace function public.submit_game_attempt(
  p_game uuid, p_question uuid, p_response text, p_grade attempt_grade, p_time_ms int default null
)
returns void language plpgsql security definer set search_path = public as $$
declare g games%rowtype; me uuid := auth.uid(); v_pts int; v_size int;
begin
  select * into g from games where id = p_game;
  if not found or me not in (g.creator_id, g.opponent_id) then raise exception 'not your game'; end if;
  if g.status <> 'active' then raise exception 'game is not active'; end if;
  if not (p_question = any(g.question_ids)) then raise exception 'question not in this game'; end if;

  select case when p_grade = 'correct' then q.difficulty_rank else 0 end into v_pts
  from questions q where q.id = p_question;

  insert into user_question_attempts (game_id, user_id, question_id, source, typed_response, grade, points, time_ms)
  values (p_game, me, p_question, 'duel', p_response, p_grade, coalesce(v_pts, 0), p_time_ms)
  on conflict (game_id, user_id, question_id) where source = 'duel' do nothing;

  v_size := coalesce(array_length(g.question_ids, 1), 0);
  if g.opponent_id is not null
     and (select count(*) from game_attempts where game_id = p_game and user_id = g.creator_id)  >= v_size
     and (select count(*) from game_attempts where game_id = p_game and user_id = g.opponent_id) >= v_size
  then
    perform public.finalize_game(p_game);
  end if;
end; $$;

create or replace function public.submit_daily_attempt(
  p_date date, p_question uuid, p_response text, p_grade attempt_grade, p_time_ms int default null
)
returns void language plpgsql security definer set search_path = public as $$
declare g daily_challenges%rowtype; v_pts int; me uuid := auth.uid();
begin
  select * into g from daily_challenges where challenge_date = p_date;
  if not found or not (p_question = any(g.question_ids)) then raise exception 'question not in this day''s challenge'; end if;
  select case when p_grade = 'correct' then q.difficulty_rank else 0 end into v_pts from questions q where q.id = p_question;
  insert into user_question_attempts (challenge_date, user_id, question_id, source, typed_response, grade, points, time_ms)
  values (p_date, me, p_question, 'daily', p_response, p_grade, coalesce(v_pts, 0), least(coalesce(p_time_ms, 30000), 30000))
  on conflict (challenge_date, user_id, question_id) where source = 'daily' do nothing;
end; $$;

------------------------------------------------------------------------------------
-- 9. record_served_questions — mark a set of questions served (run start), for the
--    adaptive selector's anti-repeat + wordplay cooldown.
------------------------------------------------------------------------------------
create or replace function public.record_served_questions(p_question_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'Authentication required'; end if;
  insert into user_questions (user_id, question_id, last_served_at, serve_count)
  select me, qid, now(), 1
  from (select distinct unnest(coalesce(p_question_ids, '{}'::uuid[])) as qid) s
  on conflict (user_id, question_id) do update set
    last_served_at = now(),
    serve_count = user_questions.serve_count + 1;
end;
$$;

grant execute on function public.record_served_questions(uuid[]) to authenticated;

------------------------------------------------------------------------------------
-- 10. recalculate_user_competencies — same math (expectation-relative, recency-
--     weighted, evidence-shrunk), now reading the single event log + the rollup's
--     due rows. Only the two source CTEs changed vs migration 029.
------------------------------------------------------------------------------------
create or replace function public.recalculate_user_competencies(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  k_evidence constant numeric := 10.0;
  k_overall  constant numeric := 15.0;
begin
  insert into category_competencies (
    user_id, dimension_type, dimension_key,
    score, tier, attempts, correct_rate, avg_correct_value,
    due_review_count, seven_day_delta, thirty_day_delta, updated_at
  )
  with attempts_all as (
    select user_id, created_at, grade, question_id from user_question_attempts
  ),
  base as (
    select
      competency_category(q.category_id) as dimension_key,
      count(*)::int as attempts,
      count(*) filter (where a.created_at <= now() - interval '7 days')::int  as attempts_7d,
      count(*) filter (where a.created_at <= now() - interval '30 days')::int as attempts_30d,
      sum(attempt_is_correct(a.grade) * recency_multiplier(a.created_at)) as act_now,
      sum(expected_success(q.value)   * recency_multiplier(a.created_at)) as exp_now,
      sum(recency_multiplier(a.created_at))                              as n_now,
      sum(attempt_is_correct(a.grade) * recency_multiplier(a.created_at))
        filter (where a.created_at <= now() - interval '7 days') as act_7d,
      sum(expected_success(q.value) * recency_multiplier(a.created_at))
        filter (where a.created_at <= now() - interval '7 days') as exp_7d,
      sum(recency_multiplier(a.created_at))
        filter (where a.created_at <= now() - interval '7 days') as n_7d,
      sum(attempt_is_correct(a.grade) * recency_multiplier(a.created_at))
        filter (where a.created_at <= now() - interval '30 days') as act_30d,
      sum(expected_success(q.value) * recency_multiplier(a.created_at))
        filter (where a.created_at <= now() - interval '30 days') as exp_30d,
      sum(recency_multiplier(a.created_at))
        filter (where a.created_at <= now() - interval '30 days') as n_30d,
      round(100 * avg(case when a.grade = 'correct' then 1 else 0 end), 2) as correct_rate,
      coalesce(round(avg(q.value) filter (where a.grade = 'correct')), 0)::int as avg_correct_value
    from attempts_all a
    join questions q on q.id = a.question_id
    where a.user_id = p_user_id
    group by competency_category(q.category_id)
  ),
  smoothed as (
    select
      dimension_key,
      attempts,
      correct_rate,
      avg_correct_value,
      round(expectation_competency(act_now, exp_now, n_now)  * least(1.0, attempts / k_evidence))::int     as score,
      round(expectation_competency(act_7d, exp_7d, n_7d)     * least(1.0, attempts_7d / k_evidence))::int  as score_7d,
      round(expectation_competency(act_30d, exp_30d, n_30d)  * least(1.0, attempts_30d / k_evidence))::int as score_30d
    from base
  ),
  due_counts as (
    select competency_category(q.category_id) as dimension_key, count(*)::int as due_review_count
    from user_questions uq
    join questions q on q.id = uq.question_id
    where uq.user_id = p_user_id
      and uq.due_at is not null
      and uq.review_state in ('learning', 'due')
      and uq.due_at <= now()
    group by competency_category(q.category_id)
  )
  select
    p_user_id,
    'category',
    s.dimension_key,
    greatest(0, least(100, s.score)),
    tier_for_score(greatest(0, least(100, s.score))),
    s.attempts,
    s.correct_rate,
    s.avg_correct_value,
    coalesce(dc.due_review_count, 0),
    s.score - s.score_7d,
    s.score - s.score_30d,
    now()
  from smoothed s
  left join due_counts dc on dc.dimension_key = s.dimension_key
  on conflict (user_id, dimension_type, dimension_key)
  do update set
    score = excluded.score,
    tier = excluded.tier,
    attempts = excluded.attempts,
    correct_rate = excluded.correct_rate,
    avg_correct_value = excluded.avg_correct_value,
    due_review_count = excluded.due_review_count,
    seven_day_delta = excluded.seven_day_delta,
    thirty_day_delta = excluded.thirty_day_delta,
    updated_at = now();

  insert into category_competencies (
    user_id, dimension_type, dimension_key,
    score, tier, attempts, correct_rate, avg_correct_value,
    due_review_count, seven_day_delta, thirty_day_delta, updated_at
  )
  with cat as (
    select
      score, attempts, correct_rate, avg_correct_value, due_review_count,
      seven_day_delta, thirty_day_delta,
      least(1.0, attempts / k_overall) as w
    from category_competencies
    where user_id = p_user_id and dimension_type = 'category'
  ),
  agg as (
    select
      coalesce(round(sum(score * w) / nullif(sum(w), 0)), 0)::int as score,
      coalesce(round(sum((score - seven_day_delta) * w) / nullif(sum(w), 0)), 0)::int as score_7d,
      coalesce(round(sum((score - thirty_day_delta) * w) / nullif(sum(w), 0)), 0)::int as score_30d,
      coalesce(sum(attempts), 0)::int as attempts,
      coalesce(round(avg(correct_rate), 2), 0) as correct_rate,
      coalesce(round(avg(avg_correct_value)), 0)::int as avg_correct_value,
      coalesce(sum(due_review_count), 0)::int as due_review_count
    from cat
  )
  select
    p_user_id,
    'overall',
    'overall',
    greatest(0, least(100, score)),
    tier_for_score(greatest(0, least(100, score))),
    attempts,
    correct_rate,
    avg_correct_value,
    due_review_count,
    score - score_7d,
    score - score_30d,
    now()
  from agg
  on conflict (user_id, dimension_type, dimension_key)
  do update set
    score = excluded.score,
    tier = excluded.tier,
    attempts = excluded.attempts,
    correct_rate = excluded.correct_rate,
    avg_correct_value = excluded.avg_correct_value,
    due_review_count = excluded.due_review_count,
    seven_day_delta = excluded.seven_day_delta,
    thirty_day_delta = excluded.thirty_day_delta,
    updated_at = now();
end;
$$;

------------------------------------------------------------------------------------
-- 11. get_recommended_questions — same signature/shape/existing modes, review mode
--     now reads user_questions, plus a new adaptive `balanced` mode.
--
--     balanced (drivers, all inside one flat query):
--       • blend across ALL categories, skewed toward weaker ones (not a bottom-3 gate);
--       • difficulty steered by competency (low score → easier target rank);
--       • missed-priority: due non-wordplay review rows float to the top;
--       • wordplay 30-day cooldown (language_wordplay clues served in the last 30 days
--         are excluded; if that empties wordplay, it's simply absent that run);
--       • no immediate repeats: exclude anything served in the last 8 hours.
------------------------------------------------------------------------------------
create or replace function public.get_recommended_questions(
  p_mode text default 'weakness',
  p_limit int default 12,
  p_categories text[] default null,
  p_values int[] default null,
  p_mechanics text[] default null
)
returns table (
  id uuid,
  category_id text,
  category_name text,
  subcategory_id uuid,
  subcategory_name text,
  value int,
  difficulty_rank int,
  mechanic text,
  constraint_text text,
  clue text,
  answer text,
  aliases text[],
  tags text[],
  image_url text,
  image_attribution text,
  answer_detail text,
  answer_type text
)
language sql
stable
as $$
  with weak_categories as (
    select dimension_key
    from category_competencies
    where user_id = auth.uid()
      and dimension_type = 'category'
    order by score asc, due_review_count desc
    limit 3
  ),
  review_questions as (
    select uq.question_id
    from user_questions uq
    where uq.user_id = auth.uid()
      and uq.due_at is not null
      and uq.review_state in ('learning', 'due')
      and uq.due_at <= now()
    order by uq.due_at asc
    limit greatest(p_limit, 1)
  )
  select
    q.id,
    competency_category(q.category_id) as category_id,
    c.name as category_name,
    q.subcategory_id,
    s.name as subcategory_name,
    q.value,
    q.difficulty_rank,
    q.mechanic,
    q.constraint_text,
    q.clue,
    q.answer,
    q.aliases,
    q.tags,
    q.image_url,
    q.image_attribution,
    q.answer_detail,
    q.answer_type
  from questions q
  join categories c on c.id = competency_category(q.category_id)
  left join subcategories s on s.id = q.subcategory_id
  left join category_competencies cc
    on cc.user_id = auth.uid()
   and cc.dimension_type = 'category'
   and cc.dimension_key = competency_category(q.category_id)
  left join user_questions uq
    on uq.user_id = auth.uid()
   and uq.question_id = q.id
  where q.is_active
    and q.quality_status in ('keep', 'rewrite', 'unreviewed')
    and q.answer not in ('True', 'False')
    and not (q.tags @> array['boolean']::text[])
    and q.clue !~* 'which (of the following|one of these|of these)'
    and (
      p_mode <> 'review'
      or q.id in (select question_id from review_questions)
    )
    and (
      p_mode <> 'weakness'
      or not exists (select 1 from weak_categories)
      or competency_category(q.category_id) in (select dimension_key from weak_categories)
    )
    -- balanced-only gates: anti-repeat (8h) + wordplay 30-day cooldown.
    and (
      p_mode <> 'balanced'
      or (
        (uq.last_served_at is null or uq.last_served_at <= now() - interval '8 hours')
        and (
          competency_category(q.category_id) <> 'language_wordplay'
          or uq.last_served_at is null
          or uq.last_served_at <= now() - interval '30 days'
        )
      )
    )
    and (p_categories is null or competency_category(q.category_id) = any(p_categories))
    and (p_values is null or q.value = any(p_values))
    and (p_mechanics is null or q.mechanic = any(p_mechanics))
  order by
    -- balanced: due non-wordplay misses first.
    case when p_mode = 'balanced'
          and uq.due_at is not null and uq.due_at <= now()
          and uq.review_state in ('learning', 'due')
          and competency_category(q.category_id) <> 'language_wordplay'
         then 0 else 1 end,
    case q.quality_status when 'keep' then 0 when 'rewrite' then 1 else 2 end,
    -- balanced: weighted-random key — level-appropriate difficulty (small distance to
    -- the competency-implied target rank) and weaker categories (small score) sort
    -- earlier, with random() spreading so the mix still spans strengths. target rank
    -- 1..5 from score: 0→1 (easy) .. 100→5. Other modes fall through to random() only.
    case when p_mode = 'balanced'
         then (abs(q.difficulty_rank - (1 + round(coalesce(cc.score, 50) / 25.0)))::numeric + 1)
              * (coalesce(cc.score, 50) + 10)
              * random()
         else 0 end,
    random()
  limit greatest(p_limit, 1);
$$;

grant execute on function public.get_recommended_questions(text, int, text[], int[], text[]) to authenticated;

------------------------------------------------------------------------------------
-- 12. PARITY GATE — recompute competency from the new model for every user and
--     compare to the pre-migration snapshot. A difference (tolerance 1 point, to
--     absorb the few seconds of recency drift between the two recomputes) RAISEs and
--     rolls back the entire migration. Nothing is dropped/committed unless parity holds.
------------------------------------------------------------------------------------
do $$
declare r record; v_bad int; v_missing int;
begin
  for r in select distinct user_id from user_question_attempts loop
    perform public.recalculate_user_competencies(r.user_id);
  end loop;

  select count(*) into v_bad
  from category_competencies c
  join _competency_snapshot s
    on s.user_id = c.user_id
   and s.dimension_type = c.dimension_type
   and s.dimension_key = c.dimension_key
  where abs(c.score - s.score) > 1;

  select count(*) into v_missing
  from _competency_snapshot s
  left join category_competencies c
    on c.user_id = s.user_id
   and c.dimension_type = s.dimension_type
   and c.dimension_key = s.dimension_key
  where c.user_id is null;

  if v_bad > 0 or v_missing > 0 then
    raise exception
      'Competency parity check FAILED: % score rows differ (>1), % dimension rows missing. Rolling back.',
      v_bad, v_missing;
  end if;
end $$;
