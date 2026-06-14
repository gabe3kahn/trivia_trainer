# Trivia Trainer Product Plan

## Goal

Build a personal trivia-training app that helps you get better at Jeopardy-style clues through deliberate practice, recall tracking, category weakness analysis, and social accountability/play.

The core product should feel like a training tool first, not a game-show clone: fast reps, useful feedback, spaced review, and a clear sense of where you are improving.

## Important Data Source Note

J! Archive is a fan-created Jeopardy clue archive. It is valuable, but scraping it aggressively or redistributing its contents can create copyright, permission, and server-load problems. The safest product direction is:

- Treat J! Archive as an external reference/source, not something to hammer live.
- Do not use Jeopardy branding in the app name or UI beyond factual source attribution.
- Prefer a user-initiated/import workflow, a small local cache for personal use, or explicit permission before any large ingestion.
- Store source URL and metadata for each clue so attribution and cleanup are possible.
- Build the app so question providers are pluggable; J! Archive can be one source, not the whole architecture.

## Product Shape

### Solo Practice

- Practice by category, broad topic, difficulty/value, air date range, or random mix.
- Prompt with clue text and ask for typed response.
- Allow self-grading with `Got it`, `Close`, `Missed`, and `Didn't know`.
- Track confidence separately from correctness.
- Support "show answer" and quick notes.
- Let users save clues into custom decks.

### Learning System

- Spaced review queue based on misses, low confidence, and stale categories.
- Weakness dashboard by category, topic tags, value/difficulty, and clue type.
- Streaks and goals focused on reps and improvement, not empty gamification.
- "Postmortem" mode after a session: missed clues, answer patterns, things to study.
- Optional manual tagging, e.g. `opera`, `word origins`, `presidents`, `world capitals`.

### Social Component

Start with lightweight social features that reinforce practice:

- Friends/following.
- Shared decks.
- Daily challenge room.
- Asynchronous head-to-head sets from the same clue pool.
- Group leaderboard for weekly accuracy/improvement.
- Comments/reactions on custom decks or challenge results.

Avoid making social depend on real-time multiplayer for the MVP. Real-time play is fun but increases complexity quickly.

## MVP Proposal

### MVP 1: Local Solo Trainer

- Local web app.
- Question import from a small seed dataset/manual importer.
- Practice session with typed answers and self-grading.
- Local progress tracking.
- Basic stats by category and result.

### MVP 2: Source Import Layer

- Provider interface for importing questions.
- J! Archive importer designed around respectful/manual/small-batch use.
- Store source URL, game id, round, category, value, clue, answer, air date.
- Deduplicate by source/game/category/clue.

### MVP 3: Accounts And Social

- Auth.
- Cloud database.
- Friend list.
- Shared decks.
- Daily group challenge.
- Leaderboard based on participation, accuracy, and improvement.

## Data Model Draft

### Question

- `id`
- `source`
- `source_url`
- `source_game_id`
- `air_date`
- `round`
- `category`
- `value`
- `clue`
- `answer`
- `media_url`
- `tags`
- `created_at`

### PracticeResult

- `id`
- `user_id`
- `question_id`
- `session_id`
- `typed_response`
- `grade`
- `confidence`
- `time_to_answer_ms`
- `created_at`

### Deck

- `id`
- `owner_id`
- `name`
- `description`
- `visibility`
- `created_at`

### Challenge

- `id`
- `creator_id`
- `deck_id`
- `mode`
- `starts_at`
- `ends_at`
- `visibility`

## Architecture Recommendation

Good default stack:

- Frontend: Next.js / React
- Backend: Next.js API routes or a small FastAPI service
- Database: Postgres
- Auth/social: Supabase is a strong fast-start option
- Search: Postgres full-text first; add Meilisearch later if needed
- Local dev seed data: JSON/CSV in `data/`

If this is mostly personal at first, start with a local SQLite/Postgres version and keep the provider/import code separate so the app can grow without rewriting the core.

## Import Strategy

Use a provider abstraction:

- `QuestionProvider`
- `search()`
- `fetchGame()`
- `normalize()`
- `dedupeKey()`

For J! Archive specifically:

- Prefer manual URL import of a single game or small list.
- Use a clear delay/rate limit.
- Cache raw HTML locally for development.
- Do not run background crawlers.
- Include a config flag that disables network import by default.

This gives you a useful personal tool while avoiding a design that depends on bulk scraping.

## Social Feature Detail

### Daily Challenge

Each day, generate a 12-30 clue set. Friends answer asynchronously. Results reveal after submission:

- Accuracy
- Coryat-style score if desired
- Missed categories
- Fun comparison: "you got 3 clues nobody else got"

### Shared Decks

Users can create decks from imported clues, missed clues, or manual study lists. Decks can be private, friends-only, or public within the app.

### Study Groups

Small groups can set weekly goals:

- `300 reps/week`
- `80% on geography`
- `review all missed clues from last week's challenge`

## Key Product Decisions

- Use self-grading first; exact answer matching is hard and often frustrating.
- Build around improvement metrics, not only win/loss.
- Keep official Jeopardy terms/branding minimal and careful.
- Make source providers replaceable.
- Make the social layer supportive rather than noisy.

## Open Questions

- Is this primarily for your own study, a small friend group, or something public?
- Do you want strict Jeopardy simulation or broader trivia training?
- Should answers require phrasing as a question, or ignore that for training?
- Do you want AI-generated explanations/study notes for missed clues?
- Should the social component be competitive, collaborative, or both?
- Are you comfortable with a cloud app, or do you want local-first?

## First Build Milestones

1. Create app scaffold.
2. Add seed questions manually.
3. Build practice session UI.
4. Store local results.
5. Add basic dashboard.
6. Add provider/import interface.
7. Add careful J! Archive single-game importer.
8. Add accounts/social challenge layer.

