-- 017-test-plan.sql — sanity/stress checks for the Daily Challenge backend (migration 017).
-- SCRATCH: run these by hand in the Supabase SQL editor AFTER applying 017. Not a
-- committed test; it's a checklist. Each section is independent — run top to bottom.
--
-- KEY GOTCHA: most of these RPCs are SECURITY DEFINER and key off auth.uid(), which
-- reads request.jwt.claims->>'sub'. In the raw SQL editor you're the service role and
-- auth.uid() is NULL, so the RPCs return nothing useful unless you impersonate a user.
-- Use the harness in §0 to impersonate. (set_config(..., true) = transaction-local, so
-- wrap an impersonated block in BEGIN; ... ROLLBACK; to leave no trace.)

-- ===========================================================================
-- §0. Impersonation harness — pick two real users to play with.
-- ===========================================================================
-- Grab two profile ids (and make sure they're friends for the leaderboard test).
select id, username, display_name from profiles order by created_at limit 5;
-- Set these for the rest of the file:
--   \set me   'PASTE-USER-A-UUID'
--   \set them 'PASTE-USER-B-UUID'
-- (psql \set won't work in the web editor — just paste the UUIDs inline below.)

-- Impersonate user A for one statement/transaction:
select set_config('request.jwt.claims',
  json_build_object('sub','PASTE-USER-A-UUID','role','authenticated')::text, true);
select auth.uid();  -- should now echo user A

-- ===========================================================================
-- §1. app_today() rolls over at PT midnight, not UTC.
-- ===========================================================================
select
  now()                                            as utc_now,
  (now() at time zone 'America/Los_Angeles')       as pt_now,
  public.app_today()                               as app_today,
  current_date                                     as server_date;
-- EXPECT: between 00:00–07:00 UTC, app_today() is one day BEHIND server_date/utc.
-- That's the whole point — verify app_today() = the PT calendar day.

-- ===========================================================================
-- §2. generate_daily_challenge — variety + difficulty ramp.
-- ===========================================================================
-- Use a throwaway future date so we don't pollute the live day, then clean up.
begin;
  select public.generate_daily_challenge(date '2099-01-01', 7);

  -- 2a. It produced a set.
  select challenge_date, array_length(question_ids,1) as n
  from daily_challenges where challenge_date = '2099-01-01';   -- EXPECT n = 7 (or = #categories if <7)

  -- 2b. VARIETY: how many distinct categories among the chosen 7?
  --     Primary path picks one-per-category, so distinct ≈ n (only the flat-random
  --     fallback would repeat a category).
  select count(*) total, count(distinct q.category_id) distinct_cats
  from daily_challenges dc
  join lateral unnest(dc.question_ids) qid on true
  join questions q on q.id = qid
  where dc.challenge_date = '2099-01-01';        -- EXPECT distinct_cats = total (no dup categories)

  -- 2c. RAMP: ids are stored array_agg(... order by difficulty_rank) → ranks should be
  --     non-decreasing in array order.
  select ord, q.difficulty_rank, q.category_id, left(q.clue,40) as clue
  from daily_challenges dc
  join lateral unnest(dc.question_ids) with ordinality as u(qid, ord) on true
  join questions q on q.id = u.qid
  where dc.challenge_date = '2099-01-01'
  order by ord;                                  -- EXPECT difficulty_rank ascending (ties ok)

  -- 2d. No True/False or boolean-tagged clue leaked in.
  select count(*) as bad_rows
  from daily_challenges dc
  join lateral unnest(dc.question_ids) qid on true
  join questions q on q.id = qid
  where dc.challenge_date = '2099-01-01'
    and (q.answer in ('True','False') or q.tags @> array['boolean']::text[] or not q.is_active);
                                                 -- EXPECT bad_rows = 0
rollback;  -- discard the throwaway challenge

-- ===========================================================================
-- §3. No-repeat window — a question used in the last 30 days is excluded.
-- ===========================================================================
begin;
  -- Seed a "yesterday" challenge with a known question, then generate "today" and
  -- confirm that question is NOT reused.
  with pick as (
    select id from questions
    where is_active and answer not in ('True','False') and not (tags @> array['boolean']::text[])
    order by random() limit 1
  )
  insert into daily_challenges (challenge_date, question_ids)
  select date '2099-02-02', array[id] from pick;

  select public.generate_daily_challenge(date '2099-02-03', 7);

  -- The seeded id should appear in 02-02 but NOT in 02-03.
  select
    (select question_ids from daily_challenges where challenge_date='2099-02-02') as seeded,
    exists (
      select 1 from daily_challenges d2
      join lateral unnest(d2.question_ids) qid on true
      where d2.challenge_date='2099-02-03'
        and qid = (select question_ids[1] from daily_challenges where challenge_date='2099-02-02')
    ) as reused_within_30d;                      -- EXPECT reused_within_30d = false
rollback;

-- ===========================================================================
-- §4. Idempotency — running generate twice never changes the set.
-- ===========================================================================
begin;
  select public.generate_daily_challenge(date '2099-03-03', 7);
  select md5(question_ids::text) as h1 from daily_challenges where challenge_date='2099-03-03' \gset
  select public.generate_daily_challenge(date '2099-03-03', 7);  -- early-return, no-op
  select md5(question_ids::text) as h2 from daily_challenges where challenge_date='2099-03-03';
  -- EXPECT h1 = h2 (compare visually; \gset is psql-only, in web editor just eyeball both).
rollback;

-- ===========================================================================
-- §5. get_daily_challenge payload shape (impersonated) + lazy generation.
-- ===========================================================================
begin;
  select set_config('request.jwt.claims',
    json_build_object('sub','PASTE-USER-A-UUID','role','authenticated')::text, true);

  -- Lazy-gen: today's set may not exist yet; calling get_ should create it.
  select
    j->>'challenge_date'                          as challenge_date,
    j->>'set_size'                                as set_size,
    j->>'seconds_per_question'                    as spq,          -- EXPECT "30"
    jsonb_array_length(j->'questions')            as q_count,      -- EXPECT = set_size
    jsonb_array_length(j->'my_attempts')          as my_attempts,  -- EXPECT 0 first run
    j->>'completed'                               as completed     -- EXPECT false first run
  from (select public.get_daily_challenge() as j) s;

  -- Every question carries the full grading payload (answer + aliases present).
  select q->>'answer' as answer, q->'aliases' as aliases, q->>'difficulty_rank' as rank
  from (select public.get_daily_challenge() as j) s,
       lateral jsonb_array_elements(j->'questions') q;            -- EXPECT no null answers
rollback;

-- ===========================================================================
-- §6. submit_daily_attempt — points = value on correct, time clamped to 30s.
-- ===========================================================================
begin;
  select set_config('request.jwt.claims',
    json_build_object('sub','PASTE-USER-A-UUID','role','authenticated')::text, true);

  -- Make sure today's set exists, grab its first question + that question's value.
  perform public.get_daily_challenge();
  with t as (select challenge_date, question_ids[1] as q from daily_challenges where challenge_date = public.app_today())
  select public.submit_daily_attempt(t.challenge_date, t.q, 'whatever', 'correct'::attempt_grade, 999999) from t;

  -- Inspect what landed: points must equal that question's value; time_ms must be 30000 (clamped).
  select a.points, q.value as question_value, a.time_ms
  from daily_challenge_attempts a join questions q on q.id = a.question_id
  where a.user_id = auth.uid() and a.challenge_date = public.app_today();
  -- EXPECT points = question_value, time_ms = 30000 (not 999999).

  -- Re-submitting the same question is a no-op (unique + do nothing) — count stays 1.
  with t as (select challenge_date, question_ids[1] as q from daily_challenges where challenge_date = public.app_today())
  select public.submit_daily_attempt(t.challenge_date, t.q, 'again', 'missed'::attempt_grade, 100) from t;
  select count(*) as rows_for_q1 from daily_challenge_attempts
  where user_id = auth.uid() and challenge_date = public.app_today()
    and question_id = (select question_ids[1] from daily_challenges where challenge_date = public.app_today());
  -- EXPECT rows_for_q1 = 1 (first write wins; grade stays 'correct').

  -- Submitting a question NOT in today's set must raise.
  -- EXPECT: ERROR "question not in this day's challenge"
  select public.submit_daily_attempt(public.app_today(), gen_random_uuid(), 'x', 'correct'::attempt_grade, 1);
rollback;

-- ===========================================================================
-- §7. get_daily_leaderboard — you + accepted friends, correct ordering.
-- ===========================================================================
-- Requires A and B to be accepted friends. If not, make them (impersonate A):
--   select set_config('request.jwt.claims', json_build_object('sub','A','role','authenticated')::text, true);
--   select public.send_friend_request('B');
--   then impersonate B and accept, OR just insert an accepted friendships row directly.
begin;
  -- Seed deterministic scores for today: A gets 2 correct (fast), B gets 2 correct (slow) + same score.
  -- (Adjust to actually hit the tiebreak you want to verify.)
  select set_config('request.jwt.claims',
    json_build_object('sub','PASTE-USER-A-UUID','role','authenticated')::text, true);
  perform public.get_daily_challenge();
  -- ... submit a couple attempts as A (see §6 pattern) with small time_ms ...
  -- then impersonate B and submit the same with larger time_ms ...

  -- Read the board as A:
  select display_name, score, correct, total_time_ms, completed, is_me
  from public.get_daily_leaderboard();
  -- EXPECT: rows for A and B only (+ any other accepted friends who played);
  --         ordered by score desc, then correct desc, then total_time_ms ASC;
  --         is_me = true on exactly one row (A).
rollback;

-- ===========================================================================
-- §8. daily_streak — gaps-and-islands, ends today or yesterday.
-- ===========================================================================
begin;
  select set_config('request.jwt.claims',
    json_build_object('sub','PASTE-USER-A-UUID','role','authenticated')::text, true);

  -- Need a challenge row per date (FK), then an attempt per date. Seed 3 consecutive
  -- days ending today, plus an older island that should NOT count.
  insert into daily_challenges (challenge_date, question_ids)
  select d, (select array_agg(id) from (select id from questions where is_active limit 1) z)
  from unnest(array[public.app_today(), public.app_today()-1, public.app_today()-2,
                    public.app_today()-10]) d
  on conflict do nothing;

  insert into daily_challenge_attempts (challenge_date, user_id, question_id, grade, points, time_ms)
  select d, auth.uid(),
         (select question_ids[1] from daily_challenges where challenge_date = d),
         'correct'::attempt_grade, 0, 1000
  from unnest(array[public.app_today(), public.app_today()-1, public.app_today()-2,
                    public.app_today()-10]) d;

  select public.daily_streak();   -- EXPECT 3 (today, -1, -2). The -10 island is excluded.

  -- Now test the "ended yesterday still counts" gate: delete today's attempt → EXPECT 2.
  delete from daily_challenge_attempts where user_id = auth.uid() and challenge_date = public.app_today();
  select public.daily_streak();   -- EXPECT 2 (ends yesterday, within the >= app_today()-1 gate)
rollback;

-- ===========================================================================
-- §9. RLS — a player cannot read a friend's raw attempts directly.
-- ===========================================================================
begin;
  select set_config('request.jwt.claims',
    json_build_object('sub','PASTE-USER-A-UUID','role','authenticated')::text, true);
  -- Direct table read should only ever return A's own rows (dca_own_all policy).
  select count(*) as visible_rows, count(*) filter (where user_id <> auth.uid()) as others
  from daily_challenge_attempts;
  -- EXPECT others = 0. (Friends' rows only surface via get_daily_leaderboard, which is DEFINER.)
rollback;

-- ===========================================================================
-- §10. Cleanup (only if you ran anything OUTSIDE a rollback by mistake).
-- ===========================================================================
-- delete from daily_challenges where challenge_date >= date '2099-01-01';
-- (attempts cascade on challenge_date FK)
