-- 028: overall competency over time, for the Home 30-day chart.
--
-- Recomputes the user's OVERALL competency "as of the end of" each of the last
-- p_days PT calendar days, mirroring recalculate_user_competencies (migration 016)
-- exactly so the final (today) point equals the current ring score:
--   * practice_attempts only, category merged via competency_category()
--   * expectation-relative score per category, evidence-shrunk (k_evidence = 10)
--   * overall = evidence-weighted (k_overall = 15) mean of the category scores
--
-- recency_multiplier is evaluated relative to now() (same as the live 7d/30d
-- deltas), so a point at day D reflects the attempts that existed by end of D,
-- weighted the way the app weights them today. A day is computed from every
-- attempt on or before that PT date; days before the first attempt are 0.
-- Returns [{date, score, attempts}] ascending. SECURITY DEFINER + auth.uid().

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
  att as (
    select
      (a.created_at at time zone 'America/Los_Angeles')::date as adate,
      attempt_is_correct(a.grade) as ok,
      expected_success(q.value) as par,
      recency_multiplier(a.created_at) as rm,
      competency_category(q.category_id) as cat
    from practice_attempts a
    join questions q on q.id = a.question_id
    cross join bounds b
    where a.user_id = b.uid
  ),
  -- per (day, category): aggregate every attempt up to and including that PT day
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

grant execute on function public.get_competency_timeseries(int) to authenticated;
