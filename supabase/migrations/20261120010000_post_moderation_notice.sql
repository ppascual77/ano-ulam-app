-- Tell posters what moderation did to their Food Post (audit F6). Until
-- now nobody was told: a post hidden by 3 reports, removed by an admin, or
-- restored just changed silently, and the poster's own label always said
-- "Removed by AnoUlam", even while it was only waiting for review.
--
-- - get_food_posts also returns hidden_reason ('reports' or 'admin', only
--   for the poster's own hidden posts), so the app can label each case.
-- - A push to the poster (if Push notifications is on) when their post is
--   hidden for review, removed by an admin, or restored. Tapping it opens
--   Profile → Created, where the post shows with its label.

-- ---- get_food_posts + hidden_reason ---------------------------------------------
-- Same as 20261108030000_community_moderation.sql plus the last column.
drop function public.get_food_posts(uuid, integer, integer);
create function public.get_food_posts(p_user_id uuid default null, p_offset integer default 0, p_limit integer default 5)
returns table (
  id uuid, user_id uuid, display_name character varying, avatar_url text,
  caption text, image_url text, link_url text, link_title text, link_description text, link_image text,
  gif_url text, sticker_url text, created_at timestamptz, updated_at timestamptz,
  like_count integer, liked boolean, hidden boolean, hidden_reason text
)
language sql stable security definer set search_path = public as $$
  select
    p.id, p.user_id, u.display_name, u.avatar_url,
    p.caption, p.image_url, p.link_url, p.link_title, p.link_description, p.link_image,
    p.gif_url, p.sticker_url, p.created_at, p.updated_at,
    (select count(*)::integer from public.food_post_likes l where l.post_id = p.id),
    exists (select 1 from public.food_post_likes l where l.post_id = p.id and l.user_id = auth.uid()),
    p.hidden_at is not null,
    case when p.hidden_at is not null then p.hidden_reason end
  from public.food_posts p
  join public.users u on u.id = p.user_id
  where auth.uid() is not null
    and (p_user_id is null or p.user_id = p_user_id)
    and (p.hidden_at is null or p.user_id = auth.uid())
    and not exists (select 1 from public.post_reports r where r.post_id = p.id and r.reporter_id = auth.uid())
    and not exists (select 1 from public.user_blocks b where b.blocker_id = auth.uid() and b.blocked_id = p.user_id)
  order by p.created_at desc, p.id desc
  offset greatest(p_offset, 0)
  limit least(greatest(p_limit, 0), 50);
$$;
revoke execute on function public.get_food_posts(uuid, integer, integer) from public, anon;
grant execute on function public.get_food_posts(uuid, integer, integer) to authenticated;

-- ---- the push ----------------------------------------------------------------------
create or replace function public.notify_post_moderation() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_title text;
  v_body text;
  v_kind text;
  v_messages jsonb;
begin
  if old.hidden_at is null and new.hidden_at is not null and new.hidden_reason = 'reports' then
    v_kind := 'hidden';
    v_title := 'Your post is hidden for review';
    v_body := 'A few people reported it. We''ll take a look soon; you can still see it on your profile.';
  elsif new.hidden_at is not null and new.hidden_reason = 'admin' and old.hidden_reason is distinct from 'admin' then
    v_kind := 'removed';
    v_title := 'Your post was removed';
    v_body := 'It didn''t follow our community guidelines. Only you can see it now.';
  elsif old.hidden_at is not null and new.hidden_at is null then
    v_kind := 'restored';
    v_title := 'Your post is back';
    v_body := 'We reviewed it, and everyone can see it again.';
  else
    return new;
  end if;

  select jsonb_agg(jsonb_build_object(
      'to', t.token,
      'title', v_title,
      'body', v_body,
      'sound', 'default',
      'data', jsonb_build_object('type', 'post_moderation', 'postId', new.id, 'action', v_kind)
    ))
    into v_messages
    from public.push_tokens t
    join public.users u on u.id = t.user_id
    where t.user_id = new.user_id and u.push_enabled;

  perform public.send_expo_push(v_messages);
  return new;
end $$;
revoke execute on function public.notify_post_moderation() from public, anon, authenticated;

create trigger food_posts_notify_moderation
  after update of hidden_at, hidden_reason on public.food_posts
  for each row execute function public.notify_post_moderation();
