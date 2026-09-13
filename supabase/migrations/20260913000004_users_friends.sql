-- Play na Pelada — perfis, busca e amizades

create or replace function public.search_users(p_query text, p_exclude_ids uuid[] default '{}')
returns setof public.profiles
language sql
stable
security definer
set search_path = public
as $$
  select * from public.profiles
  where not is_guest
    and not (id = any(p_exclude_ids))
    and (
      name ilike '%' || p_query || '%'
      or username ilike '%' || p_query || '%'
      or public_id like p_query || '%'
    )
  order by name
  limit 20
$$;
grant execute on function public.search_users(text, uuid[]) to authenticated;

create or replace function public.send_friend_request(p_to_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := public.current_profile_id();
  v_name text;
begin
  if v_me is null then raise exception 'FORBIDDEN: Faça login para continuar.'; end if;
  if v_me = p_to_id then raise exception 'VALIDATION: Não é possível adicionar você mesmo.'; end if;
  if exists (
    select 1 from public.friendships
    where (requester_id = v_me and addressee_id = p_to_id) or (requester_id = p_to_id and addressee_id = v_me)
  ) then return; end if;
  insert into public.friendships (requester_id, addressee_id, status) values (v_me, p_to_id, 'pending');
  select name into v_name from public.profiles where id = v_me;
  perform public.notify(p_to_id, 'friend_request', 'Pedido de amizade', v_name || ' quer adicionar você.', '/amigos', v_me);
end;
$$;
grant execute on function public.send_friend_request(uuid) to authenticated;

create or replace function public.respond_friend_request(p_friendship_id uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := public.current_profile_id();
  v_f public.friendships;
  v_name text;
begin
  select * into v_f from public.friendships where id = p_friendship_id;
  if v_f is null then raise exception 'NOT_FOUND: Pedido não encontrado.'; end if;
  if v_f.addressee_id <> v_me and v_f.requester_id <> v_me then raise exception 'FORBIDDEN: Pedido de outra pessoa.'; end if;
  if p_accept and v_f.addressee_id = v_me then
    update public.friendships set status = 'accepted' where id = p_friendship_id;
    select name into v_name from public.profiles where id = v_me;
    perform public.notify(v_f.requester_id, 'friend_accepted', 'Amizade aceita', v_name || ' aceitou seu pedido.', '/amigos', v_me);
  else
    delete from public.friendships where id = p_friendship_id;
  end if;
end;
$$;
grant execute on function public.respond_friend_request(uuid, boolean) to authenticated;

create or replace function public.remove_friend(p_friend_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_me uuid := public.current_profile_id();
begin
  delete from public.friendships
  where (requester_id = v_me and addressee_id = p_friend_id) or (requester_id = p_friend_id and addressee_id = v_me);
end;
$$;
grant execute on function public.remove_friend(uuid) to authenticated;
