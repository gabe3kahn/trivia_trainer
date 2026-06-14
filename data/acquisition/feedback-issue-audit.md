# Feedback Issue Audit

Generated: 2026-06-01T17:21:46.405Z

This audit uses `tools/acquisition/feedback-quality-rules.mjs`, the same feedback-shaped checks used by intake. It looks for Moore-law-style ambiguity around ellipses, units, and numerical answer forms; and Statue-of-Liberty-style leakage where a meaningful word from the answer appears in the clue.

## Summary

- Active questions checked: 1200
- Flagged suspects: 29
- High priority: 0
- Medium priority: 20
- Low priority: 9

## Issue Counts

| Issue | Count |
| --- | ---: |
| answer-content-word-in-clue | 17 |
| wordplay-answer-form-needs-extra-care | 9 |
| numeric-answer-with-weak-unit-signal | 3 |

## Highest Priority Suspects

| Severity | Issue | Category | Value | Clue | Answer |
| ---: | --- | --- | ---: | --- | --- |
| 6 | numeric-answer-with-weak-unit-signal | arts_visual_culture | 400 | Musicians commonly write cut time with this time signature. | 2/2 |
| 6 | numeric-answer-with-weak-unit-signal | music_performing_arts | 400 | Rock songs most often use this time signature. | 4/4 |
| 6 | numeric-answer-with-weak-unit-signal | science | 800 | Counting the top 1 as row zero, row 4 of Pascal's Triangle has these five numbers. | 1 4 6 4 1 |
| 5 | answer-content-word-in-clue | arts_visual_culture | 600 | This Maya Lin-designed Washington memorial lists the names of U.S. service members on polished black granite. | Vietnam Veterans Memorial |
| 5 | answer-content-word-in-clue | arts_visual_culture | 600 | Charles and Ray Eames created this molded-plywood-and-leather seat, a midcentury design icon. | Eames lounge chair |
| 5 | answer-content-word-in-clue | geography | 600 | This Texas city is known as the Rose Capital of the World. | Tyler, Texas |
| 5 | answer-content-word-in-clue | geography | 600 | This vast desert in Mongolia and China is known for harsh temperatures. | Gobi Desert |
| 5 | answer-content-word-in-clue | history | 800 | This 1890 massacre of Lakota people took place near a South Dakota creek. | Wounded Knee Massacre |
| 5 | answer-content-word-in-clue | history | 400 | This Chinese dynasty built early Great Wall sections and standardized writing. | Qin Dynasty |
| 5 | answer-content-word-in-clue | history | 600 | John Quincy Adams won the presidency after this disputed election was decided by the House. | Election of 1824 |
| 5 | answer-content-word-in-clue | literature_books | 400 | Stephen King's It takes place in this fictional Maine town. | Derry, Maine |
| 5 | answer-content-word-in-clue | literature_books | 400 | This Roald Dahl book sends a poor boy into Willy Wonka's factory. | Charlie and the Chocolate Factory |
| 5 | answer-content-word-in-clue | pop_culture_media_modern_life | 400 | This global health agency uses the abbreviation WHO. | World Health Organization |
| 5 | answer-content-word-in-clue | pop_culture_media_modern_life | 400 | This space telescope released its first full-color images in 2022. | James Webb Space Telescope |
| 5 | answer-content-word-in-clue | pop_culture_media_modern_life | 400 | In Japanese pop culture, a dakimakura is this type of pillow. | A body pillow |
| 5 | answer-content-word-in-clue | pop_culture_media_modern_life | 600 | The display abbreviation LCD expands to these three words. | Liquid Crystal Display |
| 5 | answer-content-word-in-clue | science | 400 | This 1990 space telescope has produced famous deep-field images. | Hubble Space Telescope |
| 5 | answer-content-word-in-clue | science | 600 | This distant cloud of icy bodies is thought to surround the Solar System far beyond Pluto. | Oort Cloud |
| 5 | answer-content-word-in-clue | science | 600 | The world's longest venomous snake is this species of cobra. | King Cobra |
| 5 | answer-content-word-in-clue | sports_games_leisure | 400 | This college football trophy goes annually to the most outstanding player. | Heisman Trophy |
| 3 | wordplay-answer-form-needs-extra-care | language_wordplay | 400 | Italian roots meaning bad star gave English this word for a catastrophe. | Disaster |
| 3 | wordplay-answer-form-needs-extra-care | language_wordplay | 400 | Latin salarium, linked with salt money, gives English this word for regular pay. | Salary |
| 3 | wordplay-answer-form-needs-extra-care | language_wordplay | 600 | Ariadne's thread gave English this word meaning a hint. | Clue |
| 3 | wordplay-answer-form-needs-extra-care | language_wordplay | 600 | Named for a Titan forced to hold the sky, this word means a book of maps. | Atlas |
| 3 | wordplay-answer-form-needs-extra-care | language_wordplay | 400 | Latin scrupulus, a small sharp stone, gave English this word for a tiny amount. | Scruple |
| 3 | wordplay-answer-form-needs-extra-care | language_wordplay | 400 | This word means deliberately ambiguous or evasive, especially in language. | Equivocal |
| 3 | wordplay-answer-form-needs-extra-care | language_wordplay | 400 | Greek skhole, meaning leisure, eventually gave English this word for an educational institution. | School |
| 3 | wordplay-answer-form-needs-extra-care | language_wordplay | 400 | This word for a fellow traveler or dining partner comes from Latin roots meaning with bread. | Companion |
| 3 | wordplay-answer-form-needs-extra-care | language_wordplay | 800 | This word for a farewell comes from a contraction of God be with ye. | Goodbye |

Full machine-readable results: `data/acquisition/feedback-issue-audit.json`
