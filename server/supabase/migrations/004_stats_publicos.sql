-- v716 (Mickey 2026-11-21): números reais da página inicial. Só contagens, nenhum dado de jogador.
-- contas = perfis criados (sem contas de teste zz_*); online = saves gravados nos últimos 5 minutos.
create or replace function public.stats_publicos()
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'contas', (select count(*) from public.profiles where username not like 'zz\_%'),
    'online', (select count(*) from public.saves s join public.profiles p on p.user_id = s.user_id
               where s.updated_at > now() - interval '5 minutes' and p.username not like 'zz\_%')
  );
$$;
revoke all on function public.stats_publicos() from public;
grant execute on function public.stats_publicos() to anon, authenticated;
