-- 035: list_sent_friend_requests — the outgoing counterpart to list_friend_requests (020).
--
-- Compete showed incoming requests but had no way to see invites YOU sent that are still
-- pending. RLS hides the addressee's profile until you're friends, so (like the incoming
-- reader) this is a SECURITY DEFINER RPC that returns the addressee's identity.
create or replace function public.list_sent_friend_requests()
returns table (id uuid, addressee_id uuid, username text, display_name text, avatar_url text)
language sql stable security definer set search_path = public as $$
  select f.id, f.addressee_id, p.username, p.display_name, p.avatar_url
  from public.friendships f
  join public.profiles p on p.id = f.addressee_id
  where f.requester_id = auth.uid() and f.status = 'pending'
  order by f.created_at desc;
$$;

grant execute on function public.list_sent_friend_requests() to authenticated;
