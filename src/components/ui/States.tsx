import type { ReactNode } from 'react';
import clsx from 'clsx';
import { AlertTriangle } from 'lucide-react';
import { Button } from './Button';

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx('animate-pulse rounded-xl bg-ink/[.07]', className)} />;
}

export function EmptyState({ icon, title, description, action, className }: { icon?: ReactNode; title: string; description?: string; action?: ReactNode; className?: string }) {
  return (
    <div className={clsx('flex flex-col items-center rounded-3xl border-2 border-dashed border-chalk-line px-6 py-10 text-center', className)}>
      {icon && <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-white text-turf-700 shadow-lift">{icon}</div>}
      <h3 className="font-display text-xl font-bold">{title}</h3>
      {description && <p className="mt-1 max-w-xs text-sm text-ink-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center rounded-3xl bg-whistle-soft px-6 py-8 text-center">
      <AlertTriangle className="text-whistle" />
      <p className="mt-2 font-semibold text-ink">{message}</p>
      {onRetry && <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>Tentar de novo</Button>}
    </div>
  );
}

export function Badge({ children, tone = 'neutral', className }: { children: ReactNode; tone?: 'neutral' | 'turf' | 'card' | 'whistle' | 'dark'; className?: string }) {
  const tones = {
    neutral: 'bg-chalk-soft text-ink-soft',
    turf: 'bg-turf-600/12 text-turf-700',
    card: 'bg-card/30 text-card-ink',
    whistle: 'bg-whistle-soft text-whistle',
    dark: 'bg-turf-900 text-chalk'
  };
  return <span className={clsx('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold', tones[tone], className)}>{children}</span>;
}
