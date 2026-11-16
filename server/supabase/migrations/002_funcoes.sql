-- save_game: grava o save; o saldo de diamantes do save é ignorado, só desconta p_spent (até o saldo). rev diferente = conflito.
create or replace function public.save_game(p_uid uuid, p_state jsonb, p_rev integer, p_spent integer)
returns table(ok boolean, rev integer, diamonds integer)
language plpgsql security definer set search_path = public as $$
declare r public.saves%rowtype; sp integer; d integer;
begin
  select * into r from public.saves s where s.user_id = p_uid for update;
  if not found then insert into public.saves(user_id) values (p_uid) returning * into r; end if;
  if r.state is not null and p_rev is distinct from r.rev then return query select false, r.rev, r.diamonds; return; end if;
  sp := least(greatest(0, coalesce(p_spent, 0)), r.diamonds);
  d := r.diamonds - sp;
  update public.saves s set state = jsonb_set(p_state, '{diamonds}', to_jsonb(d)), diamonds = d, rev = r.rev + 1, updated_at = now() where s.user_id = p_uid;
  if sp > 0 then insert into public.diamond_log(user_id, delta, reason) values (p_uid, -sp, 'gasto'); end if;
  return query select true, r.rev + 1, d;
end $$;
-- diamond_drop: sorteio do diamante da vitória, no máximo 1 a cada p_gap_s segundos
create or replace function public.diamond_drop(p_uid uuid, p_chance double precision, p_n integer, p_gap_s integer)
returns table(got integer, diamonds integer)
language plpgsql security definer set search_path = public as $$
declare r public.saves%rowtype; g integer := 0;
begin
  select * into r from public.saves s where s.user_id = p_uid for update;
  if not found then return query select 0, 0; return; end if;
  if r.last_drop_at is not null and now() - r.last_drop_at < make_interval(secs => p_gap_s) then return query select 0, r.diamonds; return; end if;
  if random() < p_chance then g := p_n; end if;
  update public.saves s set diamonds = r.diamonds + g, last_drop_at = now(),
    state = case when r.state is null then null else jsonb_set(r.state, '{diamonds}', to_jsonb(r.diamonds + g)) end
    where s.user_id = p_uid;
  if g > 0 then insert into public.diamond_log(user_id, delta, reason) values (p_uid, g, 'vitoria'); end if;
  return query select g, r.diamonds + g;
end $$;
revoke all on function public.save_game(uuid, jsonb, integer, integer) from public, anon, authenticated;
revoke all on function public.diamond_drop(uuid, double precision, integer, integer) from public, anon, authenticated;
grant execute on function public.save_game(uuid, jsonb, integer, integer) to service_role;
grant execute on function public.diamond_drop(uuid, double precision, integer, integer) to service_role;
