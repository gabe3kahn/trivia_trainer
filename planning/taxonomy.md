# Jeopardy-Style Training Taxonomy

This taxonomy is inspired by common Jeopardy-style knowledge areas, but it is not derived from copied clue text or systematic J! Archive extraction. Use it as the app's first category backbone for original question writing and open-source question generation.

## Design Principles

- Prefer broad primary categories that support long-term progress tracking.
- Use subcategories that are specific enough to reveal weaknesses.
- Write original clues from open/reference sources.
- Keep each question tagged by both primary category and subcategory.
- Allow multiple tags when a clue crosses categories.
- Track difficulty separately from category; "History" can have easy clues and brutal clues.

## Difficulty / Point Bands

Use Jeopardy-style point values as the app's primary difficulty language:

- `$200 - Recognition`: famous facts, common terms, canonical works, capitals, household names.
- `$400 - Standard`: facts a regular trivia player should learn; clear clue path.
- `$600 - Competitive`: requires stronger recall, less famous examples, second-order associations.
- `$800 - Deep Cut`: specialized knowledge, trickier framing, or several-step reasoning.
- `$1000 - Tournament`: obscure, high-precision, or unusually demanding material.

Internally, store both `value` and `difficulty_rank`:

```json
{ "value": 600, "difficulty_rank": 3 }
```

## Writing Style

Good training clues should:

- Point to one unambiguous answer.
- Avoid copying published clue phrasing.
- Include learnable context.
- Use "this..." phrasing when useful, but not mechanically.
- Avoid pure gotchas unless the subcategory is wordplay.
- Store source facts separately from clue wording.
- Support optional wordplay mechanics across any category, not only Language & Wordplay.

Example:

```text
Category: Literature / 19th-Century Novels
Clue: This 1866 Dostoevsky novel follows Raskolnikov after the murder of a pawnbroker.
Answer: Crime and Punishment
Difficulty: 1
```

## Reusable Wordplay Mechanics

Jeopardy-style wordplay should be available across the whole taxonomy. A clue can belong to `History / U.S. Presidents & Elections` while also having a mechanic like `starts-with-er` or `before-after`.

Store these as a separate field such as `mechanic` or `clue_type`.

Recommended mechanics:

- `standard`: normal fact clue.
- `starts_with`: answer must start with a given letter/string, e.g. starts with "ER".
- `ends_with`: answer must end with a given letter/string.
- `contains`: answer must contain a given letter/string.
- `crossword_clue`: short crossword-style clue, often with a letter constraint such as "S".
- `before_after`: two answers overlap into one phrase.
- `rhyme_time`: answer is a rhyming phrase.
- `anagram`: answer is an anagram of given letters.
- `initials`: answer is identified by initials or abbreviation.
- `quote_completion`: answer completes a quote or title.
- `same_name`: two people/places/things sharing a name.
- `hidden_word`: answer hidden across a phrase.
- `word_ladder`: transform one word to another through letter changes.

Examples:

```text
Category: History / U.S. Presidents & Elections
Mechanic: starts_with
Constraint: starts with "ER"
Clue: This constitutional change lowered the voting age to 18.
Answer: the Equal Rights... [bad clue, because answer does not fit]
```

The example above is intentionally bad: the mechanic must be checked as part of review. A better clue:

```text
Category: Science / Medicine & Anatomy
Mechanic: starts_with
Constraint: starts with "ER"
Clue: This hospital department handles acute emergencies.
Answer: ER
Value: $200
```

```text
Category: Literature & Books / Authors & Works
Mechanic: before_after
Clue: Jane Austen novel + Steinbeck mouse-and-men novella.
Answer: Pride and Prejudice and Of Mice and Men
Value: $600
```

```text
Category: Geography / World Capitals
Mechanic: crossword_clue
Constraint: S
Clue: Capital of Chile.
Answer: Santiago
Value: $400
```

## Primary Categories

1. Literature & Books
2. History
3. Geography
4. Science
5. Arts & Visual Culture
6. Music & Performing Arts
7. Religion, Mythology & Philosophy
8. Language & Wordplay
9. Sports, Games & Leisure
10. Pop Culture, Media & Modern Life

## 1. Literature & Books

Source ideas: Wikidata, Open Library, Project Gutenberg, Nobel Prize data, public-domain texts, author/work bibliographies.

Subcategories:

1. Authors & Works
2. 19th-Century Novels
3. Shakespeare & Drama
4. Poetry
5. Children's & Young Adult Literature
6. American Literature
7. British & Irish Literature
8. World Literature
9. Literary Characters
10. Awards, Movements & Terms

Question ideas:

- Author from work.
- Work from character.
- Movement from description.
- Prize winner from book or country.
- Opening line or plot summary, written originally and briefly.

## 2. History

Source ideas: Wikidata, Library of Congress, National Archives, Britannica-style references, public-domain history timelines.

Subcategories:

1. U.S. Presidents & Elections
2. U.S. History
3. Ancient History
4. Medieval & Renaissance History
5. European History
6. World Wars
7. Revolutions & Independence Movements
8. Empires & Dynasties
9. Historical Figures
10. Dates, Documents & Treaties

Question ideas:

- Leader from event.
- Treaty from war.
- Dynasty from ruler.
- Date from event, sparingly.
- Document from phrase or consequence.

## 3. Geography

Source ideas: Wikidata, GeoNames, Natural Earth, CIA World Factbook, OpenStreetMap, UNESCO data.

Subcategories:

1. World Capitals
2. Countries & Borders
3. U.S. States & Cities
4. Rivers, Lakes & Seas
5. Mountains & Deserts
6. Islands & Archipelagos
7. World Regions
8. Landmarks & UNESCO Sites
9. Demonyms & Languages
10. Maps, Coordinates & Extremes

Question ideas:

- Capital from country.
- Country from neighbors.
- River from cities it passes through.
- Island group from member island.
- Landmark from location and description.

## 4. Science

Source ideas: Wikidata, NASA, NIH/MedlinePlus, periodic table data, Nobel Prize data, public science datasets.

Subcategories:

1. Biology
2. Chemistry
3. Physics
4. Astronomy & Space
5. Earth Science
6. Medicine & Anatomy
7. Animals & Plants
8. Inventions & Discoveries
9. Scientists
10. Units, Laws & Constants

Question ideas:

- Scientist from discovery.
- Element from atomic number or symbol.
- Planet/moon from feature.
- Body system from function.
- Law from equation or description.

## 5. Arts & Visual Culture

Source ideas: Wikidata, museum open collections, Smithsonian, Metropolitan Museum of Art API, Getty vocabularies, public-domain art sources.

Subcategories:

1. Painters & Sculptors
2. Famous Artworks
3. Art Movements
4. Architecture
5. Museums & Collections
6. Photography
7. Design & Decorative Arts
8. Public Art & Monuments
9. Art Terms & Techniques
10. Patrons, Critics & Schools

Question ideas:

- Artist from work.
- Movement from style.
- Building from architect.
- Museum from city or collection.
- Technique from definition.

## 6. Music & Performing Arts

Source ideas: MusicBrainz, Wikidata, public-domain music references, Tony/Oscar/Grammy data where licensing allows facts, opera databases.

Subcategories:

1. Classical Composers
2. Opera
3. Broadway & Musicals
4. Popular Music
5. Jazz & Blues
6. Instruments
7. Music Theory & Terms
8. Dance
9. Theater
10. Film Scores & Soundtracks

Question ideas:

- Composer from work.
- Musical from song.
- Instrument family from description.
- Jazz figure from instrument.
- Opera from aria or plot summary written originally.

## 7. Religion, Mythology & Philosophy

Source ideas: Wikidata, public-domain translations, encyclopedia references, Stanford Encyclopedia of Philosophy for planning/reference only, mythological indexes.

Subcategories:

1. Greek Mythology
2. Roman & Norse Mythology
3. World Mythology
4. Bible
5. World Religions
6. Religious Texts & Terms
7. Philosophers
8. Philosophical Schools
9. Ethics & Political Thought
10. Symbols, Rituals & Holidays

Question ideas:

- Deity from domain.
- Philosopher from work.
- Religious text from tradition.
- Holiday from practice.
- Mythological figure from story.

## 8. Language & Wordplay

Source ideas: Wiktionary, public-domain dictionaries, etymology references, word lists, internally-authored wordplay.

Subcategories:

1. Etymology
2. Definitions
3. Homophones & Soundalikes
4. Anagrams
5. Before & After
6. Initials & Abbreviations
7. Foreign Words & Phrases
8. Grammar & Usage
9. Rhymes & Word Ladders
10. Puns, Quotes & Idioms

Question ideas:

- Word from roots.
- Phrase from definition.
- Homophone pair.
- Anagram solution.
- "Before & After" connector clue.

Note: this category specializes in wordplay, but wordplay mechanics should also appear across other categories. This category needs the most custom authoring because many existing wordplay clues are highly original/copyright-sensitive.

## 9. Sports, Games & Leisure

Source ideas: Wikidata, official league historical facts where terms allow factual reference, Olympedia-style references, Chess databases for facts, board game publishers for factual metadata.

Subcategories:

1. Baseball
2. Football
3. Basketball
4. Soccer
5. Tennis & Golf
6. Olympics
7. Sports Records & Awards
8. Rules & Terminology
9. Board Games & Card Games
10. Video Games & Esports

Question ideas:

- Athlete from record.
- Team from city/championship.
- Sport from term.
- Olympic host city from year.
- Game from mechanic or designer.

## 10. Pop Culture, Media & Modern Life

Source ideas: Wikidata, TMDb/IMDb-style metadata with terms review, official award sites, public facts, Open Library for books, MusicBrainz for albums.

Subcategories:

1. Film
2. Television
3. Streaming & Internet Culture
4. Comics & Graphic Novels
5. Celebrities & Public Figures
6. Brands & Advertising
7. Food & Drink
8. Fashion & Lifestyle
9. Technology & Companies
10. Recent Events & Current Affairs

Question ideas:

- Film from director/cast/plot.
- TV show from character.
- Company from founder/product.
- Food from origin or ingredient.
- Brand from slogan, carefully sourced.

## Cross-Cutting Tags

These tags should supplement the category tree:

- `women`
- `black-history`
- `latin-america`
- `asia`
- `africa`
- `middle-east`
- `indigenous-history`
- `nobel`
- `oscars`
- `pulitzer`
- `before-1900`
- `1900s`
- `2000s`
- `current`
- `wordplay`
- `starts-with`
- `ends-with`
- `contains`
- `crossword`
- `before-after`
- `rhyme-time`
- `anagram`
- `same-name`
- `hidden-word`
- `visual`
- `audio`
- `daily-double-style`
- `final-style`

## Generation Strategy

### Phase 1: Seed Pack

Write 20 original questions per primary category, distributed across subcategories.

Total: 200 questions.

Goal: prove the app loop and stats.

### Phase 2: Balanced Starter Bank

Write/generate 25 questions per subcategory.

Total: 2,500 questions.

Goal: enough volume for spaced repetition and social challenges.

### Phase 3: Competitive Bank

Write/generate 100 questions per subcategory.

Total: 10,000 questions.

Goal: serious training coverage.

## Quality Review Checklist

For each generated or written question:

- Is the answer unambiguous?
- Is the clue wording original?
- Is the difficulty reasonable?
- Is the source fact reliable?
- Does the question train a useful association?
- Does it avoid overfitting to one wording?
- Does it have useful tags?
- Would a close answer be acceptable?
- If it has a wordplay mechanic, does the answer actually satisfy the constraint?
- If it is `before_after`, is the overlap clean and pronounceable?

## Recommended First 200-Question Mix

- Literature & Books: 20
- History: 20
- Geography: 25
- Science: 20
- Arts & Visual Culture: 15
- Music & Performing Arts: 15
- Religion, Mythology & Philosophy: 20
- Language & Wordplay: 25
- Sports, Games & Leisure: 15
- Pop Culture, Media & Modern Life: 25

This slightly overweights geography, wordplay, and pop culture because they produce fast practice reps and expose answer-entry/self-grading issues quickly.
