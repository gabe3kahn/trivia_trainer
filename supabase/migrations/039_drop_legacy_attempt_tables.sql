-- 039: drop the *_legacy attempt tables left behind by migration 038.
--
-- DEFERRED CLEANUP — apply this ONLY after 038 is live in prod and you've confirmed
-- everything reads correctly off the unified model: training, duels, the daily
-- challenge, the daily + duel leaderboards, the activity feed, and the competency
-- timeseries. Until then the *_legacy tables are your instant rollback copy, so don't
-- run this migration in the same deploy as 038.
--
-- These tables are inert after 038 (nothing writes to them; all readers go through the
-- compat views over user_question_attempts). review_items_legacy has a FK into
-- practice_attempts_legacy, so drop it first. Idempotent.

drop table if exists review_items_legacy;
drop table if exists practice_attempts_legacy;
drop table if exists game_attempts_legacy;
drop table if exists daily_challenge_attempts_legacy;
