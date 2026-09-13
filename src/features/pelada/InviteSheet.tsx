import { useState } from 'react';
import { Check, Send } from 'lucide-react';
import { useMe } from '@/stores/session';
import { errorMessage, services } from '@/services';
import { useAsync } from '@/hooks/useAsync';
import { toast } from '@/stores/toast';
import { Sheet } from '@/components/ui/Sheet';
import { Segmented } from '@/components/ui/Controls';
import { Button } from '@/components/ui/Button';
import { PlayerRow } from '@/components/app/PlayerRow';
import { UserSearch } from '@/components/app/UserSearch';
import type { PublicUser } from '@/types';

/** Convidar amigos ou qualquer usuário (nome, @ ou ID); opcionalmente adicionar direto. */
export function InviteSheet({ eventId, open, onClose, excludeIds, canAddDirectly, onChanged }: { eventId: string; open: boolean; onClose(): void; excludeIds: string[]; canAddDirectly: boolean; onChanged(): void }) {
  const me = useMe();
  const [tab, setTab] = useState<'amigos' | 'buscar'>('amigos');
  const [done, setDone] = useState<Record<string, 'invited' | 'added'>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const friends = useAsync(() => (open ? services.users.listFriends(me.id) : Promise.resolve([])), [open, me.id]);

  const act = async (u: PublicUser, kind: 'invite' | 'add') => {
    setBusy(u.id + kind);
    try {
      if (kind === 'invite') await services.events.invite(me.id, eventId, u.id);
      else await services.events.addPlayer(me.id, eventId, u.id);
      setDone((d) => ({ ...d, [u.id]: kind === 'invite' ? 'invited' : 'added' }));
      toast.success(kind === 'invite' ? `Convite enviado para ${u.name.split(' ')[0]}` : `${u.name.split(' ')[0]} entrou na lista`);
      onChanged();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const actions = (u: PublicUser) =>
    done[u.id] ? (
      <span className="flex items-center gap-1 text-sm font-semibold text-turf-700"><Check size={16} />{done[u.id] === 'invited' ? 'Convidado' : 'Na lista'}</span>
    ) : (
      <>
        {canAddDirectly && <Button size="sm" variant="outline" loading={busy === u.id + 'add'} onClick={() => act(u, 'add')}>Adicionar</Button>}
        <Button size="sm" variant="dark" loading={busy === u.id + 'invite'} onClick={() => act(u, 'invite')} aria-label={`Convidar ${u.name}`}><Send size={15} />Convidar</Button>
      </>
    );

  const availableFriends = (friends.data ?? []).filter((f) => !excludeIds.includes(f.id));

  return (
    <Sheet open={open} onClose={onClose} title="Chamar jogadores">
      <Segmented value={tab} onChange={setTab} options={[{ value: 'amigos', label: 'Amigos' }, { value: 'buscar', label: 'Buscar' }]} className="mb-3" />
      {tab === 'amigos' ? (
        friends.loading ? <p className="py-6 text-center text-ink-muted">Carregando amigos…</p> :
        availableFriends.length ? <div className="divide-y divide-chalk-line">{availableFriends.map((u) => <PlayerRow key={u.id} user={u} link={false} actions={actions(u)} />)}</div> :
        <p className="py-6 text-center text-sm text-ink-muted">Todos os seus amigos já estão na pelada. Use a busca para chamar outras pessoas.</p>
      ) : (
        <UserSearch excludeIds={[...excludeIds, me.id]} renderActions={actions} />
      )}
    </Sheet>
  );
}
