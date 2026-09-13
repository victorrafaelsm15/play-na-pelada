import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CalendarDays, Clock, Coins, Lock, Play, Settings2, Share2, Shuffle, UserPlus, Users } from 'lucide-react';
import { errorMessage, services } from '@/services';
import { invalidate } from '@/stores/refresh';
import { toast } from '@/stores/toast';
import { useEvent } from '@/features/pelada/useEvent';
import { InviteSheet } from '@/features/pelada/InviteSheet';
import { ROLE_LABEL, canManage } from '@/domain/permissions';
import { ROTATION_LABEL } from '@/domain/rotation';
import { formatDay, formatMoney, STATUS_LABEL } from '@/lib/format';
import { PageHeader } from '@/components/app/PageHeader';
import { MapPreview } from '@/components/app/MapPreview';
import { PlayerRow } from '@/components/app/PlayerRow';
import { statusTone } from '@/components/app/EventCard';
import { Button } from '@/components/ui/Button';
import { Badge, EmptyState, ErrorState, Skeleton } from '@/components/ui/States';
import { ConfirmDialog } from '@/components/ui/Sheet';
import { useAsync } from '@/hooks/useAsync';

export default function EventDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { me, event, participants, confirmed, pending, mine, role, allows, reload } = useEvent(id);
  const teams = useAsync(() => services.games.getTeams(id), [id]);
  const [busy, setBusy] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);

  if (event.loading && !event.data) {
    return <div className="space-y-4 pt-4"><Skeleton className="h-48 rounded-[28px]" /><Skeleton className="h-24" /><Skeleton className="h-64" /></div>;
  }
  if (event.error || !event.data) {
    return <div><PageHeader title="Pelada" back /><ErrorState message={event.error ?? 'Pelada não encontrada.'} onRetry={event.reload} /></div>;
  }

  const e = event.data;
  const spots = Math.max(0, e.maxPlayers - e.confirmedCount);
  const manager = canManage(role);
  const hasTeams = (teams.data?.length ?? 0) >= 2;

  const run = async (fn: () => Promise<unknown>, success: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(success);
      invalidate('events', 'invites', 'notifications');
      reload();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const share = async () => {
    const url = `${location.origin}/peladas/${e.id}`;
    const text = `${e.name}: ${formatDay(e.date)}, ${e.time}, ${e.location.name}`;
    if (navigator.share) await navigator.share({ title: e.name, text, url }).catch(() => undefined);
    else {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      toast.success('Link copiado');
    }
  };

  const invitation = mine?.status === 'invited';
  const primaryAction = () => {
    if (manager) return null;
    if (mine?.status === 'confirmed') return <Button variant="outline" size="lg" block onClick={() => setLeaveOpen(true)}>Sair da lista</Button>;
    if (mine?.status === 'pending') return <div className="rounded-2xl bg-card/25 p-3 text-center font-semibold text-card-ink">Pedido enviado. Aguardando o organizador.</div>;
    if (spots === 0) return <div className="rounded-2xl bg-chalk-soft p-3 text-center font-semibold text-ink-muted">Lista completa</div>;
    if (invitation)
      return (
        <Button size="lg" block loading={busy} onClick={async () => {
          const inv = (await services.events.listInvitations(me.id)).find((i) => i.eventId === e.id);
          if (inv) run(() => services.events.respondInvitation(me.id, inv.id, true), 'Presença confirmada');
          else run(() => services.events.join(e.id, me.id), 'Presença confirmada');
        }}>Aceitar convite</Button>
      );
    return (
      <Button size="lg" block loading={busy} variant={e.joinPolicy === 'auto' ? 'primary' : 'dark'} onClick={() => run(() => services.events.join(e.id, me.id), e.joinPolicy === 'auto' ? 'Você está na lista' : 'Pedido enviado')}>
        {e.joinPolicy === 'auto' ? 'Participar' : 'Solicitar participação'}
      </Button>
    );
  };

  return (
    <div>
      <PageHeader title="" back actions={<button onClick={share} className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-ink/5" aria-label="Compartilhar"><Share2 size={20} /></button>} className="pb-1" />

      <section className="pitch-lines rounded-[28px] bg-turf-800 p-5 text-chalk">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={statusTone(e.status)} className={e.status === 'confirmed' ? '!bg-chalk/15 !text-chalk' : ''}>{STATUS_LABEL[e.status]}</Badge>
          {e.privacy === 'private' && <Badge className="!bg-chalk/15 !text-chalk"><Lock size={12} />Privada</Badge>}
          {role && <Badge tone="card" className="!bg-card !text-card-ink">{ROLE_LABEL[role]}</Badge>}
        </div>
        <h1 className="mt-3 font-display text-[40px] font-extrabold leading-[.95]">{e.name}</h1>
        <Link to={`/jogador/${e.organizer.username}`} className="mt-2 inline-block text-chalk/80">Organizada por <span className="font-semibold text-chalk">{e.organizer.name}</span></Link>
        <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 text-[15px]">
          <span className="flex items-center gap-2"><CalendarDays size={18} className="text-card" />{formatDay(e.date)}</span>
          <span className="flex items-center gap-2"><Clock size={18} className="text-card" />{e.time}</span>
          <span className="flex items-center gap-2"><Users size={18} className="text-card" />{e.confirmedCount}/{e.maxPlayers}{spots > 0 ? `, ${spots} ${spots === 1 ? 'vaga' : 'vagas'}` : ''}</span>
          <span className="flex items-center gap-2"><Coins size={18} className="text-card" />{formatMoney(e.priceCents)}</span>
        </div>
      </section>

      <div className="mt-4 space-y-2">
        {primaryAction()}
        {manager && (
          <div className="grid grid-cols-2 gap-2">
            {allows('games.control') && hasTeams ? (
              <Button size="lg" onClick={() => navigate(`/peladas/${e.id}/partida`)}><Play size={20} />{e.status === 'live' ? 'Voltar à partida' : 'Ir para partida'}</Button>
            ) : allows('teams.draw') ? (
              <Button size="lg" onClick={() => navigate(`/peladas/${e.id}/sorteio`)} disabled={confirmed.length < e.playersPerTeam * 2 && confirmed.length < 4}><Shuffle size={20} />Sortear times</Button>
            ) : null}
            <Button size="lg" variant="dark" onClick={() => navigate(`/peladas/${e.id}/gerenciar`)} className="relative">
              <Settings2 size={20} />Gerenciar
              {pending.length > 0 && allows('requests.review') && <span className="absolute -right-1 -top-1 rounded-full bg-whistle px-2 text-xs text-white">{pending.length}</span>}
            </Button>
          </div>
        )}
      </div>

      <section className="mt-6 rounded-3xl bg-white p-4 shadow-lift">
        <h2 className="font-display text-2xl font-bold">Como vai ser</h2>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          {[
            [e.teamsCount, 'times'],
            [e.playersPerTeam, 'por time'],
            [`${e.matchDurationMin}′`, 'por partida']
          ].map(([v, l]) => (
            <div key={l} className="rounded-2xl bg-chalk py-3"><p className="font-display text-3xl font-extrabold leading-none">{v}</p><p className="mt-1 text-xs font-medium text-ink-muted">{l}</p></div>
          ))}
        </div>
        <p className="mt-3 text-sm text-ink-muted"><span className="font-semibold text-ink">{ROTATION_LABEL[e.rotationRule].title}.</span> {ROTATION_LABEL[e.rotationRule].hint}</p>
        {e.description && <p className="mt-3 leading-relaxed text-ink-soft">{e.description}</p>}
        {e.notes && <p className="mt-3 rounded-xl bg-card/20 px-3 py-2 text-sm text-card-ink">{e.notes}</p>}
      </section>

      <section className="mt-4">
        <MapPreview location={e.location} />
      </section>

      <section className="mt-6">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-display text-2xl font-bold">Jogadores <span className="text-ink-muted">{confirmed.length}</span></h2>
          {allows('invites.send') && <Button size="sm" variant="outline" onClick={() => setInviteOpen(true)}><UserPlus size={16} />Chamar</Button>}
        </div>
        <div className="rounded-3xl bg-white px-4 shadow-lift">
          {participants.loading ? (
            <div className="space-y-3 py-4">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : confirmed.length ? (
            <div className="divide-y divide-chalk-line">
              {confirmed.map((p) => (
                <PlayerRow key={p.userId} user={p.user} actions={p.role !== 'player' ? <Badge tone={p.role === 'owner' ? 'dark' : 'turf'}>{ROLE_LABEL[p.role]}</Badge> : p.userId === me.id ? <Badge>Você</Badge> : undefined} />
              ))}
            </div>
          ) : (
            <EmptyState className="my-4 border-0" title="Lista vazia" description="Chame os amigos para começar." />
          )}
        </div>
      </section>

      <InviteSheet eventId={e.id} open={inviteOpen} onClose={() => setInviteOpen(false)} excludeIds={(participants.data ?? []).filter((p) => p.status === 'confirmed').map((p) => p.userId)} canAddDirectly={allows('players.manage')} onChanged={reload} />
      <ConfirmDialog open={leaveOpen} onClose={() => setLeaveOpen(false)} title="Sair da lista?" message="Sua vaga fica livre para outro jogador." confirmLabel="Sair" danger loading={busy} onConfirm={() => run(() => services.events.leave(e.id, me.id), 'Você saiu da lista').then(() => setLeaveOpen(false))} />
    </div>
  );
}
