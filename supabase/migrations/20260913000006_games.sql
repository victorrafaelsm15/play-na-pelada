-- Play na Pelada — times, partidas e rodízio

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
  v_rotation public.rotations;
begin
  if not public.has_permission(p_event_id, 'teams.draw') then raise exception 'FORBIDDEN: Você não tem permissão para esta ação.'; end if;

  delete from public.teams where event_id = p_event_id;
  for v_team in select * from jsonb_array_elements(p_teams)
  loop
    v_id := coalesce(nullif(v_team->>'id','')::uuid, gen_random_uuid());
    insert into public.teams (id, event_id, name, color, player_ids)
    values (
      v_id, p_event_id, v_team->>'name', v_team->>'color',
      coalesce((select array_agg(x::uuid) from jsonb_array_elements_text(v_team->'playerIds') x), '{}')
    );
    v_ids := v_ids || v_id;
  end loop;

  delete from public.games where event_id = p_event_id and status <> 'finished';
  insert into public.rotations (event_id, queue) values (p_event_id, v_ids)
  on conflict (event_id) do update set queue = excluded.queue
  returning * into v_rotation;

  return v_rotation;
end;
$$;
grant execute on function public.save_teams(uuid, jsonb) to authenticated;

create or replace function public.create_game(p_event_id uuid, p_team_a_id uuid, p_team_b_id uuid, p_duration_ms bigint)
returns public.games
language plpgsql
security definer
set search_path = public
as $$
declare
  v_open public.games;
  v_round int;
  v_game public.games;
begin
  if not public.has_permission(p_event_id, 'games.control') then raise exception 'FORBIDDEN: Você não tem permissão para esta ação.'; end if;
  select * into v_open from public.games where event_id = p_event_id and status <> 'finished' limit 1;
  if v_open.id is not null then return v_open; end if;

  select count(*) + 1 into v_round from public.games where event_id = p_event_id;
  insert into public.games (event_id, round, team_a_id, team_b_id, timer)
  values (p_event_id, v_round, p_team_a_id, p_team_b_id, jsonb_build_object('durationMs', p_duration_ms, 'accumulatedMs', 0, 'runningSince', null))
  returning * into v_game;
  return v_game;
end;
$$;
grant execute on function public.create_game(uuid, uuid, uuid, bigint) to authenticated;

create or replace function public.save_game(p_game jsonb)
returns public.games
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid := (p_game->>'eventId')::uuid;
  v_game public.games;
begin
  if not public.has_permission(v_event_id, 'games.control') then raise exception 'FORBIDDEN: Você não tem permissão para esta ação.'; end if;

  update public.games set
    score_a = (p_game->>'scoreA')::int,
    score_b = (p_game->>'scoreB')::int,
    timer = p_game->'timer',
    started_at = nullif(p_game->>'startedAt','')::timestamptz,
    finished_at = nullif(p_game->>'finishedAt','')::timestamptz,
    status = p_game->>'status',
    winner_team_id = nullif(p_game->>'winnerTeamId','')::uuid,
    events = coalesce(p_game->'events','[]'::jsonb)
  where id = (p_game->>'id')::uuid
  returning * into v_game;

  if v_game is null then raise exception 'NOT_FOUND: Partida não encontrada.'; end if;

  if v_game.status = 'live' then
    update public.events set status = 'live' where id = v_event_id and status <> 'live';
  end if;

  return v_game;
end;
$$;
grant execute on function public.save_game(jsonb) to authenticated;

create or replace function public.finish_game(p_game jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid := (p_game->>'eventId')::uuid;
  v_game public.games;
  v_rotation public.rotations;
  v_rule text;
  v_queue uuid[];
  v_winner uuid;
  v_loser uuid;
  v_a uuid; v_b uuid;
  v_rest uuid[];
begin
  if not public.has_permission(v_event_id, 'games.control') then raise exception 'FORBIDDEN: Você não tem permissão para esta ação.'; end if;

  update public.games set
    score_a = (p_game->>'scoreA')::int,
    score_b = (p_game->>'scoreB')::int,
    timer = p_game->'timer',
    started_at = nullif(p_game->>'startedAt','')::timestamptz,
    finished_at = nullif(p_game->>'finishedAt','')::timestamptz,
    status = p_game->>'status',
    winner_team_id = nullif(p_game->>'winnerTeamId','')::uuid,
    events = coalesce(p_game->'events','[]'::jsonb)
  where id = (p_game->>'id')::uuid
  returning * into v_game;

  if v_game is null then raise exception 'NOT_FOUND: Partida não encontrada.'; end if;

  select rotation_rule into v_rule from public.events where id = v_event_id;
  select * into v_rotation from public.rotations where event_id = v_event_id;
  if v_rotation.event_id is null then
    v_queue := array[v_game.team_a_id, v_game.team_b_id];
  else
    v_queue := v_rotation.queue;
  end if;

  if array_length(v_queue,1) >= 2 then
    v_a := v_queue[1]; v_b := v_queue[2];
    v_rest := v_queue[3:array_length(v_queue,1)];
    if v_rule = 'round-robin' or v_game.winner_team_id is null or array_length(v_queue,1) = 2 then
      v_queue := v_rest || v_a || v_b;
    else
      v_winner := v_game.winner_team_id;
      v_loser := case when v_winner = v_a then v_b else v_a end;
      v_queue := array[v_winner] || v_rest || v_loser;
    end if;
  end if;

  insert into public.rotations (event_id, queue) values (v_event_id, v_queue)
  on conflict (event_id) do update set queue = excluded.queue
  returning * into v_rotation;

  return jsonb_build_object('game', to_jsonb(v_game), 'rotation', to_jsonb(v_rotation));
end;
$$;
grant execute on function public.finish_game(jsonb) to authenticated;

create or replace function public.mark_notification_read(p_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.notifications set read = true where id = p_id and user_id = public.current_profile_id();
$$;
grant execute on function public.mark_notification_read(uuid) to authenticated;

create or replace function public.mark_all_notifications_read()
returns void
language sql
security definer
set search_path = public
as $$
  update public.notifications set read = true where user_id = public.current_profile_id();
$$;
grant execute on function public.mark_all_notifications_read() to authenticated;
