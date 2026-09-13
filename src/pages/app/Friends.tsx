import { useState } from 'react';
import { Check, Clock, UserMinus, UserPlus, Users, X } from 'lucide-react';
import type { PublicUser } from '@/types';
import { useMe } from '@/stores/session';
import { errorMessage, services } from '@/services';
import { useAsync } from '@/hooks/useAsync';
import { invalidate, useRefresh } from '@/stores/refresh';
import { toast } from '@/stores/toast';
import { BellButton } from '@/layouts/AppLayout';
import { PageHeader } from '@/components/app/PageHeader';
import { PlayerRow } from '@/components/app/PlayerRow';
import { UserSearch } from '@/components/app/UserSearch';
import { Segmented } from '@/components/ui/Controls';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/Sheet';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States';

type Tab = 'amigos' | 'pedidos' | 'buscar';

export default function Friends() {
  const me = useMe();
  const tick = useRefresh((s) => s.ticks.friends);
  const [tab, setTab] = useState<Tab>('amigos');
  const friends = useAsync(() => services.users.listFriends(me.id), [me.id, tick]);
  const requests = useAsync(() => services.users.listFriendRequests(me.id), [me.id, tick]);
  const [busy, setBusy] = useState<string | null>(null);
  const [removing, setRemoving] = useState<PublicUser | null>(null);
  const [sent, setSent] = useState<Set<string>>(new Set());

  const incoming = requests.data?.filter((r) => r.direction === 'incoming') ?? [];
  const outgoing = requests.data?.filter((r) => r.direction === 'outgoing') ?? [];
  const excluded = [me.id, ...(friends.data ?? []).map((f) => f.id), ...(requests.data ?? []).map((r) => r.user.id)];

  const run = async (key: string, fn: () => Promise<unknown>, msg: string) => {
    setBusy(key);
    try {
      await fn();
      toast.success(msg);
      invalidate('friends', 'notifications');
      return true;
    } catch (err) {
      toast.error(errorMessage(err));
      return false;
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <PageHeader title="Amigos" actions={<span className="lg:hidden"><BellButton /></span>} />
      <Segmented value={tab} onChange={setTab} options={[{ value: 'amigos', label: 'Amigos', count: friends.data?.length }, { value: 'pedidos', label: 'Pedidos', count: incoming.length }, { value: 'buscar', label: 'Buscar' }]} />

      <div className="mt-5">
        {tab === 'amigos' && (
          friends.loading ? <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-14" />)}</div> :
          friends.error ? <ErrorState message={friends.error} onRetry={friends.reload} /> :
          friends.data?.length ? (
            <div className="divide-y divide-chalk-line rounded-3xl bg-white px-4 shadow-lift">
              {friends.data.map((u) => (
                <PlayerRow key={u.id} user={u} actions={<button onClick={() => setRemoving(u)} className="flex h-11 w-11 items-center justify-center rounded-full text-ink-muted hover:bg-chalk" aria-label={`Remover ${u.name}`}><UserMinus size={19} /></button>} />
              ))}
            </div>
          ) : (
            <EmptyState icon={<Users />} title="Nenhum amigo ainda" description="Adicione quem joga com você para convidar mais rápido." action={<Button onClick={() => setTab('buscar')}><UserPlus size={18} />Buscar jogadores</Button>} />
          )
        )}

        {tab === 'pedidos' && (
          requests.loading ? <Skeleton className="h-40" /> : (
            <div className="space-y-6">
              <section>
                <h2 className="mb-2 font-display text-xl font-bold">Recebidos</h2>
                {incoming.length ? (
                  <div className="divide-y divide-chalk-line rounded-3xl bg-white px-4 shadow-lift">
                    {incoming.map((r) => (
                      <PlayerRow key={r.friendship.id} user={r.user} actions={
                        <>
                          <Button size="sm" variant="outline" aria-label="Recusar" loading={busy === `no-${r.friendship.id}`} onClick={() => run(`no-${r.friendship.id}`, () => services.users.respondFriendRequest(me.id, r.friendship.id, false), 'Pedido recusado')}><X size={16} /></Button>
                          <Button size="sm" variant="dark" loading={busy === `ok-${r.friendship.id}`} onClick={() => run(`ok-${r.friendship.id}`, () => services.users.respondFriendRequest(me.id, r.friendship.id, true), `Você e ${r.user.name.split(' ')[0]} agora são amigos`)}><Check size={16} />Aceitar</Button>
                        </>
                      } />
                    ))}
                  </div>
                ) : <p className="rounded-2xl bg-white p-4 text-sm text-ink-muted shadow-lift">Nenhum pedido recebido.</p>}
              </section>
              {outgoing.length > 0 && (
                <section>
                  <h2 className="mb-2 font-display text-xl font-bold">Enviados</h2>
                  <div className="divide-y divide-chalk-line rounded-3xl bg-white px-4 shadow-lift">
                    {outgoing.map((r) => (
                      <PlayerRow key={r.friendship.id} user={r.user} actions={<Button size="sm" variant="ghost" loading={busy === `c-${r.friendship.id}`} onClick={() => run(`c-${r.friendship.id}`, () => services.users.respondFriendRequest(me.id, r.friendship.id, false), 'Pedido cancelado')}>Cancelar</Button>} />
                    ))}
                  </div>
                </section>
              )}
            </div>
          )
        )}

        {tab === 'buscar' && (
          <div className="rounded-3xl bg-white p-4 shadow-lift">
            <UserSearch
              excludeIds={excluded}
              renderActions={(u) => sent.has(u.id) ? (
                <span className="flex items-center gap-1 text-sm font-semibold text-ink-muted"><Clock size={15} />Enviado</span>
              ) : (
                <Button size="sm" variant="dark" loading={busy === `add-${u.id}`} onClick={async () => { if (await run(`add-${u.id}`, () => services.users.sendFriendRequest(me.id, u.id), 'Pedido de amizade enviado')) setSent((s) => new Set(s).add(u.id)); }}><UserPlus size={15} />Adicionar</Button>
              )}
            />
          </div>
        )}
      </div>

      <ConfirmDialog open={!!removing} onClose={() => setRemoving(null)} title="Remover amigo?" message={`${removing?.name} sai da sua lista de amigos.`} confirmLabel="Remover" danger loading={busy === 'remove'}
        onConfirm={async () => { if (removing && (await run('remove', () => services.users.removeFriend(me.id, removing.id), 'Amigo removido'))) setRemoving(null); }} />
    </div>
  );
}
