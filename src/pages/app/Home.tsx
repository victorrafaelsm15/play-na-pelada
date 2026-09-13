import { Link } from 'react-router-dom';
import { CalendarPlus, Compass, Mail, Radio, Trophy, User, Users } from 'lucide-react';
import { useMe } from '@/stores/session';
import { services } from '@/services';
import { useAsync } from '@/hooks/useAsync';
import { useRefresh } from '@/stores/refresh';
import { BellButton } from '@/layouts/AppLayout';
import { Wordmark } from '@/components/app/Logo';
import { EventCard, EventCardSkeleton } from '@/components/app/EventCard';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { formatDay } from '@/lib/format';

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
};

export default function Home() {
  const me = useMe();
  const tick = useRefresh((s) => s.ticks.events);
  const mine = useAsync(() => services.events.listForUser(me.id), [me.id, tick]);
  const invites = useAsync(() => services.events.listInvitations(me.id), [me.id]);

  const upcoming = mine.data ? [...mine.data.organized, ...mine.data.participating].filter((e) => e.status !== 'finished').sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`)) : [];
  const next = upcoming[0];
  const rest = upcoming.slice(1, 5);

  const actions = [
    { to: '/peladas/nova', label: 'Criar nova pelada', icon: CalendarPlus, strong: true },
    { to: '/peladas?aba=procurar', label: 'Procurar peladas', icon: Compass },
    { to: '/convites', label: 'Meus convites', icon: Mail, count: invites.data?.length },
    { to: '/amigos', label: 'Amigos', icon: Users },
    { to: '/peladas?aba=minhas', label: 'Minhas peladas', icon: Trophy },
    { to: '/perfil', label: 'Meu perfil', icon: User }
  ];

  return (
    <div>
      <div className="flex items-center justify-between py-2 lg:hidden">
        <Wordmark />
        <BellButton />
      </div>

      <section className="mt-4">
        <p className="text-ink-muted">{greeting()},</p>
        <h1 className="font-display text-[38px] font-extrabold leading-none">{me.name.split(' ')[0]}</h1>
      </section>

      {/* Próximo jogo em destaque */}
      <section className="mt-6" aria-label="Próxima pelada">
        {mine.loading ? (
          <div className="h-44 animate-pulse rounded-[28px] bg-turf-800/80" />
        ) : mine.error ? (
          <ErrorState message={mine.error} onRetry={mine.reload} />
        ) : next ? (
          <Link to={`/peladas/${next.id}`} className="pitch-lines relative block overflow-hidden rounded-[28px] bg-turf-800 p-5 text-chalk shadow-lift">
            <div className="flex items-center justify-between text-sm text-chalk/75">
              <span>{next.status === 'live' ? 'Acontecendo agora' : 'Sua próxima pelada'}</span>
              {next.status === 'live' && <span className="flex items-center gap-1.5 rounded-full bg-whistle px-2.5 py-1 text-xs font-bold text-white"><Radio size={12} className="animate-flash" />Ao vivo</span>}
            </div>
            <p className="mt-3 font-display text-[34px] font-extrabold leading-none">{next.name}</p>
            <p className="mt-2 text-chalk/85">{formatDay(next.date)}, {next.time}. {next.location.name}</p>
            <div className="mt-5 flex items-end justify-between">
              <div>
                <span className="font-display text-5xl font-extrabold leading-none tabular">{next.confirmedCount}</span>
                <span className="font-display text-2xl font-bold text-chalk/60">/{next.maxPlayers}</span>
                <p className="text-sm text-chalk/70">confirmados</p>
              </div>
              <span className="rounded-xl bg-card px-4 py-2.5 font-semibold text-card-ink">Ver pelada</span>
            </div>
          </Link>
        ) : (
          <EmptyState
            icon={<CalendarPlus />}
            title="Nenhuma pelada marcada"
            description="Crie a sua ou encontre uma pública com vagas."
            action={<Link to="/peladas/nova" className="inline-flex h-12 items-center rounded-xl bg-card px-5 font-semibold text-card-ink">Criar minha primeira pelada</Link>}
          />
        )}
      </section>

      {/* Ações principais */}
      <nav className="mt-6 grid grid-cols-3 gap-2.5" aria-label="Ações">
        {actions.map(({ to, label, icon: Icon, strong, count }) => (
          <Link key={label} to={to} className={`relative flex min-h-[96px] flex-col justify-between rounded-2xl p-3 transition active:scale-[.97] ${strong ? 'bg-card text-card-ink' : 'bg-white shadow-lift'}`}>
            <Icon size={24} className={strong ? '' : 'text-turf-700'} />
            <span className="text-[13px] font-semibold leading-tight">{label}</span>
            {!!count && <span className="absolute right-2.5 top-2.5 rounded-full bg-whistle px-1.5 text-xs font-bold text-white">{count}</span>}
          </Link>
        ))}
      </nav>

      <section className="mt-8">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="font-display text-2xl font-bold">Próximas peladas</h2>
          <Link to="/peladas?aba=minhas" className="text-sm font-semibold text-turf-700">Ver todas</Link>
        </div>
        {mine.loading ? (
          <div className="space-y-3"><EventCardSkeleton /><EventCardSkeleton /></div>
        ) : rest.length ? (
          <div className="space-y-3">{rest.map((e) => <EventCard key={e.id} event={e} compact />)}</div>
        ) : !mine.error && next ? (
          <p className="rounded-2xl bg-white p-4 text-sm text-ink-muted shadow-lift">Só essa por enquanto. <Link to="/peladas?aba=procurar" className="font-semibold text-turf-700">Procurar outras peladas</Link></p>
        ) : null}
      </section>
    </div>
  );
}
