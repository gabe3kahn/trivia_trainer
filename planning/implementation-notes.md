# Implementation Notes

## Suggested Folder Shape

```text
Trivia Trainer/
  README.md
  planning/
    product-plan.md
    implementation-notes.md
  app/
  data/
    seed-questions.json
  scripts/
```

## Early Technical Choices

For the first prototype, a Next.js app with a local JSON seed file is enough. Do not start with scraping, auth, or multiplayer. Prove the practice loop first:

1. Show clue.
2. User types response.
3. User reveals answer.
4. User self-grades.
5. Result is recorded.
6. Next clue appears instantly.

For the iOS-shaped product structure, competency model, gamification system, and app navigation, see `planning/app-structure.md`.

## Practice Session UX

The first screen should be the trainer itself:

- Left/center: clue card, category, value, answer input.
- Right/side: session progress and recent results.
- Bottom/after reveal: grading controls.

Avoid a landing page. This is a tool.

## Scoring

Use two scoring models:

- Training score: correctness/confidence/review schedule.
- Optional Jeopardy-style score: value gained/lost.

Training score should drive the app. Jeopardy-style score is fun but can distract from learning.

## Answer Matching

Do not rely on automatic exact matching early. Jeopardy answers have aliases, spelling variants, partial names, and judgment calls.

MVP grading:

- `Correct`
- `Close`
- `Missed`
- `No idea`

Later:

- fuzzy matching
- accepted aliases
- AI-assisted adjudication

## Question Provider Interface

Keep imported clues normalized into one schema. A provider should return raw source data plus normalized questions.

```ts
type NormalizedQuestion = {
  source: string;
  sourceUrl?: string;
  sourceGameId?: string;
  airDate?: string;
  round?: string;
  category: string;
  value?: number;
  clue: string;
  answer: string;
  mediaUrl?: string;
  tags?: string[];
};
```

## J! Archive Handling

Build the importer last among the MVP foundations.

Guidelines:

- single-game import before season/bulk import
- manual URL input
- visible attribution
- cache raw HTML while developing
- configurable delay
- no automatic crawling by default

## Social MVP

The lowest-complexity social slice is asynchronous shared challenges:

1. User creates challenge from a deck or random filter.
2. Friends answer same questions.
3. Results reveal after completion.
4. Group page shows who played and what categories hurt everyone.

Real-time buzzing can come later.
