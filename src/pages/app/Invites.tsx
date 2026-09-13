import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, CalendarClock, CheckCircle2, Mail, Pencil, UserPlus, Users } from 'lucide-react';
import type { NotificationType } from '@/types';
import { useMe } from '@/stores/session';
import { errorMessage, services } from '@/services';
import { useAsync } from '@/hooks/useAsync';
import { invalidate, useRefresh } from '@/stores/refresh';
import { toast } from '@/stores/toast';
import { formatDay, timeAgo } from '@/lib/format';
import { PageHeader } from '@/components/app/PageHeader';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States';

const ICON: Record<NotificationType, typeof Bell> = {
  event_invite: Mail, join_request: UserPlus, join_approved: CheckCircle2, event_updated: Pencil,
  game_soon: CalendarClock, added_to_event: Users, friend_request: UserPlus, friend_accepted: Users
};

export default function Invites() {
  const me = useMe();
  const navigate = useNavigate();
  const tick = useRefresh((s) => s.ticks.invites);
  const invites = useAsync(() => services.events.listInvitations(me.id), [me.id, tick]);
  const notes = useAsync(() => services.notifications.list(me.id), [me.id, tick]);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    // Marca como lidas ao sair da tela, para o destaque aparecer nesta visita.
    return () => {
      services.notifications.markAllRead(me.id).then(() => invalidate('notifications'));
    };
  }, [me.id]);

  const respond = async (invId: string, eventId: string, accept: boolean) => {
    setBusy(invId + accept);
    try {
      await services.events.respondInvitation(me.id, invId, accept);
      toast.success(accept ? 'Presença confirmada' : 'Convite recusado');
      invalidate('invites', 'events', 'notifications');
      if (accept) navigate(`/peladas/${eventId}`);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <PageHeader title="Convites" back />

      <section>
        {invites.loading ? <Skeleton className="h-36 rounded-3xl" /> : invites.error ? <ErrorState message={invites.error} onRetry={invites.reload} /> : invites.data?.length ? (
          <div className="space-y-3">
            {invites.data.map((inv) => (
              <article key={inv.id} className="overflow-hidden rounded-3xl bg-white shadow-lift">
                <Link to={`/peladas/${inv.eventId}`} className="block bg-turf-800 p-4 text-chalk">
                  <p className="flex items-center gap-2 text-sm text-chalk/75"><Avatar name={inv.sender.name} src={inv.sender.avatarUrl} size={22} />{inv.sender.name} convidou você</p>
                  <p className="mt-2 font-display text-3xl font-extrabold leading-none">{inv.event.name}</p>
                  <p className="mt-1.5 text-chalk/80">{formatDay(inv.event.date)}, {inv.event.time}. {inv.event.location.name}</p>
                  <p className="text-sm text-chalk/60">{inv.event.confirmedCount}/{inv.event.maxPlayers} confirmados</p>
                </Link>
                <div className="grid grid-cols-2 gap-2 p-3">
                  <Button variant="outline" size="lg" loading={busy === inv.id + false} onClick={() => respond(inv.id, inv.eventId, false)}>Recusar</Button>
                  <Button size="lg" loading={busy === inv.id + true} onClick={() => respond(inv.id, inv.eventId, true)}>Confirmar presença</Button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState icon={<Mail />} title="Nenhum convite pendente" description="Quando alguém chamar você para uma pelada, aparece aqui." />
        )}
      </section>

      <section className="mt-8">
        <h2 className="mb-2 font-display text-2xl font-bold">Notificações</h2>
        {notes.loading ? (
          <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16" />)}</div>
        ) : notes.data?.length ? (
          <ul className="divide-y divide-chalk-line rounded-3xl bg-white shadow-lift">
            {notes.data.map((n) => {
              const Icon = ICON[n.type];
              const body = (
                <div className="flex gap-3 px-4 py-3.5">
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${n.read ? 'bg-chalk text-ink-muted' : 'bg-card text-card-ink'}`}><Icon size={18} /></span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{n.title}</p>
                    <p className="text-sm text-ink-soft">{n.body}</p>
                    <p className="mt-0.5 text-xs text-ink-muted">{timeAgo(n.createdAt)}</p>
                  </div>
                  {!n.read && <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-whistle" aria-label="Não lida" />}
                </div>
              );
              return <li key={n.id}>{n.link && n.link !== '/convites' ? <Link to={n.link}>{body}</Link> : body}</li>;
            })}
          </ul>
        ) : (
          <EmptyState icon={<Bell />} title="Tudo em dia" description="Pedidos, aprovações e mudanças nas suas peladas aparecem aqui." />
        )}
      </section>
    </div>
  );
}
