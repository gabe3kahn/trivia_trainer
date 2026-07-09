-- 036: topic_entities on questions — the handle for RELATED-clue detection.
--
-- The import dedup gate + the critic's duplicate dimension are answer-based: they catch the
-- SAME answer, not the same FACT asked under a DIFFERENT answer (e.g. a "Siege of Yorktown"
-- clue vs. an existing "Charles Cornwallis" clue about that same 1781 surrender, or a
-- "George Eliot" clue reusing the "Mary Ann Evans / eight installments" hook already spent on
-- "Middlemarch"). "Same fact" is too vague to encode; shared *entities* are concrete.
--
-- topic_entities is the normalized set of distinctive entities a clue references — proper
-- nouns and years drawn from its answer + clue text (see tools/acquisition/topic-entities.mjs).
-- Two clues are "related" when they share several entities. It's populated by the importer
-- from the pack, backfilled over the active bank once (tools/acquisition/backfill-topic-entities.mjs),
-- and read by the critic's advisory `related` check. Stored (not just computed live) so the
-- tags are stable and human-curatable — a bad extraction can be corrected in place.
alter table questions
  add column if not exists topic_entities text[] not null default '{}';
