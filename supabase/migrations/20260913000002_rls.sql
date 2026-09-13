-- Play na Pelada — Row Level Security
-- Toda escrita passa por funções RPC (SECURITY DEFINER); RLS aqui só cobre leitura
-- e a exceção de auto-edição do próprio perfil.

alter table public.profiles enable row level security;
alter table public.friendships enable row level security;
alter table public.events enable row level security;
alter table public.participants enable row level security;
alter table public.invitations enable row level security;
alter table public.teams enable row level security;
alter table public.rotations enable row level security;
alter table public.games enable row level security;
alter table public.notifications enable row level security;

create policy profiles_select on public.profiles for select to authenticated using (true);
create policy profiles_update_self on public.profiles for update to authenticated
  using (auth_user_id = auth.uid()) with check (auth_user_id = auth.uid());

create policy friendships_select on public.friendships for select to authenticated
  using (requester_id = public.current_profile_id() or addressee_id = public.current_profile_id());

create policy events_select on public.events for select to authenticated using (public.can_view_event(id));

create policy participants_select on public.participants for select to authenticated using (public.can_view_event(event_id));

create policy invitations_select on public.invitations for select to authenticated
  using (receiver_id = public.current_profile_id() or sender_id = public.current_profile_id());

create policy teams_select on public.teams for select to authenticated using (public.can_view_event(event_id));

create policy rotations_select on public.rotations for select to authenticated using (public.can_view_event(event_id));

create policy games_select on public.games for select to authenticated using (public.can_view_event(event_id));

create policy notifications_select on public.notifications for select to authenticated using (user_id = public.current_profile_id());

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on all tables in schema public to anon;
