-- 018: fix friend requests
--
-- Two bugs surfaced the first time Compete → Friends was exercised end to end:
--
--   1. ACCEPTING a request failed with Postgres 42804
--      ("column \"status\" is of type friendship_status but expression is of type text").
--      respond_friend_request assigned a CASE expression to friendships.status. A bare
--      'accepted' string literal has type `unknown` and coerces to the enum, but a
--      `CASE WHEN ... THEN 'accepted' ELSE 'blocked' END` resolves to `text`, and text→enum
--      is not an implicit assignment cast — so it has to be cast explicitly.
--
--   2. Incoming requests rendered as "Someone": the client read the requester's row from
--      `profiles` directly, but RLS hides other users' profiles until you're friends, so the
--      lookup came back empty and fell through to the "Someone" fallback. The other friend
--      ops dodge this by being SECURITY DEFINER RPCs; this read didn't. Add a matching reader
--      (mirrors search_users / list_friends) that returns the requester's identity.

create or replace function public.respond_friend_request(p_id uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  update friendships
     set status      = (case when p_accept then 'accepted' else 'blocked' end)::friendship_status,
         accepted_at = case when p_accept then now() else accepted_at end
   where id = p_id and addressee_id = auth.uid() and status = 'pending';
end; $$;

create or replace function public.list_friend_requests()
returns table (id uuid, requester_id uuid, username text, display_name text, avatar_url text)
language sql stable security definer set search_path = public as $$
  select f.id, f.requester_id, p.username, p.display_name, p.avatar_url
  from friendships f
  join profiles p on p.id = f.requester_id
  where f.addressee_id = auth.uid() and f.status = 'pending'
  order by f.created_at desc;
$$;

grant execute on function
  public.respond_friend_request(uuid, boolean),
  public.list_friend_requests()
to authenticated;
