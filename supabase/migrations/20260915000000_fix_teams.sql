-- Corrige a causa raiz do "invalid input syntax for type uuid" no sorteio de times:
-- o cliente gerava IDs de time como string (uid('team') -> "team_xxxx"), não UUID.
-- save_teams agora sempre gera UUID no servidor e ignora qualquer id vindo do cliente.
--
-- Também corrige perda de histórico: antes, save_teams apagava TODOS os times do
-- evento a cada sorteio, e games.team_a_id/team_b_id tinham ON DELETE CASCADE,
-- então partidas já finalizadas eram apagadas junto. Agora só times sem nenhuma
-- partida associada (nem finalizada) são removidos; times com histórico ficam.
--
-- Adiciona: ordem dos times (order_index), renomear time, reordenar times e
-- editar a escalação de um time sem precisar re-sortear tudo.

alter table public.teams add column if not exists order_index int not null default 0;

create or replace function public.save_teams(p_event_id uuid, p_teams jsonb)
returns public.rotations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team jsonb;
  v_id uuid;
  v_ids uuid[] := '{}';
  v_idx int := 0;
  v_rotation public.rotations;
begin
  if not public.has_permission(p_event_id, 'teams.draw') then raise exception 'FORBIDDEN: Você não tem permissão para esta ação.'; end if;

  -- só remove times sem nenhuma partida associada (preserva histórico)
  delete from public.teams t
  where t.event_id = p_event_id
    and not exists (select 1 from public.games g where g.team_a_id = t.id or g.team_b_id = t.id);

  for v_team in select * from jsonb_array_elements(p_teams)
  loop
    v_id := gen_random_uuid();
    insert into public.teams (id, event_id, name, color, player_ids, order_index)
    values (
      v_id, p_event_id, v_team->>'name', v_team->>'color',
      coalesce((select array_agg(x::uuid) from jsonb_array_elements_text(v_team->'playerIds') x), '{}'),
      v_idx
    );
    v_ids := v_ids || v_id;
    v_idx := v_idx + 1;
  end loop;

  delete from public.games where event_id = p_event_id and status <> 'finished';
  insert into public.rotations (event_id, queue) values (p_event_id, v_ids)
  on conflict (event_id) do update set queue = excluded.queue
  returning * into v_rotation;

  return v_rotation;
end;
$$;

create or replace function public.rename_team(p_team_id uuid, p_name text)
returns public.teams
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
  v_name text := trim(p_name);
  v_team public.teams;
begin
  select event_id into v_event_id from public.teams where id = p_team_id;
  if v_event_id is null then raise exception 'NOT_FOUND: Time não encontrado.'; end if;
  if not public.has_permission(v_event_id, 'teams.draw') then raise exception 'FORBIDDEN: Você não tem permissão para esta ação.'; end if;
  if v_name = '' then raise exception 'VALIDATION: Informe um nome.'; end if;
  update public.teams set name = v_name where id = p_team_id returning * into v_team;
  return v_team;
end;
$$;
grant execute on function public.rename_team(uuid, text) to authenticated;

create or replace function public.reorder_teams(p_event_id uuid, p_ordered_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_idx int := 0;
begin
  if not public.has_permission(p_event_id, 'teams.draw') then raise exception 'FORBIDDEN: Você não tem permissão para esta ação.'; end if;
  foreach v_id in array p_ordered_ids
  loop
    update public.teams set order_index = v_idx where id = v_id and event_id = p_event_id;
    v_idx := v_idx + 1;
  end loop;
end;
$$;
grant execute on function public.reorder_teams(uuid, uuid[]) to authenticated;

create or replace function public.update_team_roster(p_team_id uuid, p_player_ids uuid[])
returns public.teams
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
  v_team public.teams;
begin
  select event_id into v_event_id from public.teams where id = p_team_id;
  if v_event_id is null then raise exception 'NOT_FOUND: Time não encontrado.'; end if;
  if not public.has_permission(v_event_id, 'players.manage') then raise exception 'FORBIDDEN: Você não tem permissão para esta ação.'; end if;
  update public.teams set player_ids = p_player_ids where id = p_team_id returning * into v_team;
  return v_team;
end;
$$;
grant execute on function public.update_team_roster(uuid, uuid[]) to authenticated;
