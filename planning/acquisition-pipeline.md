# Trivia Acquisition Pipeline

## Goal

Build the question bank in stages without tying the app to any one provider. Every import should preserve source metadata, map into our category taxonomy, validate before import, and produce SQL that can be reviewed before it touches Supabase.

## Current Stage: OpenTDB MVP Volume

Open Trivia DB gives us fast practice volume. It is useful for testing the app loop, competency scoring, and review behavior. It is not the final voice of the app: provider questions should go through the same quality gate as original packs and gradually be replaced or supplemented with cleaner Jeopardy-style clues.

Provider constraints:

- No API key required.
- Max 50 questions per request.
- One category per request when category filtering is used.
- One request per IP every 5 seconds.
- License: CC BY-SA 4.0.

Provider difficulty is intentionally conservative: OpenTDB `easy` maps to $200, `medium` maps to $400, and `hard` maps to $800. Original/editorial packs can still use $1000 when the clue requires deeper recall.

## Commands

Fetch and normalize one mixed batch:

```bash
node tools/acquisition/fetch-opentdb.mjs --amount 50 --label starter-001
```

Validate a normalized batch:

```bash
node tools/acquisition/validate-bank.mjs data/acquisition/normalized/opentdb-starter-001.json
```

Generate SQL for Supabase:

```bash
node tools/acquisition/build-import-sql.mjs data/acquisition/normalized/opentdb-starter-001.json data/acquisition/sql/import-opentdb-starter-001.sql
```

Import directly to Supabase after adding a local service-role key:

```bash
node tools/acquisition/import-to-supabase.mjs data/acquisition/normalized/opentdb-starter-001.json --dry-run
node tools/acquisition/import-to-supabase.mjs data/acquisition/normalized/opentdb-starter-001.json
```

The direct importer reads `.env.local`, `.env`, and `mobile/.env`. It needs `SUPABASE_SERVICE_ROLE_KEY`; the public Expo key cannot insert questions.

The direct importer, generated-SQL path, and OpenTDB fill runner now run `tools/acquisition/intake-assessment.mjs` before writing rows. That shared intake assessment applies:

- clue cleanup and known provider-polish rules from `question-quality-rules.mjs`
- the stricter feedback-shaped checks for ellipses, placeholder wording, weak numeric/unit signals, and answer-word leakage
- the conservative difficulty calibration rules from `difficulty-rules.mjs`

New rows get `quality_status`, `quality_score`, and `quality_issues`; `replace` and `deactivate` rows are saved inactive so they do not enter training. The importer also logs any dollar-value changes made by difficulty calibration.

Run the stricter feedback-shaped audit after imports:

```bash
node tools/acquisition/audit-feedback-issues.mjs
```

This catches the issues that surfaced in live testing: trailing ellipses, placeholder wording like "the what," vague numerical/unit answer forms, and meaningful answer words leaking into the clue.

Run the advisory difficulty calibration pass after larger bank changes:

```bash
node tools/acquisition/evaluate-difficulty.mjs
```

This uses the same `difficulty-rules.mjs` scoring as intake to create an editorial queue. It is not a replacement for real attempt data, but it helps find obviously over- or under-valued rows before the app has enough history.

Fill OpenTDB-covered categories toward a target count:

```bash
node tools/acquisition/fill-opentdb-targets.mjs --target 100 --maxCalls 80 --label balanced-001
```

This runner imports directly, respects OpenTDB's 5-second/IP limit between calls, applies the quality gate, and writes a normalized archive plus a run summary. It cannot fully cover categories OpenTDB does not meaningfully support, especially `language_wordplay`.

## Import Review

Before running generated SQL:

- Spot-check clue wording and answer ambiguity.
- Check the generated quality summary; anything counted as `replace` or `deactivate` will be inserted inactive.
- Check `provider_type`; true/false clues should usually be inactive for typed-answer practice.
- Check very short answers and dates.
- Check category mapping for broad OpenTDB buckets like `General Knowledge`.
- Keep `source`, `source_url`, and `external_id`.

## Next Stages

1. Add category-specific OpenTDB batches with provider category IDs.
2. Add a reviewed/manual seed pack in the same normalized JSON format.
3. Add Wikidata-generated packs for durable, open, structured facts.
4. Add a review UI or admin script that can promote `rewrite` rows to `keep` after editing.
