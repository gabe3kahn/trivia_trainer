# Prelaunch Notes

Things to revisit before publishing the app — deferred on purpose, parked here so
they aren't forgotten.

## Schedule the grader override-mining report
`tools/acquisition/mine-grader-overrides.mjs` reconstructs the auto-grade from each
attempt's `typed_response` and reports overrides in both directions (missing-alias
candidates to add, false-accept candidates to remove/fix). It exists but is **run
manually** for now. Once there's real usage, schedule it (e.g. weekly, alongside the
`TriviaTrainer-DraftClues` task) so alias add/remove candidates and grader/clue bugs
accrue for review. Use `--min 2` to focus on recurring cases. Triage `via: exact`
false-accepts first (real alias bugs); `via: fuzzy` is often legitimate (e.g. accepted
surname-only answers).

## Revisit auto-import security
`.github/workflows/import-on-merge.yml` auto-imports merged clue packs to **production**
Supabase using the `SUPABASE_SERVICE_ROLE_KEY` GitHub Actions secret. Fine for solo
development; before launch, reconsider whether merge should write to prod automatically.
Option on the table: flip the workflow to `--dry-run` + comment results, with a manual
button (`workflow_dispatch`) for the real import.

## Unordered multi-answer grading (list answers)
Some clues are better asked as "name the N things" (e.g. "Name the four U.S. states
officially styled a 'Commonwealth'" → Kentucky, Massachusetts, Pennsylvania, Virginia).
The grader currently accepts a single answer only, so these can't be graded — the
"four commonwealths" clue is therefore phrased with the answer **Commonwealth** instead.
To support flipped/list clues, add a set-answer mode: accept the N expected answers in
any order (decide all-or-nothing vs. partial credit), with per-item alias matching.

## Known gaps from the roadmap (see README "Roadmap / Next Steps")
- Confidence capture: `confidence` is plumbed through `submit_practice_attempt` but always
  `null` — the capture UI isn't built.
- Badge awarding: tier badges are defined but never granted (no award step/trigger).
- Retire the legacy uncited clue bank as source-grounded replacements land
  (`retire-old-category-clues.mjs`, build-then-swap per category).
