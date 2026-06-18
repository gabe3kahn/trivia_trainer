-- 014_multiplayer.sql — Compete M1: friends graph + 1v1 async duels.
--
-- Additive only. games / game_attempts / friendships and their RLS already exist
-- (001_core_schema.sql); this adds scoring/winner columns, an invites table, the
-- profile columns the new FE needs, and the RPCs that drive the Compete tab.
--
-- Grading is client-side (honor system) for Phase 1 — get_game returns the full
-- clue payload incl. answer/aliases so the app can grade locally, same as
-- get_recommended_questions. Phase 2 will move grading into an Edge Function.

-- ---------------------------------------------------------------------------
-- 1. Schema additions
-- ---------------------------------------------------------------------------
alter table games
  add column if not exists winner_id      uuid references profiles(id),
  add column if not exists creator_score  int  not null default 0,
  add column if not exists opponent_score int  not null default 0;

alter table game_attempts
  add column if not exists time_ms int;  -- per-clue answer time, for tiebreaks

alter table profiles
  add column if not exists expo_push_token text,
  add column if not exists avatar_url      text,
  add column if not exists phone_hash      text;  -- contacts matching (fast-follow)

create index if not exists idx_profiles_phone_hash on profiles(phone_hash) where phone_hash is not null;
create index if not exists idx_games_creator  on games(creator_id);
create index if not exists idx_games_opponent on games(opponent_id);

-- Share-link invites (auto-friend on redeem).
create table if not exists invites (
  token       text primary key,
  inviter_id  uuid not null references profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  redeemed_by uuid references profiles(id),
  redeemed_at timestamptz
);
alter table invites enable row level security;
drop policy if exists "invites_inviter_read" on invites;
create policy "invites_inviter_read" on invites for select using (auth.uid() = inviter_id);
-- Inserts/redeems happen only through the SECURITY DEFINER RPCs below.

-- ---------------------------------------------------------------------------
-- 2. Friends RPCs
-- ---------------------------------------------------------------------------
create or replace function public.search_users(p_q text)
returns table (id uuid, username text, display_name text, avatar_url text, status text)
language sql stable security definer set search_path = public as $$
  select p.id, p.username, p.display_name, p.avatar_url,
         coalesce(f.status::text, 'none') as status
  from profiles p
  left join friendships f on
    (f.requester_id = auth.uid() and f.addressee_id = p.id) or
    (f.addressee_id = auth.uid() and f.requester_id = p.id)
  where p.id <> auth.uid()
    and p_q is not null and length(btrim(p_q)) >= 2
    and (p.username ilike '%' || p_q || '%' or p.display_name ilike '%' || p_q || '%')
  order by p.username
  limit 20;
$$;

-- Sends a request; if the other person already requested you, this accepts it.
create or replace function public.send_friend_request(p_addressee uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_existing friendships%rowtype; v_id uuid;
begin
  if p_addressee = auth.uid() then raise exception 'cannot friend yourself'; end if;

  select * into v_existing from friendships
    where requester_id = p_addressee and addressee_id = auth.uid();
  if found then
    update friendships set status = 'accepted', accepted_at = now() where id = v_existing.id;
    return v_existing.id;
  end if;

  insert into friendships (requester_id, addressee_id, status)
  values (auth.uid(), p_addressee, 'pending')
  on conflict (requester_id, addressee_id) do update set status = friendships.status
  returning id into v_id;
  return v_id;
end; $$;

create or replace function public.respond_friend_request(p_id uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  update friendships
     set status      = case when p_accept then 'accepted' else 'blocked' end,
         accepted_at = case when p_accept then now() else accepted_at end
   where id = p_id and addressee_id = auth.uid() and status = 'pending';
end; $$;

create or replace function public.list_friends()
returns table (id uuid, username text, display_name text, avatar_url text)
language sql stable security definer set search_path = public as $$
  select p.id, p.username, p.display_name, p.avatar_url
  from friendships f
  join profiles p on p.id = case when f.requester_id = auth.uid()
                                 then f.addressee_id else f.requester_id end
  where f.status = 'accepted' and auth.uid() in (f.requester_id, f.addressee_id)
  order by p.display_name;
$$;

create or replace function public.create_invite()
returns text language plpgsql security definer set search_path = public as $$
declare v_token text;
begin
  v_token := substr(md5(random()::text || clock_timestamp()::text || auth.uid()::text), 1, 12);
  insert into invites (token, inviter_id) values (v_token, auth.uid());
  return v_token;
end; $$;

create or replace function public.redeem_invite(p_token text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_inviter uuid;
begin
  select inviter_id into v_inviter from invites where token = p_token and redeemed_by is null;
  if not found then raise exception 'invalid or already-used invite'; end if;
  if v_inviter = auth.uid() then raise exception 'cannot redeem your own invite'; end if;

  update invites set redeemed_by = auth.uid(), redeemed_at = now() where token = p_token;

  insert into friendships (requester_id, addressee_id, status, accepted_at)
  values (v_inviter, auth.uid(), 'accepted', now())
  on conflict (requester_id, addressee_id) do update set status = 'accepted', accepted_at = now();
  return v_inviter;
end; $$;

-- ---------------------------------------------------------------------------
-- 3. Duel RPCs
-- ---------------------------------------------------------------------------
-- Freezes one shared question set onto the game; both players answer the same ids.
create or replace function public.create_game(
  p_opponent   uuid,
  p_count      int default 6,
  p_categories text[] default null,
  p_mechanics  text[] default null
)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_qids uuid[]; v_id uuid;
begin
  if not exists (
    select 1 from friendships where status = 'accepted'
      and ((requester_id = auth.uid() and addressee_id = p_opponent)
        or (requester_id = p_opponent and addressee_id = auth.uid()))
  ) then raise exception 'must be friends to start a duel'; end if;

  select array_agg(id) into v_qids from (
    select q.id from questions q
    where q.is_active
      and q.answer not in ('True', 'False')
      and not (q.tags @> array['boolean']::text[])
      and (p_categories is null or q.category_id = any(p_categories))
      and (p_mechanics  is null or q.mechanic   = any(p_mechanics))
    order by random()
    limit greatest(p_count, 1)
  ) s;

  if v_qids is null or array_length(v_qids, 1) < 1 then
    raise exception 'no questions match the chosen filters';
  end if;

  insert into games (creator_id, opponent_id, status, mode, question_ids, expires_at)
  values (auth.uid(), p_opponent, 'active', 'head_to_head', v_qids, now() + interval '3 days')
  returning id into v_id;
  return v_id;
end; $$;

-- Play payload: game meta + the shared clue set + your attempts + opponent progress.
create or replace function public.get_game(p_game uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare g games%rowtype; me uuid := auth.uid();
begin
  select * into g from games where id = p_game;
  if not found or me not in (g.creator_id, g.opponent_id) then
    raise exception 'game not found';
  end if;

  return jsonb_build_object(
    'id', g.id,
    'status', g.status,
    'creator_id', g.creator_id,
    'opponent_id', g.opponent_id,
    'winner_id', g.winner_id,
    'creator_score', g.creator_score,
    'opponent_score', g.opponent_score,
    'expires_at', g.expires_at,
    'set_size', coalesce(array_length(g.question_ids, 1), 0),
    'questions', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', q.id, 'category_id', q.category_id, 'category_name', c.name,
        'subcategory_name', s.name, 'difficulty_rank', q.difficulty_rank,
        'mechanic', q.mechanic, 'constraint_text', q.constraint_text,
        'clue', q.clue, 'answer', q.answer, 'aliases', q.aliases,
        'image_url', q.image_url, 'answer_detail', q.answer_detail
      ) order by array_position(g.question_ids, q.id)), '[]'::jsonb)
      from questions q
      join categories c on c.id = q.category_id
      left join subcategories s on s.id = q.subcategory_id
      where q.id = any(g.question_ids)
    ),
    'my_attempts', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'question_id', ga.question_id, 'grade', ga.grade, 'points', ga.points)), '[]'::jsonb)
      from game_attempts ga where ga.game_id = p_game and ga.user_id = me
    ),
    'opponent_answered', (
      select count(*) from game_attempts ga where ga.game_id = p_game and ga.user_id <> me
    )
  );
end; $$;

create or replace function public.submit_game_attempt(
  p_game uuid, p_question uuid, p_response text, p_grade attempt_grade, p_time_ms int default null
)
returns void language plpgsql security definer set search_path = public as $$
declare g games%rowtype; me uuid := auth.uid(); v_pts int; v_size int;
begin
  select * into g from games where id = p_game;
  if not found or me not in (g.creator_id, g.opponent_id) then raise exception 'not your game'; end if;
  if g.status <> 'active' then raise exception 'game is not active'; end if;
  if not (p_question = any(g.question_ids)) then raise exception 'question not in this game'; end if;

  select case when p_grade = 'correct' then q.value else 0 end into v_pts
  from questions q where q.id = p_question;

  insert into game_attempts (game_id, user_id, question_id, typed_response, grade, points, time_ms)
  values (p_game, me, p_question, p_response, p_grade, coalesce(v_pts, 0), p_time_ms)
  on conflict (game_id, user_id, question_id) do nothing;

  -- Finalize once both players have answered the whole set.
  v_size := coalesce(array_length(g.question_ids, 1), 0);
  if g.opponent_id is not null
     and (select count(*) from game_attempts where game_id = p_game and user_id = g.creator_id)  >= v_size
     and (select count(*) from game_attempts where game_id = p_game and user_id = g.opponent_id) >= v_size
  then
    perform public.finalize_game(p_game);
  end if;
end; $$;

-- Score = sum of points; winner by score, then more-correct, then faster total time; else draw.
create or replace function public.finalize_game(p_game uuid)
returns void language plpgsql security definer set search_path = public as $$
declare g games%rowtype;
        cs int; os int; cc int; oc int; ct bigint; ot bigint; v_winner uuid;
begin
  select * into g from games where id = p_game;
  if not found or g.status = 'completed' then return; end if;

  select coalesce(sum(points),0), count(*) filter (where grade='correct'), coalesce(sum(time_ms),0)
    into cs, cc, ct from game_attempts where game_id = p_game and user_id = g.creator_id;
  select coalesce(sum(points),0), count(*) filter (where grade='correct'), coalesce(sum(time_ms),0)
    into os, oc, ot from game_attempts where game_id = p_game and user_id = g.opponent_id;

  v_winner := case
    when cs > os then g.creator_id
    when os > cs then g.opponent_id
    when cc > oc then g.creator_id
    when oc > cc then g.opponent_id
    when ct < ot then g.creator_id
    when ot < ct then g.opponent_id
    else null end;  -- genuine draw

  update games set status = 'completed', completed_at = now(),
         creator_score = cs, opponent_score = os, winner_id = v_winner
  where id = p_game;
end; $$;

create or replace function public.list_games(p_status text default null)
returns table (
  id uuid, status game_status, mode text, set_size int,
  opponent_id uuid, opponent_name text, opponent_username text, opponent_avatar text,
  is_creator boolean, your_turn boolean, my_answered int, their_answered int,
  creator_score int, opponent_score int, winner_id uuid,
  created_at timestamptz, expires_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select g.id, g.status, g.mode, coalesce(array_length(g.question_ids,1),0) as set_size,
    case when g.creator_id = auth.uid() then g.opponent_id else g.creator_id end as opponent_id,
    p.display_name, p.username, p.avatar_url,
    (g.creator_id = auth.uid()) as is_creator,
    (g.status = 'active'
      and (select count(*) from game_attempts ga where ga.game_id = g.id and ga.user_id = auth.uid())
          < coalesce(array_length(g.question_ids,1),0)) as your_turn,
    (select count(*) from game_attempts ga where ga.game_id = g.id and ga.user_id =  auth.uid())::int as my_answered,
    (select count(*) from game_attempts ga where ga.game_id = g.id and ga.user_id <> auth.uid())::int as their_answered,
    g.creator_score, g.opponent_score, g.winner_id, g.created_at, g.expires_at
  from games g
  left join profiles p on p.id = case when g.creator_id = auth.uid() then g.opponent_id else g.creator_id end
  where auth.uid() in (g.creator_id, g.opponent_id)
    and (p_status is null or g.status::text = p_status)
  order by (g.status = 'active') desc, g.created_at desc
  limit 50;
$$;

-- Expiry sweep: a lone finisher wins by forfeit; if neither played, mark expired.
-- Call from pg_cron (schedule added with the daily-challenge job in M2).
create or replace function public.sweep_expired_games()
returns int language plpgsql security definer set search_path = public as $$
declare r record; n int := 0;
begin
  for r in select * from games where status = 'active' and expires_at < now() loop
    if not exists (select 1 from game_attempts where game_id = r.id) then
      update games set status = 'expired', completed_at = now() where id = r.id;
    else
      perform public.finalize_game(r.id);
    end if;
    n := n + 1;
  end loop;
  return n;
end; $$;

-- ---------------------------------------------------------------------------
-- 4. Grants (PostgREST RPC exposure)
-- ---------------------------------------------------------------------------
grant execute on function
  public.search_users(text),
  public.send_friend_request(uuid),
  public.respond_friend_request(uuid, boolean),
  public.list_friends(),
  public.create_invite(),
  public.redeem_invite(text),
  public.create_game(uuid, int, text[], text[]),
  public.get_game(uuid),
  public.submit_game_attempt(uuid, uuid, text, attempt_grade, int),
  public.finalize_game(uuid),
  public.list_games(text)
to authenticated;
-- sweep_expired_games is intentionally NOT granted to authenticated (cron/service only).
