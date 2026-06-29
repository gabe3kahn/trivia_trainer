-- 033: commit a whole run/duel/daily at the end, recalc competency ONCE.
--
-- Until now every attempt insert recalced competency in-transaction (the practice
-- trigger from 002 + the game/daily triggers from 029). That meant competency — and
-- therefore badge awards — changed mid-run, and an abandoned run still left attempts
-- + competency behind. We now buffer a run client-side and commit it only when it
-- finishes, via one batch RPC per mode that inserts every attempt and then recalcs a
-- single time. Abandoning writes nothing.
--
-- Changes:
--   1. handle_practice_attempt_insert: keep the review_items + daily_activity
--      bookkeeping (still per-row), but DROP the per-attempt recalc.
--   2. Drop the game/daily competency triggers (029) — they only recalced.
--   3. Add submit_practice_run / submit_game_run / submit_daily_run: batch inserts
--      (reusing the per-row RPCs) + one recalc at the end. Badges still award via the
--      category_competencies trigger (030), which now fires once, at run end.
--
-- No backfill: the recalc math is unchanged — only WHEN it runs.

------------------------------------------------------------------------------
-- 1. Practice insert trigger — same as 002 minus the recalc line.
------------------------------------------------------------------------------
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

  -- (recalc moved to the end-of-run batch RPCs)
  return new;
end;
$$;

------------------------------------------------------------------------------
-- 2. Drop the per-attempt competency triggers on game/daily inserts (029).
--    handle_competency_attempt_insert() is left defined but unused.
------------------------------------------------------------------------------
drop trigger if exists on_game_attempt_competency on game_attempts;
drop trigger if exists on_daily_attempt_competency on daily_challenge_attempts;

------------------------------------------------------------------------------
-- 3. Batch "commit the whole run" RPCs. Each takes the attempts as a jsonb array
--    of {question_id, response, grade, time_ms} and recalcs competency once.
------------------------------------------------------------------------------
create or replace function public.submit_practice_run(
  p_mode session_mode,
  p_question_ids uuid[],
  p_attempts jsonb,
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
  v_att jsonb;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  v_session_id := public.create_practice_session(
    p_mode, p_question_ids, p_selected_categories, p_selected_subcategories,
    p_selected_values, p_selected_mechanics
  );

  for v_att in select * from jsonb_array_elements(coalesce(p_attempts, '[]'::jsonb))
  loop
    perform public.submit_practice_attempt(
      v_session_id,
      (v_att->>'question_id')::uuid,
      v_att->>'response',
      (v_att->>'grade')::attempt_grade,
      null,
      (v_att->>'time_ms')::int
    );
  end loop;

  perform public.recalculate_user_competencies(auth.uid());
  return v_session_id;
end;
$$;

create or replace function public.submit_game_run(p_game uuid, p_attempts jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_att jsonb;
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'Authentication required';
  end if;

  for v_att in select * from jsonb_array_elements(coalesce(p_attempts, '[]'::jsonb))
  loop
    -- submit_game_attempt finalizes the game once both players have finished.
    perform public.submit_game_attempt(
      p_game,
      (v_att->>'question_id')::uuid,
      v_att->>'response',
      (v_att->>'grade')::attempt_grade,
      (v_att->>'time_ms')::int
    );
  end loop;

  perform public.recalculate_user_competencies(me);
end;
$$;

create or replace function public.submit_daily_run(p_date date, p_attempts jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_att jsonb;
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'Authentication required';
  end if;

  for v_att in select * from jsonb_array_elements(coalesce(p_attempts, '[]'::jsonb))
  loop
    perform public.submit_daily_attempt(
      p_date,
      (v_att->>'question_id')::uuid,
      v_att->>'response',
      (v_att->>'grade')::attempt_grade,
      (v_att->>'time_ms')::int
    );
  end loop;

  perform public.recalculate_user_competencies(me);
end;
$$;

grant execute on function public.submit_practice_run(session_mode, uuid[], jsonb, text[], uuid[], int[], text[]) to authenticated;
grant execute on function public.submit_game_run(uuid, jsonb) to authenticated;
grant execute on function public.submit_daily_run(date, jsonb) to authenticated;
