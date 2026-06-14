# Agent Difficulty Testing

Yes, we can create a panel of difficulty-testing agents. The useful version is not "ask one model what the value should be." It is a structured disagreement engine: each agent gets the same clue, answers from a defined skill level, and records whether the clue felt fair.

## Proposed Panel

| Agent | Expected Knowledge | What It Tests |
| --- | --- | --- |
| Casual Player | Broad school/pop-culture knowledge, light trivia | Whether $200 clues are accessible and not over-specialized. |
| Pub Trivia Regular | Plays trivia regularly, uneven category depth | Whether $400 clues are fair core recall. |
| Jeopardy Watcher | Familiar with clue style and common canon | Whether phrasing feels like Jeopardy and whether $400/$600 splits make sense. |
| Tournament Aspirant | Studies trivia, good breadth | Whether $800 clues are demanding but fair. |
| Domain Specialist | Strong only in one category at a time | Whether specialist clues are actually hard or just poorly phrased. |

## Agent Output Format

Each agent should return:

| Field | Meaning |
| --- | --- |
| `would_buzz` | Whether the agent thinks it would attempt the clue. |
| `predicted_correct` | Whether the agent expects to answer correctly. |
| `confidence` | 0-100 confidence in the answer. |
| `fairness` | Whether the clue gives enough signal for the assigned value. |
| `suggested_value` | $200, $400, $600, $800, or $1000. |
| `note` | One short reason, especially if it felt vague or leaked the answer. |

## Aggregation

- If Casual and Pub Trivia both expect to get it, it is probably $200-$400.
- If only the Jeopardy Watcher and Tournament Aspirant expect to get it, it is probably $600-$800.
- If only the specialist gets it, it is likely $800-$1000, unless the clue is too niche for the main bank.
- If agents disagree because the clue is vague, rewrite the clue before assigning difficulty.
- If agents agree that the answer is visible in the clue, rewrite it instead of lowering difficulty.

## Best Use

The agent panel should sit between deterministic audits and real user data:

1. Deterministic audits catch format errors, answer leakage, and obvious unit ambiguity.
2. Agent testing estimates human-facing difficulty and finds confusing phrasing.
3. Real attempt history adjusts category competency and eventually recalibrates question value.

Once the app has enough attempts, agent results should become fallback priors rather than final labels.
