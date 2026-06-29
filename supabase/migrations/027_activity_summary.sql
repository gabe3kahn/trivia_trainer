-- 027: activity summary for the Home 30-day chart + Activity detail screen.
--
-- Aggregates the user's attempts across all three sources (practice + duel +
-- daily-challenge) over the last p_days, bucketed by PT calendar day (matching
-- app_today()). Returns ONE json object so the client makes a single call:
--   daily:       [{date, total, correct, missed, by_category:{<category_id>:n}}]  -- days with activity
--   by_category: [{category_id, reps, correct, accuracy}]                          -- period totals
--
-- "correct" = grade in ('correct','close'); everything else counts as missed. The client
-- fills the empty days in the 30-slot strip and joins competency deltas from
-- category_competencies. SECURITY DEFINER + auth.uid() scoping (same as the other RPCs).

create or replace function public.get_activity_summary(p_days int default 30)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with bounds as (
    select auth.uid() as uid,
           (now() - make_interval(days => greatest(1, p_days))) as since
  ),
  attempts as (
    select pa.created_at, pa.grade, q.category_id
    from practice_attempts pa
    join questions q on q.id = pa.question_id
    cross join bounds b
    where pa.user_id = b.uid and pa.created_at >= b.since
    union all
    select ga.created_at, ga.grade, q.category_id
    from game_attempts ga
    join questions q on q.id = ga.question_id
    cross join bounds b
    where ga.user_id = b.uid and ga.created_at >= b.since
    union all
    select da.created_at, da.grade, q.category_id
    from daily_challenge_attempts da
    join questions q on q.id = da.question_id
    cross join bounds b
    where da.user_id = b.uid and da.created_at >= b.since
  ),
  marked as (
    select (created_at at time zone 'America/Los_Angeles')::date as d,
           category_id,
           case when grade in ('correct', 'close') then 1 else 0 end as is_correct
    from attempts
  ),
  per_day_cat as (
    select d, category_id, count(*)::int as n, sum(is_correct)::int as c
    from marked
    group by d, category_id
  ),
  daily as (
    select d,
           sum(n)::int as total,
           sum(c)::int as correct,
           (sum(n) - sum(c))::int as missed,
           coalesce(
             jsonb_object_agg(category_id::text, n) filter (where category_id is not null),
             '{}'::jsonb
           ) as by_category
    from per_day_cat
    group by d
  ),
  per_cat as (
    select category_id, sum(n)::int as reps, sum(c)::int as correct
    from per_day_cat
    where category_id is not null
    group by category_id
  )
  select jsonb_build_object(
    'daily', coalesce((
      select jsonb_agg(jsonb_build_object(
        'date', d, 'total', total, 'correct', correct, 'missed', missed, 'by_category', by_category
      ) order by d)
      from daily
    ), '[]'::jsonb),
    'by_category', coalesce((
      select jsonb_agg(jsonb_build_object(
        'category_id', category_id, 'reps', reps, 'correct', correct,
        'accuracy', round(100.0 * correct / nullif(reps, 0))
      ) order by reps desc)
      from per_cat
    ), '[]'::jsonb)
  );
$$;

grant execute on function public.get_activity_summary(int) to authenticated;
