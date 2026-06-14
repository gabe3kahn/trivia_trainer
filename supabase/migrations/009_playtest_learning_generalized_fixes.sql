update questions
set
  answer = 'Red Hot Chili Peppers',
  aliases = array(
    select distinct alias
    from unnest(aliases || array['Red Hot Chilli Peppers']) as alias
  ),
  value = 400,
  difficulty_rank = 2,
  quality_issues = array(
    select distinct issue
    from unnest(quality_issues || array[
      'playtest-learning: canonical-name-misspelling',
      'playtest-learning: low-value-long-specialist-answer'
    ]) as issue
  )
where external_id = 'opentdb-e4e8d7c0c26c902c'
   or answer = 'Red Hot Chilli Peppers';

update questions
set
  clue = 'The Red Hot Chili Peppers song "Give It Away" is from what album.',
  quality_issues = array(
    select distinct issue
    from unnest(quality_issues || array[
      'playtest-learning: canonical-name-singularized',
      'playtest-learning: low-value-long-specialist-answer'
    ]) as issue
  )
where external_id = 'opentdb-1afe171fb5326f2d'
   or clue = 'The Red Hot Chili Pepper song "Give It Away" is from what album.';

update questions
set
  clue = 'In geography, Australia has this many states.',
  quality_issues = array(
    select distinct issue
    from unnest(quality_issues || array['playtest-learning: duplicate-opening-phrase']) as issue
  )
where external_id = 'opentdb-93bce0a7586cffe8'
   or clue = 'In geography, In geography, Australia has this many states.';

update questions
set
  value = 400,
  difficulty_rank = 2,
  quality_issues = array(
    select distinct issue
    from unnest(quality_issues || array['playtest-learning: low-value-long-specialist-answer']) as issue
  )
where external_id = 'opentdb-fe86904c8c1186d2'
   or clue = 'Bon Iver released this symbol-heavy album in 2016.';
