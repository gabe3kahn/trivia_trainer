-- Expectation-relative competency scoring.
--
-- Replaces the "difficulty as weight" model (where missing a hard clue hurt MORE
-- than missing an easy one — backwards for a competency metric) with a
-- "difficulty as expectation" model:
--
--   * Each clue has an expected success rate by difficulty (a "par"):
--       $200 .85   $400 .75   $600 .60   $800 .45   $1000 .30
--   * Results are BINARY: correct (incl. near-string matches the grader treats
--     as correct) = 1; everything else = 0. No partial "close" credit.
--   * A category's raw score is performance vs that par, mapped to 0..100 where
--     50 = exactly at expectation, 100 = beat every clue, 0 = got nothing:
--
--       actual   = Σ(correct_i × recency_i)
--       expected = Σ(par(value_i) × recency_i)
--       n        = Σ(recency_i)
--       raw = actual >= expected
--               ? 50 + 50·(actual−expected)/(n−expected)   -- above par
--               : 50·actual/expected                        -- below par
--
-- This makes missing an EASY clue hurt (it had high expected success, so falling
-- short drags you well below par) while getting a HARD clue right is a big
-- reward (low expected success, so you beat par by a lot) — the opposite of the
-- old model, and the right behavior for "how good am I".
--
-- The displayed score is then evidence-shrunk toward 0 (min(1, attempts/10)) so
-- a thin category reads as Unmapped and climbs as you prove competency, same as
-- migration 010. Tiers now mean "competency above par": 50 ≈ Developing (you
-- perform about as expected), higher tiers require beating expectations.
--
-- The par rates are fixed constants for now; they're the natural place to plug
-- in empirical, per-clue difficulty (IRT) once there's enough real attempt data.

create or replace function public.expected_success(p_value int)
returns numeric
language sql
immutable
as $$
  select case p_value
    when 200 then 0.85
    when 400 then 0.75
    when 600 then 0.60
    when 800 then 0.45
    when 1000 then 0.30
    else 0.60
  end;
$$;

create or replace function public.attempt_is_correct(p_grade attempt_grade)
returns int
language sql
immutable
as $$
  -- 'close' is retained only for legacy rows; the grader no longer emits it and
  -- a near-string match is now graded 'correct'.
  select case when p_grade in ('correct', 'close') then 1 else 0 end;
$$;

create or replace function public.expectation_competency(p_actual numeric, p_expected numeric, p_n numeric)
returns numeric
language sql
immutable
as $$
  select case
    when p_n is null or p_n = 0 then 0
    when p_actual >= p_expected
      then least(100, 50 + 50 * (p_actual - p_expected) / nullif(p_n - p_expected, 0))
    else greatest(0, 50 * p_actual / nullif(p_expected, 0))
  end;
$$;

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
  --------------------------------------------------------------------------
  -- Per-category competencies
  --------------------------------------------------------------------------
  insert into category_competencies (
    user_id, dimension_type, dimension_key,
    score, tier, attempts, correct_rate, avg_correct_value,
    due_review_count, seven_day_delta, thirty_day_delta, updated_at
  )
  with base as (
    select
      q.category_id as dimension_key,
      count(*)::int as attempts,
      count(*) filter (where a.created_at <= now() - interval '7 days')::int  as attempts_7d,
      count(*) filter (where a.created_at <= now() - interval '30 days')::int as attempts_30d,
      -- "now" window
      sum(attempt_is_correct(a.grade) * recency_multiplier(a.created_at)) as act_now,
      sum(expected_success(q.value)   * recency_multiplier(a.created_at)) as exp_now,
      sum(recency_multiplier(a.created_at))                              as n_now,
      -- as-of 7 days ago (attempts that already existed then)
      sum(attempt_is_correct(a.grade) * recency_multiplier(a.created_at))
        filter (where a.created_at <= now() - interval '7 days') as act_7d,
      sum(expected_success(q.value) * recency_multiplier(a.created_at))
        filter (where a.created_at <= now() - interval '7 days') as exp_7d,
      sum(recency_multiplier(a.created_at))
        filter (where a.created_at <= now() - interval '7 days') as n_7d,
      -- as-of 30 days ago
      sum(attempt_is_correct(a.grade) * recency_multiplier(a.created_at))
        filter (where a.created_at <= now() - interval '30 days') as act_30d,
      sum(expected_success(q.value) * recency_multiplier(a.created_at))
        filter (where a.created_at <= now() - interval '30 days') as exp_30d,
      sum(recency_multiplier(a.created_at))
        filter (where a.created_at <= now() - interval '30 days') as n_30d,
      round(100 * avg(case when a.grade = 'correct' then 1 else 0 end), 2) as correct_rate,
      coalesce(round(avg(q.value) filter (where a.grade = 'correct')), 0)::int as avg_correct_value
    from practice_attempts a
    join questions q on q.id = a.question_id
    where a.user_id = p_user_id
    group by q.category_id
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
    select q.category_id as dimension_key, count(*)::int as due_review_count
    from review_items r
    join questions q on q.id = r.question_id
    where r.user_id = p_user_id
      and r.state in ('learning', 'due')
      and r.due_at <= now()
    group by q.category_id
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

  --------------------------------------------------------------------------
  -- Overall competency: evidence-weighted average of the smoothed category
  -- scores, with matching recent-vs-prior deltas.
  --------------------------------------------------------------------------
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
