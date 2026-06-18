# Compete — Duels design & build plan

Status: **backend built (014), list-only in the FE (PR #34). Gameplay (create/play/recap) not built.**
This doc captures the locked decisions and the outstanding build. Mock: `mockups/duel-recap.html`.

## What a duel is
Async 1v1. `create_game` freezes a shared random clue set (default 6); both players answer the
*same* set on their own time; client-side honor grading (Phase 1); when both finish (or it
expires at 3 days) `finalize_game` picks the winner. Friendship required to start.

## Locked decisions (this session)
1. **No time tiebreak.** Winner = higher score → if tied, more correct → else **genuine draw**.
   (Drop only the total-time tiebreak from `finalize_game`. `time_ms` no longer affects outcome.)
2. **Multiple formats — future, not now.** Category / larger / hard-question duels. `create_game`
   already takes `count`, `categories`, `mechanics`; a hard-question format just needs a value/
   difficulty filter arg. When built, add a `format` label on the game for display + recap.
3. **Synchronous duels — future, not now.** Both-online live mode. The frozen-shared-set +
   shared selection/grading infra keeps this open; sync adds presence + live reveal + shared clock.
4. **Post-duel recap — mocked now** (`mockups/duel-recap.html`): verdict banner → two scorelines →
   clue-by-clue (you vs. them) → rematch. States: win, loss, draw, and a "waiting on opponent"
   interstitial (their per-clue marks stay hidden until finalize).
5. **Same 30s timer as the daily challenge.** Duel play reuses `ChallengePlayer` with
   `secondsPerQuestion={30}`; auto-submit a no-answer at zero.
6. **No grade self-correction in duels.** Hide the correct/missed override chips entirely — the
   auto-grader is final. (`ChallengePlayer` gets an `allowGradeOverride` prop, false for duels.)
   Note: true anti-cheat needs server-side grading (Phase 2); today the client receives answers.
7. **Duels never downstream of the daily challenge.** Already true — `create_game` has its own
   selection and does not read `daily_challenges` / call `generate_daily_challenge`. If we DRY the
   duplicated selection, do it via a neutral upstream helper both call
   (`pick_question_set(count, categories, mechanics, values, exclude[])`), never by pointing duels
   at challenge data. (Optional refactor; not required for the build.)

## Outstanding build

### Backend — migration `018_duel_tweaks.sql`
- **`finalize_game`**: score → more-correct → draw (remove the `ct/ot` time comparison).
- **`get_game`**: add `seconds_per_question: 30`; add `opponent` profile block (name/username/avatar
  for the recap header); reveal `opponent_attempts` (per-question grade+points) **only when the
  game is completed/expired** — keep it hidden (count only) while active, preserving fairness.
- (Optional) `pick_question_set(...)` shared picker; refactor `create_game` + `generate_daily_challenge`
  to call it. Deferred — duels are already independent, so this is cleanup, not a blocker.

### Frontend
- **`ChallengePlayer`**: add `allowGradeOverride?: boolean` (default true) → false hides the chips +
  the "tap to adjust" hint; recorded grade = auto result.
- **`app/duel/[id].tsx`** (play + recap in one route, by status):
  - active & my run unfinished → `ChallengePlayer` (remaining questions, 30s, no override) →
    onSubmit = `submitGameAttempt` → onComplete reloads.
  - completed/expired → **recap** (win/loss/draw, clue-by-clue you-vs-them, rematch).
  - active & my run done, theirs isn't → **waiting** interstitial (their marks hidden).
- **`app/duel/new.tsx`**: friend picker → `createGame` (default 6 mixed) → `router.replace('/duel/<id>')`.
  (Format options come later — see #2.)
- **`compete.tsx`**: wire "New" → `/duel/new`; duel row tap → `/duel/<id>`.
- **types**: extend `GamePayload` with `seconds_per_question`, `opponent`, `opponent_attempts`.

### Not in scope here
- Formats (#2), synchronous mode (#3), "your turn" push (M3), server-side grading (Phase 2 anti-cheat).

## Merge guidance
**Merge #34 as-is**; build duels as a separate PR. #34 is a coherent working slice (daily challenge +
timer + leaderboard + friends + Compete tab + duels *list*). Duel gameplay is a meaty addition that
wants its own review and the mock-review cycle — folding it into #34 balloons the diff and delays the
daily challenge. The duels branch is based on #34's branch so it merges cleanly after #34 lands.
