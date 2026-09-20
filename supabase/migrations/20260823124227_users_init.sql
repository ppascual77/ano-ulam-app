create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email varchar(255) unique not null,
  display_name varchar(255),
  tier varchar(20) not null default 'free',
  avatar_url text,
  preferences jsonb not null default '{"dietary_focus": "none", "allergens": [], "goals": []}'::jsonb,
  created_at timestamptz not null default now()
);

-- Auto-creates a public.users row from Google OAuth metadata whenever a new
-- auth.users row lands, so the client never has to remember to do it after
-- sign-in. Metadata key names read defensively across both spellings Google
-- sign-in populates until confirmed against a real sign-in.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.users (id, email, display_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
