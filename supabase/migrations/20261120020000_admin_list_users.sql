-- Admin → Manage Users (audit F10): the user list, read-only, matching the
-- web admin's Manage Users page (ano-ulam frontend/src/admin/pages/users):
-- name, email, plan, role, last sign-in, joined, newsletter; search by email
-- or name; a Free / Pro filter; 50 at a time with the total.
--
-- users is owner-only (RLS) and last sign-in and the admin role live in
-- auth.users, so the list comes through this function, which refuses
-- anyone but an admin (app_metadata role, public.is_admin()).
--
-- plan: 'subscriber' (users.pro_until running), 'earned' (only reward days
-- running) or 'free'. p_plan 'pro' means either of the first two.

create or replace function public.admin_list_users(
  p_query text default null,
  p_plan text default null,
  p_offset integer default 0,
  p_limit integer default 50
)
returns table (
  id uuid,
  display_name character varying,
  email text,
  avatar_url text,
  role text,
  plan text,
  pro_until timestamptz,
  pro_reward_until timestamptz,
  newsletter_subscribed boolean,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  total_count bigint
)
language plpgsql stable security definer set search_path = public as $$
declare
  v_query text := nullif(trim(coalesce(p_query, '')), '');
begin
  if not public.is_admin() then
    raise exception 'admins only' using errcode = '42501';
  end if;
  if p_plan is not null and p_plan not in ('free', 'pro') then
    raise exception 'unknown plan %', p_plan using errcode = '22023';
  end if;

  return query
  with listed as (
    select
      u.id,
      u.display_name,
      u.email::text as email,
      u.avatar_url,
      coalesce(a.raw_app_meta_data ->> 'role', 'user') as role,
      case
        when u.pro_until > now() then 'subscriber'
        when u.pro_reward_until > now() then 'earned'
        else 'free'
      end as plan,
      u.pro_until,
      u.pro_reward_until,
      coalesce(u.newsletter_subscribed, false) as newsletter_subscribed,
      u.created_at,
      a.last_sign_in_at
    from public.users u
    join auth.users a on a.id = u.id
    where (v_query is null
           or u.email ilike '%' || v_query || '%'
           or u.display_name ilike '%' || v_query || '%')
  )
  select l.*, count(*) over () as total_count
  from listed l
  where p_plan is null
     or (p_plan = 'pro' and l.plan <> 'free')
     or (p_plan = 'free' and l.plan = 'free')
  order by l.created_at desc, l.id
  offset greatest(p_offset, 0)
  limit least(greatest(p_limit, 1), 100);
end $$;

revoke execute on function public.admin_list_users(text, text, integer, integer) from public, anon;
grant execute on function public.admin_list_users(text, text, integer, integer) to authenticated;
