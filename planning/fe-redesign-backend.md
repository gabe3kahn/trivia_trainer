# FE redesign — backend assessment

What the new front end (see `mockups/app-redesign.html`) needs from the backend, what already exists, and what's net-new. The headline: **the visual redesign is almost entirely a reskin on the backend we already have** — the real new backend work is the **Compete** surface (daily challenge + duels + friends + leaderboards), plus **streak**, **badge awarding**, and **push**.

Companion to `planning/multiplayer-design.md` (the Compete build is that doc, scoped here against the new screens).

---

## Screen → backend map

| Screen / element | Backend need | Status |
|---|---|---|
| **Home** · mastery ring (68 · Sharp · ▲3) | `category_competencies` overall row + `seven_day_delta` | ✅ exists |
| **Home** · 🔥 streak | consecutive days the Daily Challenge was played | 🟠 new (depends on Daily Challenge) |
| **Home** · Daily Challenge card ("7 clues · 4 friends played") | `daily_challenges` set + friends-played count | 🔴 new |
| **Home** · compete strip (active game / challenge / invite) | `games` + `friendships` + a "what to surface" resolver | 🔴 new |
| **Home** · quick practice (weak spots) | `get_recommended_questions(mode='weakness')` | ✅ exists |
| **Home** · last-session line | recent `practice_sessions` summary | 🟡 minor (derive) |
| **Train** · modes (weakness/random/review/wordplay/pick) | `get_recommended_questions` (modes, categories, mechanics) | ✅ exists |
| **Clue card** · clue/answer/aliases/image/answer_detail | `get_recommended_questions` payload | ✅ exists |
| **Clue card** · 1–5 difficulty pips | `questions.difficulty_rank` (already 1–5) | ✅ exists |
| **Clue card** · per-category color glow | category→color mapping | 🟢 FE constant (or optional `categories.color`) |
| **Clue card** · submit + self-grade | `submit_practice_attempt` | ✅ exists |
| **Compete** · Daily Challenge play + leaderboard | `daily_challenges`, `daily_challenge_attempts`, leaderboard RPC | 🔴 new |
| **Compete** · Duels (1v1) | `games`/`game_attempts` (+ scores/winner) + RPCs | 🟠 tables exist, RPCs + columns new |
| **Compete** · Friends (search/invite/accept) | `friendships` (exists) + request/search/invite RPCs | 🟠 table exists, RPCs new |
| **Compete** · weekly friends leaderboard | aggregate RPC over games + daily attempts | 🔴 new |
| **Profile** · mastery + category bars | `category_competencies` (overall + category) | ✅ exists |
| **Profile** · stats: reps / streak / win-rate / badges | reps ✅ · streak 🟠 · win-rate 🔴(duels) · badges 🟠 | mixed |
| **Profile** · badges (earned vs locked) | `badges`/`user_badges` exist; **awarding not implemented** | 🟠 new (award step) |
| **New-user** · warm-up / calibration | gate mastery until N reps (confidence already modeled) | 🟢 mostly FE + flag |
| **All** · avatars (colored initials) | derive from `display_name`; optional `avatar_url` later | 🟢 FE (optional column) |
| **Cross-cut** · push (your turn / daily / friend req) | `profiles.expo_push_token` + send Edge Function + EAS/APNs | 🔴 new |

Legend: ✅ exists · 🟢 FE-only/trivial · 🟡 minor query · 🟠 partial (extend existing) · 🔴 net-new build.

---

## Already in place (reuse, don't rebuild)
- **Question delivery & practice loop:** `get_recommended_questions` (modes, category/mechanic filters), `create_practice_session`, `submit_practice_attempt`.
- **Competency model:** `category_competencies` (overall + per-category, tiers, 7/30-day deltas), expectation-relative scoring (migrations 010/011), `recalculate_user_competencies`.
- **Difficulty 1–5:** `questions.difficulty_rank` already powers the new pips — no change.
- **Visual clues:** `image_url` / `answer_detail` already on `questions` and in the recommender payload (migration 013).
- **Tables that exist but are under-used:** `games`, `game_attempts`, `friendships`, `daily_activity`, `badges`, `user_badges`, `profiles.username`.
- **Auth:** email/password.

So **Home (mastery + quick practice), Train, the whole in-session clue experience, and Profile's mastery+categories ship on today's backend** — they're a reskin.

---

## Net-new backend work

### A. Migrations (schema)
1. `daily_challenges` — `challenge_date date pk, question_ids uuid[], created_at`.
2. `daily_challenge_attempts` — `id, challenge_date, user_id, question_id, typed_response, grade, points, time_ms, created_at`, `unique(challenge_date,user_id,question_id)`.
3. `games` columns — `winner_id uuid, creator_score int, opponent_score int` (lifecycle/`completed_at` already there).
4. `profiles` columns — `expo_push_token text`, `avatar_url text` (optional), `phone_hash text` (for contacts matching, indexed). Streak is computed on read — **no** counter column.
5. `matchmaking_queue` — `user_id pk, filters jsonb, enqueued_at` (only for random matchmaking, M3).
6. `categories.color` — **not added**; the category→color map lives as a FE constant (10 static categories).
7. RLS policies for every new table (own rows; friends-read for leaderboards; participants-only for games).

### B. RPCs
- **Home:** `get_home_summary()` — overall mastery + tier + weekly delta, streak, today's Daily Challenge status, the compete-strip state, last-session blurb. (One aggregate call keeps Home a single round-trip.)
- **Daily Challenge:** `get_or_create_daily_challenge(date)`, `submit_daily_attempt(...)`, `get_daily_leaderboard(date, scope='friends')`.
- **Duels:** `create_game(opponent, n, filters)`, `get_game(id)`, `submit_game_attempt(...)`, `finalize_game(id)`, `list_games(status)`.
- **Friends:** `search_users(q)`, `send_friend_request(addressee)`, `respond_friend_request(id, accept)`, `list_friends()`, `get_friends_leaderboard(window)`. **Invite:** `create_invite()` → share-link token + `redeem_invite(token)` (auto-friends on signup). **Contacts (fast-follow):** `match_contacts(hashed[])` against `profiles.phone_hash`.
- **Matchmaking (M3):** `enqueue_random_game(filters)` + pairing.

### C. Jobs / scheduled
- **Daily Challenge generation** — one `daily_challenges` row per day (pick N questions, balanced). **Server-side** via Supabase `pg_cron` (or a scheduled Edge Function) — **not** the local laptop task, so it can't be missed when a machine is asleep. Runs early each day before users wake up.

### D. Edge Functions (phased)
- **`send-push`** (Expo Push API) — your-turn, daily-available, friend-request. Needs `expo_push_token` + EAS/APNs credentials (a TestFlight build needs these anyway).
- **`grade-attempt`** (server-side, Option B / anti-cheat) — reuse `answerGrader` logic; **Phase 2** (Phase 1 grades client-side / honor system).

### E. Badge awarding
- A post-attempt / post-game hook (trigger or RPC step) that evaluates `badges.criteria` and inserts `user_badges`. Today badges exist but are never granted — the Profile "earned vs locked" wall needs this.

### F. Streak
- **Consecutive days the Daily Challenge was played, computed on read** from `daily_challenge_attempts` dates — no stored counter, no update logic, no drift. Surfaced by `get_home_summary`. Coupled to the Daily Challenge existing (Compete M2).

---

## Phasing (maps to build order)

**Phase R — Redesign on existing backend.** Ship the new look + 4-tab IA using what exists: Home (mastery hero, quick practice, last session), Train, the custom clue card + pips (category color = FE constant), Profile (mastery + categories + **earned badges**). Compete tab present in its empty/invite state. *BE cost: one small add* — **badge awarding** (the post-attempt hook in §E) is in scope for Phase R so Profile shows real badges, not an all-locked wall. Everything else is FE.

**Phase 1 — Compete core (the multiplayer doc).**
- M1: friends graph + 1v1 async duels (`games` scores/winner, friend RPCs, duel RPCs, RLS). Unlocks Home compete strip (active/challenge variants), Profile win-rate.
- M2: Daily Challenge + leaderboards (`daily_challenges`, attempts, generation job, leaderboard RPCs). Unlocks Home Daily card, streak, "N friends played."
- M3: random matchmaking (`matchmaking_queue`).
- M4: push (`expo_push_token`, `send-push`, EAS/APNs).

**Phase 2 — Live + server-grading.** Realtime duels (Supabase Realtime), `grade-attempt` Edge Function (anti-cheat).

Note the dependency: **streak, the Daily Challenge card, and "N friends played" all need Phase 1 (M2)** — Home shows the invite/empty variants until then. If we want the streak earlier, M2's solo Daily Challenge is the minimum.

---

## Decisions (resolved 2026-06-17)
- **Streak:** consecutive days the Daily Challenge was played, **computed on read** from `daily_challenge_attempts` — no stored counter. (Needs Compete M2.)
- **Daily Challenge generation:** **server-side** (`pg_cron` / scheduled Edge Function), not the local task — can't be missed by a sleeping laptop.
- **Invite mechanics:** **share link + username search first; phone contacts as a fast-follow** (adds `profiles.phone_hash` + `match_contacts` + a privacy prompt); QR deferred.
- **Badge awarding:** **on for Phase R** — implement the §E award hook now so Profile shows earned badges from day one.
- **`categories.color`:** **FE constant**, not a DB column.
