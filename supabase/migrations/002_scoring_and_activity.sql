create or replace function public.attempt_grade_weight(p_grade attempt_grade)
returns numeric
language sql
immutable
as $$
  select case p_grade
    when 'correct' then 1.00
    when 'close' then 0.55
    when 'missed' then 0.15
    when 'unknown' then 0.00
  end;
$$;

create or replace function public.value_multiplier(p_value int)
returns numeric
language sql
immutable
as $$
  select case p_value
    when 200 then 0.70
    when 400 then 0.85
    when 600 then 1.00
    when 800 then 1.25
    when 1000 then 1.55
    else 1.00
  end;
$$;

create or replace function public.recency_multiplier(p_created_at timestamptz)
returns numeric
language sql
stable
as $$
  select case
    when p_created_at >= now() - interval '7 days' then 1.00
    when p_created_at >= now() - interval '30 days' then 0.85
    when p_created_at >= now() - interval '90 days' then 0.65
    else 0.45
  end;
$$;

create or replace function public.tier_for_score(p_score int)
returns text
language sql
immutable
as $$
  select case
    when p_score >= 90 then 'mastered'
    when p_score >= 75 then 'strong'
    when p_score >= 60 then 'solid'
    when p_score >= 40 then 'developing'
    when p_score >= 20 then 'familiar'
    else 'unmapped'
  end;
$$;

create or replace function public.recalculate_user_competencies(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into category_competencies (
    user_id,
    dimension_type,
    dimension_key,
    score,
    tier,
    attempts,
    correct_rate,
    avg_correct_value,
    due_review_count,
    seven_day_delta,
    thirty_day_delta,
    updated_at
  )
  with category_attempts as (
    select
      q.category_id as dimension_key,
      count(*)::int as attempts,
      round(
        100 * sum(attempt_grade_weight(a.grade) * value_multiplier(q.value) * recency_multiplier(a.created_at))
        / nullif(sum(value_multiplier(q.value) * recency_multiplier(a.created_at)), 0)
      )::int as score,
      round(100 * avg(case when a.grade = 'correct' then 1 else 0 end), 2) as correct_rate,
      coalesce(round(avg(q.value) filter (where a.grade = 'correct')), 0)::int as avg_correct_value
    from practice_attempts a
    join questions q on q.id = a.question_id
    where a.user_id = p_user_id
    group by q.category_id
  ),
  due_counts as (
    select
      q.category_id as dimension_key,
      count(*)::int as due_review_count
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
    ca.dimension_key,
    greatest(0, least(100, ca.score)),
    tier_for_score(greatest(0, least(100, ca.score))),
    ca.attempts,
    ca.correct_rate,
    ca.avg_correct_value,
    coalesce(dc.due_review_count, 0),
    0,
    0,
    now()
  from category_attempts ca
  left join due_counts dc on dc.dimension_key = ca.dimension_key
  on conflict (user_id, dimension_type, dimension_key)
  do update set
    score = excluded.score,
    tier = excluded.tier,
    attempts = excluded.attempts,
    correct_rate = excluded.correct_rate,
    avg_correct_value = excluded.avg_correct_value,
    due_review_count = excluded.due_review_count,
    updated_at = now();

  insert into category_competencies (
    user_id,
    dimension_type,
    dimension_key,
    score,
    tier,
    attempts,
    correct_rate,
    avg_correct_value,
    due_review_count,
    seven_day_delta,
    thirty_day_delta,
    updated_at
  )
  with category_scores as (
    select
      score,
      attempts,
      correct_rate,
      avg_correct_value,
      due_review_count,
      least(1.0, attempts / 15.0) as evidence_weight
    from category_competencies
    where user_id = p_user_id
      and dimension_type = 'category'
  ),
  overall as (
    select
      coalesce(round(sum(score * evidence_weight) / nullif(sum(evidence_weight), 0)), 0)::int as score,
      coalesce(sum(attempts), 0)::int as attempts,
      coalesce(round(avg(correct_rate), 2), 0) as correct_rate,
      coalesce(round(avg(avg_correct_value)), 0)::int as avg_correct_value,
      coalesce(sum(due_review_count), 0)::int as due_review_count
    from category_scores
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
    0,
    0,
    now()
  from overall
  on conflict (user_id, dimension_type, dimension_key)
  do update set
    score = excluded.score,
    tier = excluded.tier,
    attempts = excluded.attempts,
    correct_rate = excluded.correct_rate,
    avg_correct_value = excluded.avg_correct_value,
    due_review_count = excluded.due_review_count,
    updated_at = now();
end;
$$;

create or replace function public.handle_practice_attempt_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_category_id text;
  v_due_at timestamptz;
begin
  select category_id into v_category_id
  from questions
  where id = new.question_id;

  if new.grade in ('close', 'missed', 'unknown') then
    v_due_at := case new.grade
      when 'close' then now() + interval '3 days'
      when 'missed' then now() + interval '1 day'
      else now() + interval '12 hours'
    end;

    insert into review_items (user_id, question_id, source_attempt_id, state, due_at)
    values (new.user_id, new.question_id, new.id, 'learning', v_due_at)
    on conflict (user_id, question_id)
    do update set
      source_attempt_id = excluded.source_attempt_id,
      state = 'learning',
      due_at = excluded.due_at,
      ease = greatest(1.30, review_items.ease - 0.20);
  elsif new.grade = 'correct' then
    update review_items
    set
      state = (case when review_count >= 2 then 'mastered' else 'due' end)::review_state,
      last_reviewed_at = now(),
      review_count = review_count + 1,
      due_at = now() + interval '14 days',
      ease = least(3.00, ease + 0.10)
    where user_id = new.user_id
      and question_id = new.question_id;
  end if;

  insert into daily_activity (
    user_id,
    activity_date,
    reps,
    review_reps,
    challenge_reps,
    review_cleared,
    challenge_played,
    categories_touched,
    daily_goal_met,
    updated_at
  )
  values (
    new.user_id,
    (new.created_at at time zone 'UTC')::date,
    1,
    case when exists (
      select 1 from review_items r
      where r.user_id = new.user_id
        and r.question_id = new.question_id
    ) then 1 else 0 end,
    0,
    false,
    false,
    array[v_category_id],
    false,
    now()
  )
  on conflict (user_id, activity_date)
  do update set
    reps = daily_activity.reps + 1,
    review_reps = daily_activity.review_reps + excluded.review_reps,
    categories_touched = (
      select array_agg(distinct category_id)
      from unnest(daily_activity.categories_touched || excluded.categories_touched) as category_id
    ),
    daily_goal_met = (daily_activity.reps + 1) >= 30,
    updated_at = now();

  perform recalculate_user_competencies(new.user_id);

  return new;
end;
$$;

drop trigger if exists on_practice_attempt_insert on practice_attempts;
create trigger on_practice_attempt_insert
  after insert on practice_attempts
  for each row execute function public.handle_practice_attempt_insert();
