-- 031: treat words_language as part of language_wordplay everywhere the user sees or
-- selects a category — not just in the competency math (016).
--
-- words_language and language_wordplay are two BE drafting categories but ONE user-facing
-- category ("Language & Wordplay"). Competency already merges them (016), and the FE now
-- hides the words_language row. But two surfaces still leaked it:
--   * get_recommended_questions filtered/weakness-matched on the RAW category_id, so
--     picking "Language & Wordplay" (language_wordplay) missed the 50 active words_language
--     questions, and weakness mode (keyed on the merged dimension) never served them.
--   * get_activity_summary grouped by raw category_id, so the Activity breakdown showed a
--     separate "Words & Language" row.
-- Both now route category through competency_category().

-- get_recommended_questions — map category through competency_category in the weakness
-- match and the explicit category filter. Return shape unchanged from 023 (no drop needed).
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
    select r.question_id
    from review_items r
    where r.user_id = auth.uid()
      and r.state in ('learning', 'due')
      and r.due_at <= now()
    order by r.due_at asc
    limit greatest(p_limit, 1)
  )
  select
    q.id,
    q.category_id,
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
  join categories c on c.id = q.category_id
  left join subcategories s on s.id = q.subcategory_id
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
    and (p_categories is null or competency_category(q.category_id) = any(p_categories))
    and (p_values is null or q.value = any(p_values))
    and (p_mechanics is null or q.mechanic = any(p_mechanics))
  order by
    case q.quality_status when 'keep' then 0 when 'rewrite' then 1 else 2 end,
    random()
  limit greatest(p_limit, 1);
$$;
grant execute on function public.get_recommended_questions(text, int, text[], int[], text[]) to authenticated;

-- get_activity_summary — group by the merged category so the Activity breakdown shows one
-- "Language & Wordplay" row, not a separate words_language. Only the source select changes.
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
    select pa.created_at, pa.grade, competency_category(q.category_id) as category_id
    from practice_attempts pa
    join questions q on q.id = pa.question_id
    cross join bounds b
    where pa.user_id = b.uid and pa.created_at >= b.since
    union all
    select ga.created_at, ga.grade, competency_category(q.category_id) as category_id
    from game_attempts ga
    join questions q on q.id = ga.question_id
    cross join bounds b
    where ga.user_id = b.uid and ga.created_at >= b.since
    union all
    select da.created_at, da.grade, competency_category(q.category_id) as category_id
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
