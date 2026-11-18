-- Kocia Biblioteka: player accounts and cloud saves.
-- Run once in Supabase: SQL Editor -> New query -> paste -> Run.

create table if not exists public.saves (
  user_id    uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.saves enable row level security;

-- Each player can see and change only their own save.
drop policy if exists "own save: read" on public.saves;
create policy "own save: read" on public.saves
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "own save: insert" on public.saves;
create policy "own save: insert" on public.saves
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "own save: update" on public.saves;
create policy "own save: update" on public.saves
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

revoke all on public.saves from anon;
grant select, insert, update on public.saves to authenticated;

-- "Usuń konto" button in the game: removes the player's account and,
-- through the cascade above, their save. Works only on the caller's own account.
create or replace function public.delete_my_account()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from auth.users where id = auth.uid();
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
