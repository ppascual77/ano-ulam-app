-- Pro rewards once per person, not once per account (BUG-2, 2026-11-21 test
-- run). pro_rewards rows go with the user (on delete cascade), so deleting the
-- account and signing in again with the same Apple or Google account made a
-- fresh user who could earn both rewards again.
--
-- reward_claims remembers which sign-in identities have claimed which reward,
-- with no link to users, so it outlives the account. An identity is stored only
-- as sha256(provider || ':' || provider_id) from auth.identities: Apple's and
-- Google's ids stay the same when the same account signs in again (Apple's
-- also behind Hide My Email), and the hash can't be turned back into the id.
-- Every identity linked to the user is recorded.
--
-- A claim is permanent, also when the reward is later revoked (the post or
-- recipe that earned it goes away): same as the per-account rule before.
-- No backfill: the app wasn't live when this was added.

create table public.reward_claims (
  identity_hash text not null,
  kind          text not null check (kind in ('recipe', 'photo_post')),
  claimed_at    timestamptz not null default now(),
  primary key (identity_hash, kind)
);

alter table public.reward_claims enable row level security;
-- No policies and no grants: only grant_pro_reward (security definer) reads
-- and writes it.
revoke all on public.reward_claims from public, anon, authenticated;

create or replace function public.grant_pro_reward(p_user uuid, p_kind text, p_source uuid, p_days integer)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_inserted int;
  v_hashes   text[];
begin
  select coalesce(array_agg(encode(sha256(convert_to(i.provider || ':' || i.provider_id, 'UTF8')), 'hex')), '{}')
    into v_hashes
    from auth.identities i
    where i.user_id = p_user;

  -- Already claimed by this person under an earlier (deleted) account.
  if exists (select 1 from public.reward_claims where kind = p_kind and identity_hash = any (v_hashes)) then
    return;
  end if;

  insert into public.pro_rewards (user_id, kind, source_id, days)
    values (p_user, p_kind, p_source, p_days)
    on conflict (kind, source_id) do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then
    return;
  end if;

  insert into public.reward_claims (identity_hash, kind)
    select h, p_kind from unnest(v_hashes) h
    on conflict do nothing;

  update public.users
    set pro_reward_until = greatest(now(), coalesce(pro_reward_until, now())) + make_interval(days => p_days)
    where id = p_user;
end $$;
-- Only the reward triggers call it.
revoke execute on function public.grant_pro_reward(uuid, text, uuid, integer) from public, anon, authenticated;
