-- 032: add a "Flags" subcategory to geography.
--
-- Mirrors how arts_visual_culture carries picture clues ("Famous Artworks") — the
-- subcategory is just a row; image-based clues attach via questions.image_url, which
-- already exists. This gives flag-identification clues (show a flag, name the country)
-- a home in geography. Slots in after the existing 10 geography subcategories.

insert into subcategories (category_id, name, sort_order) values
  ('geography', 'Flags', 11)
on conflict (category_id, name) do update set sort_order = excluded.sort_order;
