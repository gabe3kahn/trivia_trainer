# Acquisition Data

This folder stores provider output before it becomes part of the app's reviewed question bank.

## Folders

- `raw/`: unmodified provider responses.
- `normalized/`: app-shaped question JSON after taxonomy mapping.
- `sql/`: generated Supabase insert scripts.

## Provider Notes

Open Trivia DB content is available under Creative Commons Attribution-ShareAlike 4.0. Keep `source`, `external_id`, and `source_url` fields when importing so we can preserve attribution and separate provider-backed clues from original/manual clues.

The Open Trivia DB import is useful for MVP volume, but its questions are not written in our target Jeopardy-style voice. Treat these as provisional practice content until reviewed/generated packs replace them.

Import scripts now apply the shared quality gate in `tools/acquisition/question-quality-rules.mjs`. Rows classified as `replace` or `deactivate` are preserved for provenance but imported with `is_active = false`, so normal training only sees rows that passed the gate or need light rewriting.
