import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Check, History, MoreVertical, Pencil, Play, Shuffle, Trash2, UserCog, UserPlus, X } from 'lucide-react';
import type { ParticipantRole, PublicUser } from '@/types';
import { errorMessage, services, type ParticipantView } from '@/services';
import { useAsync } from '@/hooks/useAsync';
import { invalidate } from '@/stores/refresh';
import { toast } from '@/stores/toast';
import { useEvent } from '@/features/pelada/useEvent';
import { InviteSheet } from '@/features/pelada/InviteSheet';
import { TeamsPanel } from '@/features/pelada/TeamsPanel';
import { ASSIGNABLE_ROLES, ROLE_LABEL, canManage } from '@/domain/permissions';
import { formatClock } from '@/domain/timer';
import { PageHeader } from '@/components/app/PageHeader';
import { PlayerRow } from '@/components/app/PlayerRow';
import { UserSearch } from '@/components/app/UserSearch';
import { Segmented } from '@/components/ui/Controls';
import { Button } from '@/components/ui/Button';
import { Badge, EmptyState, ErrorState, Skeleton } from '@/components/ui/States';
import { ConfirmDialog, Sheet } from '@/components/ui/Sheet';

type Tab = 'jogadores' | 'pedidos' | 'partidas' | 'ajustes';

const ROLE_HINT: Record<ParticipantRole, string> = {
  owner: 'Acesso total.',
  organizer: 'Edita a pelada, gerencia jogadores e partidas.',
  moderator: 'Aprova pedidos, convida, sorteia e controla partidas.',
  player: 'Vê a pelada e participa.'
};

export default function ManageEvent() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = (params.get('aba') as Tab) ?? 'jogadores';
  const ctx = useEvent(id);
  const { me, event, participants, confirmed, pending, invited, role, allows, reload } = ctx;
  const [target, setTarget] = useState<ParticipantView | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [shared, setShared] = useState<Record<string, true>>({});

  if (event.loading || participants.loading) return <div className="space-y-3 pt-4"><Skeleton className="h-10 w-2/3" /><Skeleton className="h-12" /><Skeleton className="h-72" /></div>;
  if (event.error || !event.data) return <div><PageHeader title="Gerenciar" back /><ErrorState message={event.error ?? 'Pelada não encontrada.'} /></div>;
  if (!canManage(role)) return <div><PageHeader title="Gerenciar" back /><ErrorState message="Você não tem permissão para gerenciar esta pelada." /></div>;

  const e = event.data;
  const run = async (key: string, fn: () => Promise<unknown>, success: string) => {
    setBusy(key);
    try {
      await fn();
      toast.success(success);
      invalidate('events', 'notifications');
      reload();
      return true;
    } catch (err) {
      toast.error(errorMessage(err));
      return false;
    } finally {
      setBusy(null);
    }
  };

  const tabs = [
    { value: 'jogadores' as const, label: 'Jogadores' },
    { value: 'pedidos' as const, label: 'Pedidos', count: allows('requests.review') ? pending.length : 0 },
    { value: 'partidas' as const, label: 'Partidas' },
    { value: 'ajustes' as const, label: 'Ajustes' }
  ];

  return (
    <div>
      <PageHeader title="Gerenciar" subtitle={e.name} back={`/peladas/${e.id}`} />
      <Segmented value={tab} onChange={(v) => setParams({ aba: v }, { replace: true })} options={tabs} className="no-scrollbar overflow-x-auto" />

      <div className="mt-5">
        {tab === 'jogadores' && (
          <div>
            <div className="mb-3 flex items-center justify-between">
              <p className="font-semibold">{confirmed.length} de {e.maxPlayers} confirmados</p>
              {allows('invites.send') && <Button size="sm" variant="dark" onClick={() => setInviteOpen(true)}><UserPlus size={16} />Chamar jogadores</Button>}
            </div>
            <div className="divide-y divide-chalk-line rounded-3xl bg-white px-4 shadow-lift">
              {confirmed.map((p) => (
                <PlayerRow
                  key={p.userId}
                  user={p.user}
                  meta={p.role !== 'player' ? <Badge tone={p.role === 'owner' ? 'dark' : 'turf'} className="mt-1">{ROLE_LABEL[p.role]}</Badge> : undefined}
                  actions={p.role !== 'owner' && p.userId !== me.id && (allows('players.manage') || allows('roles.assign')) ? (
                    <button onClick={() => setTarget(p)} className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-chalk" aria-label={`Opções para ${p.user.name}`}><MoreVertical size={20} /></button>
                  ) : undefined}
                />
              ))}
            </div>
            {invited.length > 0 && (
              <>
                <h3 className="mb-2 mt-6 font-display text-xl font-bold">Convidados sem resposta</h3>
                <div className="divide-y divide-chalk-line rounded-3xl bg-white px-4 shadow-lift">
                  {invited.map((p) => <PlayerRow key={p.userId} user={p.user} actions={<Badge tone="card">Convidado</Badge>} />)}
                </div>
              </>
            )}
          </div>
        )}

        {tab === 'pedidos' && (
          !allows('requests.review') ? <ErrorState message="Seu papel não permite revisar pedidos." /> :
          pending.length === 0 ? (
            <EmptyState icon={<Check />} title="Nenhum pedido pendente" description={e.joinPolicy === 'auto' && e.privacy === 'public' ? 'Esta pelada aceita entrada direta.' : 'Novos pedidos aparecem aqui.'} />
          ) : (
            <div className="divide-y divide-chalk-line rounded-3xl bg-white px-4 shadow-lift">
              {pending.map((p) => (
                <PlayerRow
                  key={p.userId}
                  user={p.user}
                  actions={
                    <>
                      <Button size="sm" variant="outline" aria-label={`Recusar ${p.user.name}`} loading={busy === `no-${p.userId}`} onClick={() => run(`no-${p.userId}`, () => services.events.reviewRequest(me.id, e.id, p.userId, false), 'Pedido recusado')}><X size={16} /></Button>
                      <Button size="sm" variant="dark" loading={busy === `ok-${p.userId}`} onClick={() => run(`ok-${p.userId}`, () => services.events.reviewRequest(me.id, e.id, p.userId, true), `${p.user.name.split(' ')[0]} entrou na lista`)}><Check size={16} />Aceitar</Button>
                    </>
                  }
                />
              ))}
            </div>
          )
        )}

        {tab === 'partidas' && <GamesTab eventId={e.id} canDraw={allows('teams.draw')} canManage={allows('players.manage')} canControl={allows('games.control')} onDraw={() => navigate(`/peladas/${e.id}/sorteio`)} onPlay={() => navigate(`/peladas/${e.id}/partida`)} />}

        {tab === 'ajustes' && (
          <div className="space-y-3">
            {allows('event.edit') && (
              <Link to={`/peladas/${e.id}/editar`} className="flex items-center gap-3 rounded-2xl bg-white p-4 font-semibold shadow-lift"><Pencil size={20} className="text-turf-700" />Editar informações, local e formato</Link>
            )}
            {allows('event.edit') && (
              <div className="rounded-2xl bg-white p-4 shadow-lift">
                <p className="font-semibold">Situação da pelada</p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Button variant="outline" disabled={e.status === 'finished'} loading={busy === 'finish'} onClick={() => run('finish', () => services.events.update(me.id, e.id, { status: 'finished' }), 'Pelada finalizada')}>Finalizar pelada</Button>
                  <Button variant="outline" disabled={e.status === 'cancelled'} loading={busy === 'cancel'} onClick={() => run('cancel', () => services.events.update(me.id, e.id, { status: 'cancelled' }), 'Pelada cancelada')}>Cancelar pelada</Button>
                </div>
              </div>
            )}
            <div className="rounded-2xl bg-white p-4 shadow-lift">
              <p className="font-semibold">Papéis</p>
              <ul className="mt-2 space-y-1.5 text-sm text-ink-muted">
                {(['owner', ...ASSIGNABLE_ROLES] as ParticipantRole[]).map((r) => <li key={r}><span className="font-semibold text-ink">{ROLE_LABEL[r]}:</span> {ROLE_HINT[r]}</li>)}
              </ul>
            </div>
            {allows('roles.assign') && (
              <button onClick={() => setShareOpen(true)} className="flex w-full items-center gap-3 rounded-2xl bg-white p-4 text-left font-semibold shadow-lift"><UserCog size={20} className="text-turf-700" />Compartilhar organização</button>
            )}
            {allows('event.delete') && (
              <button onClick={() => setDeleteOpen(true)} className="flex w-full items-center gap-3 rounded-2xl bg-whistle-soft p-4 font-semibold text-whistle"><Trash2 size={20} />Excluir pelada</button>
            )}
          </div>
        )}
      </div>

      <Sheet open={!!target} onClose={() => setTarget(null)} title={target?.user.name}>
        {target && (
          <div>
            {allows('roles.assign') && !target.user.isGuest && (
              <>
                <p className="mb-2 text-sm font-semibold text-ink-soft">Papel na pelada</p>
                <div className="space-y-2">
                  {ASSIGNABLE_ROLES.map((r) => (
                    <button
                      key={r}
                      disabled={!!busy}
                      onClick={async () => { if (await run('role', () => services.events.setRole(me.id, e.id, target.userId, r), `${target.user.name.split(' ')[0]} agora é ${ROLE_LABEL[r].toLowerCase()}`)) setTarget(null); }}
                      className={`flex w-full items-center justify-between rounded-2xl border-2 p-3 text-left ${target.role === r ? 'border-turf-600 bg-turf-600/5' : 'border-chalk-line'}`}
                    >
                      <span><span className="block font-semibold">{ROLE_LABEL[r]}</span><span className="text-sm text-ink-muted">{ROLE_HINT[r]}</span></span>
                      {target.role === r && <Check className="text-turf-700" />}
                    </button>
                  ))}
                </div>
              </>
            )}
            {allows('players.manage') && <Button variant="outline" block size="lg" className="mt-4 !text-whistle" onClick={() => setRemoveOpen(true)}>Remover da pelada</Button>}
          </div>
        )}
      </Sheet>

      <ConfirmDialog
        open={removeOpen}
        onClose={() => setRemoveOpen(false)}
        title="Remover jogador?"
        message={`${target?.user.name} sai da lista e dos times sorteados.`}
        confirmLabel="Remover"
        danger
        loading={busy === 'remove'}
        onConfirm={async () => { if (target && (await run('remove', () => services.events.removePlayer(me.id, e.id, target.userId), 'Jogador removido'))) { setRemoveOpen(false); setTarget(null); } }}
      />
      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Excluir pelada?"
        message="Lista, times e histórico de partidas serão apagados. Não dá para desfazer."
        confirmLabel="Excluir"
        danger
        loading={busy === 'delete'}
        onConfirm={async () => { if (await run('delete', () => services.events.remove(me.id, e.id), 'Pelada excluída')) navigate('/peladas?aba=minhas', { replace: true }); }}
      />
      <InviteSheet eventId={e.id} open={inviteOpen} onClose={() => setInviteOpen(false)} excludeIds={confirmed.map((p) => p.userId)} canAddDirectly={allows('players.manage')} onChanged={reload} />

      <Sheet open={shareOpen} onClose={() => setShareOpen(false)} title="Compartilhar organização">
        <p className="mb-3 text-sm text-ink-muted">A pessoa passa a editar a pelada, gerenciar jogadores e controlar partidas, mesmo que ainda não esteja na lista.</p>
        <UserSearch
          excludeIds={[...confirmed.filter((p) => p.role === 'owner' || p.role === 'organizer').map((p) => p.userId), me.id]}
          renderActions={(u: PublicUser) =>
            shared[u.id] ? (
              <span className="flex items-center gap-1 text-sm font-semibold text-turf-700"><Check size={16} />Organizador</span>
            ) : (
              <Button
                size="sm"
                variant="dark"
                loading={busy === `share-${u.id}`}
                onClick={async () => {
                  if (await run(`share-${u.id}`, () => services.events.addOrganizer(me.id, e.id, u.id), `${u.name.split(' ')[0]} agora é organizador`)) {
                    setShared((s) => ({ ...s, [u.id]: true }));
                  }
                }}
              >
                <UserCog size={15} />Tornar organizador
              </Button>
            )
          }
        />
      </Sheet>
    </div>
  );
}

function GamesTab({ eventId, canDraw, canManage, canControl, onDraw, onPlay }: { eventId: string; canDraw: boolean; canManage: boolean; canControl: boolean; onDraw(): void; onPlay(): void }) {
  const teams = useAsync(() => services.games.getTeams(eventId), [eventId]);
  const games = useAsync(() => services.games.listGames(eventId), [eventId]);
  const participants = useAsync(() => services.events.getParticipants(eventId), [eventId]);
  const byId = (tid: string) => teams.data?.find((t) => t.id === tid);
  const finished = (games.data ?? []).filter((g) => g.status === 'finished');

  if (teams.loading || games.loading) return <Skeleton className="h-64" />;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-2">
        {canDraw && <Button size="lg" variant={teams.data?.length ? 'outline' : 'primary'} onClick={onDraw}><Shuffle size={20} />{teams.data?.length ? 'Novo sorteio' : 'Sortear times'}</Button>}
        {canControl && !!teams.data?.length && <Button size="lg" onClick={onPlay}><Play size={20} />Ir para partida</Button>}
      </div>

      {teams.data?.length ? (
        <TeamsPanel
          teams={teams.data}
          confirmed={(participants.data ?? []).filter((p) => p.status === 'confirmed')}
          canEdit={canDraw}
          canManageRoster={canManage}
          onChanged={teams.reload}
        />
      ) : (
        <EmptyState icon={<Shuffle />} title="Times ainda não sorteados" description="Sorteie com os confirmados ou monte na mão." />
      )}

      <section>
        <h3 className="mb-2 flex items-center gap-2 font-display text-xl font-bold"><History size={20} />Histórico</h3>
        {finished.length ? (
          <div className="divide-y divide-chalk-line rounded-3xl bg-white px-4 shadow-lift">
            {finished.map((g) => (
              <div key={g.id} className="flex items-center justify-between py-3">
                <span className="text-sm text-ink-muted">Partida {g.round}</span>
                <span className="flex items-center gap-2 font-semibold">
                  <span className={g.winnerTeamId === g.teamAId ? '' : 'text-ink-muted'}>{byId(g.teamAId)?.name.replace('Time ', '') ?? 'A'}</span>
                  <span className="font-display text-2xl font-extrabold tabular">{g.scoreA} × {g.scoreB}</span>
                  <span className={g.winnerTeamId === g.teamBId ? '' : 'text-ink-muted'}>{byId(g.teamBId)?.name.replace('Time ', '') ?? 'B'}</span>
                </span>
                <span className="text-xs text-ink-muted">{formatClock(g.timer.accumulatedMs)}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-2xl bg-white p-4 text-sm text-ink-muted shadow-lift">As partidas finalizadas aparecem aqui com placar e duração.</p>
        )}
      </section>
    </div>
  );
}
