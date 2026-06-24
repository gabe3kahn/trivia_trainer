-- 024: add a "Hidden Words" subcategory for language_wordplay + re-home existing clues
--
-- The wordplay generator produces a `hidden_word` mechanic, but there was no matching
-- subcategory, so all hidden-word clues were filed under "Puns, Quotes & Idioms" (which
-- holds zero actual puns). Add the proper subcategory and migrate every active hidden_word
-- clue to it. "Puns, Quotes & Idioms" is left in place for a future puns/quotes/idioms
-- mechanic (see the proposal for the other unused wordplay subcategories). Idempotent.

insert into subcategories (category_id, name, sort_order)
select 'language_wordplay', 'Hidden Words',
       (select coalesce(max(sort_order), 0) + 1 from subcategories where category_id = 'language_wordplay')
where not exists (
  select 1 from subcategories where category_id = 'language_wordplay' and name = 'Hidden Words'
);

-- Re-home every hidden_word clue (currently mislabeled under Puns, Quotes & Idioms).
update questions
set subcategory_id = (select id from subcategories where category_id = 'language_wordplay' and name = 'Hidden Words')
where category_id = 'language_wordplay'
  and mechanic = 'hidden_word';
