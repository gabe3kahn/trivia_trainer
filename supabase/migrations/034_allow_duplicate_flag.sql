-- 034: allow_duplicate flag on questions.
--
-- The import dedup gate is answer-only (scoped by wordplay/image class), so it can't
-- distinguish two genuinely different facts that share an answer — e.g. "Brazil" as
-- France's longest land border (geography) vs. the only ever-present World Cup nation
-- (sports). Those should coexist; two clues testing the SAME fact should not.
--
-- allow_duplicate is the reviewer's manual override: a clue marked true is an approved
-- cross-fact dupe and skips the gate. The importer reads it from the pack and persists
-- it here so the duplicate report can exclude already-blessed sets.
alter table questions
  add column if not exists allow_duplicate boolean not null default false;
