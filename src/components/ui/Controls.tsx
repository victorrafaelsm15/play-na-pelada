import clsx from 'clsx';
import { Minus, Plus } from 'lucide-react';

export function Segmented<T extends string>({ value, options, onChange, className, dark }: { value: T; options: { value: NoInfer<T>; label: string; count?: number }[]; onChange(v: NoInfer<T>): void; className?: string; dark?: boolean }) {
  return (
    <div role="tablist" className={clsx('flex gap-1 rounded-2xl p-1', dark ? 'bg-white/10' : 'bg-ink/[.06]', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={clsx(
            'flex h-10 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-3 text-sm font-semibold transition',
            value === o.value ? (dark ? 'bg-chalk text-turf-900' : 'bg-white text-ink shadow-sm') : dark ? 'text-chalk/70' : 'text-ink-muted'
          )}
        >
          {o.label}
          {!!o.count && <span className={clsx('rounded-full px-1.5 text-xs', value === o.value ? 'bg-card text-card-ink' : 'bg-ink/10')}>{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Stepper({ label, value, onChange, min = 0, max = 99, step = 1, suffix }: { label: string; value: number; onChange(v: number): void; min?: number; max?: number; step?: number; suffix?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <span className="text-[15px] font-medium text-ink-soft">{label}</span>
      <div className="flex items-center gap-1 rounded-xl bg-chalk p-1">
        <button type="button" aria-label={`Diminuir ${label}`} disabled={value <= min} onClick={() => onChange(Math.max(min, value - step))} className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-ink disabled:opacity-40"><Minus size={18} /></button>
        <span className="min-w-[3.5rem] text-center font-display text-2xl font-bold tabular">{value}{suffix && <span className="ml-0.5 text-sm font-semibold text-ink-muted">{suffix}</span>}</span>
        <button type="button" aria-label={`Aumentar ${label}`} disabled={value >= max} onClick={() => onChange(Math.min(max, value + step))} className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-ink disabled:opacity-40"><Plus size={18} /></button>
      </div>
    </div>
  );
}

export function Switch({ checked, onChange, label, description }: { checked: boolean; onChange(v: boolean): void; label: string; description?: string }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 py-2">
      <span>
        <span className="block text-[15px] font-medium">{label}</span>
        {description && <span className="block text-sm text-ink-muted">{description}</span>}
      </span>
      <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className={clsx('relative h-7 w-12 shrink-0 rounded-full transition', checked ? 'bg-turf-600' : 'bg-ink/20')}>
        <span className={clsx('absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all', checked ? 'left-6' : 'left-1')} />
      </button>
    </label>
  );
}

export function ChoiceCards<T extends string>({ value, onChange, options }: { value: T; onChange(v: T): void; options: { value: T; title: string; description: string; icon?: React.ReactNode }[] }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {options.map((o) => (
        <button
          type="button"
          key={o.value}
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={clsx('flex gap-3 rounded-2xl border-2 p-3.5 text-left transition', value === o.value ? 'border-turf-600 bg-turf-600/[.06]' : 'border-chalk-line bg-white')}
        >
          {o.icon && <span className={clsx('mt-0.5', value === o.value ? 'text-turf-700' : 'text-ink-muted')}>{o.icon}</span>}
          <span>
            <span className="block font-semibold">{o.title}</span>
            <span className="block text-sm text-ink-muted">{o.description}</span>
          </span>
        </button>
      ))}
    </div>
  );
}
