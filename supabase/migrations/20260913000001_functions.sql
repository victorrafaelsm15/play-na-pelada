-- Play na Pelada — funções auxiliares e de permissão

create or replace function public.current_profile_id()
returns uuid
language sql
stable
as $$
  select id from public.profiles where auth_user_id = auth.uid()
$$;

create or replace function public.event_role(p_event_id uuid)
returns text
language sql
stable
as $$
  select role from public.participants
  where event_id = p_event_id and user_id = public.current_profile_id() and status = 'confirmed'
$$;

create or replace function public.has_permission(p_event_id uuid, p_permission text)
returns boolean
language sql
stable
as $$
  select case public.event_role(p_event_id)
    when 'owner' then true
    when 'organizer' then p_permission in ('event.view','event.edit','players.manage','requests.review','invites.send','teams.draw','games.control')
    when 'moderator' then p_permission in ('event.view','requests.review','invites.send','teams.draw','games.control')
    when 'player' then p_permission = 'event.view'
    else false
  end
$$;

create or replace function public.can_view_event(p_event_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from public.events e
    where e.id = p_event_id
      and (
        e.privacy = 'public'
        or e.organizer_id = public.current_profile_id()
        or exists (select 1 from public.participants p where p.event_id = e.id and p.user_id = public.current_profile_id())
      )
  )
$$;

create or replace function public.notify(p_user_id uuid, p_type text, p_title text, p_body text, p_link text default null, p_actor_id uuid default null, p_ref_id text default null)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.notifications (user_id, type, title, body, link, actor_id, ref_id)
  values (p_user_id, p_type, p_title, p_body, p_link, p_actor_id, p_ref_id)
$$;

create or replace function public.recompute_event_status(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.events;
  v_count int;
begin
  select * into v_event from public.events where id = p_event_id;
  if v_event.status in ('live','finished','cancelled') then return; end if;
  select count(*) into v_count from public.participants where event_id = p_event_id and status = 'confirmed';
  update public.events set status = case when v_count >= v_event.players_per_team * 2 then 'confirmed' else 'waiting' end
  where id = p_event_id;
end;
$$;
