-- 021: backfill duel scores to difficulty-rank points
--
-- 018_duel_tweaks switched duel scoring to difficulty_rank (1-5) per correct answer, but
-- — unlike 019 for the daily challenge — it didn't backfill existing game_attempts. So any
-- duel whose attempts were recorded BEFORE 018_duel_tweaks was applied still carries the old
-- Jeopardy dollar-value points (e.g. a run showing 3,000 instead of ~15). This re-scores
-- those attempts and recomputes the per-game totals + winner for already-finalized games,
-- using finalize_game's rule (higher score, then more correct, else a genuine draw).
--
-- Idempotent: the WHERE clause only touches rows whose points are wrong, and re-running
-- recomputes the same totals.

-- 1. Re-score every attempt: points = difficulty_rank on a correct answer, else 0.
update game_attempts a
set points = case when a.grade = 'correct' then coalesce(q.difficulty_rank, 0) else 0 end
from questions q
where q.id = a.question_id
  and a.points <> case when a.grade = 'correct' then coalesce(q.difficulty_rank, 0) else 0 end;

-- 2. Recompute finalized games' scores + winner from the corrected points.
--    (Active games are left alone; they get the rank-based total when finalize_game runs.)
update games g
set creator_score  = s.cs,
    opponent_score = s.os,
    winner_id = case
      when s.cs > s.os then g.creator_id
      when s.os > s.cs then g.opponent_id
      when s.cc > s.oc then g.creator_id
      when s.oc > s.cc then g.opponent_id
      else null end
from (
  select gm.id,
    coalesce(sum(ga.points) filter (where ga.user_id = gm.creator_id), 0)              as cs,
    coalesce(sum(ga.points) filter (where ga.user_id = gm.opponent_id), 0)             as os,
    count(*) filter (where ga.user_id = gm.creator_id  and ga.grade = 'correct')       as cc,
    count(*) filter (where ga.user_id = gm.opponent_id and ga.grade = 'correct')       as oc
  from games gm
  left join game_attempts ga on ga.game_id = gm.id
  where gm.status in ('completed', 'expired')
  group by gm.id
) s
where g.id = s.id;
