-- 031: every clue lives under ONE headline category. words_language collapses into
-- language_wordplay everywhere the user sees, selects, OR is served a category — not just
-- in the competency math (016).
--
-- Two BE drafting categories, one user-facing category ("Language & Wordplay"). This routes
-- category through competency_category() at every remaining boundary:
--   * get_recommended_questions — filter/weakness-match on the merged category (so picking
--     "Language & Wordplay" reaches the 50 active words_language questions), and RETURN the
--     merged category id/name so a served words_language clue displays as Language & Wordplay.
--   * get_daily_challenge / get_game — same merged id/name on each served question.
--   * get_activity_summary — group the breakdown by the merged category.
-- The question's real category_id is unchanged in the table (drafting + competency_category
-- still see it); only what's SERVED for display is mapped.

-- ---------------------------------------------------------------------------
-- get_recommended_questions (training)
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
    competency_category(q.category_id) as category_id,
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
  join categories c on c.id = competency_category(q.category_id)
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

-- ---------------------------------------------------------------------------
-- get_daily_challenge — merged category id/name on each served question.
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
        'id', q.id, 'category_id', competency_category(q.category_id), 'category_name', c.name,
        'subcategory_name', s.name, 'difficulty_rank', q.difficulty_rank,
        'mechanic', q.mechanic, 'constraint_text', q.constraint_text,
        'clue', q.clue, 'answer', q.answer, 'aliases', q.aliases,
        'image_url', q.image_url, 'answer_detail', q.answer_detail, 'answer_type', q.answer_type
      ) order by array_position(g.question_ids, q.id)), '[]'::jsonb)
      from questions q
      join categories c on c.id = competency_category(q.category_id)
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
-- get_game (duel) — merged category id/name on each served question.
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
        'id', q.id, 'category_id', competency_category(q.category_id), 'category_name', c.name,
        'subcategory_name', s.name, 'difficulty_rank', q.difficulty_rank,
        'mechanic', q.mechanic, 'constraint_text', q.constraint_text,
        'clue', q.clue, 'answer', q.answer, 'aliases', q.aliases,
        'image_url', q.image_url, 'answer_detail', q.answer_detail, 'value', q.value, 'answer_type', q.answer_type
      ) order by array_position(g.question_ids, q.id)), '[]'::jsonb)
      from questions q
      join categories c on c.id = competency_category(q.category_id)
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

-- ---------------------------------------------------------------------------
-- get_activity_summary — group the breakdown by the merged category.
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
