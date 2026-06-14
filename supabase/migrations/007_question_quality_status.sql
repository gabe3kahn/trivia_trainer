-- Run this in the Supabase SQL editor.
-- It only applies schema/function changes. Codex can handle question-row edits through the service-role API.

do $$ begin
  alter table questions add column quality_status text not null default 'keep';
exception when duplicate_column then null;
end $$;

do $$ begin
  alter table questions add column quality_score int;
exception when duplicate_column then null;
end $$;

do $$ begin
  alter table questions add column quality_issues text[] not null default '{}';
exception when duplicate_column then null;
end $$;

alter table questions drop constraint if exists questions_quality_status_check;
alter table questions add constraint questions_quality_status_check
  check (quality_status in ('unreviewed', 'keep', 'rewrite', 'replace', 'deactivate'));

alter table questions drop constraint if exists questions_quality_score_check;
alter table questions add constraint questions_quality_score_check
  check (quality_score is null or quality_score between 0 and 100);

alter table questions alter column quality_status set default 'unreviewed';

create index if not exists questions_quality_active_idx
  on questions(quality_status, is_active, category_id);

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
  tags text[]
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
    q.tags
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
      or q.category_id in (select dimension_key from weak_categories)
    )
    and (p_categories is null or q.category_id = any(p_categories))
    and (p_values is null or q.value = any(p_values))
    and (p_mechanics is null or q.mechanic = any(p_mechanics))
  order by
    case q.quality_status when 'keep' then 0 when 'rewrite' then 1 else 2 end,
    random()
  limit greatest(p_limit, 1);
$$;

grant execute on function public.get_recommended_questions(text, int, text[], int[], text[]) to authenticated;
