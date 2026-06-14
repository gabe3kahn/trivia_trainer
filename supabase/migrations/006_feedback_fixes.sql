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

update questions
set clue = 'This is the number of books in Euclid''s Elements of Geometry.'
where id = 'c85d5079-deef-48e6-8a93-9deddb6699d5';

update questions
set
  clue = 'This punctuation mark can show possession in "the king''s crown" or stand in for missing letters in "don''t."',
  answer = 'Apostrophe',
  aliases = array['apostrophe'],
  tags = array['gap-pack', 'grammar']
where id = '7c991496-eb41-4888-979f-9f37ca5d31c2';

update questions
set clue = 'Norwegian painter Edvard Munch is believed to have produced this many paint and pastel versions of The Scream.'
where id = '9ec036b8-7aec-40f6-bed6-fa007baabadf';

update questions
set clue = 'The Chronicles of Narnia series contains this many books.'
where id = '9b630f9d-f4bb-4387-bf52-903deaabea0a';

update questions
set clue = 'This is the number of voting members in the U.S. House of Representatives.'
where id = '1b1103d3-e195-43f5-b1f2-43b4092a9d2c';

update questions
set clue = 'Australia has this many states.'
where id = '51cce01d-57cb-4f72-86f3-964b267e8e6a';

update questions
set clue = 'Japanese rock band SCANDAL has this many members.'
where id = 'fb875352-f873-4f90-9073-6c9135762f63';

update questions
set clue = 'Daft Punk released this many studio albums.'
where id = '6549cbac-74c0-46eb-ac9c-3a3cb49c2ad9';

update questions
set clue = 'Metallica released this many studio albums from 1983 through 2016.'
where id = '01511568-e80b-4034-8aa4-dc1db3cb59f2';

update questions
set clue = 'A standard Monopoly board has this many spaces.'
where id = '4c471dcc-3a48-49e8-9da4-b0a3dd6344ff';

update questions
set clue = 'A game of chess starts with this many pieces on the board.'
where id = '95860adc-1930-481e-bba1-d64ed06939ca';

update questions
set clue = 'The pips on a single standard die add up to this number.'
where id = '3ef5f2de-0ff0-4637-861a-69e0611197b6';

update questions
set clue = 'The main Harry Potter series contains this many books.'
where id = 'dd366617-2a50-4a08-8545-5cf4823cd778';

update questions
set clue = 'King Gizzard & the Lizard Wizard released this many albums in 2017.'
where id = '958bed37-c9bc-44f1-8e3c-816cf53cc891';

update questions
set clue = 'Despite its name, the Hundred Years'' War lasted this many years.'
where id = 'c806ac9e-b489-4e84-9fbe-e8c86731be5b';
