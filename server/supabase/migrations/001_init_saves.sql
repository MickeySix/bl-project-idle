create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9_.]{3,16}$'),
  created_at timestamptz not null default now()
);
create table public.saves (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb,
  diamonds integer not null default 0 check (diamonds >= 0),
  rev integer not null default 0,
  last_drop_at timestamptz,
  updated_at timestamptz not null default now()
);
create table public.diamond_log (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  delta integer not null,
  reason text not null,
  at timestamptz not null default now()
);
create index diamond_log_user_idx on public.diamond_log(user_id);
alter table public.profiles enable row level security;
alter table public.saves enable row level security;
alter table public.diamond_log enable row level security;
create policy "own profile" on public.profiles for select to authenticated using ((select auth.uid()) = user_id);
create policy "own save" on public.saves for select to authenticated using ((select auth.uid()) = user_id);
create policy "own diamond log" on public.diamond_log for select to authenticated using ((select auth.uid()) = user_id);
revoke insert, update, delete on public.profiles, public.saves, public.diamond_log from anon, authenticated;
