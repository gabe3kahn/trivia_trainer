-- 029: competency counts ALL answered questions, not just practice.
--
-- Until now competency (the ring + the 30-day line) was built from practice_attempts
-- only — so a user who did the daily challenge or duels built zero competency, which
-- is wrong: they're all questions that test the same knowledge. This migration rolls
-- game_attempts (duels) and daily_challenge_attempts into the competency source, and
-- adds the recalc triggers those tables were missing.
--
-- Supersedes the function bodies from migrations 016 (recalc) and 028 (timeseries):
-- only the FROM/source changes — the expectation-relative + evidence-shrink math,
-- the category merge, and the recency weighting are identical.

------------------------------------------------------------------------------
-- 1. recalculate_user_competencies — same as 016, but the per-category base
--    reads from all three attempt tables unioned together.
------------------------------------------------------------------------------
create or replace function public.recalculate_user_competencies(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  k_evidence constant numeric := 10.0;  -- reps for full per-category confidence
  k_overall  constant numeric := 15.0;  -- reps for full overall weight
begin
  insert into category_competencies (
    user_id, dimension_type, dimension_key,
    score, tier, attempts, correct_rate, avg_correct_value,
    due_review_count, seven_day_delta, thirty_day_delta, updated_at
  )
  with attempts_all as (
    select user_id, created_at, grade, question_id from practice_attempts
    union all
    select user_id, created_at, grade, question_id from game_attempts
    union all
    select user_id, created_at, grade, question_id from daily_challenge_attempts
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
    from review_items r
    join questions q on q.id = r.question_id
    where r.user_id = p_user_id
      and r.state in ('learning', 'due')
      and r.due_at <= now()
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

------------------------------------------------------------------------------
-- 2. get_competency_timeseries — same as 028, but `att` unions all three sources.
------------------------------------------------------------------------------
create or replace function public.get_competency_timeseries(p_days int default 30)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with bounds as (
    select auth.uid() as uid, greatest(1, p_days) as days
  ),
  cal as (
    select ((now() at time zone 'America/Los_Angeles')::date - g) as d
    from bounds b, generate_series(0, b.days - 1) as g
  ),
  attempts_all as (
    select user_id, created_at, grade, question_id from practice_attempts
    union all
    select user_id, created_at, grade, question_id from game_attempts
    union all
    select user_id, created_at, grade, question_id from daily_challenge_attempts
  ),
  att as (
    select
      (a.created_at at time zone 'America/Los_Angeles')::date as adate,
      attempt_is_correct(a.grade) as ok,
      expected_success(q.value) as par,
      recency_multiplier(a.created_at) as rm,
      competency_category(q.category_id) as cat
    from attempts_all a
    join questions q on q.id = a.question_id
    cross join bounds b
    where a.user_id = b.uid
  ),
  per_day_cat as (
    select
      cal.d,
      att.cat,
      sum(att.ok * att.rm) as act,
      sum(att.par * att.rm) as exp,
      sum(att.rm) as n,
      count(*) as attempts
    from cal
    join att on att.adate <= cal.d
    group by cal.d, att.cat
  ),
  per_day_cat_score as (
    select
      d,
      round(expectation_competency(act, exp, n) * least(1.0, attempts / 10.0))::int as score,
      least(1.0, attempts / 15.0) as w,
      attempts
    from per_day_cat
  ),
  per_day as (
    select
      d,
      coalesce(round(sum(score * w) / nullif(sum(w), 0)), 0)::int as score,
      coalesce(sum(attempts), 0)::int as attempts
    from per_day_cat_score
    group by d
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'date', to_char(c.d, 'YYYY-MM-DD'),
        'score', greatest(0, least(100, coalesce(pd.score, 0))),
        'attempts', coalesce(pd.attempts, 0)
      ) order by c.d
    ),
    '[]'::jsonb
  )
  from cal c
  left join per_day pd on pd.d = c.d;
$$;

------------------------------------------------------------------------------
-- 3. Recalc triggers on game/daily inserts (practice already has one). A light
--    trigger that only refreshes competency — no daily_activity bookkeeping
--    (that stays practice-specific; the streak reads attempts directly).
------------------------------------------------------------------------------
create or replace function public.handle_competency_attempt_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform recalculate_user_competencies(new.user_id);
  return new;
end;
$$;

drop trigger if exists on_game_attempt_competency on game_attempts;
create trigger on_game_attempt_competency
  after insert on game_attempts
  for each row execute function public.handle_competency_attempt_insert();

drop trigger if exists on_daily_attempt_competency on daily_challenge_attempts;
create trigger on_daily_attempt_competency
  after insert on daily_challenge_attempts
  for each row execute function public.handle_competency_attempt_insert();

------------------------------------------------------------------------------
-- 4. Backfill — recompute competency for everyone who has answered anything,
--    so existing accounts reflect the duel/daily attempts immediately.
------------------------------------------------------------------------------
do $$
declare
  v_uid uuid;
begin
  for v_uid in
    select user_id from practice_attempts
    union
    select user_id from game_attempts
    union
    select user_id from daily_challenge_attempts
  loop
    perform recalculate_user_competencies(v_uid);
  end loop;
end;
$$;
