-- Security audit fixes (2026-11-14). What a signed-in user could do by
-- calling the API directly instead of going through the app:
--
-- 1. Recipe photos: the poster could overwrite their recipe's cover photo
--    after approval (upload is an upsert and the path is in the public
--    image_url), putting an unreviewed image in the catalog. Uploading and
--    replacing now need the recipe to still be pending. Deleting stays
--    allowed (deleting your own recipe removes its photos).
-- 2. Recipe columns: meals has no column grants (admins write it through the
--    same `authenticated` role), so a poster could submit a recipe with a
--    made-up save_count (Community Favorites ranking), created_at,
--    source_type, rejection_reason, archived_at, or a cover photo hosted
--    anywhere. A trigger now pins those for non-admins. Price and macros are
--    recomputed by the admin's Approve (api/recipes.ts), not trusted.
-- 3. URLs other people's phones load or open: post photos, GIFs, stickers,
--    link previews and avatars were free text. A link could be tel:, sms:,
--    intent:// or another app's deep link; an image could be a tracking
--    pixel or something Klipy's filter never saw; image_url = 'x' earned the
--    photo-post Pro reward without a photo. Now: photos and uploaded avatars
--    only from the user's own folder in our bucket, GIFs and stickers only
--    from Klipy, links only http(s). (A Google profile photo set at sign-up
--    stays; users can only change it to their own upload.)
--    (Existing rows checked on 2026-11-14: all pass.)
-- 6. is_pro(uuid) let any signed-in user check anyone's Pro status. The app
--    never calls it; the functions that do are security definer and run as
--    their owner, so they keep working.

-- ---- 1. recipe photos: pending recipes only -------------------------------------
drop policy "Users upload own recipe photos" on storage.objects;
drop policy "Users replace own recipe photos" on storage.objects;

create policy "Users upload own pending recipe photos" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'meal-images'
    and exists (
      select 1 from public.meals m
      where m.id::text = (storage.foldername(objects.name))[1]
        and m.poster_id = auth.uid() and m.status = 'pending'
    )
  );

create policy "Users replace own pending recipe photos" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'meal-images'
    and exists (
      select 1 from public.meals m
      where m.id::text = (storage.foldername(objects.name))[1]
        and m.poster_id = auth.uid() and m.status = 'pending'
    )
  )
  with check (
    bucket_id = 'meal-images'
    and exists (
      select 1 from public.meals m
      where m.id::text = (storage.foldername(objects.name))[1]
        and m.poster_id = auth.uid() and m.status = 'pending'
    )
  );

-- ---- 2. recipe columns a poster can't set ---------------------------------------
-- Only for a direct API write by a non-admin (current_user = authenticated).
-- Security definer functions (sync_meal_save_count keeping save_count, the
-- service role, pg_cron) run as another role and pass straight through.
create function public.guard_user_meal_columns() returns trigger
language plpgsql set search_path = public as $$
begin
  if current_user <> 'authenticated' or public.is_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.save_count := 0;
    new.created_at := now();
    new.updated_at := now();
    new.source_type := 'estimated';
    new.archived_at := null;
    new.rejection_reason := null;
    new.reference_image_url := null;
    new.image_attribution := null;
  else
    new.save_count := old.save_count;
    new.created_at := old.created_at;
    new.source_type := old.source_type;
    new.archived_at := old.archived_at;
    new.rejection_reason := old.rejection_reason;
    new.reference_image_url := old.reference_image_url;
    new.image_attribution := old.image_attribution;
  end if;

  -- The cover photo: this recipe's own folder in our meal-images bucket.
  if new.image_url is not null
     and (tg_op = 'INSERT' or new.image_url is distinct from old.image_url)
     and new.image_url not like 'https://ykrultxqfxgyiziqrrgp.supabase.co/storage/v1/object/public/meal-images/' || new.id::text || '/%'
  then
    raise exception 'image_url must be this recipe''s uploaded photo' using errcode = '22023';
  end if;
  return new;
end $$;

create trigger meals_guard_user_columns
  before insert or update on public.meals
  for each row execute function public.guard_user_meal_columns();

-- ---- 3. URLs on posts and avatars -------------------------------------------------
alter table public.food_posts
  add constraint food_posts_image_url_own check (
    image_url is null
    or image_url like 'https://ykrultxqfxgyiziqrrgp.supabase.co/storage/v1/object/public/post-images/' || user_id::text || '/%'
  ),
  add constraint food_posts_gif_url_klipy check (
    gif_url is null or gif_url ~ '^https://([a-z0-9-]+\.)*klipy\.com/'
  ),
  add constraint food_posts_sticker_url_klipy check (
    sticker_url is null or sticker_url ~ '^https://([a-z0-9-]+\.)*klipy\.com/'
  ),
  add constraint food_posts_link_url_http check (
    link_url is null or link_url ~* '^https?://[^\s/]+'
  ),
  add constraint food_posts_link_image_http check (
    link_image is null or link_image ~* '^https?://[^\s/]+'
  );

-- Avatars: a user changing their own avatar can only point it at their
-- upload in post-images/<user id>/ (api/auth.ts uploadAvatar) or clear it.
-- A trigger on user edits, not a check constraint, so sign-up
-- (handle_new_user copying the Google profile photo) can never fail on it.
create function public.guard_user_avatar() returns trigger
language plpgsql set search_path = public as $$
begin
  if current_user = 'authenticated'
     and new.avatar_url is distinct from old.avatar_url
     and new.avatar_url is not null
     and new.avatar_url not like 'https://ykrultxqfxgyiziqrrgp.supabase.co/storage/v1/object/public/post-images/' || new.id::text || '/%'
  then
    raise exception 'avatar_url must be your uploaded photo' using errcode = '22023';
  end if;
  return new;
end $$;

create trigger users_guard_avatar
  before update of avatar_url on public.users
  for each row execute function public.guard_user_avatar();

-- ---- 6. is_pro: database-internal only ----------------------------------------------
revoke execute on function public.is_pro(uuid) from authenticated;
