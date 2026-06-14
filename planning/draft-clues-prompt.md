You are drafting candidate trivia clues for the trivia_trainer app, for a HUMAN to review before import. You are running locally and unattended (a scheduled task), with full local access: Wikipedia is reachable, Supabase credentials are in .env.local, git push works, and the `gh` CLI is authenticated.

HARD RULES: Draft only. Do NOT import live into Supabase (dry-run only). Do NOT merge any PR. Stop after opening the PR and printing your summary.

Steps:

1. Read planning/clue-authoring-guide.md (the calibration rules) and data/sourcing/subcategories.json (valid subcategory names per category). Internalize: declarative "this/it" phrasing, not interrogative; NO answer leaks — the clue must not contain the answer's words or any word sharing a root/stem with the answer (e.g. "southernmost" leaks "Southern Ocean"); difficulty comes from revealing LESS and asking from the surprising end, NOT from stacking facts ($200-400 = direct recall, $600 = triangulation, $800-1000 = a single oblique/counterintuitive hook). Write each clue ONLY from a fact stated in a cited source doc — never from memory.

2. Pick ONE under-covered category. Query Supabase for active clue counts by category (use tools/acquisition/acquisition-utils.mjs with the .env.local credentials, the same pattern verify-clue-sources.mjs uses with --from-db). SKIP geography (already at 200). Also skip any category that already has a recent draft in data/sourcing/packs/drafts/ unless every non-geography category has one.

3. BUILD THE CATEGORY'S OWN SOURCE DOCS (mandatory every run). Run `node tools/acquisition/build-topic-docs.mjs --category <category> --limit 25`. This fetches cited Wikipedia docs from that category's topic store into data/sourcing/docs/<category>/ (idempotent — it skips docs that already exist, so it's cheap when the corpus is already grown). Wikipedia is reachable here. Do this BEFORE authoring so the clues are grounded in the chosen category's OWN docs. NEVER borrow another category's docs (e.g. do not write History clues from geography docs); if after this step the category still has too few usable docs to write ~15 good clues, pick a different under-covered category and build its docs instead.

4. Author ~15 clues grounded ONLY in the Wikipedia lead extracts in data/sourcing/docs/<category>/ (the folder for your chosen category). Attach each source doc's {source,title,url} citation to its clue. Give each clue a category_id and a subcategory_name that EXACTLY matches an entry in data/sourcing/subcategories.json for that category. Match the exact pack shape used by existing files in data/sourcing/packs/ — open one and copy its field names. Quality over volume; ~15 is plenty.

5. Write the pack to data/sourcing/packs/drafts/<category>-draft-<YYYY-MM-DD>.json (use today's date).

6. Verify: run `node tools/acquisition/verify-clue-sources.mjs --pack <that pack> --write-back`. Then run `node tools/acquisition/import-to-supabase.mjs <that pack> --dry-run` to get the quality + difficulty gate result. Do NOT run a live import.

7. Open a PR. First start from a clean, current main so the daily harvest's local changes don't ride along: `git checkout main && git pull --ff-only origin main`, then `git checkout -b draft-clues/<category>-<YYYY-MM-DD>`. Commit **only your own new files, by explicit path** — the draft pack and the docs you built for THIS category:
   `git add data/sourcing/packs/drafts/<your-pack>.json data/sourcing/docs/<category>/`
   then commit. **NEVER run `git add -A` or `git add .`** — derived/runtime files (topic stores, harvest state/logs, regenerated reports) must never be committed, or unreviewed daily PRs will collide on them. Push and run `gh pr create` with a body summarizing the draft. Do NOT merge.

8. Print a concise final summary: the category chosen and why (with the active-count that made it under-covered), how many new docs step 3 fetched, clue count, the verify result (verified/weak/unverified), the dry-run quality/difficulty gate result, any leak or quality concerns you caught and how you handled them, and the PR URL.

Remember: this is a draft for human review. Never import live, never merge.
