-- Which Pro rewards the caller has already claimed as a person, including
-- under an earlier account they deleted (reward_claims, 20261122000000). The
-- app reads it next to its own pro_rewards rows, so the + menu, Settings and
-- the composer stop offering a reward the database will refuse.
--
-- Returns kinds only, never hashes, and only for the caller's own identities.

create function public.my_reward_claims() returns setof text
language sql stable security definer set search_path = public as $$
  select distinct c.kind
  from public.reward_claims c
  where c.identity_hash in (
    select encode(sha256(convert_to(i.provider || ':' || i.provider_id, 'UTF8')), 'hex')
    from auth.identities i
    where i.user_id = auth.uid()
  )
$$;

revoke execute on function public.my_reward_claims() from public, anon;
grant execute on function public.my_reward_claims() to authenticated;
