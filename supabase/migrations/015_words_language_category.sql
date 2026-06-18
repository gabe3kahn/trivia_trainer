-- 015_words_language_category.sql
--
-- Carve a sourceable "Words & Language" category out of language_wordplay.
-- Definitions / Etymology / Foreign Words & Phrases are knowledge subcategories
-- (you can source "carpe diem = seize the day", the etymology of "salary", etc.),
-- not constructed wordplay — so they get their own top-level category. After this,
-- language_wordplay holds only the constructed puzzles (Anagrams, Before & After,
-- Homophones, Puns, Rhymes, …) that build-wordplay-pack.mjs generates.
--
-- Idempotent / additive. Nearly empty in practice (one live clue moves).

-- New category, appended after the existing ones.
insert into categories (id, name, sort_order)
select 'words_language', 'Words & Language', coalesce(max(sort_order), 0) + 1
from categories
on conflict (id) do nothing;

-- Move the three knowledge subcategories under it.
update subcategories
   set category_id = 'words_language'
 where category_id = 'language_wordplay'
   and name in ('Definitions', 'Etymology', 'Foreign Words & Phrases');

-- Repoint any clues that were filed in those subcategories so their category
-- matches their (now-moved) subcategory.
update questions
   set category_id = 'words_language'
 where subcategory_id in (
   select id from subcategories where category_id = 'words_language'
 );
