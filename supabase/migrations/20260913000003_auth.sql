-- Play na Pelada — cadastro/login (username, publicId ou e-mail)

create or replace function public.is_username_available(p_username text, p_except_user_id uuid default null)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (
    select 1 from public.profiles
    where lower(username) = lower(p_username)
      and (p_except_user_id is null or id <> p_except_user_id)
  )
$$;

create or replace function public.is_publicid_available(p_public_id text, p_except_user_id uuid default null)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (
    select 1 from public.profiles
    where public_id = p_public_id
      and (p_except_user_id is null or id <> p_except_user_id)
  )
$$;

create or replace function public.get_email_by_identifier(p_identifier text)
returns text
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_email text;
  v_id text := lower(trim(p_identifier));
begin
  if v_id like '%@%' then
    select email into v_email from auth.users where lower(email) = v_id;
    return v_email;
  end if;
  v_id := ltrim(v_id, '@');
  select au.email into v_email
  from public.profiles p
  join auth.users au on au.id = p.auth_user_id
  where lower(p.username) = v_id or p.public_id = v_id
  limit 1;
  return v_email;
end;
$$;

grant execute on function public.is_username_available(text, uuid) to anon, authenticated;
grant execute on function public.is_publicid_available(text, uuid) to anon, authenticated;
grant execute on function public.get_email_by_identifier(text) to anon, authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (auth_user_id, public_id, username, name, avatar_url)
  values (
    new.id,
    new.raw_user_meta_data->>'public_id',
    lower(new.raw_user_meta_data->>'username'),
    coalesce(new.raw_user_meta_data->>'name', 'Jogador'),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
