# Multiplayer / Competitive — Design

Design for the competitive element, scoped to ship on TestFlight. Decisions below
are **locked** unless revisited; open questions are at the end.

## Locked decisions
- **Phase 1 = asynchronous challenges** (both players answer the same frozen set on
  their own time; compared when both finish). **Live real-time = Phase 2**, added
  later once there's usage — not a launch blocker.
- **Integrity: Option A now → Option B later.** Start with client-side grading
  (honor system, fine for friends/family). Move to **server-side grading** (answers
  never sent to the client) **before** any public or ranked leaderboard.
- Build on the **existing schema** (`games`, `game_attempts`, `friendships`) rather
  than new parallel tables.

## What already exists (schema)
- `friendships(requester_id, addressee_id, status, …)` — the social graph
  (`pending`/`accepted`/`blocked`), unique per pair.
- `games(id, creator_id, opponent_id, status, mode, question_ids uuid[], created_at,
  expires_at, completed_at)` — a 1v1 async match container with a **frozen question
  set**.
- `game_attempts(game_id, user_id, question_id, typed_response, grade, points,
  created_at, unique(game_id,user_id,question_id))` — each player's answers.
- `profiles`, competency, `daily_activity`, `badges`.

This already supports 1v1 async. Additions needed are small (below).

## Game lifecycle
```
pending  → both invited, set frozen, opponent not yet accepted/started
active   → at least one player has started answering
complete → both finished (or expiry resolved) → winner determined
expired  → response window passed before both finished (resolved by forfeit rules)
declined → opponent rejected the challenge
```
`expires_at` defaults to creation + 48h (configurable).

## Linking users into a game
1. **Friendship first.** Players connect via `friendships` (request → accept). The
   Social tab surfaces add/accept (graph already supports it). Random/global
   opponents are deferred (see open questions).
2. **Create.** `create_game(opponent_id, mode, filters)`:
   - Verifies caller and `opponent_id` are accepted friends.
   - **Freezes the question set**: selects N questions (respecting `filters` —
     category/difficulty) and stores them in `games.question_ids` so BOTH players get
     the **identical** set. Order can be the stored order (same for both) or shuffled
     per-player from the same set.
   - `creator_id` = caller, `opponent_id` = chosen friend, `status='pending'`,
     `expires_at` set. Fires a notification to the opponent.
3. **Accept / play.** Opponent opens the challenge; first answer flips `status` to
   `active`. Either player may already be mid-game; they don't interact live.
4. A player is "linked into" the game purely via `creator_id` / `opponent_id`; all
   their answers go to `game_attempts` keyed by `(game_id, user_id, question_id)`.
5. **Progress** for a player = `count(game_attempts where game_id,user_id) /
   length(question_ids)`. "Finished" = count equals the set size.

## Playing
- Reuses the **Train board UI** almost wholesale, bound to the game's frozen
  `question_ids` instead of the recommender. Each answer writes a `game_attempt`
  (mirrors `submit_practice_attempt`).
- A player **cannot see the opponent's answers or score until they themselves
  finish** (enforced in RLS / the read RPC) — prevents peeking.

## Determining wins / losses
- **Per-question points**: `points = value` if the grade is `correct`, else `0`
  (binary, consistent with solo scoring). `time_to_answer_ms` is captured for an
  optional speed bonus / tiebreak.
- **Player score** = `sum(game_attempts.points)` for that `(game_id, user_id)`.
- **Finalize** (`finalize_game`) runs when the **second player finishes**, or when a
  scheduled sweep finds an `expires_at` in the past:
  - Both finished → higher score wins.
  - **Tiebreak order**: (1) more `correct` answers, (2) lower total `time_to_answer_ms`,
    (3) genuine **draw**.
  - **Forfeit**: at expiry, if exactly one player finished, that player **wins by
    forfeit**; if neither finished, it's a **double-forfeit / no-contest** (no
    leaderboard impact); `declined` games never count.
- On finalize, write the result onto the game for cheap history/leaderboard reads:
  add `winner_id uuid null` (null = draw/no-contest), `creator_score int`,
  `opponent_score int`, set `completed_at`, `status='complete'`.

## Schema additions (small)
- `games`: add `winner_id uuid references profiles(id)`, `creator_score int`,
  `opponent_score int` (populated at finalize). `mode` already exists
  (`head_to_head`; add `daily_challenge` if we do that — see open questions).
- `game_status` enum: ensure it has `pending, active, complete, expired, declined`.
- `profiles`: add `expo_push_token text` for notifications.
- (A separate `game_participants` table is only needed if we later support >2 players;
  for 1v1 the `creator_id`/`opponent_id` columns are enough.)

## RPCs
- `create_game(opponent_id, mode, filters)` → freezes `question_ids`, returns game id.
- `get_game(game_id)` → game meta + your progress; the question set **without
  answers** under Option B (with answers under Option A); opponent's score/answers
  **only after you've finished**.
- `submit_game_attempt(game_id, question_id, typed_response, grade?, time_ms)` →
  inserts a `game_attempt`. **Option A**: client passes `grade`. **Option B**: omit
  `grade`; the server (Edge Function) grades and returns it. On the last answer,
  triggers `finalize_game` if the opponent is already done.
- `list_games(status?)` → your games (your turn / waiting / history).
- `finalize_game(game_id)` → scoring + winner (idempotent; safe to call from submit
  and from the expiry sweep).
- `get_friends_leaderboard(window)` → weekly points among accepted friends.

## Row-level security (mandatory here)
- `games`: a row is visible/updatable only to its `creator_id` / `opponent_id`.
- `game_attempts`: you may insert only your own rows for a game you're in; you may
  read the **opponent's** rows only once the game is `complete` (or once you've
  finished) — this is what prevents answer-peeking under Option A.
- `friendships`: visible only to `requester_id` / `addressee_id`.

## Anti-cheat: Option A now → Option B later
- **A (MVP):** answers ship to the client (as today) and the client grades. Honor
  system; fine for friends/family. RLS still hides the opponent's answers until
  reveal. Zero new infra.
- **B (before public/ranked):** a `get_game_questions` path returns **no answers**;
  `submit_game_attempt` grades **server-side** via a **Supabase Edge Function that
  reuses the existing `answerGrader.ts` logic** (Deno/JS — no rewrite). Answers are
  revealed only at completion. This closes the network-inspection cheat.

## Frontend (Expo / RN)
- **Social tab** (currently a placeholder): **Friends** (search / add / accept),
  **Challenges** (your turn / waiting / history), **Leaderboard** (friends, weekly).
- **Challenge flow**: create (pick friend + category/difficulty) → play (Train board
  bound to the frozen set) → **results screen** comparing your score vs the
  opponent's, per-question who-got-what.
- **"Your turn" indicators** on the tab; deep-linkable from notifications.
- Reuse: a `getGameQuestions` analog to `getRecommendedQuestions`, and a
  `submitGameAttempt` analog to `submitPracticeAttempt`.

## Notifications (Expo Push)
- Store `profiles.expo_push_token`. An Edge Function sends on **game created** (→
  opponent: "X challenged you") and **game completed** (→ both: "You beat Y" / "Y won").
- Remote push needs an APNs key via EAS credentials; works in **TestFlight builds**
  (not reliably in Expo Go), so it lands when you're doing real builds anyway.

## TestFlight specifics
- **Auth**: email+password works. Consider **Sign in with Apple** for lower friction
  (Apple only *requires* it if you add other social logins; email/password alone is
  fine). **App Review requires an account-deletion path** for any app with account
  creation — add before submitting.
- **RLS** is the thing to get right (multiplayer exposes other users' data).
- **Realtime** (Phase 2) and RLS both work fine on TestFlight.

## Phase 2 — live head-to-head (later)
- Supabase **Realtime** channel per game (broadcast answers/progress; presence for
  "opponent is answering…"), a **matchmaking queue** table, and **timeout/disconnect**
  handling. Ship async first; add this once there's real usage.

## Decisions (resolved 2026-06-15)
1. **Opponents**: friends **and** random matchmaking. Build friends + 1v1 first
   (it exercises the whole pipeline); add an async random-matchmaking queue once the
   core loop is solid.
2. **Competition shape**: **all three** — 1v1 duels, a shared daily challenge, and
   leaderboards. Recommended build order so each milestone ships something testable:
   M1 friends + 1v1 async duel → M2 daily challenge + leaderboards → M3 random
   matchmaking → M4 push. (Daily challenge is the stickiest single feature, but 1v1
   builds the schema/RPC/RLS plumbing the others reuse, so it goes first.)
3. **Push notifications**: yes — included (M4). Cost is moderate, not "very difficult":
   token storage + an Expo push call from an Edge Function. The one real prerequisite
   is APNs/EAS push credentials, which a TestFlight build needs anyway.

**Next step (not yet built):** turn the above into a concrete Phase-1 build plan —
migration `014_multiplayer.sql` (games scores/winner + `daily_challenges`,
`daily_challenge_attempts`, `matchmaking_queue`, `profiles.expo_push_token`), the RPC
set, RLS policies, and the Social-tab FE spec — sequenced as M1→M4 above.
