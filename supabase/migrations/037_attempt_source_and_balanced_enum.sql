-- 037: enum groundwork for the unified per-user×question model (see 038).
--
-- Split into its own migration because a new enum value can't be USED in the same
-- transaction that adds it (Postgres restriction on ALTER TYPE ... ADD VALUE). By
-- committing these here first, migration 038 (and the client) can use them freely.
--
--   + `attempt_source` — tags every row of the new unified `user_question_attempts`
--     event log with where it came from (practice run / duel / daily challenge).
--   + `balanced` — a new adaptive session mode (strengths + weaknesses blend, difficulty
--     steered by competency, missed-priority, wordplay cooldown). Added to `session_mode`
--     so a balanced practice run can be persisted (practice_sessions.mode / submit_practice_run).
-- Idempotent.

do $$ begin
  create type attempt_source as enum ('practice', 'duel', 'daily');
exception when duplicate_object then null;
end $$;

alter type session_mode add value if not exists 'balanced';
