# Backend Data Contract

This document maps the Expo mockup screens to backend data that can be recorded, queried, and synced later. The app shell should not show metrics that cannot be explained by stored user activity.

## Core Tables

### profiles

User identity and account metadata.

Fields:

- `id`
- `email`
- `display_name`
- `username`
- `created_at`
- `last_active_at`

Feeds:

- Profile header
- Account info
- Friend discovery

### questions

Canonical question bank.

Fields:

- `id`
- `source`
- `source_url`
- `category`
- `subcategory`
- `value`
- `difficulty_rank`
- `mechanic`
- `constraint`
- `clue`
- `answer`
- `aliases`
- `tags`
- `created_at`

Feeds:

- Train sessions
- Review queue
- Category competency dimensions

### practice_sessions

One started/completed training set.

Fields:

- `id`
- `user_id`
- `mode`
- `selected_categories`
- `selected_subcategories`
- `selected_values`
- `selected_mechanics`
- `started_at`
- `completed_at`
- `question_count`

Feeds:

- Train history
- Daily activity
- Profile totals

### practice_attempts

One user answer to one question.

Fields:

- `id`
- `session_id`
- `user_id`
- `question_id`
- `typed_response`
- `grade`
- `confidence`
- `time_to_answer_ms`
- `created_at`

Feeds:

- Overall competency
- Category scores
- Review queue
- Daily reps
- Badge progress

### category_competencies

Materialized/user-specific scores by dimension.

Fields:

- `id`
- `user_id`
- `dimension_type`
- `dimension_key`
- `score`
- `tier`
- `attempts`
- `correct_rate`
- `avg_correct_value`
- `due_review_count`
- `seven_day_delta`
- `thirty_day_delta`
- `updated_at`

Feeds:

- Home overall score
- Home category score rows
- Train weakness recommendation
- Badge qualification

### review_items

Spaced review queue.

Fields:

- `id`
- `user_id`
- `question_id`
- `source_attempt_id`
- `state`
- `due_at`
- `last_reviewed_at`
- `review_count`
- `ease`

Feeds:

- Home review due count
- Train Review Misses
- Daily review cleared marker

### daily_activity

One row per user per date.

Fields:

- `id`
- `user_id`
- `date`
- `reps`
- `review_reps`
- `review_cleared`
- `challenge_reps`
- `challenge_played`
- `categories_touched`
- `daily_goal_met`

Feeds:

- Daily Today tile
- Daily Review tile
- Daily Week tile
- Activity calendar colors and markers

### badges

Badge definitions.

Fields:

- `key`
- `name`
- `description`
- `criteria`
- `tier`

Feeds:

- Profile badge grid

### user_badges

User-earned badges.

Fields:

- `id`
- `user_id`
- `badge_key`
- `earned_at`
- `metadata`

Feeds:

- Profile earned/locked badge states
- Profile badge count

## Future Social Tables

### friendships

Fields:

- `id`
- `requester_id`
- `addressee_id`
- `status`
- `created_at`
- `accepted_at`

Feeds:

- Profile add friends
- Friend requests
- Social opponent list

### games

Async crossplay container.

Fields:

- `id`
- `creator_id`
- `opponent_id`
- `status`
- `mode`
- `question_ids`
- `created_at`
- `expires_at`

Feeds:

- Social turn-based games
- Rematches

### game_attempts

Attempt rows tied to async games.

Fields:

- `id`
- `game_id`
- `user_id`
- `question_id`
- `typed_response`
- `grade`
- `points`
- `created_at`

Feeds:

- Social result comparison
- Unique gets
- Crossplay scoring

## Screen Mapping

### Home

Reads:

- `category_competencies`
- `practice_attempts`
- `review_items`

Writes:

- none directly

### Train

Reads:

- `category_competencies`
- `questions`
- `review_items`

Writes:

- `practice_sessions`
- `practice_attempts`
- `review_items`
- recalculated `category_competencies`
- `daily_activity`

### Daily

Reads:

- `daily_activity`
- `review_items`
- `practice_sessions`

Writes:

- mostly indirect through completed sessions and reviews

### Social

Reads:

- future `friendships`
- future `games`
- future `game_attempts`

Writes:

- future async game state

### Profile

Reads:

- `profiles`
- `user_badges`
- `badges`
- `friendships`
- aggregate user activity

Writes:

- profile settings
- friend requests
- sign out is client auth state, not a row
