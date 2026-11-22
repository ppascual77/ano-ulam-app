-- Admin: posts an admin removed (IMP-2, 2026-11-21 test run). A post removed
-- from its ⋯ menu had no reports, so it never showed in Reported Posts and
-- couldn't be restored. Reported Posts now lists these too, last 30 days,
-- newest removal first; Restore is dismiss_post_reports (it un-hides a post
-- whatever hid it, and the poster gets the "Your post is back" push).
create function public.get_removed_posts()
returns table (
  id           uuid,
  user_id      uuid,
  display_name varchar,
  avatar_url   text,
  caption      text,
  image_url    text,
  link_url     text,
  gif_url      text,
  sticker_url  text,
  created_at   timestamptz,
  hidden_at    timestamptz
)
language sql stable security definer set search_path = public as $$
  select
    p.id, p.user_id, u.display_name, u.avatar_url,
    p.caption, p.image_url, p.link_url, p.gif_url, p.sticker_url, p.created_at, p.hidden_at
  from public.food_posts p
  join public.users u on u.id = p.user_id
  where public.is_admin()
    and p.hidden_reason = 'admin'
    and p.hidden_at > now() - interval '30 days'
  order by p.hidden_at desc;
$$;
revoke execute on function public.get_removed_posts() from public, anon;
grant execute on function public.get_removed_posts() to authenticated;
