-- Play na Pelada — peladas, participantes e convites

create or replace function public.create_event(p_input jsonb)
returns public.events
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := public.current_profile_id();
  v_event public.events;
begin
  if v_me is null then raise exception 'FORBIDDEN: Faça login para continuar.'; end if;
  insert into public.events (
    name, description, organizer_id, date, time, location, privacy, join_policy,
    max_players, players_per_team, teams_count, match_duration_min, price_cents, notes, rotation_rule
  ) values (
    p_input->>'name', p_input->>'description', v_me, p_input->>'date', p_input->>'time', p_input->'location',
    coalesce(p_input->>'privacy','public'), coalesce(p_input->>'joinPolicy','auto'),
    (p_input->>'maxPlayers')::int, (p_input->>'playersPerTeam')::int, (p_input->>'teamsCount')::int,
    (p_input->>'matchDurationMin')::int,
    nullif(p_input->>'priceCents','')::int, p_input->>'notes', coalesce(p_input->>'rotationRule','winner-stays')
  ) returning * into v_event;

  insert into public.participants (event_id, user_id, role, status) values (v_event.id, v_me, 'owner', 'confirmed');
  return v_event;
end;
$$;
grant execute on function public.create_event(jsonb) to authenticated;

create or replace function public.update_event(p_event_id uuid, p_patch jsonb)
returns public.events
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.events;
  v_status_given boolean := p_patch ? 'status';
  r record;
begin
  if not public.has_permission(p_event_id, 'event.edit') then raise exception 'FORBIDDEN: Você não tem permissão para esta ação.'; end if;

  update public.events set
    name = coalesce(p_patch->>'name', name),
    description = case when p_patch ? 'description' then p_patch->>'description' else description end,
    date = coalesce(p_patch->>'date', date),
    time = coalesce(p_patch->>'time', time),
    location = coalesce(p_patch->'location', location),
    privacy = coalesce(p_patch->>'privacy', privacy),
    join_policy = coalesce(p_patch->>'joinPolicy', join_policy),
    max_players = coalesce((p_patch->>'maxPlayers')::int, max_players),
    players_per_team = coalesce((p_patch->>'playersPerTeam')::int, players_per_team),
    teams_count = coalesce((p_patch->>'teamsCount')::int, teams_count),
    match_duration_min = coalesce((p_patch->>'matchDurationMin')::int, match_duration_min),
    price_cents = case when p_patch ? 'priceCents' then nullif(p_patch->>'priceCents','')::int else price_cents end,
    notes = case when p_patch ? 'notes' then p_patch->>'notes' else notes end,
    rotation_rule = coalesce(p_patch->>'rotationRule', rotation_rule),
    status = coalesce(p_patch->>'status', status),
    updated_at = now()
  where id = p_event_id
  returning * into v_event;

  if not v_status_given then
    perform public.recompute_event_status(p_event_id);
    select * into v_event from public.events where id = p_event_id;
  end if;

  for r in select user_id from public.participants where event_id = p_event_id and status = 'confirmed' and user_id <> public.current_profile_id()
  loop
    perform public.notify(r.user_id, 'event_updated', 'Pelada alterada', v_event.name || ' teve informações atualizadas.', '/peladas/' || v_event.id);
  end loop;

  return v_event;
end;
$$;
grant execute on function public.update_event(uuid, jsonb) to authenticated;

create or replace function public.remove_event(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_permission(p_event_id, 'event.delete') then raise exception 'FORBIDDEN: Você não tem permissão para esta ação.'; end if;
  delete from public.events where id = p_event_id;
end;
$$;
grant execute on function public.remove_event(uuid) to authenticated;

create or replace function public.join_event(p_event_id uuid)
returns public.participants
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := public.current_profile_id();
  v_event public.events;
  v_existing public.participants;
  v_confirmed int;
  v_auto_ok boolean;
  v_status text;
  v_row public.participants;
  r record;
begin
  select * into v_event from public.events where id = p_event_id;
  if v_event is null then raise exception 'NOT_FOUND: Pelada não encontrada.'; end if;
  select * into v_existing from public.participants where event_id = p_event_id and user_id = v_me;
  if v_existing.status in ('confirmed','pending') then return v_existing; end if;

  select count(*) into v_confirmed from public.participants where event_id = p_event_id and status = 'confirmed';
  if v_event.privacy = 'private' and coalesce(v_existing.status,'') <> 'invited' then
    raise exception 'FORBIDDEN: Pelada privada: é preciso convite.';
  end if;
  v_auto_ok := v_event.join_policy = 'auto' or v_existing.status = 'invited';
  if v_auto_ok and v_confirmed >= v_event.max_players then raise exception 'EVENT_FULL: A lista está completa.'; end if;
  v_status := case when v_auto_ok then 'confirmed' else 'pending' end;

  if v_existing.event_id is not null then
    update public.participants set status = v_status where event_id = p_event_id and user_id = v_me returning * into v_row;
  else
    insert into public.participants (event_id, user_id, role, status) values (p_event_id, v_me, 'player', v_status) returning * into v_row;
  end if;

  if v_status = 'pending' then
    for r in select p.user_id from public.participants p where p.event_id = p_event_id and p.role in ('owner','organizer','moderator')
    loop
      perform public.notify(r.user_id, 'join_request', 'Pedido de participação',
        (select name from public.profiles where id = v_me) || ' quer entrar em ' || v_event.name || '.',
        '/peladas/' || v_event.id || '/gerenciar?aba=pedidos', v_me);
    end loop;
  end if;

  perform public.recompute_event_status(p_event_id);
  return v_row;
end;
$$;
grant execute on function public.join_event(uuid) to authenticated;

create or replace function public.leave_event(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := public.current_profile_id();
  v_event public.events;
begin
  select * into v_event from public.events where id = p_event_id;
  if v_event.organizer_id = v_me then raise exception 'FORBIDDEN: O dono não pode sair da própria pelada.'; end if;
  delete from public.participants where event_id = p_event_id and user_id = v_me;
  perform public.recompute_event_status(p_event_id);
end;
$$;
grant execute on function public.leave_event(uuid) to authenticated;

create or replace function public.add_player(p_event_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.events;
  v_confirmed int;
begin
  if not public.has_permission(p_event_id, 'players.manage') then raise exception 'FORBIDDEN: Você não tem permissão para esta ação.'; end if;
  select * into v_event from public.events where id = p_event_id;
  select count(*) into v_confirmed from public.participants where event_id = p_event_id and status = 'confirmed';
  if v_confirmed >= v_event.max_players then raise exception 'EVENT_FULL: A lista está completa.'; end if;

  if exists (select 1 from public.participants where event_id = p_event_id and user_id = p_user_id) then
    update public.participants set status = 'confirmed' where event_id = p_event_id and user_id = p_user_id;
  else
    insert into public.participants (event_id, user_id, role, status) values (p_event_id, p_user_id, 'player', 'confirmed');
  end if;

  perform public.notify(p_user_id, 'added_to_event', 'Você foi adicionado', 'Você está na lista de ' || v_event.name || '.', '/peladas/' || v_event.id, public.current_profile_id());
  perform public.recompute_event_status(p_event_id);
end;
$$;
grant execute on function public.add_player(uuid, uuid) to authenticated;

create or replace function public.add_guest_player(p_event_id uuid, p_name text)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.events;
  v_confirmed int;
  v_name text := trim(p_name);
  v_guest public.profiles;
begin
  if not public.has_permission(p_event_id, 'players.manage') then raise exception 'FORBIDDEN: Você não tem permissão para esta ação.'; end if;
  if v_name = '' then raise exception 'VALIDATION: Informe um nome.'; end if;
  select * into v_event from public.events where id = p_event_id;
  select count(*) into v_confirmed from public.participants where event_id = p_event_id and status = 'confirmed';
  if v_confirmed >= v_event.max_players then raise exception 'EVENT_FULL: A lista está completa.'; end if;

  insert into public.profiles (name, is_guest) values (v_name, true) returning * into v_guest;
  insert into public.participants (event_id, user_id, role, status) values (p_event_id, v_guest.id, 'player', 'confirmed');
  perform public.recompute_event_status(p_event_id);
  return v_guest;
end;
$$;
grant execute on function public.add_guest_player(uuid, text) to authenticated;

create or replace function public.remove_player(p_event_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.events;
  v_is_guest boolean;
begin
  if not public.has_permission(p_event_id, 'players.manage') then raise exception 'FORBIDDEN: Você não tem permissão para esta ação.'; end if;
  select * into v_event from public.events where id = p_event_id;
  if v_event.organizer_id = p_user_id then raise exception 'FORBIDDEN: O dono não pode ser removido.'; end if;

  select is_guest into v_is_guest from public.profiles where id = p_user_id;
  delete from public.participants where event_id = p_event_id and user_id = p_user_id;
  update public.teams set player_ids = array_remove(player_ids, p_user_id) where event_id = p_event_id;
  if v_is_guest then delete from public.profiles where id = p_user_id; end if;
  perform public.recompute_event_status(p_event_id);
end;
$$;
grant execute on function public.remove_player(uuid, uuid) to authenticated;

create or replace function public.review_request(p_event_id uuid, p_user_id uuid, p_approve boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.events;
  v_confirmed int;
begin
  if not public.has_permission(p_event_id, 'requests.review') then raise exception 'FORBIDDEN: Você não tem permissão para esta ação.'; end if;
  if not exists (select 1 from public.participants where event_id = p_event_id and user_id = p_user_id and status = 'pending') then
    raise exception 'NOT_FOUND: Pedido não encontrado.';
  end if;
  select * into v_event from public.events where id = p_event_id;
  if p_approve then
    select count(*) into v_confirmed from public.participants where event_id = p_event_id and status = 'confirmed';
    if v_confirmed >= v_event.max_players then raise exception 'EVENT_FULL: A lista está completa.'; end if;
    update public.participants set status = 'confirmed' where event_id = p_event_id and user_id = p_user_id;
    perform public.notify(p_user_id, 'join_approved', 'Participação aprovada', 'Você foi aceito em ' || v_event.name || '.', '/peladas/' || v_event.id, public.current_profile_id());
  else
    delete from public.participants where event_id = p_event_id and user_id = p_user_id;
  end if;
  perform public.recompute_event_status(p_event_id);
end;
$$;
grant execute on function public.review_request(uuid, uuid, boolean) to authenticated;

create or replace function public.set_role(p_event_id uuid, p_user_id uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_cur_role text; v_is_guest boolean;
begin
  if not public.has_permission(p_event_id, 'roles.assign') then raise exception 'FORBIDDEN: Você não tem permissão para esta ação.'; end if;
  if p_role = 'owner' then raise exception 'FORBIDDEN: A posse da pelada não pode ser transferida por aqui.'; end if;
  select role into v_cur_role from public.participants where event_id = p_event_id and user_id = p_user_id;
  if v_cur_role is null or v_cur_role = 'owner' then raise exception 'FORBIDDEN: Não é possível alterar este papel.'; end if;
  select is_guest into v_is_guest from public.profiles where id = p_user_id;
  if p_role <> 'player' and v_is_guest then raise exception 'FORBIDDEN: Um jogador avulso não pode ter esse papel.'; end if;
  update public.participants set role = p_role where event_id = p_event_id and user_id = p_user_id;
end;
$$;
grant execute on function public.set_role(uuid, uuid, text) to authenticated;

create or replace function public.add_organizer(p_event_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.events;
  v_is_guest boolean;
  v_existing_role text;
begin
  if not public.has_permission(p_event_id, 'roles.assign') then raise exception 'FORBIDDEN: Você não tem permissão para esta ação.'; end if;
  select * into v_event from public.events where id = p_event_id;
  select is_guest into v_is_guest from public.profiles where id = p_user_id;
  if v_is_guest then raise exception 'FORBIDDEN: Um jogador avulso não pode ser organizador.'; end if;

  select role into v_existing_role from public.participants where event_id = p_event_id and user_id = p_user_id;
  if v_existing_role = 'owner' then raise exception 'FORBIDDEN: Não é possível alterar este papel.'; end if;

  if v_existing_role is not null then
    update public.participants set status = 'confirmed', role = 'organizer' where event_id = p_event_id and user_id = p_user_id;
  else
    insert into public.participants (event_id, user_id, role, status) values (p_event_id, p_user_id, 'organizer', 'confirmed');
  end if;

  perform public.notify(p_user_id, 'added_to_event', 'Você agora é organizador', 'Você recebeu acesso de organizador em ' || v_event.name || '.', '/peladas/' || v_event.id || '/gerenciar', public.current_profile_id());
  perform public.recompute_event_status(p_event_id);
end;
$$;
grant execute on function public.add_organizer(uuid, uuid) to authenticated;

create or replace function public.invite_player(p_event_id uuid, p_receiver_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.events;
  v_existing_status text;
  v_inv_id uuid;
begin
  if not public.has_permission(p_event_id, 'invites.send') then raise exception 'FORBIDDEN: Você não tem permissão para esta ação.'; end if;
  select * into v_event from public.events where id = p_event_id;
  select status into v_existing_status from public.participants where event_id = p_event_id and user_id = p_receiver_id;
  if v_existing_status = 'confirmed' then raise exception 'CONFLICT: Este jogador já está na lista.'; end if;
  if exists (select 1 from public.invitations where event_id = p_event_id and receiver_id = p_receiver_id and status = 'pending') then
    return;
  end if;

  insert into public.invitations (sender_id, receiver_id, event_id, status)
  values (public.current_profile_id(), p_receiver_id, p_event_id, 'pending') returning id into v_inv_id;

  if v_existing_status is null then
    insert into public.participants (event_id, user_id, role, status) values (p_event_id, p_receiver_id, 'player', 'invited');
  end if;

  perform public.notify(p_receiver_id, 'event_invite', 'Convite para pelada',
    (select name from public.profiles where id = public.current_profile_id()) || ' convidou você para ' || v_event.name || '.',
    '/convites', public.current_profile_id(), v_inv_id::text);
end;
$$;
grant execute on function public.invite_player(uuid, uuid) to authenticated;

create or replace function public.respond_invitation(p_invitation_id uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := public.current_profile_id();
  v_inv public.invitations;
  v_event public.events;
  v_confirmed int;
  v_exists boolean;
begin
  select * into v_inv from public.invitations where id = p_invitation_id and receiver_id = v_me;
  if v_inv is null then raise exception 'NOT_FOUND: Convite não encontrado.'; end if;
  select * into v_event from public.events where id = v_inv.event_id;
  select exists(select 1 from public.participants where event_id = v_inv.event_id and user_id = v_me) into v_exists;

  if p_accept then
    select count(*) into v_confirmed from public.participants where event_id = v_inv.event_id and status = 'confirmed';
    if v_confirmed >= v_event.max_players then raise exception 'EVENT_FULL: A lista está completa.'; end if;
    if v_exists then
      update public.participants set status = 'confirmed' where event_id = v_inv.event_id and user_id = v_me;
    else
      insert into public.participants (event_id, user_id, role, status) values (v_inv.event_id, v_me, 'player', 'confirmed');
    end if;
  else
    delete from public.participants where event_id = v_inv.event_id and user_id = v_me and status = 'invited';
  end if;

  update public.invitations set status = case when p_accept then 'accepted' else 'declined' end where id = p_invitation_id;
  perform public.recompute_event_status(v_inv.event_id);
end;
$$;
grant execute on function public.respond_invitation(uuid, boolean) to authenticated;
