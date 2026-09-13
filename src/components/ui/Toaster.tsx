import { CheckCircle2, Info, XCircle } from 'lucide-react';
import clsx from 'clsx';
import { useToasts } from '@/stores/toast';

export function Toaster() {
  const toasts = useToasts((s) => s.toasts);
  const dismiss = useToasts((s) => s.dismiss);
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex flex-col items-center gap-2 px-4 pt-[max(1rem,env(safe-area-inset-top))]" aria-live="polite">
      {toasts.map((t) => (
        <button
          key={t.id}
          onClick={() => dismiss(t.id)}
          className={clsx('pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-2xl px-4 py-3 text-left text-[15px] font-semibold shadow-xl animate-rise', t.kind === 'error' ? 'bg-whistle text-white' : 'bg-turf-900 text-chalk')}
        >
          {t.kind === 'success' && <CheckCircle2 size={20} className="shrink-0 text-card" />}
          {t.kind === 'error' && <XCircle size={20} className="shrink-0" />}
          {t.kind === 'info' && <Info size={20} className="shrink-0 text-card" />}
          {t.message}
        </button>
      ))}
    </div>
  );
}
