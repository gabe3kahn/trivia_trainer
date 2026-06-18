-- 018_duel_tweaks.sql — duel rule + payload changes for the gameplay screens.
--
-- 1. finalize_game: drop the total-time tiebreak. Winner = higher score, then more
--    correct, else a GENUINE DRAW. (time_ms is no longer an outcome factor; the 30s
--    timer is purely the play constraint, same as the daily challenge.)
-- 2. get_game: add seconds_per_question (30), the opponent's profile block (for the
--    recap header), and the opponent's per-question results — but reveal those ONLY
--    once the game is completed/expired. While it's still active, only the opponent's
--    answered COUNT is exposed, so neither player can see the other's answers mid-duel.
--
-- Additive / CREATE OR REPLACE only; safe to re-run.

create or replace function public.finalize_game(p_game uuid)
returns void language plpgsql security definer set search_path = public as $$
declare g games%rowtype; cs int; os int; cc int; oc int; v_winner uuid;
begin
  select * into g from games where id = p_game;
  if not found or g.status = 'completed' then return; end if;

  select coalesce(sum(points),0), count(*) filter (where grade='correct')
    into cs, cc from game_attempts where game_id = p_game and user_id = g.creator_id;
  select coalesce(sum(points),0), count(*) filter (where grade='correct')
    into os, oc from game_attempts where game_id = p_game and user_id = g.opponent_id;

  v_winner := case
    when cs > os then g.creator_id
    when os > cs then g.opponent_id
    when cc > oc then g.creator_id
    when oc > cc then g.opponent_id
    else null end;  -- equal score AND equal correct -> genuine draw (no time tiebreak)

  update games set status = 'completed', completed_at = now(),
         creator_score = cs, opponent_score = os, winner_id = v_winner
  where id = p_game;
end; $$;

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
        'image_url', q.image_url, 'answer_detail', q.answer_detail, 'value', q.value
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
    -- The other player, for the recap header.
    'opponent', (
      select case when v_other is null then null else jsonb_build_object(
        'id', p.id, 'display_name', p.display_name, 'username', p.username, 'avatar_url', p.avatar_url
      ) end
      from profiles p where p.id = v_other
    ),
    'opponent_answered', (
      select count(*) from game_attempts ga where ga.game_id = p_game and ga.user_id = v_other
    ),
    -- Per-question results for the other player — revealed ONLY after the duel ends.
    'opponent_attempts', (
      case when v_done then (
        select coalesce(jsonb_agg(jsonb_build_object(
          'question_id', ga.question_id, 'grade', ga.grade, 'points', ga.points)), '[]'::jsonb)
        from game_attempts ga where ga.game_id = p_game and ga.user_id = v_other
      ) else '[]'::jsonb end
    )
  );
end; $$;

grant execute on function public.finalize_game(uuid), public.get_game(uuid) to authenticated;
