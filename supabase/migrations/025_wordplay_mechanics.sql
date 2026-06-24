-- 025: wordplay mechanics overhaul — subcategories (companion to the drafter prompt +
-- validate-wordplay changes that add the initials / crossword / rhyme_time mechanics).
--
--   + add "Crossword Clues" (language_wordplay) and "Idioms" (words_language)
--   + rename "Rhymes & Word Ladders" -> "Rhyme Time" (the word-ladder half is dropped —
--     it doesn't fit a clue -> single typed answer)
--   + retire "Grammar & Usage" (terminology belongs in words_language) and
--     "Puns, Quotes & Idioms" (idioms move to words_language; puns/quotes aren't
--     constructed-wordplay mechanics) — but ONLY if they hold no questions. Apply AFTER
--     migration 024 (which re-homes the hidden-word clues out of Puns/Quotes/Idioms);
--     the guard makes it a safe no-op if anything still references them.
-- Idempotent.

insert into subcategories (category_id, name, sort_order)
select 'language_wordplay', 'Crossword Clues',
       (select coalesce(max(sort_order), 0) + 1 from subcategories where category_id = 'language_wordplay')
where not exists (select 1 from subcategories where category_id = 'language_wordplay' and name = 'Crossword Clues');

insert into subcategories (category_id, name, sort_order)
select 'words_language', 'Idioms',
       (select coalesce(max(sort_order), 0) + 1 from subcategories where category_id = 'words_language')
where not exists (select 1 from subcategories where category_id = 'words_language' and name = 'Idioms');

update subcategories
set name = 'Rhyme Time'
where category_id = 'language_wordplay' and name = 'Rhymes & Word Ladders';

delete from subcategories s
where s.category_id = 'language_wordplay'
  and s.name in ('Grammar & Usage', 'Puns, Quotes & Idioms')
  and not exists (select 1 from questions q where q.subcategory_id = s.id);
