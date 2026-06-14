update questions
set
  value = 800,
  difficulty_rank = 4,
  aliases = array(
    select distinct alias
    from unnest(aliases || array['Trap Card', 'Counter Trap Card']) as alias
  ),
  quality_status = 'keep',
  quality_issues = array(
    select distinct issue
    from unnest(quality_issues || array['user-feedback: accepted broader answer; raised difficulty']) as issue
  )
where external_id = 'opentdb-886152573e63b994'
   or clue = '"Magic Drain" is this type in Yugioh! Trading Card Game.';

update questions
set
  value = 400,
  difficulty_rank = 2,
  quality_issues = array(
    select distinct issue
    from unnest(quality_issues || array['user-feedback: album recall too hard for 200']) as issue
  )
where external_id = 'opentdb-1afe171fb5326f2d'
   or clue = 'The Red Hot Chili Pepper song "Give It Away" is from what album.';

update questions
set
  clue = 'In literature, this author wrote "Harry Potter."',
  quality_issues = array_remove(quality_issues, 'duplicate phrase')
where id = '855529df-26ee-47fd-8f87-263c0385671e'
   or clue = 'In literature, in literature, this author wrote "Harry Potter."';

update questions
set
  answer = 'Moho',
  aliases = array(
    select distinct alias
    from unnest(aliases || array['Mohorovicic discontinuity', 'Mohorovicic boundary']) as alias
  ),
  value = 800,
  difficulty_rank = 4,
  quality_issues = array(
    select distinct issue
    from unnest(quality_issues || array['user-feedback: harder than 600; prefer common answer form']) as issue
  )
where external_id = 'topoff-99b95b90385e8583'
   or answer = 'Mohorovicic discontinuity';
