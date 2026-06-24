-- 022: de-name F. Scott Fitzgerald in the active "The Great Gatsby" clues
--
-- Reviewing #65 (a new "name the author" Fitzgerald draft clue): the two active
-- "name the novel" Great Gatsby clues both NAME F. Scott Fitzgerald, which gives the
-- Fitzgerald answer away. A "name the novel" prompt shouldn't need the author. Strip the
-- author name from both. Idempotent — matched by exact text, no-op once applied.
--
-- (Heads-up for review: there are TWO active "The Great Gatsby" clues — a duplicate
-- answer in the bank. Not deduped here; flagged separately.)

update questions
set clue = 'Set in the Jazz Age on Long Island, this 1925 novel follows Nick Carraway''s encounters with a mysterious millionaire obsessed with recapturing his lost romance with Daisy Buchanan.'
where clue = 'Set in the Jazz Age on Long Island, this 1925 F. Scott Fitzgerald novel follows Nick Carraway''s encounters with a mysterious millionaire obsessed with recapturing his lost romance with Daisy Buchanan.';

update questions
set clue = 'This 1925 novel follows Nick Carraway into the parties of a mysterious Long Island millionaire.'
where clue = 'This Fitzgerald novel follows Nick Carraway into the parties of a mysterious Long Island millionaire.';
