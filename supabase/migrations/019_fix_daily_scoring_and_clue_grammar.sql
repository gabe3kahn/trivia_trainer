-- 019: fix daily-challenge scoring + two anagram-clue grammar slips
-- (from on-device review). Idempotent — safe to re-run.
--
-- Why: some daily_challenge_attempts were recorded with points = the old Jeopardy
-- VALUE (200/400/…/1000) instead of difficulty_rank (1–5), so the leaderboard showed
-- e.g. 3800 for a 7/7 run instead of ~19. This re-asserts the rank-scoring function
-- AND backfills any rows already written with value-based points.

-- 1. Re-assert submit_daily_attempt as the difficulty_rank version (no-op if already current).
create or replace function public.submit_daily_attempt(
  p_date date, p_question uuid, p_response text, p_grade attempt_grade, p_time_ms int default null
)
returns void language plpgsql security definer set search_path = public as $$
declare g daily_challenges%rowtype; v_pts int; me uuid := auth.uid();
begin
  select * into g from daily_challenges where challenge_date = p_date;
  if not found or not (p_question = any(g.question_ids)) then raise exception 'question not in this day''s challenge'; end if;
  select case when p_grade = 'correct' then q.difficulty_rank else 0 end into v_pts from questions q where q.id = p_question;
  insert into daily_challenge_attempts (challenge_date, user_id, question_id, typed_response, grade, points, time_ms)
  values (p_date, me, p_question, p_response, p_grade, coalesce(v_pts, 0), least(coalesce(p_time_ms, 30000), 30000))
  on conflict (challenge_date, user_id, question_id) do nothing;
end; $$;

-- 2. Backfill existing attempts: points must be difficulty_rank on correct, else 0.
update daily_challenge_attempts a
set points = case when a.grade = 'correct' then coalesce(q.difficulty_rank, 0) else 0 end
from questions q
where q.id = a.question_id
  and a.points <> case when a.grade = 'correct' then coalesce(q.difficulty_rank, 0) else 0 end;

-- 3. Anagram clue grammar (matched by text so it's portable / idempotent).
update questions
set clue = 'Careful not to eat too much of these when you are stressed'
where clue = 'Careful not to eat too much of this when you are stressed';

update questions
set clue = 'Perk up your ears while you are silent'
where clue = 'Something you might be doing with your ears while you are silent';
