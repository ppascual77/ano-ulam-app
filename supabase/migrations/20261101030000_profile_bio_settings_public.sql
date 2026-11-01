-- Profile: the bio and the two account settings move from the app's mock to
-- the user's row, and other users' profiles become readable through two
-- narrow functions instead of opening up `users` or `saved_meals` RLS.

-- Shown under the name on the profile. 50 characters, same as the app.
alter table public.users add column bio text check (char_length(bio) <= 50);
-- "Show saved meals publicly": off until the user turns it on.
alter table public.users add column show_saved_public boolean not null default false;
-- "Email newsletter": saved only, nothing sends emails yet. Off until the
-- user opts in.
alter table public.users add column newsletter_subscribed boolean not null default false;

-- Someone else's public profile: only what the profile page shows, never
-- email, tier or preferences. Signed-in users only (guests get the app's
-- sign-in gate).
create function public.get_public_profile(p_user_id uuid)
returns table (
  id uuid,
  display_name varchar,
  avatar_url text,
  bio text,
  show_saved_public boolean
)
language sql stable security definer set search_path = public as $$
  select u.id, u.display_name, u.avatar_url, u.bio, u.show_saved_public
  from public.users u
  where u.id = p_user_id;
$$;

-- Someone's saved meals, only when they made them public; otherwise none.
-- Most recent first, like their own Saved tab.
create function public.get_public_saved_meals(p_user_id uuid)
returns setof public.saved_meals
language sql stable security definer set search_path = public as $$
  select s.*
  from public.saved_meals s
  join public.users u on u.id = s.user_id
  where s.user_id = p_user_id and u.show_saved_public
  order by s.saved_at desc;
$$;

revoke execute on function public.get_public_profile(uuid) from public, anon;
revoke execute on function public.get_public_saved_meals(uuid) from public, anon;
grant execute on function public.get_public_profile(uuid) to authenticated;
grant execute on function public.get_public_saved_meals(uuid) to authenticated;
