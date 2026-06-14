# Data Source Options

## Short Answer

Yes. We should treat J! Archive as optional/reference-only and build the app around pluggable sources. The best path is probably a hybrid:

1. Use open trivia APIs for quick MVP volume.
2. Generate higher-quality study clues from open sources like Wikidata.
3. Allow manual/private imports for personal sets.
4. Keep J! Archive out of the default ingestion path unless permission/use constraints are resolved.

## Option 1: Open Trivia DB

Best for: fast MVP, simple API, free question pool.

Pros:
- Free JSON API.
- No API key required.
- Categories, difficulty, type, and session tokens.
- Data is licensed under Creative Commons Attribution-ShareAlike 4.0.

Cons:
- Mostly multiple-choice / true-false style, not Jeopardy-style clue writing.
- Quality and difficulty may vary.
- Attribution/share-alike obligations matter if redistributed.
- Rate limit is one request per IP every 5 seconds.

Use it for:
- MVP practice loop.
- Social daily challenges.
- Category performance tracking.

Source: https://opentdb.com/api_config.php

## Option 2: The Trivia API

Best for: broader ready-made trivia pool with an API product.

Pros:
- Simple trivia API.
- Noncommercial use is allowed under CC BY-NC 4.0.
- Commercial use is available through paid subscription.

Cons:
- Noncommercial license limits what we can do if this becomes public/commercial.
- Still not necessarily Jeopardy-style.
- Needs account/API key for use.

Use it for:
- Prototype or private/noncommercial version.
- Supplemental daily challenges.

Source: https://the-trivia-api.com/docs/

## Option 3: API Ninjas Trivia

Best for: easy commercial-ish API integration if pricing/terms fit.

Pros:
- Simple endpoint returning `category`, `question`, and `answer`.
- Category filters are available on premium.
- Trivia of the day endpoint is useful for social daily prompts.

Cons:
- Requires API key.
- Free users have limited access; premium is needed for broader access and filters.
- Licensing/redistribution rights need review before storing or republishing at scale.

Use it for:
- Daily challenge feed.
- Backup provider.
- Quick external source while our own generated question bank grows.

Source: https://api-ninjas.com/api/trivia

## Option 4: Wikidata-Generated Questions

Best for: scalable, legally clean, structured fact-based training.

Pros:
- Wikidata structured data is CC0.
- We can generate questions programmatically from facts.
- Great for categories like geography, literature, awards, science, history, rulers, films, composers, capitals, birthplaces, works, and discoveries.
- We can store our generated questions because the underlying structured data is open.

Cons:
- Generated questions can feel dry unless templates are good.
- Need validation to avoid ambiguity.
- SPARQL/query design takes care.
- Not all facts are equally reliable or clue-worthy.

Use it for:
- Core long-term question bank.
- Weakness-focused drills.
- Jeopardy-adjacent clues without copying Jeopardy clue text.

Example templates:
- `This capital city is located in {country}.` -> `{capital}`
- `This author wrote {work}.` -> `{author}`
- `{person} won the Nobel Prize in this field.` -> `{field}`
- `This chemical element has atomic number {n}.` -> `{element}`
- `This country borders {neighbor} and has capital {capital}.` -> `{country}`

Source: https://www.wikidata.org/wiki/Help:Queries

## Option 5: Public-Domain / Open Text Sources

Best for: richer clue writing and study explanations.

Potential sources:
- Wikipedia/Wikidata summaries with license compliance.
- Project Gutenberg for literature/public-domain works.
- Library of Congress / National Archives data.
- NASA open data/media.
- Smithsonian/open museum collections.
- MusicBrainz, Open Library, Crossref, GeoNames, DBpedia, OpenStreetMap depending on category.

Pros:
- Can create better clues and explanations than generic APIs.
- Good for "learn the thing" mode, not just "test the thing."

Cons:
- Each source has its own license and attribution requirements.
- Generated clues need QA.
- Some sources are better for facts than for natural-language clue style.

Use it for:
- Topic packs.
- Study notes after missed clues.
- Rich categories like presidents, mythology, literature, art, geography, science.

## Option 6: Manual / Community-Created Question Packs

Best for: social component and high-quality curation.

Pros:
- Friends can write and share decks.
- We control formatting and metadata.
- Great for personal weak areas.
- Avoids dependency on external copyrighted clue banks.

Cons:
- Needs moderation if public.
- Quality varies.
- Could drift away from Jeopardy-style unless templates/guidelines help.

Use it for:
- Shared decks.
- Study groups.
- Private competitive sets.

## Option 7: Licensed Question Providers

Best for: if this becomes a serious public/commercial app.

Pros:
- Clear rights.
- Better reliability and support.
- Often includes categories/difficulty metadata.

Cons:
- Costs money.
- May have limits on storage, display, or derivative use.
- Quality may still vary.

Use it for:
- Public launch.
- Monetized version.
- Avoiding legal ambiguity.

## Recommended Direction

For this app, I would do:

### MVP

- Open Trivia DB for immediate volume.
- Manual seed packs for categories you care about.
- Self-grading typed-answer mode.

### V1

- Add Wikidata question generation for cleaner long-term ownership.
- Keep generated clues in our own database with source fact attribution.
- Add quality review flags.

### Social

- Daily challenges can draw from reviewed generated questions plus Open Trivia DB.
- Shared decks let friends create better/trickier sets.

### J! Archive

- Keep as a personal reference and maybe a manual "open source page" link.
- Do not scrape or store J! Archive clue text by default.

## Best First Build Choice

Start with Open Trivia DB plus our own seed format. In parallel, design the question schema to handle generated Wikidata clues. That gives us a working app quickly and a path toward a cleaner, more durable question bank.

