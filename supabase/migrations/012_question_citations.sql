-- Citation + source-verification storage for questions.
--
-- Authored clues are verified against reputable sources (Wikipedia, Wiktionary)
-- by tools/acquisition/source-verifier.mjs, which attaches a citation and a
-- verdict. These columns persist that evidence against each question so we can
-- (a) show/audit where an answer is sourced and (b) filter the bank by how well
-- a clue is corroborated.
--
--   citations: array of { source, title, url, snippet } objects
--   verification_status: 'verified' | 'weak' | 'unverified' | 'skipped'
--     - verified  : answer found in a reputable source and the clue corroborates
--     - weak      : answer found/citable, but clue wording barely overlaps — review
--     - unverified: no clean source found for the answer — needs a human fix
--     - skipped   : constructed wordplay (anagram/before-after/etc.), not a factual lookup
--   verified_at: when the verification pass last ran

alter table questions
  add column if not exists citations jsonb not null default '[]'::jsonb,
  add column if not exists verification_status text not null default 'unverified',
  add column if not exists verified_at timestamptz;

-- Helpful for "show me clues that still need a source eye".
create index if not exists questions_verification_status_idx
  on questions (verification_status);
