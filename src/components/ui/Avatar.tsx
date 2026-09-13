import clsx from 'clsx';
import { initials } from '@/lib/format';

const tones = ['bg-turf-600 text-chalk', 'bg-card text-card-ink', 'bg-ink text-chalk', 'bg-turf-900 text-card', 'bg-chalk-line text-ink'];

export function Avatar({ name, src, size = 40, className, ring }: { name: string; src?: string; size?: number; className?: string; ring?: boolean }) {
  const tone = tones[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % tones.length];
  return (
    <span
      className={clsx('inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-display font-bold', tone, ring && 'ring-2 ring-white', className)}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
      aria-hidden={!src}
    >
      {src ? <img src={src} alt={name} className="h-full w-full object-cover" /> : initials(name)}
    </span>
  );
}

export function AvatarStack({ people, max = 4, size = 28 }: { people: { name: string; avatarUrl?: string }[]; max?: number; size?: number }) {
  const shown = people.slice(0, max);
  return (
    <div className="flex -space-x-2">
      {shown.map((p, i) => <Avatar key={i} name={p.name} src={p.avatarUrl} size={size} ring />)}
      {people.length > max && (
        <span className="inline-flex items-center justify-center rounded-full bg-chalk-soft text-xs font-bold text-ink-soft ring-2 ring-white" style={{ width: size, height: size }}>
          +{people.length - max}
        </span>
      )}
    </div>
  );
}
