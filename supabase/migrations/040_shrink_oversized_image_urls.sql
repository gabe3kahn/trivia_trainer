-- 040: shrink oversized clue images.
--
-- 19 active image clues stored a 3840px Wikimedia thumbnail (~2 MB each). On a timed
-- daily/duel that's too slow to fetch+decode on mobile — the picture can miss the whole
-- countdown, leaving a blank box on an image-only clue like "Name the artist." Every one
-- of these files was validated to return 200 at 1280px (~230–600 KB), so swap the width
-- token. (The client also now holds the timer until the image loads — see ChallengePlayer
-- — and the visual-arts sourcing pipeline caps width going forward.)
--
-- Literal token swap (all oversized rows are exactly /3840px-), so this is exact and
-- idempotent: a second run finds no /3840px- rows and is a no-op.

update questions
set image_url = replace(image_url, '/3840px-', '/1280px-')
where image_url like '%/3840px-%';
