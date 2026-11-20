-- Audit fixes (2026-11-20, docs: AnoUlam Android/iOS Audit, S1 S3 S4 S5 S6).
-- What a signed-in user could do by calling the API directly:
--
-- S1. Set procedure_audio (cook mode's narration URLs) on their own pending
--     recipe. Approval kept it, so cook mode played audio from anywhere to
--     everyone. Now pinned for non-admins (they may only clear it), and any
--     audio already on a user recipe is cleared: narrate-meal never narrates
--     user recipes, so none of it is ours. approveRecipe also clears it.
-- S3. Search for free all day: count_daily_use trusted the app's p_refines,
--     and "refines" compared with the last search, so a chain of
--     extend/shorten steps cost one search. The server now decides, against
--     the last search that COUNTED (`anchor`): the same words (other
--     filters), or one query a prefix of the other with the shorter at
--     least 3 letters. At most 20 free refinements a day. p_refines stays in
--     the signature (older builds send it) and is ignored.
-- S4. Three reports hid a post AND took back its Pro reward; an admin
--     restoring it didn't give the reward back. Hiding by reports is now
--     only "waiting for review": the reward goes when an admin removes the
--     post, or the poster deletes it or takes its photo out.
-- S5. The first photo post's reward only checked the URL pointed into the
--     poster's folder; now the file has to exist (the app uploads before it
--     inserts the post).
-- S6. The 8-recipe limit was only in the app. Now the database refuses a
--     9th recipe (pending or approved) from a non-admin.

-- ---- S1 + S6: recipe columns and the recipe limit --------------------------------
-- Same as 20261114010000_security_hardening.sql, plus procedure_audio and the
-- limit. Matches RECIPE_LIMIT in api/recipes.ts (counted the same way:
-- every recipe of theirs that isn't rejected).
create or replace function public.guard_user_meal_columns() returns trigger
language plpgsql set search_path = public as $$
begin
  if current_user <> 'authenticated' or public.is_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if (select count(*) from public.meals
        where poster_id = new.poster_id and status <> 'rejected') >= 8 then
      raise exception 'recipe limit reached' using errcode = 'P0001';
    end if;
    new.save_count := 0;
    new.created_at := now();
    new.updated_at := now();
    new.source_type := 'estimated';
    new.archived_at := null;
    new.rejection_reason := null;
    new.reference_image_url := null;
    new.image_attribution := null;
    new.procedure_audio := null;
  else
    new.save_count := old.save_count;
    new.created_at := old.created_at;
    new.source_type := old.source_type;
    new.archived_at := old.archived_at;
    new.rejection_reason := old.rejection_reason;
    new.reference_image_url := old.reference_image_url;
    new.image_attribution := old.image_attribution;
    -- Clearing is fine (changing the steps clears it anyway); setting isn't.
    if new.procedure_audio is not null and new.procedure_audio is distinct from old.procedure_audio then
      new.procedure_audio := old.procedure_audio;
    end if;
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

update public.meals set procedure_audio = null
  where poster_id is not null and procedure_audio is not null;

-- ---- S3: refinements decided by the server ------------------------------------------
alter table public.daily_usage
  add column if not exists anchor text,
  add column if not exists refinements integer not null default 0;

-- Free refinements a day (search only).
create or replace function public.free_refinements_per_day() returns integer
language sql immutable as $$ select 20 $$;

-- Whether search signature `next` only refines `anchor`. Signatures are the
-- app's JSON [words, filters] (useBrowseSearch signatureOf); anything else
-- is never a refinement.
create or replace function public.search_refines(p_anchor text, p_next text) returns boolean
language plpgsql immutable set search_path = public as $$
declare
  a jsonb;
  b jsonb;
  qa text;
  qb text;
begin
  if p_anchor is null or p_next is null then
    return false;
  end if;
  begin
    a := p_anchor::jsonb;
    b := p_next::jsonb;
  exception when others then
    return false;
  end;
  if jsonb_typeof(a) <> 'array' or jsonb_typeof(b) <> 'array' then
    return false;
  end if;
  qa := coalesce(a ->> 0, '');
  qb := coalesce(b ->> 0, '');
  -- The same words with other filters.
  if qa = qb then
    return true;
  end if;
  if (a -> 1) is distinct from (b -> 1) then
    return false;
  end if;
  -- One a prefix of the other ("sini" -> "sinigang", or back), the shorter
  -- at least 3 letters so "p" -> "pork" -> "pancit" can't chain.
  return least(length(qa), length(qb)) >= 3 and (qb like qa || '%' or qa like qb || '%');
end $$;

-- Same as 20261118010000_narration_daily_limit.sql, but a refinement is the
-- server's call (p_refines is ignored).
create or replace function public.count_daily_use(p_kind text, p_signature text, p_refines boolean default false)
returns table (allowed boolean, uses_left integer)
language plpgsql security definer set search_path = public as $$
declare
  v_user   uuid := auth.uid();
  v_day    date := (now() at time zone 'Asia/Manila')::date;
  v_limit  integer := public.daily_limit(p_kind);
  v_row    public.daily_usage;
  v_repeat boolean;
  v_refine boolean;
begin
  if v_user is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if p_kind not in ('search', 'budget', 'pantry', 'narration') then
    raise exception 'unknown kind %', p_kind using errcode = '22023';
  end if;

  insert into public.daily_usage (user_id, kind, day) values (v_user, p_kind, v_day)
    on conflict do nothing;
  select * into v_row from public.daily_usage
    where user_id = v_user and kind = p_kind and day = v_day
    for update;

  v_repeat := p_signature = any (v_row.seen);
  v_refine := not v_repeat
    and p_kind = 'search'
    and v_row.refinements < public.free_refinements_per_day()
    and public.search_refines(v_row.anchor, p_signature);

  if not v_repeat and not v_refine and v_limit is not null and v_row.count >= v_limit then
    return query select false, 0;
    return;
  end if;

  update public.daily_usage set
    count       = case when v_repeat or v_refine then count else count + 1 end,
    refinements = case when v_refine then refinements + 1 else refinements end,
    anchor      = case when v_repeat or v_refine then anchor else p_signature end,
    seen        = case when v_repeat then seen else seen || p_signature end,
    last        = p_signature
  where user_id = v_user and kind = p_kind and day = v_day
  returning * into v_row;

  return query select true, case when v_limit is null then null else greatest(v_limit - v_row.count, 0) end;
end $$;

revoke execute on function public.search_refines(text, text) from public, anon, authenticated;
revoke execute on function public.free_refinements_per_day() from public, anon, authenticated;

-- ---- S4: reports hide, only an admin's removal takes the reward ---------------------
create or replace function public.revoke_reward_for_post() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    perform public.revoke_pro_reward('photo_post', old.id);
    return old;
  end if;
  if (old.image_url is not null and new.image_url is null)
     or (new.hidden_reason = 'admin' and old.hidden_reason is distinct from 'admin')
  then
    perform public.revoke_pro_reward('photo_post', new.id);
  end if;
  return new;
end $$;

drop trigger if exists revoke_reward_for_post_update on public.food_posts;
create trigger revoke_reward_for_post_update
  after update of image_url, hidden_at, hidden_reason on public.food_posts
  for each row execute function public.revoke_reward_for_post();

-- ---- S5: the photo has to be there -------------------------------------------------
create or replace function public.reward_first_photo_post() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_prefix constant text := 'https://ykrultxqfxgyiziqrrgp.supabase.co/storage/v1/object/public/post-images/';
begin
  if new.image_url is not null
     and not exists (select 1 from public.pro_rewards where user_id = new.user_id and kind = 'photo_post')
     and exists (
       select 1 from storage.objects o
       where o.bucket_id = 'post-images'
         and o.name = split_part(substr(new.image_url, length(v_prefix) + 1), '?', 1)
     )
  then
    perform public.grant_pro_reward(new.user_id, 'photo_post', new.id, 7);
  end if;
  return new;
end $$;
