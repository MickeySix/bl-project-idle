-- 005 painel de dev (Mickey, 2026-11-21): só contas da tabela admins entram, com senha da conta + PIN.
-- O PIN fica só como hash bcrypt (pgcrypto). 5 PINs errados travam o admin por 15 minutos.
-- Toda ação do painel vai para admin_log. Ninguém do navegador lê ou escreve estas tabelas: só a Edge Function "admin" (service role).
create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  pin_hash text,
  erros integer not null default 0,
  travado_ate timestamptz,
  criado_em timestamptz not null default now()
);
create table if not exists public.admin_log (
  id bigserial primary key,
  admin uuid references auth.users(id) on delete set null,
  admin_nome text,
  acao text not null,
  alvo text,
  detalhe jsonb,
  em timestamptz not null default now()
);
alter table public.admins enable row level security;
alter table public.admin_log enable row level security;
revoke all on public.admins, public.admin_log from anon, authenticated;

-- confere o PIN (e conta os erros); devolve 'ok', 'errado', 'travado', 'sem_pin' ou 'nao_admin'
create or replace function public.admin_pin_check(p_uid uuid, p_pin text) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare a public.admins;
begin
  select * into a from public.admins where user_id = p_uid for update;
  if not found then return 'nao_admin'; end if;
  if a.pin_hash is null then return 'sem_pin'; end if;
  if a.travado_ate is not null and a.travado_ate > now() then return 'travado'; end if;
  if extensions.crypt(coalesce(p_pin, ''), a.pin_hash) = a.pin_hash then
    update public.admins set erros = 0, travado_ate = null where user_id = p_uid; return 'ok';
  end if;
  update public.admins set erros = a.erros + 1, travado_ate = case when a.erros + 1 >= 5 then now() + interval '15 minutes' else null end where user_id = p_uid;
  return case when a.erros + 1 >= 5 then 'travado' else 'errado' end;
end $$;

-- define o PIN só se ainda não existe (primeiro acesso)
create or replace function public.admin_pin_set(p_uid uuid, p_pin text) returns boolean
language plpgsql security definer set search_path = public, extensions as $$
begin
  if p_pin !~ '^[0-9]{6,8}$' then return false; end if;
  update public.admins set pin_hash = extensions.crypt(p_pin, extensions.gen_salt('bf', 10)) where user_id = p_uid and pin_hash is null;
  return found;
end $$;

-- ajusta Diamantes no banco (nunca abaixo de 0) e registra no diamond_log
create or replace function public.admin_diamonds(p_uid uuid, p_delta integer, p_reason text) returns integer
language plpgsql security definer set search_path = public as $$
declare v integer;
begin
  update public.saves set diamonds = greatest(0, diamonds + p_delta) where user_id = p_uid returning diamonds into v;
  if not found then return null; end if;
  insert into public.diamond_log(user_id, delta, reason) values (p_uid, p_delta, left(coalesce(p_reason, 'painel'), 120));
  return v;
end $$;

-- troca um campo numérico do save (gold e afins) e sobe a revisão: a aba aberta do jogador recarrega o save novo
create or replace function public.admin_set_num(p_uid uuid, p_path text[], p_val numeric) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  update public.saves set state = jsonb_set(state, p_path, to_jsonb(p_val), true), rev = rev + 1, updated_at = now() where user_id = p_uid and state is not null;
  return found;
end $$;

revoke all on function public.admin_pin_check(uuid, text), public.admin_pin_set(uuid, text), public.admin_diamonds(uuid, integer, text), public.admin_set_num(uuid, text[], numeric) from public, anon, authenticated;
