# Trivia Trainer Supabase Backend

This folder contains the first backend foundation for the Trivia Trainer app.

## Migrations

- `001_core_schema.sql`: core tables, enums, RLS policies, and profile trigger.
- `002_scoring_and_activity.sql`: competency scoring, review queue updates, and daily activity updates.
- `003_seed_reference_data.sql`: taxonomy, badges, and starter questions.
- `004_training_rpcs.sql`: app-facing RPCs for recommended questions, sessions, and attempts.
- `008_session_feedback_question_fixes.sql`: user playtest fixes for clue difficulty, aliases, and typo cleanup.
- `009_playtest_learning_generalized_fixes.sql`: generalized playtest-learning fixes for low-value specialist clues and rewrite artifacts.

## Question QA

Run these from the repo root when playtesting reveals a reusable quality pattern:

```text
node tools/acquisition/audit-playtest-learnings.mjs
node tools/acquisition/apply-playtest-learning-fixes.mjs
```

The audit writes `data/acquisition/playtest-learning-audit.json` and `.md`. The apply step only applies conservative auto-fixes.

## First Setup

Create a Supabase project, then run the migrations in order with the Supabase CLI or through the SQL editor.

For the Expo app, copy:

```text
mobile/.env.example
```

to:

```text
mobile/.env
```

and fill:

```text
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
```

## Data Flow

The intended app flow is:

1. `get_recommended_questions` returns a set of question IDs and display data.
2. `create_practice_session` records the session and its ordered questions.
3. `submit_practice_attempt` records each answer.
4. The attempt trigger updates:
   - `review_items`
   - `daily_activity`
   - `category_competencies`

The Expo app currently uses static mock data, but `mobile/src/services/triviaApi.ts` is ready to swap screens over to live data.
