import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CalendarPlus, Compass, Search, SlidersHorizontal } from 'lucide-react';
import { useMe } from '@/stores/session';
import { errorMessage, services, type EventSummary } from '@/services';
import { useAsync } from '@/hooks/useAsync';
import { useDebounced } from '@/hooks/useDebounced';
import { invalidate, useRefresh } from '@/stores/refresh';
import { toast } from '@/stores/toast';
import { BellButton } from '@/layouts/AppLayout';
import { PageHeader } from '@/components/app/PageHeader';
import { EventCard, EventCardSkeleton } from '@/components/app/EventCard';
import { Segmented, Switch } from '@/components/ui/Controls';
import { Input } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { EmptyState, ErrorState } from '@/components/ui/States';

type Tab = 'procurar' | 'minhas' | 'participo';

export default function Peladas() {
  const [params, setParams] = useSearchParams();
  const tab = (params.get('aba') as Tab) ?? 'procurar';
  return (
    <div>
      <PageHeader title="Peladas" actions={<span className="lg:hidden"><BellButton /></span>} />
      <Segmented<Tab>
        value={tab}
        onChange={(v) => setParams({ aba: v }, { replace: true })}
        options={[{ value: 'procurar', label: 'Procurar' }, { value: 'minhas', label: 'Minhas' }, { value: 'participo', label: 'Participo' }]}
      />
      <div className="mt-5">{tab === 'procurar' ? <Explore /> : <MyList kind={tab} />}</div>
    </div>
  );
}

function Explore() {
  const me = useMe();
  const [query, setQuery] = useState('');
  const [onlySpots, setOnlySpots] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const dq = useDebounced(query);
  const tick = useRefresh((s) => s.ticks.events);
  const res = useAsync(() => services.events.listPublic(me.id, { query: dq, onlyWithSpots: onlySpots }), [dq, onlySpots, me.id, tick]);
  const [busy, setBusy] = useState<string | null>(null);

  const join = async (e: EventSummary) => {
    setBusy(e.id);
    try {
      const p = await services.events.join(e.id, me.id);
      toast.success(p.status === 'confirmed' ? `Você está na lista de ${e.name}` : 'Pedido enviado ao organizador');
      invalidate('events');
      res.reload();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const actionFor = (e: EventSummary) => {
    const p = e.myParticipation;
    if (p?.status === 'confirmed') return <p className="text-center text-sm font-semibold text-turf-700">Você está confirmado</p>;
    if (p?.status === 'pending') return <p className="text-center text-sm font-semibold text-ink-muted">Pedido aguardando aprovação</p>;
    if (e.confirmedCount >= e.maxPlayers) return <p className="text-center text-sm font-semibold text-ink-muted">Lista completa</p>;
    return (
      <Button block variant={e.joinPolicy === 'auto' ? 'primary' : 'dark'} loading={busy === e.id} onClick={() => join(e)}>
        {e.joinPolicy === 'auto' ? 'Participar' : 'Solicitar participação'}
      </Button>
    );
  };

  return (
    <div>
      <div className="flex gap-2">
        <Input className="flex-1" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Nome, local ou bairro" leading={<Search size={18} />} aria-label="Buscar peladas" />
        <button onClick={() => setShowFilters(!showFilters)} className={`flex h-12 w-12 items-center justify-center rounded-xl border-2 ${showFilters || onlySpots ? 'border-turf-600 bg-turf-600/10 text-turf-700' : 'border-chalk-line bg-white'}`} aria-label="Filtros" aria-expanded={showFilters}>
          <SlidersHorizontal size={20} />
        </button>
      </div>
      {showFilters && (
        <div className="mt-2 rounded-2xl bg-white px-4 py-2 shadow-lift animate-rise">
          <Switch checked={onlySpots} onChange={setOnlySpots} label="Somente com vagas" />
          <p className="pb-2 text-sm text-ink-muted">Distância, nível e modalidade chegam com a localização.</p>
        </div>
      )}
      <div className="mt-4 space-y-3">
        {res.loading ? (
          [0, 1, 2].map((i) => <EventCardSkeleton key={i} />)
        ) : res.error ? (
          <ErrorState message={res.error} onRetry={res.reload} />
        ) : res.data?.length ? (
          res.data.map((e) => <EventCard key={e.id} event={e} action={actionFor(e)} />)
        ) : (
          <EmptyState icon={<Compass />} title="Nenhuma pelada encontrada" description={dq ? `Nada para “${dq}”. Tente outro nome ou bairro.` : 'Ainda não há peladas públicas marcadas.'} action={<Link to="/peladas/nova" className="font-semibold text-turf-700">Criar uma pelada</Link>} />
        )}
      </div>
    </div>
  );
}

function MyList({ kind }: { kind: 'minhas' | 'participo' }) {
  const me = useMe();
  const tick = useRefresh((s) => s.ticks.events);
  const res = useAsync(() => services.events.listForUser(me.id), [me.id, tick]);
  const list = kind === 'minhas' ? res.data?.organized : res.data?.participating;

  if (res.loading) return <div className="space-y-3">{[0, 1].map((i) => <EventCardSkeleton key={i} />)}</div>;
  if (res.error) return <ErrorState message={res.error} onRetry={res.reload} />;
  if (!list?.length)
    return kind === 'minhas' ? (
      <EmptyState icon={<CalendarPlus />} title="Você ainda não criou nenhuma pelada." description="Monte a lista, defina os times e controle as partidas por aqui." action={<Link to="/peladas/nova" className="inline-flex h-12 items-center rounded-xl bg-card px-5 font-semibold text-card-ink">Criar minha primeira pelada</Link>} />
    ) : (
      <EmptyState icon={<Compass />} title="Você não está em nenhuma pelada" description="Procure peladas públicas ou aceite um convite." action={<Link to="/peladas?aba=procurar" className="font-semibold text-turf-700">Procurar peladas</Link>} />
    );
  return <div className="space-y-3">{list.map((e) => <EventCard key={e.id} event={e} />)}</div>;
}
