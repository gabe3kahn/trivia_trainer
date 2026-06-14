# iOS App Structure And Competency System

This document defines the mobile-first app structure for Trivia Trainer. The main shift is that the app opens on **Home**, where the user sees a difficulty-weighted competency score by category and overall. Training is the next action, but competency is the product's central game loop.

## Product Pillars

1. Show knowledge clearly: every category should have a visible, game-like score.
2. Train intentionally: practice should start from weaknesses, randomization, or selected categories.
3. Reward real growth: gamification should reward improvement and breadth, not just volume.
4. Build daily habits: activity should be visible through calendar-style tracking.
5. Keep social in mind: long-term social can become async crossplay, similar to Words With Friends.

## iOS Navigation

Use a five-tab structure:

1. **Home**
   - Default launch tab.
   - Shows overall competency score.
   - Shows difficulty-weighted scores for each primary category.
   - Highlights biggest gain, weakest category, and recommended next action.

2. **Train**
   - Practice entry point.
   - Modes: Challenge My Weaknesses, Randomize, Select Categories, Review Misses, Wordplay.
   - Includes filters for category, subcategory, point value, and clue mechanic.
   - Leads into the typed-answer practice loop.

3. **Daily**
   - Activity calendar and habit tracking.
   - Shows daily reps, review completion, streaks, and weekly activity.
   - Can include daily board/challenge later, but the core function is tracking.

4. **Social**
   - Future crossplay surface.
   - Async games, friend challenges, shared boards, nudges, and rematches.
   - Not needed for MVP, but the app structure should leave room for it.

5. **Profile**
   - Identity, XP, levels, badges, preferences, and settings.
   - Badges should make competency achievements feel collectible.

## Home

Purpose: answer "how good am I, and where should I go next?"

Primary modules:

- Overall Competency: a difficulty-weighted score from 0-100.
- Category Scores: one card/row for each of the 10 primary categories.
- Score Movement: biggest riser and biggest drop over the last 7 days.
- Recommendation: one button that sends the user into the best next training set.
- Category Detail Entry: tapping a category opens subcategory scores and value ladders.

Category cards should show:

- Category name.
- Difficulty-weighted score.
- Tier: Unmapped, Familiar, Developing, Solid, Strong, Mastered.
- Trend: up, flat, down.
- Evidence confidence: low, medium, high.
- Mini value ladder for $200, $400, $600, $800, $1000.

## Difficulty-Weighted Competency

The category score should not be plain accuracy. A user who gets $200 clues right should not receive the same rating as someone who gets $800 and $1000 clues right.

For MVP, use a transparent weighted model:

```text
weighted_score =
  sum(attempt_result_value * difficulty_multiplier * recency_multiplier)
  / sum(max_attempt_value * difficulty_multiplier * recency_multiplier)

category_competency = clamp(round(weighted_score * 100), 0, 100)
```

Suggested attempt result values:

```text
Correct: 1.00
Close: 0.55
Missed: 0.15
No Idea: 0.00
```

Suggested difficulty multipliers:

```text
$200: 0.70
$400: 0.85
$600: 1.00
$800: 1.25
$1000: 1.55
```

Suggested recency multiplier:

```text
Last 7 days: 1.00
8-30 days: 0.85
31-90 days: 0.65
91+ days: 0.45
```

Overall competency should be the weighted average of the 10 primary category scores, adjusted for evidence. Categories with very low evidence should contribute less until sampled enough.

```text
overall_score =
  sum(category_score * evidence_weight)
  / sum(evidence_weight)
```

Evidence confidence:

```text
0-14 attempts: low
15-49 attempts: medium
50+ attempts: high
```

Rating tiers:

```text
0-19: Unmapped
20-39: Familiar
40-59: Developing
60-74: Solid
75-89: Strong
90-100: Mastered
```

## Train

Purpose: let the user choose the kind of practice they want.

Primary modes:

- **Challenge My Weaknesses**
  - Builds a set from the lowest competency categories and subcategories.
  - Skews toward values just above the user's comfort zone.

- **Randomize**
  - Creates a mixed set across categories, values, and mechanics.
  - Good for general readiness and variety.

- **Select Categories**
  - User chooses one or more primary categories and optionally subcategories.
  - Useful for targeted study before a game night or personal goal.

- **Review Misses**
  - Spaced repetition queue from missed, close, and low-confidence answers.

- **Wordplay**
  - Focuses on clue mechanics such as before-and-after, starts-with, anagrams, and crossword clues.

Practice session requirements:

- Category, subcategory, value, and mechanic.
- Typed response.
- Reveal answer.
- Self-grade: Correct, Close, Missed, No Idea.
- Optional confidence.
- Optional note on why the clue was missed.

## Daily

Purpose: show consistency over time.

Daily should be less about a static challenge board and more about activity rhythm:

- Calendar heat map.
- Daily rep count.
- Review queue completed or not.
- Daily goal completion.
- Streaks, with gentle recovery.
- Weekly totals by activity type.
- Optional daily board as a bonus activity.

Calendar cells should be driven by meaningful activity:

- 0 reps: empty.
- 1-9 reps: light activity.
- 10-29 reps: standard day.
- 30+ reps: goal met.
- Review cleared: small marker.
- Challenge played: small marker.

## Social

Purpose: future async/crossplay layer.

Long-term direction:

- Turn-based head-to-head games.
- Shared boards where friends answer the same clues asynchronously.
- Rematches.
- Nudges.
- Friend streaks.
- Category wagers or category drafts.
- "Unique gets" and comparison after both players finish.

MVP should only reserve the space. Do not make Social a blocker for the core app.

## Profile And Badges

Purpose: identity, long-term rewards, and settings.

Profile should include:

- Level and XP.
- Overall competency.
- Badges.
- Favorite categories.
- Strongest/weakest categories.
- Friend/social status eventually.
- Preferences and data settings.

Badge ideas:

- **Cartographer**: reach Solid in Geography.
- **Archivist**: reach Solid in History.
- **Bookworm**: reach Solid in Literature & Books.
- **Lab Coat**: reach Solid in Science.
- **Gallery Guide**: reach Solid in Arts & Visual Culture.
- **Maestro**: reach Solid in Music & Performing Arts.
- **Oracle**: reach Solid in Religion, Mythology & Philosophy.
- **Wordsmith**: reach Solid in Language & Wordplay.
- **Playmaker**: reach Solid in Sports, Games & Leisure.
- **Zeitgeist**: reach Solid in Pop Culture, Media & Modern Life.
- **Deep Cut**: answer 25 $800 clues correctly.
- **Tournament Ready**: answer 10 $1000 clues correctly.
- **Clutch**: get three $1000 clues correct in one session.
- **Renaissance**: improve any category by 15 points in 30 days.
- **Board Runner**: complete a 30-clue board.
- **Comeback**: turn a low-confidence miss into two later correct answers.
- **Mechanic**: reach Strong in three wordplay mechanics.
- **Generalist**: reach Solid in all 10 primary categories.
- **Specialist**: reach Strong in any one category with high evidence.
- **Regular**: complete activity on 7 days in a row.

## Data Model Additions

### UserCompetency

```ts
type UserCompetency = {
  id: string;
  userId: string;
  dimensionType: "overall" | "category" | "subcategory" | "value" | "mechanic" | "tag";
  dimensionKey: string;
  competencyScore: number;
  tier: "unmapped" | "familiar" | "developing" | "solid" | "strong" | "mastered";
  evidenceCount: number;
  evidenceConfidence: "low" | "medium" | "high";
  weightedAttempts: number;
  weightedScore: number;
  trend7Day: number;
  trend30Day: number;
  lastSeenAt?: string;
  updatedAt: string;
};
```

### DailyActivity

```ts
type DailyActivity = {
  id: string;
  userId: string;
  date: string;
  reps: number;
  reviewReps: number;
  challengeReps: number;
  categoriesTouched: string[];
  dailyGoalMet: boolean;
  reviewCleared: boolean;
};
```

### Badge

```ts
type Badge = {
  key: string;
  name: string;
  description: string;
  criteria: Record<string, unknown>;
  tier?: "bronze" | "silver" | "gold";
};
```

### UserBadge

```ts
type UserBadge = {
  id: string;
  userId: string;
  badgeKey: string;
  earnedAt: string;
  metadata?: Record<string, unknown>;
};
```

## SwiftUI App Shape

Recommended module structure:

```text
TriviaTrainer/
  App/
    TriviaTrainerApp.swift
    AppRouter.swift
  Features/
    Home/
    Train/
    Daily/
    Social/
    Profile/
  Domain/
    Models/
    Scoring/
    Recommendation/
    ReviewScheduling/
    Badges/
  Data/
    LocalStore/
    Sync/
    QuestionProviders/
  DesignSystem/
    Components/
    Theme/
```

## MVP Build Order

1. Build local competency scoring from practice results.
2. Build Home with overall score and category scores.
3. Build Train mode selection: weaknesses, randomize, select categories, review misses, wordplay.
4. Build the practice loop and session recap.
5. Build Daily calendar/activity tracking.
6. Build Profile badges and XP.
7. Reserve Social as a future tab with placeholder async-game concepts.
8. Add accounts/crossplay when the solo loop is strong.

## Decisions Made

- Home is the default tab and primary competency surface.
- Competency is difficulty-weighted and evidence-aware.
- Train is for choosing practice mode, not for showing overall progress.
- Daily is an activity calendar and consistency tracker.
- Social is future-facing async crossplay, not an MVP dependency.
- Profile houses badges, XP, levels, and preferences.
