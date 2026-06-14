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
  order by random()
  limit greatest(p_limit, 1);
$$;

create or replace function public.create_practice_session(
  p_mode session_mode,
  p_question_ids uuid[],
  p_selected_categories text[] default '{}',
  p_selected_subcategories uuid[] default '{}',
  p_selected_values int[] default '{}',
  p_selected_mechanics text[] default '{}'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session_id uuid;
  v_question_id uuid;
  v_position int := 1;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  insert into practice_sessions (
    user_id,
    mode,
    selected_categories,
    selected_subcategories,
    selected_values,
    selected_mechanics,
    question_count
  )
  values (
    auth.uid(),
    p_mode,
    coalesce(p_selected_categories, '{}'),
    coalesce(p_selected_subcategories, '{}'),
    coalesce(p_selected_values, '{}'),
    coalesce(p_selected_mechanics, '{}'),
    coalesce(array_length(p_question_ids, 1), 0)
  )
  returning id into v_session_id;

  foreach v_question_id in array coalesce(p_question_ids, '{}'::uuid[])
  loop
    insert into session_questions (session_id, question_id, position)
    values (v_session_id, v_question_id, v_position);
    v_position := v_position + 1;
  end loop;

  return v_session_id;
end;
$$;

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

  select value into v_value
  from questions
  where id = p_question_id
    and is_active;

  if v_value is null then
    raise exception 'Question not found';
  end if;

  if p_session_id is not null and not exists (
    select 1 from practice_sessions
    where id = p_session_id
      and user_id = auth.uid()
  ) then
    raise exception 'Session not found';
  end if;

  v_points := case p_grade
    when 'correct' then v_value
    when 'close' then floor(v_value * 0.5)::int
    else 0
  end;

  insert into practice_attempts (
    session_id,
    user_id,
    question_id,
    typed_response,
    grade,
    confidence,
    time_to_answer_ms,
    points_awarded
  )
  values (
    p_session_id,
    auth.uid(),
    p_question_id,
    p_typed_response,
    p_grade,
    p_confidence,
    p_time_to_answer_ms,
    v_points
  )
  returning id into v_attempt_id;

  return v_attempt_id;
end;
$$;

grant execute on function public.get_recommended_questions(text, int, text[], int[], text[]) to authenticated;
grant execute on function public.create_practice_session(session_mode, uuid[], text[], uuid[], int[], text[]) to authenticated;
grant execute on function public.submit_practice_attempt(uuid, uuid, text, attempt_grade, int, int) to authenticated;
