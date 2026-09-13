import type { ReactNode } from 'react';
import { ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';

export function PageHeader({ title, subtitle, back, actions, dark, className }: { title: string; subtitle?: string; back?: boolean | string; actions?: ReactNode; dark?: boolean; className?: string }) {
  const navigate = useNavigate();
  return (
    <header className={clsx('flex items-center gap-2 pb-4 pt-2', className)}>
      {back && (
        <button
          onClick={() => (typeof back === 'string' ? navigate(back) : window.history.length > 1 ? navigate(-1) : navigate('/inicio'))}
          className={clsx('-ml-2 flex h-11 w-11 items-center justify-center rounded-full', dark ? 'text-chalk hover:bg-white/10' : 'hover:bg-ink/5')}
          aria-label="Voltar"
        >
          <ChevronLeft size={26} />
        </button>
      )}
      <div className="min-w-0 flex-1">
        <h1 className={clsx('truncate font-display text-[30px] font-bold leading-tight', dark && 'text-chalk')}>{title}</h1>
        {subtitle && <p className={clsx('truncate text-sm', dark ? 'text-chalk/70' : 'text-ink-muted')}>{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-1">{actions}</div>}
    </header>
  );
}
