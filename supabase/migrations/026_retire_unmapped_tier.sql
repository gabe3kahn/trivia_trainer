-- 026: retire the "unmapped" tier label.
--
-- tier_for_score returned 'unmapped' for any score < 20 — but that band is reached two
-- different ways: (a) thin evidence (the score is shrunk toward 0 by attempts/K, so the
-- first reps read low no matter how good you are) and (b) a mapped user who simply
-- performs below par. Showing the word "Unmapped" next to a concrete number reads as
-- "no data / not measured" even when there's plenty — confusing and discouraging.
--
-- Fix (paired with an app-side change, Option A):
--   * The floor band (score < 20) is renamed 'novice' — a real low tier, not "no data".
--   * The genuine "not enough evidence yet" state is handled in the APP: a dimension whose
--     attempts are below the confidence threshold (15 overall / 10 per category — the same
--     K constants the score shrink uses) shows a "Getting started" placement state with
--     progress, instead of a score. So the stored tier no longer needs an 'unmapped' value.
--
-- The rest of the ladder (familiar/developing/solid/strong/mastered) is unchanged.
-- Idempotent — safe to re-run.

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
    else 'novice'
  end;
$$;

-- New rows shouldn't carry the retired label before their first recalc.
alter table category_competencies alter column tier set default 'novice';

-- Relabel rows already stored under the old floor name.
update category_competencies set tier = 'novice' where tier = 'unmapped';
