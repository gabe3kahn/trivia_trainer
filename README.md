# Trivia Trainer

A trivia-practice app focused on Jeopardy-style recall, weak-area tracking, and a source-grounded clue bank. It pairs an Expo / React Native app (`mobile/`) and Supabase backend with an expectation-relative competency model and a question-acquisition pipeline that authors clues only from cited sources.

Start with `planning/product-plan.md`. For authoring clues, see `planning/clue-authoring-guide.md`.

Prototype:

- Open `app/index.html` in a browser for the first local trainer.
- Open `app/ios-mockup.html` in a browser for the iOS-style product mockup.
- Run `mobile` with Expo for the native iOS-style mockup app.

Expo mockup:

```bash
cd mobile
npm run web
```

For phone testing, run `npm start` inside `mobile` and scan the QR code with Expo Go.

Useful planning docs:

- `planning/product-plan.md`
- `planning/app-structure.md`
- `planning/backend-data-contract.md`
- `planning/implementation-notes.md`
- `planning/data-sources.md`
- `planning/acquisition-pipeline.md`
- `planning/taxonomy.md`

Backend:

- Supabase migrations live in `supabase/migrations`.
- Expo Supabase client lives in `mobile/src/services/supabase.ts`.

Acquisition:

- Provider tooling lives in `tools/acquisition`.
- Raw, normalized, and generated SQL outputs live in `data/acquisition`.
- Start with `planning/acquisition-pipeline.md`.

## Question Intake Process

All question imports should pass through the shared intake assessment in `tools/acquisition/intake-assessment.mjs`. This keeps the live app, SQL import path, and bulk provider tooling from drifting apart.

The intake assessment runs in this order:

1. Normalize and polish the incoming row with `question-quality-rules.mjs`.
   - Cleans known provider wording problems.
   - Converts selected awkward quiz forms into Jeopardy-style declarative clues.
   - Preserves source metadata, tags, aliases, category, and subcategory mapping.

2. Evaluate base clue quality with `question-quality-rules.mjs`.
   - Flags direct interrogatives, question-mark forms, visible multiple-choice dependencies, true/false answers, awkward number wrappers, low-anchor clues, missing aliases, and other general quality issues.
   - Produces `quality_status`, `quality_score`, and `quality_issues`.

3. Run feedback-shaped quality checks from `feedback-quality-rules.mjs`.
   - Catches issues that surfaced during app testing: trailing ellipses, placeholder wording like "the what," vague numerical/unit answer forms, and meaningful answer words leaking into the clue.
   - These penalties merge into the base quality result before import.

4. Reassess difficulty with `difficulty-rules.mjs`.
   - Treats the incoming dollar value as a meaningful prior, then adjusts using answer fame, answer specificity, clue generosity, cognitive work, category specialization, provider difficulty, and wordplay/gimmick mechanics.
   - This standard is intentionally calibrated against J! Archive board rows: well-written clues should not automatically be downgraded just because they contain clean anchors.
   - Applies conservative value changes before import.
   - The importer logs changes like `$800->$400=16`.

5. Decide whether the row can enter training.
   - `keep` and `rewrite` rows are inserted active.
   - `replace` and `deactivate` rows are inserted inactive so they do not appear in practice.

The following entry points already use the shared intake assessment:

- `tools/acquisition/import-to-supabase.mjs`
- `tools/acquisition/build-import-sql.mjs`
- `tools/acquisition/fill-opentdb-targets.mjs`

Original balanced packs can be generated with:

```bash
node tools/acquisition/generate-strategy-pack.mjs strategy-pack-001
node tools/acquisition/import-to-supabase.mjs data/acquisition/normalized/strategy-pack-001.json --dry-run
node tools/acquisition/import-to-supabase.mjs data/acquisition/normalized/strategy-pack-001.json
```

The strategy-pack generator uses stable row-based external IDs so clue wording edits update existing rows instead of creating duplicates.

Post-import reports use the same shared rule modules:

- `tools/acquisition/audit-question-quality.mjs`
- `tools/acquisition/audit-feedback-issues.mjs`
- `tools/acquisition/evaluate-difficulty.mjs`
- `tools/acquisition/benchmark-jarchive-difficulty.mjs`
- `tools/acquisition/benchmark-jarchive-quality.mjs`

### J! Archive As Paragon

J! Archive is the reference corpus of well-written, real-board clues, so we use it to calibrate **both** models. Both benchmarks are calibration-only: they fetch a small set of show pages through the shared loader `tools/acquisition/jarchive-source.mjs`, hold clues in memory to measure, and write only aggregate reports plus source references — they never import or persist J! Archive clue/answer text into the question bank. See `planning/jarchive-paragon.md` for the full approach.

**Difficulty calibration** compares our suggested difficulty rank against the real board row and reports drift plus a per-rank bias/confusion table (the signal for retuning `difficulty-rules.mjs`):

```bash
node tools/acquisition/benchmark-jarchive-difficulty.mjs
node tools/acquisition/benchmark-jarchive-difficulty.mjs --games 9202,9171,9121
```

Outputs `data/acquisition/jarchive-difficulty-benchmark.{json,md}`.

**Quality calibration** runs the live intake assessment over real clues. Because a real aired clue is well-written by definition, any `replace`/`deactivate` decision is a false positive — a rule that's too harsh. The report ranks the rules that misfire on known-good clues:

```bash
node tools/acquisition/benchmark-jarchive-quality.mjs
node tools/acquisition/benchmark-jarchive-quality.mjs --games 9202,9171 --examples 20
```

Outputs `data/acquisition/jarchive-quality-benchmark.{json,md}`. Run it after changing quality or feedback rules to make sure you didn't start rejecting good clues.

For the existing live bank, `tools/acquisition/apply-difficulty-calibration.mjs` applies a one-pass editorial adjustment from the latest `difficulty-evaluation.json`. Do not run it repeatedly as a loop: because the difficulty rules now use the assigned dollar value as a prior, repeated application can ratchet borderline clues upward. Re-run `evaluate-difficulty.mjs` after applying and review the new distribution before making another manual pass.

### Adding New Quality Or Difficulty Rules

New assessments should be added to one of the shared rule modules, not directly inside an importer:

- General clue quality or clue cleanup: `tools/acquisition/question-quality-rules.mjs`
- Live-test/feedback-shaped issues: `tools/acquisition/feedback-quality-rules.mjs`
- Difficulty scoring or value calibration: `tools/acquisition/difficulty-rules.mjs`
- Shared env loading, Supabase requests, and report formatting: `tools/acquisition/acquisition-utils.mjs`

Avoid adding new quality, feedback, difficulty, env-loading, or Supabase-request logic directly to import scripts. Importers should call `tools/acquisition/intake-assessment.mjs`; reports should call the same shared rule modules.

After adding a rule, run:

```bash
node tools/acquisition/verify-intake-wiring.mjs
```

This checks that the importers still route through `intake-assessment.mjs` and that the report scripts are using the same shared rule modules. Then run a dry-run import against a normalized pack:

```bash
node tools/acquisition/import-to-supabase.mjs data/acquisition/normalized/gap-pack-001.json --dry-run
```

The dry run should print both the quality gate summary and the difficulty calibration summary.

## Competency Scoring

Competency is computed in `supabase/migrations/` (function `recalculate_user_competencies`; the math is from `011_expectation_relative_competency.sql`, and `029` widened the source to UNION practice + duel + daily attempts). It is recomputed **once at the end of a run**, not per attempt — see "Runs commit at the end" under Frontend conventions. The model is **expectation-relative** — difficulty is treated as an *expectation*, not a weight.

- **Results are binary.** Correct (including near-string matches the grader treats as correct — a typo or "JFK" for "John F. Kennedy") = 1; everything else = 0. There is no partial "close" credit.
- **Each value has a par success rate** (`expected_success`): `$200 .85, $400 .75, $600 .60, $800 .45, $1000 .30`.
- **Raw category score = performance vs par, mapped to 0–100** where **50 = exactly on par**, 100 = beat every clue, 0 = got nothing:

  ```
  actual   = Σ(correct × recency)
  expected = Σ(par(value) × recency)
  n        = Σ(recency)
  raw = actual >= expected
          ? 50 + 50·(actual−expected)/(n−expected)   -- above par
          : 50·actual/expected                        -- below par
  ```

- **Why this shape:** missing an *easy* clue hurts more (it had high expected success, so falling short drags you well below par), and getting a *hard* clue right rewards more (you beat a low expectation). This is the opposite of a Jeopardy-dollars "value as weight" model, and the right behavior for "how good am I." Known property: acing *everything* is 100 regardless of difficulty — difficulty differentiates on the downside and in mixed sets, not when you get a perfect run.
- **Evidence shrink:** the displayed score is `raw × min(1, attempts/10)`, so a thin category reads near Unmapped and climbs as you prove competency (no lurching from a single session). Tiers therefore mean "competency above par" (≈50 is Developing; higher tiers require beating expectations).
- **Trends** (`seven_day_delta` / `thirty_day_delta`) compare the current smoothed score against the same computation over only the attempts that existed N days ago.
- **Overall** is the evidence-weighted average of the smoothed category scores.

The par rates are fixed constants for now; they're the natural place to plug in empirical per-clue difficulty (IRT) once there's enough real attempt data. **Migrations 010 and 011 must both be applied**; existing competency rows refresh on the next attempt (trigger) or via `select recalculate_user_competencies('<user_id>')`.

## Source-Grounded Clue Authoring

The clue bank is being rebuilt **source-first, one category at a time** (build-then-swap: import the new sourced clues, then deactivate the old ones for that category — reversible via `is_active`). Every clue is written *only* from a cited source and carries that citation; authored answers are never trusted blind.

The full calibration rules live in **[`planning/clue-authoring-guide.md`](planning/clue-authoring-guide.md)** — read it before authoring. In brief: declarative "this/it" phrasing; no answer leaks (not even a word sharing a *stem* with the answer, e.g. "southernmost" leaks "Southern Ocean"); difficulty comes from revealing *less* and asking from the surprising end, **not** from stacking facts ($200–400 = recall, $600 = triangulation, $800–1000 = a single oblique hook).

Sourcing tools (all in `tools/acquisition/`):

- `seed-geography-candidates.mjs` — seeds canonical entity sets via **Wikidata SPARQL** (UN members + capitals, plus curated rivers/oceans/seas/lakes/ranges/parks/states) and fetches each one's Wikipedia doc.
- `build-topic-docs.mjs` — fetches a Wikipedia lead-extract + citation per topic into `data/sourcing/docs/<category>/<slug>.json`.
- `build-geo-facts.mjs` + `verify-clue-uniqueness.mjs` — a structured fact store and a uniqueness checker for *combinatorial* clues: a clever constraint clue ships only if it resolves to **exactly one** answer. (Caveat the verifier surfaced: Wikidata border *counts* and population figures are unreliable; border membership, area, continent, and landlocked status are not.)
- `verify-clue-sources.mjs` (with `source-verifier.mjs`) — independent corroboration against reputable sources (Wikipedia; Wiktionary for definitions), recording citations. `--from-db` checks the live bank; `--write-back` records citations + `verification_status` into a pack. Anything `unverified` is held for a human, not trusted.
- `subcategories.json` (in `data/sourcing/`) — a static snapshot of the valid subcategory names per category, so packs can be validated offline (no Supabase needed).

Citations and verification status persist to the bank via migration `012_question_citations.sql` (`questions.citations`, `verification_status`, `verified_at`), and `import-to-supabase.mjs` writes them.

### Visual clues

The `arts_visual_culture` category supports image clues ("Name this painting." / "Name the artist.", randomly alternated). They use `mechanic = 'visual'`, store the image on `questions.image_url`, and reveal the full `answer_detail` (`"<Title> — <Artist>"`) on submission regardless of which half was asked — grading still uses `answer` + `aliases` only. Images are restricted to **public-domain works** (artist long dead) pulled from each painting's Wikipedia REST summary; `image_license` records why the image is safe to show. No artist credit is shown on screen — a faithful reproduction of a public-domain 2D work carries no attribution requirement, and showing the artist would leak the answer on "Name the artist" clues. The schema lives in migration `013_question_image.sql`; `tools/acquisition/build-visual-arts-pack.mjs` is a working builder.

## Automation

- **Daily job** (`tools/acquisition/daily-job.mjs`, run by the `TriviaTrainer-JArchiveHarvest` Windows scheduled task, ~8am local). Two deterministic phases: harvest ~5 recent J! Archive games to grow the per-category topic stores (`data/sourcing/topics/`), then top up the cited Wikipedia doc corpus for every category. It grows the "what to ask" signal and the source corpus — it does **not** author clues (authoring stays a reviewed step).
- **Daily draft-clues task** (`tools/scheduled/draft-clues.ps1`, run by the `TriviaTrainer-DraftClues` Windows scheduled task, ~7:45am local, after the harvest). A headless Claude Code run that picks **two** under-covered categories, builds their cited Wikipedia docs, **drafts** ~15 clues per category grounded only in those docs (following `planning/clue-authoring-guide.md` and `data/sourcing/category-guide.json`), runs the source verifier, and opens **one pull request per category** for human review. For the visual-arts category it also drafts image clues. It never imports to Supabase and never merges — drafts only. (This replaced an earlier *remote* routine, which couldn't push branches or reach Wikipedia from its sandbox.)
- **Auto-import on merge** (`.github/workflows/import-on-merge.yml`). When a pull request touching `data/sourcing/packs/**/*.json` merges to `main`, the changed packs are imported via `import-to-supabase.mjs` (idempotent upsert on a stable `external_id`). Requires the `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` repo secrets. So the loop is: daily harvest → daily draft → review PR → merge → auto-import. The merge job loops the changed packs under `set -e`, so one pack's gate failure halts the rest (partial import) — fix the collision and re-run the importer (locally with `.env.local`, or via a fresh push) to finish.
- **Import dedup gate** (`import-to-supabase.mjs`, enforced on both `--dry-run` and live import — throws before any write). Two checks: (1) no two clues in a pack share an answer; (2) no pack answer duplicates one already ACTIVE under a *different* clue, **scoped by class** — a collision counts only when two clues are the same *kind* of question. Class = **wordplay-ness AND image-ness**: a constructed-wordplay answer (`language_wordplay`) may match a normal answer (*Muscle* the homophone vs the body part), and an **image** clue (`image_url` set — "name the artist/painting/flag") may match a **text** clue with the same answer (recognition vs recall). So a clue collides only with another that matches on *both* dimensions. Re-importing the same pack is safe (rows carrying the pack's own `external_id`s are excluded).
  - **`allow_duplicate` override** (column added in `034`): a clue with `allow_duplicate: true` in its pack skips the bank gate. It's the reviewer's bless for genuinely different facts that share an answer — *Brazil* as France's longest land border (geography) **and** as the only ever-present World Cup nation (sports). Identical-fact dupes still fail; the rule is "different facts OK, same fact → keep one."
  - **`tools/acquisition/find-duplicates.mjs`** reports every active same-class duplicate set (full clues; omits sets already fully blessed). It emits clickable task-list Markdown to paste into a PR for triage — tick the clues to keep, leave the rest to cut.

### Importing or re-importing a deck / stale pack

Old packs can fall out of sync with the live schema and stop re-importing. To make one a managed pack again (so it works like the drafter PRs), dry-run it and fix each blocker until it's clean: stale subcategory mapping (a clue's `category_id` no longer matches its `subcategory_name` — fix the category), answers that now duplicate newer clues (remove from the pack and deactivate the live row, or bless one side with `allow_duplicate`), lowercase answers, and value recalibration (set `lock_value: true` to preserve a value, or let the importer recalibrate). Resolve live duplicate *decisions* by blessing the keepers (`allow_duplicate = true`) and deactivating the cuts (`is_active = false`). A source pack that's still too stale to re-import is fine as a frozen archive — the live decisions hold in the DB — and can be fully integrated later.

## Deploying (OTA vs rebuild)

Ships via **EAS Update** (channel `production`, which TestFlight builds use). The runtimeVersion policy is **`fingerprint`**, so an over-the-air update only reaches a build whose fingerprint hash matches the update's.

- **JS / asset-only change → OTA:** `eas update --channel production --message "…"`.
- **Native change (new native dep, `app.json`, a config plugin) → rebuild + submit.** A rebuild also resets the fingerprint baseline.

**Check before publishing** — compare the current tree's fingerprint to the installed build's:

```bash
cd mobile && npx expo-updates fingerprint:generate --platform ios   # → .hash
npx eas-cli@latest build:list --platform ios --limit 1 --json       # → .fingerprint.hash / .runtimeVersion
```

Match → the OTA lands; mismatch → it's published but silently never delivered to that build.

**Gotcha:** `@expo/fingerprint` hashes `package.json` `scripts` (a script *could* be a build hook), so adding a dev script (e.g. `test`) changes the fingerprint with **no real native change** and breaks OTA matching to an already-installed build. `mobile/fingerprint.config.js` skips the scripts source (`SourceSkips.PackageJsonScriptsAll`) so only real native changes move the fingerprint — it takes effect on the **next full build** (it does not retroactively change an existing build's hash). To push a JS fix to a build cut *before* that config, temporarily remove the offending script so the fingerprint reproduces the build's hash, publish, then restore (the JS bundle is unaffected by the scripts).

**Ordering:** apply a migration before shipping app code that depends on it.

## Frontend conventions

The mobile app (`mobile/`, Expo SDK 54, expo-router, StyleSheet) follows a few settled patterns:

- **Runs commit at the end.** A practice run, duel, or daily challenge is buffered on-device and written in one batch RPC (`submit_practice_run` / `submit_game_run` / `submit_daily_run`, migration `033`) only when it reaches the last clue. **Abandoning a run records nothing** — no attempts, no competency, no badge. Competency and badge awards recompute **once at run end** (the per-attempt recalc triggers were removed). The shared `ChallengePlayer` (daily + duels) buffers and hands every attempt to `onComplete` once; it re-throws on failure to keep the Finish screen for a retry.
- **Scoring = difficulty rank.** A run's points are the sum of each correct answer's `difficulty_rank` (1–5), matching daily/duel scoring — not the Jeopardy dollar value.
- **Badges** award via a trigger on the `category_competencies` overall row (`030`), surfaced by an app-wide unlock modal (`BadgeUnlockContext` / `useBadgeUnlock` / `BadgeUnlockModal`).
- **Answer-reveal casing.** The grader sentence-cases the revealed answer for display, but store answers properly cased anyway — other surfaces show the raw value (brands keep their own casing, e.g. `23andMe`).
- **Design tokens** live in `theme.ts` (`type` / `radius` / `spacing` / `colors` / `accentFor`); shared components in `ui.tsx` (`Screen`, `ScoreRing`, `Touchable`, `Card`, `ModeCard`, `CategoryScoreRow`, `PrimaryAction`). The shared `Screen` ScrollView disables bounce/overscroll so content doesn't scroll past the bottom on short screens, and `Touchable` adds a short press delay so scroll-drags don't fire taps.

## Multiplayer / Competitive (designed, not built)

The full back-end + front-end design lives in **[`planning/multiplayer-design.md`](planning/multiplayer-design.md)**. Decisions: opponents can be **friends or random matchmaking**; the competitive layer is **1v1 duels + a shared daily challenge + leaderboards**; **push notifications** are included. It ships in phases — **async turn-based first, live (Supabase Realtime) later** — and grading starts client-side (honor system) then moves to a server-side Supabase Edge Function that reuses `answerGrader`. Recommended build order: **M1** friends + 1v1 async duel → **M2** daily challenge + leaderboards → **M3** random matchmaking → **M4** push. The doc covers linking users into a game (friendship → frozen shared `question_ids` → per-player attempts) and determining wins/losses (points, finalize/tiebreak/forfeit rules). It builds on the existing `games`, `game_attempts`, and `friendships` tables; the next concrete step is migration `014_multiplayer.sql` plus the RPC set, RLS, and the Social-tab UI.

## Roadmap / Next Steps

Tracked here so the next session can pick up cleanly. Grouped by area, roughly in priority order within each group.

### Frontend / UX
- Animate the `ScoreRing` fill (animate `strokeDashoffset` on score change instead of snapping; `react-native-reanimated` is already a dependency).
- Build the **Category Detail** screen reached by tapping a Home category: subcategory score ladder, the $200–$1000 value ladder, a 7-day trend, and a "Train this" button. Requires subcategory competency data (`category_competencies` rows with `dimension_type = 'subcategory'`).
- Apply the design-token pass to the screens not yet restyled: `app/auth.tsx`, `app/auth-callback.tsx`, `app/modal.tsx`, `app/+not-found.tsx`.
- ~~Add empty / zero states for a brand-new user~~ — **done** (#85): new-user empty states on Home, plus the activity/badges screens.
- Train **Select Categories** multi-pick UI (today only single-category via a Home tap; the `selected` mode + `categories[]` parameter already support multi-select on the backend).
- Session recap / postmortem: list the missed clues with reveal, not just the counts.
- Fix the stale `mobile/AGENTS.md` (it says Expo v56; the app is on SDK 54).

### Practice loop & grading
- Self-grade override after reveal is **done**, now **binary** (Correct / Missed); the final grade is what gets written. Grading is binary end to end — a near-string match counts as correct, there is no partial "close".
- Invest in **alias coverage** — this is the highest-leverage improvement for grading accuracy. The grader can only credit equivalents that exist as aliases (e.g. "JFK" ↔ "John F. Kennedy"), so alias quality matters more than any threshold tuning. Ties directly to the `missing-multiword-aliases` quality rule.
- Short-answer fuzzy matching is guarded in `isClose` (equal-length substitutions and first-letter changes are rejected on short answers, so "Mars" ≠ "Mark" and "Rhône" ≠ "Rhine"), and `matchesSurname` accepts **last-name-only** answers plus a one-edit surname misspelling for multi-word person names ("Pollack" → "Jackson Pollock"), with a ≥6-char guard that keeps real neighbors apart ("Manet" ≠ "Monet"). Remaining work is widening alias coverage rather than loosening the matcher.
- Optional: capture confidence and offer "show answer" before grading (both in `planning/product-plan.md`, not yet in the loop).
- ~~Badge **awarding** is not implemented~~ — **done** (#85): `award_badges` runs via a trigger on the `category_competencies` overall row (migration `030`), surfaced by an app-wide unlock modal. Awards fire once at run end (see Frontend conventions).

### Question quality & difficulty (calibration)
- **Difficulty re-centering.** The base-score prior currently shrinks toward 2.4, which is below the true scale midpoint of 3. The J! Archive benchmark shows the resulting structural compression: we rate $200 clues too hard (bias +0.72) and $1000 too easy (−0.40), monotonic across ranks. Re-center the prior to 3 and/or reduce the shrinkage weight in `difficulty-rules.mjs`, then re-run the benchmark and watch the per-rank bias collapse toward zero.
- Before retuning, pull a **larger J! Archive sample** (`--games` with more IDs) to confirm the bias magnitude beyond the default five games.
- Calibrate the quality thresholds (45 / 70 / 88 in `quality-constants.mjs`) and the individual penalty magnitudes against a small hand-labeled good / rewrite / bad set, rather than leaving them hand-tuned.
- Build the **LLM agent panel** described in `planning/difficulty-standard.md`. Factual-correctness checking is the biggest gap the deterministic rules cannot cover — they can't tell that an answer is simply wrong.
- Run `benchmark-jarchive-quality.mjs` after any change to the quality or feedback rules, as a regression guard (it currently reports 100% accept on the paragon).
- Long-term: let real user attempt data supersede the cold-start difficulty estimate — IRT-style item difficulty derived from how real users actually perform.

### Sourcing / automation follow-ups
- **Verify clues against their source doc, not the answer's page.** `verify-clue-sources.mjs` corroborates a clue by checking its content words against the *answer's* Wikipedia page. For deliberately oblique, leak-avoiding clues (which avoid the answer's words and are often sourced from a *different* page), this scores them "weak" even when the fact is solid and cited. The verifier should check the clue against the `citations` source doc it was actually written from.
- **Filter junk from the J! Archive topic stores.** Harvested topic stores (`data/sourcing/topics/<category>.json`) include non-topical or miscategorized answers (e.g. a TV series like "Masters of the Air" under history, bare names like "Vlad"). `build-topic-docs.mjs` already skips bare numbers and a few generics, but a stronger topical filter (and/or category sanity-check) would raise doc-corpus quality for the draft-clues task.
