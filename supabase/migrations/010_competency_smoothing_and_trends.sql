-- Competency smoothing + real trend deltas.
--
-- Fixes two issues found while reviewing the Home ratings:
--   1. Per-category scores lurched because the raw weighted ratio had no prior;
--      with few attempts a single answer could swing a category 20+ points.
--   2. seven_day_delta / thirty_day_delta were always 0 — they were inserted as
--      literals AND never set in the ON CONFLICT update, so the Home trend line
--      and "This week" movers were driven by dead data.
--
-- Model (competency-only gamification): a category's displayed score is the raw
-- difficulty/recency-weighted accuracy SHRUNK toward 0 ("Unmapped") by evidence:
--
--     evidence   = min(1, attempts / 10)        -- 0..1, full confidence at ~10 reps
--     score      = round(raw_weighted * evidence)
--
-- So a freshly-touched category starts near Unmapped and climbs as you prove
-- competency across reps (the core game loop), and each new attempt moves the
-- score less as evidence accrues — no more lurching.
--
-- Trends compare the current smoothed score against the smoothed score computed
-- over only the attempts that existed N days ago (a heuristic recent-vs-prior
-- delta; recency weighting is left relative to now, which is fine for a trend).

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
  with raw as (
    select
      q.category_id as dimension_key,
      count(*)::int as attempts,
      count(*) filter (where a.created_at <= now() - interval '7 days')::int  as attempts_7d,
      count(*) filter (where a.created_at <= now() - interval '30 days')::int as attempts_30d,
      -- raw difficulty/recency-weighted accuracy, 0..100, over each window
      100 * sum(attempt_grade_weight(a.grade) * value_multiplier(q.value) * recency_multiplier(a.created_at))
        / nullif(sum(value_multiplier(q.value) * recency_multiplier(a.created_at)), 0) as raw_now,
      100 * sum(attempt_grade_weight(a.grade) * value_multiplier(q.value) * recency_multiplier(a.created_at))
              filter (where a.created_at <= now() - interval '7 days')
        / nullif(sum(value_multiplier(q.value) * recency_multiplier(a.created_at))
              filter (where a.created_at <= now() - interval '7 days'), 0) as raw_7d,
      100 * sum(attempt_grade_weight(a.grade) * value_multiplier(q.value) * recency_multiplier(a.created_at))
              filter (where a.created_at <= now() - interval '30 days')
        / nullif(sum(value_multiplier(q.value) * recency_multiplier(a.created_at))
              filter (where a.created_at <= now() - interval '30 days'), 0) as raw_30d,
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
      round(coalesce(raw_now, 0)  * least(1.0, attempts / k_evidence))::int     as score,
      round(coalesce(raw_7d, 0)   * least(1.0, attempts_7d / k_evidence))::int  as score_7d,
      round(coalesce(raw_30d, 0)  * least(1.0, attempts_30d / k_evidence))::int as score_30d
    from raw
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
      -- prior-window overall reconstructed from each category's delta
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
