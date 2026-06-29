-- 030: actually award badges.
--
-- Badges were seeded (003) with criteria, but nothing ever evaluated them — user_badges
-- was never written, so no one could earn a badge (e.g. "Solid in Science" never granted
-- the Lab Coat). This adds award_badges(user), evaluates the criteria computable from
-- competency + attempts, fires it whenever competency recalculates, and backfills.
--
-- Covered now (competency- and attempt-derived):
--   * per-category "Reach Solid in X"  {"dimension":..,"score":..}   (lab_coat, etc.)
--   * generalist  {"all_categories_score":..}   — all 10 categories at/above score
--   * specialist  {"any_category_score":..}     — a category that high, with evidence
--   * renaissance {"delta_30_day":..}           — a category up that much in 30 days
--   * deep_cut / tournament_ready {"value":..,"correct":..} — N distinct correct at $value
-- Deferred (need session/streak/mechanic context, not yet wired): clutch, comeback,
--   board_runner, mechanic, regular.

create or replace function public.award_badges(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- per-category competency badges: criteria {"dimension": <cat>, "score": <n>}
  insert into user_badges (user_id, badge_key, earned_at)
  select p_user_id, b.key, now()
  from badges b
  join category_competencies cc
    on cc.user_id = p_user_id
   and cc.dimension_type = 'category'
   and cc.dimension_key = b.criteria->>'dimension'
  where b.criteria ? 'dimension'
    and cc.score >= (b.criteria->>'score')::int
  on conflict (user_id, badge_key) do nothing;

  -- generalist: every one of the 10 primary categories at/above the score
  insert into user_badges (user_id, badge_key, earned_at)
  select p_user_id, b.key, now()
  from badges b
  where b.criteria ? 'all_categories_score'
    and (
      select count(*) from category_competencies cc
      where cc.user_id = p_user_id and cc.dimension_type = 'category'
        and cc.score >= (b.criteria->>'all_categories_score')::int
    ) >= 10
  on conflict (user_id, badge_key) do nothing;

  -- specialist: any category Strong (75) with high evidence (>= 15 reps)
  insert into user_badges (user_id, badge_key, earned_at)
  select p_user_id, b.key, now()
  from badges b
  where b.criteria ? 'any_category_score'
    and exists (
      select 1 from category_competencies cc
      where cc.user_id = p_user_id and cc.dimension_type = 'category'
        and cc.score >= (b.criteria->>'any_category_score')::int
        and cc.attempts >= 15
    )
  on conflict (user_id, badge_key) do nothing;

  -- renaissance: any category improved >= N points over the last 30 days
  insert into user_badges (user_id, badge_key, earned_at)
  select p_user_id, b.key, now()
  from badges b
  where b.criteria ? 'delta_30_day'
    and exists (
      select 1 from category_competencies cc
      where cc.user_id = p_user_id and cc.dimension_type = 'category'
        and cc.thirty_day_delta >= (b.criteria->>'delta_30_day')::int
    )
  on conflict (user_id, badge_key) do nothing;

  -- value milestones: N distinct questions answered correctly at a given $value
  insert into user_badges (user_id, badge_key, earned_at)
  select p_user_id, b.key, now()
  from badges b
  where b.criteria ? 'value' and b.criteria ? 'correct'
    and (
      select count(distinct a.question_id)
      from (
        select grade, question_id from practice_attempts where user_id = p_user_id
        union all
        select grade, question_id from game_attempts where user_id = p_user_id
        union all
        select grade, question_id from daily_challenge_attempts where user_id = p_user_id
      ) a
      join questions q on q.id = a.question_id
      where attempt_is_correct(a.grade) = 1
        and q.value = (b.criteria->>'value')::int
    ) >= (b.criteria->>'correct')::int
  on conflict (user_id, badge_key) do nothing;
end;
$$;

grant execute on function public.award_badges(uuid) to authenticated;

-- Fire once per recalc: the overall competency row is upserted last, after every
-- category row, so awarding off that single row sees fully-updated competencies and
-- runs exactly once per recalculate_user_competencies() (which all attempt triggers call).
create or replace function public.trg_award_badges()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform award_badges(new.user_id);
  return new;
end;
$$;

drop trigger if exists on_competency_award_badges on category_competencies;
create trigger on_competency_award_badges
  after insert or update on category_competencies
  for each row
  when (new.dimension_type = 'overall')
  execute function public.trg_award_badges();

-- Backfill: award for everyone who already has competency rows.
do $$
declare
  v_uid uuid;
begin
  for v_uid in select distinct user_id from category_competencies loop
    perform award_badges(v_uid);
  end loop;
end;
$$;
