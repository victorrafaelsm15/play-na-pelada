import { Link } from 'react-router-dom';
import { Clock, Lock, MapPin, Users } from 'lucide-react';
import clsx from 'clsx';
import type { EventSummary } from '@/services';
import { dateParts, formatDay, formatMoney, STATUS_LABEL } from '@/lib/format';
import { Badge } from '@/components/ui/States';
import type { ReactNode } from 'react';

export function statusTone(status: EventSummary['status']) {
  return status === 'live' ? 'whistle' : status === 'confirmed' ? 'turf' : status === 'finished' ? 'neutral' : 'card';
}

/** Card de pelada: data em "bloco de ingresso" à esquerda, informação à direita. */
export function EventCard({ event, action, compact }: { event: EventSummary; action?: ReactNode; compact?: boolean }) {
  const { day, month } = dateParts(event.date);
  const spots = Math.max(0, event.maxPlayers - event.confirmedCount);
  const pct = Math.min(100, (event.confirmedCount / event.maxPlayers) * 100);
  return (
    <article className="overflow-hidden rounded-3xl bg-white shadow-lift">
      <Link to={`/peladas/${event.id}`} className="flex gap-4 p-4">
        <div className={clsx('flex w-14 shrink-0 flex-col items-center justify-center rounded-2xl py-2', event.status === 'live' ? 'bg-whistle text-white' : 'bg-turf-800 text-chalk')}>
          <span className="font-display text-[28px] font-extrabold leading-none">{day}</span>
          <span className="text-xs font-semibold">{month}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="truncate font-display text-[22px] font-bold leading-tight">{event.name}</h3>
            {event.privacy === 'private' && <Lock size={15} className="mt-1.5 shrink-0 text-ink-muted" aria-label="Privada" />}
          </div>
          <p className="mt-0.5 flex items-center gap-1.5 text-sm text-ink-muted"><Clock size={14} />{formatDay(event.date)}, {event.time}</p>
          <p className="flex items-center gap-1.5 truncate text-sm text-ink-muted"><MapPin size={14} className="shrink-0" /><span className="truncate">{event.location.name}</span></p>
          {!compact && (
            <div className="mt-3">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1.5 font-semibold"><Users size={15} />{event.confirmedCount}/{event.maxPlayers}</span>
                <span className={clsx('font-semibold', spots === 0 ? 'text-whistle' : 'text-turf-700')}>{spots === 0 ? 'Lista completa' : `${spots} ${spots === 1 ? 'vaga' : 'vagas'}`}</span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-chalk-soft"><div className={clsx('h-full rounded-full', spots === 0 ? 'bg-whistle' : 'bg-turf-600')} style={{ width: `${pct}%` }} /></div>
            </div>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge tone={statusTone(event.status)}>{event.status === 'live' && <span className="h-1.5 w-1.5 rounded-full bg-whistle animate-flash" />}{STATUS_LABEL[event.status]}</Badge>
            {!compact && <Badge>{formatMoney(event.priceCents)}</Badge>}
            {!compact && <span className="text-xs text-ink-muted">por {event.organizer.name.split(' ')[0]}</span>}
          </div>
        </div>
      </Link>
      {action && <div className="border-t border-chalk-line px-4 py-3">{action}</div>}
    </article>
  );
}

export function EventCardSkeleton() {
  return (
    <div className="flex gap-4 rounded-3xl bg-white p-4 shadow-lift">
      <div className="h-[72px] w-14 animate-pulse rounded-2xl bg-ink/[.07]" />
      <div className="flex-1 space-y-2">
        <div className="h-6 w-2/3 animate-pulse rounded-lg bg-ink/[.07]" />
        <div className="h-4 w-1/2 animate-pulse rounded-lg bg-ink/[.07]" />
        <div className="h-4 w-3/4 animate-pulse rounded-lg bg-ink/[.07]" />
      </div>
    </div>
  );
}
