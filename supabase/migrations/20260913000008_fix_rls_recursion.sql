-- Corrige recursão infinita: as funções auxiliares de RLS precisam ser
-- SECURITY DEFINER para não reaplicar as próprias policies (events/participants)
-- que as chamam, o que travava toda leitura de eventos/participantes.

create or replace function public.current_profile_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.profiles where auth_user_id = auth.uid()
$$;

create or replace function public.event_role(p_event_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.participants
  where event_id = p_event_id and user_id = public.current_profile_id() and status = 'confirmed'
$$;

create or replace function public.has_permission(p_event_id uuid, p_permission text)
returns boolean
language sql
stable
security definer
set search_path = public
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
security definer
set search_path = public
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

grant execute on function public.current_profile_id() to authenticated;
grant execute on function public.event_role(uuid) to authenticated;
grant execute on function public.has_permission(uuid, text) to authenticated;
grant execute on function public.can_view_event(uuid) to authenticated;
