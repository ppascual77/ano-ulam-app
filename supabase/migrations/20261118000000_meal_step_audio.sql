-- Narrated steps for cook mode. One MP3 per step, made once per meal by the
-- narrate-meal edge function (Google Cloud Text-to-Speech) and stored in the
-- public meal-audio bucket; meals.procedure_audio holds their public URLs in
-- step order (null: not narrated yet, cook mode shows no speaker button).
--
-- Writes only ever come from narrate-meal with the service role, which
-- bypasses RLS, so the bucket needs no insert/update/delete policies: no
-- user or admin session can write to it directly. Public read is by URL
-- (a public bucket serves files without a select policy, and none is added
-- so the bucket can't be listed).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('meal-audio', 'meal-audio', true, 5242880, array['audio/mpeg'])
on conflict (id) do nothing;

alter table public.meals add column if not exists procedure_audio text[];

comment on column public.meals.procedure_audio is
  'Public URLs of each step''s narration (narrate-meal), in procedure order. Cleared when procedure changes.';

-- Audio that no longer matches the steps never plays: changing a meal's
-- steps clears its narration (unless the same update sets new audio, which
-- is what narrate-meal does). The meal is then narrated again by whoever
-- saved it (Seed Meal, Edit Meal, recipe approval, /seed-meal).
create or replace function public.clear_stale_procedure_audio()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.procedure is distinct from old.procedure
     and new.procedure_audio is not distinct from old.procedure_audio then
    new.procedure_audio := null;
  end if;
  return new;
end;
$$;

drop trigger if exists meals_clear_stale_procedure_audio on public.meals;
create trigger meals_clear_stale_procedure_audio
  before update of procedure on public.meals
  for each row execute function public.clear_stale_procedure_audio();
