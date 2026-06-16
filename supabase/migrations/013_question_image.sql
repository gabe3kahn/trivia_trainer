-- 013: visual clues — attach an image to a question and surface it to the app.
-- Enables "name this painting / landmark / flag"-style clues where the image is
-- the prompt. Apply in the Supabase SQL editor (or CLI) before importing any
-- question that carries an image_url.

alter table questions
  add column if not exists image_url text,
  add column if not exists image_attribution text,
  add column if not exists image_license text,
  -- Optional richer reveal shown on submission (e.g. "Mona Lisa — Leonardo da
  -- Vinci") regardless of which part the clue asked for. Falls back to `answer`.
  add column if not exists answer_detail text;

-- Recreate the recommender so the app receives image_url + image_attribution.
-- (Body is identical to migration 007 plus the two new SELECT columns.)
-- Must DROP first: CREATE OR REPLACE cannot change a function's return-type
-- shape, and we're adding columns to the RETURNS TABLE.
drop function if exists public.get_recommended_questions(text, int, text[], int[], text[]);

create or replace function public.get_recommended_questions(
  p_mode text default 'weakness',
  p_limit int default 12,
  p_categories text[] default null,
  p_values int[] default null,
  p_mechanics text[] default null
)
returns table (
  id uuid,
  category_id text,
  category_name text,
  subcategory_id uuid,
  subcategory_name text,
  value int,
  difficulty_rank int,
  mechanic text,
  constraint_text text,
  clue text,
  answer text,
  aliases text[],
  tags text[],
  image_url text,
  image_attribution text,
  answer_detail text
)
language sql
stable
as $$
  with weak_categories as (
    select dimension_key
    from category_competencies
    where user_id = auth.uid()
      and dimension_type = 'category'
    order by score asc, due_review_count desc
    limit 3
  ),
  review_questions as (
    select r.question_id
    from review_items r
    where r.user_id = auth.uid()
      and r.state in ('learning', 'due')
      and r.due_at <= now()
    order by r.due_at asc
    limit greatest(p_limit, 1)
  )
  select
    q.id,
    q.category_id,
    c.name as category_name,
    q.subcategory_id,
    s.name as subcategory_name,
    q.value,
    q.difficulty_rank,
    q.mechanic,
    q.constraint_text,
    q.clue,
    q.answer,
    q.aliases,
    q.tags,
    q.image_url,
    q.image_attribution,
    q.answer_detail
  from questions q
  join categories c on c.id = q.category_id
  left join subcategories s on s.id = q.subcategory_id
  where q.is_active
    and q.quality_status in ('keep', 'rewrite', 'unreviewed')
    and q.answer not in ('True', 'False')
    and not (q.tags @> array['boolean']::text[])
    and q.clue !~* 'which (of the following|one of these|of these)'
    and (
      p_mode <> 'review'
      or q.id in (select question_id from review_questions)
    )
    and (
      p_mode <> 'weakness'
      or not exists (select 1 from weak_categories)
      or q.category_id in (select dimension_key from weak_categories)
    )
    and (p_categories is null or q.category_id = any(p_categories))
    and (p_values is null or q.value = any(p_values))
    and (p_mechanics is null or q.mechanic = any(p_mechanics))
  order by
    case q.quality_status when 'keep' then 0 when 'rewrite' then 1 else 2 end,
    random()
  limit greatest(p_limit, 1);
$$;

grant execute on function public.get_recommended_questions(text, int, text[], int[], text[]) to authenticated;
