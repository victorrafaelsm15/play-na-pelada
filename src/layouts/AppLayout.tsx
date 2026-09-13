import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { Bell, Home, Plus, Settings, Trophy, User, Users } from 'lucide-react';
import clsx from 'clsx';
import { useMe } from '@/stores/session';
import { useRefresh } from '@/stores/refresh';
import { services } from '@/services';
import { Wordmark } from '@/components/app/Logo';
import { Avatar } from '@/components/ui/Avatar';
import { InstallButton } from '@/components/app/InstallButton';

const NAV = [
  { to: '/inicio', label: 'Início', icon: Home },
  { to: '/peladas', label: 'Peladas', icon: Trophy },
  { to: '/peladas/nova', label: 'Criar', icon: Plus, primary: true },
  { to: '/amigos', label: 'Amigos', icon: Users },
  { to: '/perfil', label: 'Perfil', icon: User }
];

export function useUnreadCount() {
  const me = useMe();
  const tick = useRefresh((s) => s.ticks.notifications);
  const [count, setCount] = useState(0);
  const { pathname } = useLocation();
  useEffect(() => {
    let alive = true;
    const load = () => services.notifications.unreadCount(me.id).then((c) => alive && setCount(c));
    load();
    const id = setInterval(load, 20000);
    window.addEventListener('focus', load);
    return () => {
      alive = false;
      clearInterval(id);
      window.removeEventListener('focus', load);
    };
  }, [me.id, tick, pathname]);
  return count;
}

export function BellButton() {
  const count = useUnreadCount();
  return (
    <Link to="/convites" className="relative flex h-11 w-11 items-center justify-center rounded-full hover:bg-ink/5" aria-label={`Convites e notificações${count ? `, ${count} não lidas` : ''}`}>
      <Bell size={22} />
      {count > 0 && <span className="absolute right-1.5 top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-whistle px-1 text-[11px] font-bold text-white">{count > 9 ? '9+' : count}</span>}
    </Link>
  );
}

const isActive = (pathname: string, to: string) =>
  to === '/peladas' ? pathname.startsWith('/peladas') && pathname !== '/peladas/nova' : pathname === to || pathname.startsWith(`${to}/`);

export function AppLayout() {
  const me = useMe();
  const { pathname } = useLocation();
  const immersive = /\/partida$/.test(pathname);
  const unread = useUnreadCount();

  if (immersive) return <Outlet />;

  return (
    <div className="min-h-dvh lg:flex">
      {/* Desktop: barra lateral */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-chalk-line bg-white px-4 py-6 lg:flex">
        <Link to="/inicio" className="px-2"><Wordmark /></Link>
        <Link to="/peladas/nova" className="mt-8 flex h-12 items-center justify-center gap-2 rounded-2xl bg-card font-semibold text-card-ink hover:bg-card-deep"><Plus size={20} />Criar pelada</Link>
        <nav className="mt-6 flex flex-col gap-1">
          {[...NAV.filter((n) => !n.primary), { to: '/convites', label: 'Convites', icon: Bell }, { to: '/configuracoes', label: 'Configurações', icon: Settings }].map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className={() => clsx('flex h-11 items-center gap-3 rounded-xl px-3 font-semibold transition', isActive(pathname, to) ? 'bg-turf-800 text-chalk' : 'text-ink-soft hover:bg-chalk')}>
              <Icon size={20} />{label}
              {to === '/convites' && unread > 0 && <span className="ml-auto rounded-full bg-whistle px-2 text-xs text-white">{unread}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto space-y-2">
          <InstallButton />
          <Link to="/perfil" className="flex items-center gap-3 rounded-2xl p-2 hover:bg-chalk">
            <Avatar name={me.name} src={me.avatarUrl} size={40} />
            <span className="min-w-0"><span className="block truncate font-semibold">{me.name}</span><span className="block truncate text-sm text-ink-muted">@{me.username}</span></span>
          </Link>
        </div>
      </aside>

      <main className="mx-auto w-full max-w-2xl px-4 pb-32 pt-safe lg:max-w-3xl lg:px-8 lg:pb-12 lg:pt-6">
        <Outlet />
      </main>

      {/* Mobile: navegação inferior */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-chalk-line bg-white/95 pb-safe backdrop-blur lg:hidden" aria-label="Navegação principal">
        <ul className="mx-auto grid max-w-lg grid-cols-5">
          {NAV.map(({ to, label, icon: Icon, primary }) => {
            const active = isActive(pathname, to);
            return (
              <li key={to} className="flex justify-center">
                {primary ? (
                  <Link to={to} className="-mt-5 flex flex-col items-center gap-1" aria-label="Criar pelada">
                    <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-card text-card-ink shadow-lg shadow-card/40 ring-4 ring-chalk transition active:scale-95"><Icon size={28} strokeWidth={2.5} /></span>
                    <span className="text-[11px] font-semibold text-ink-soft">{label}</span>
                  </Link>
                ) : (
                  <Link to={to} className={clsx('flex h-16 w-full flex-col items-center justify-center gap-1', active ? 'text-turf-800' : 'text-ink-muted')} aria-current={active ? 'page' : undefined}>
                    <Icon size={23} strokeWidth={active ? 2.5 : 2} />
                    <span className={clsx('text-[11px]', active ? 'font-bold' : 'font-medium')}>{label}</span>
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
