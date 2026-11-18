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

-- "💬 Opinia / błąd" button in the game: testers send opinions and bug reports.
-- Anyone (also without an account) may ADD a report; nobody can read them through
-- the game. You read them in the dashboard: Table Editor -> feedback.
create table if not exists public.feedback (
  id         bigint generated always as identity primary key,
  kind       text not null check (kind in ('opinia', 'blad', 'pomysl')),
  rating     smallint check (rating between 1 and 5),
  message    text not null check (char_length(message) between 3 and 2000),
  contact    text check (char_length(contact) <= 200),
  context    jsonb not null default '{}'::jsonb check (pg_column_size(context) <= 8000),
  created_at timestamptz not null default now()
);

alter table public.feedback enable row level security;

drop policy if exists "anyone: add feedback" on public.feedback;
create policy "anyone: add feedback" on public.feedback
  for insert to anon, authenticated with check (true);

revoke all on public.feedback from anon, authenticated;
grant insert on public.feedback to anon, authenticated;

-- Simple flood protection: at most 30 reports in 10 minutes from everyone together.
create or replace function public.feedback_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.feedback where created_at > now() - interval '10 minutes') >= 30 then
    raise exception 'Za dużo zgłoszeń naraz, spróbuj później.';
  end if;
  new.created_at := now();
  return new;
end;
$$;

drop trigger if exists feedback_rate_limit on public.feedback;
create trigger feedback_rate_limit before insert on public.feedback
  for each row execute function public.feedback_rate_limit();

-- Old reports are deleted after a year (run by hand or schedule it with pg_cron):
-- delete from public.feedback where created_at < now() - interval '1 year';
