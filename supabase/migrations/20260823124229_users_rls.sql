alter table public.users enable row level security;

create policy "Users can view own row"
  on public.users
  for select
  using (auth.uid() = id);

create policy "Users can update own row"
  on public.users
  for update
  using (auth.uid() = id);
