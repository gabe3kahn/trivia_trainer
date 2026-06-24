-- 023: answer_type — make "what counts as correct" an authoring decision, not a grader guess
--
-- The grader kept generating false-positive gotchas (Samothrace, Counter-Reformation)
-- because it INFERRED whether a bare surname / sub-phrase should count. Move that decision
-- to the question:
--   'name'  → the answer is a person; the bare last name auto-counts (surname shortcut).
--   'other' → only the answer + approved aliases count (no surname shortcut, no sub-phrase
--             containment). DEFAULT — the safe, strict mode.
-- Typo tolerance (with the Rhône/Rhine guards) stays universal in the client grader.
--
-- Default 'other' is safe: the client grader treats a missing/`other` type strictly, so
-- this can't introduce a false positive. Existing people are tagged 'name' by the
-- one-time classifier (tools/acquisition/classify-answer-types.mjs); new clues set it at
-- authoring time. The three question-returning RPCs are re-declared to carry the field.

alter table questions
  add column if not exists answer_type text not null default 'other'
  check (answer_type in ('name', 'other'));

-- ---------------------------------------------------------------------------
-- get_recommended_questions (training) — add answer_type to the row shape.
-- Adding an OUT column changes the function's return-row type, which
-- CREATE OR REPLACE cannot do ("cannot change return type of existing
-- function") — so drop the old signature first, then recreate.
drop function if exists public.get_recommended_questions(text, int, text[], int[], text[]);
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

-- ---------------------------------------------------------------------------
-- get_daily_challenge — add answer_type to each question.
create or replace function public.get_daily_challenge(p_date date default app_today())
returns jsonb language plpgsql security definer set search_path = public as $$
declare g daily_challenges%rowtype; me uuid := auth.uid();
begin
  select * into g from daily_challenges where challenge_date = p_date;
  if not found then
    perform public.generate_daily_challenge(p_date);
    select * into g from daily_challenges where challenge_date = p_date;
    if not found then
      return jsonb_build_object('challenge_date', p_date, 'set_size', 0, 'seconds_per_question', 30, 'questions', '[]'::jsonb, 'my_attempts', '[]'::jsonb, 'completed', false);
    end if;
  end if;

  return jsonb_build_object(
    'challenge_date', g.challenge_date,
    'set_size', coalesce(array_length(g.question_ids, 1), 0),
    'seconds_per_question', 30,
    'questions', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', q.id, 'category_id', q.category_id, 'category_name', c.name,
        'subcategory_name', s.name, 'difficulty_rank', q.difficulty_rank,
        'mechanic', q.mechanic, 'constraint_text', q.constraint_text,
        'clue', q.clue, 'answer', q.answer, 'aliases', q.aliases,
        'image_url', q.image_url, 'answer_detail', q.answer_detail, 'answer_type', q.answer_type
      ) order by array_position(g.question_ids, q.id)), '[]'::jsonb)
      from questions q
      join categories c on c.id = q.category_id
      left join subcategories s on s.id = q.subcategory_id
      where q.id = any(g.question_ids)
    ),
    'my_attempts', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'question_id', a.question_id, 'grade', a.grade, 'points', a.points)), '[]'::jsonb)
      from daily_challenge_attempts a where a.challenge_date = p_date and a.user_id = me
    ),
    'completed', (
      select count(*) >= coalesce(array_length(g.question_ids, 1), 0)
      from daily_challenge_attempts a where a.challenge_date = p_date and a.user_id = me
    )
  );
end; $$;

-- ---------------------------------------------------------------------------
-- get_game (duel) — add answer_type to each question.
create or replace function public.get_game(p_game uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare g games%rowtype; me uuid := auth.uid(); v_other uuid; v_done boolean;
begin
  select * into g from games where id = p_game;
  if not found or me not in (g.creator_id, g.opponent_id) then
    raise exception 'game not found';
  end if;

  v_other := case when me = g.creator_id then g.opponent_id else g.creator_id end;
  v_done  := g.status in ('completed', 'expired');

  return jsonb_build_object(
    'id', g.id,
    'status', g.status,
    'creator_id', g.creator_id,
    'opponent_id', g.opponent_id,
    'winner_id', g.winner_id,
    'creator_score', g.creator_score,
    'opponent_score', g.opponent_score,
    'expires_at', g.expires_at,
    'set_size', coalesce(array_length(g.question_ids, 1), 0),
    'seconds_per_question', 30,
    'questions', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', q.id, 'category_id', q.category_id, 'category_name', c.name,
        'subcategory_name', s.name, 'difficulty_rank', q.difficulty_rank,
        'mechanic', q.mechanic, 'constraint_text', q.constraint_text,
        'clue', q.clue, 'answer', q.answer, 'aliases', q.aliases,
        'image_url', q.image_url, 'answer_detail', q.answer_detail, 'value', q.value, 'answer_type', q.answer_type
      ) order by array_position(g.question_ids, q.id)), '[]'::jsonb)
      from questions q
      join categories c on c.id = q.category_id
      left join subcategories s on s.id = q.subcategory_id
      where q.id = any(g.question_ids)
    ),
    'my_attempts', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'question_id', ga.question_id, 'grade', ga.grade, 'points', ga.points)), '[]'::jsonb)
      from game_attempts ga where ga.game_id = p_game and ga.user_id = me
    ),
    'opponent', (
      select case when v_other is null then null else jsonb_build_object(
        'id', p.id, 'display_name', p.display_name, 'username', p.username, 'avatar_url', p.avatar_url
      ) end
      from profiles p where p.id = v_other
    ),
    'opponent_answered', (
      select count(*) from game_attempts ga where ga.game_id = p_game and ga.user_id = v_other
    ),
    'opponent_attempts', (
      case when v_done then (
        select coalesce(jsonb_agg(jsonb_build_object(
          'question_id', ga.question_id, 'grade', ga.grade, 'points', ga.points)), '[]'::jsonb)
        from game_attempts ga where ga.game_id = p_game and ga.user_id = v_other
      ) else '[]'::jsonb end
    )
  );
end; $$;
