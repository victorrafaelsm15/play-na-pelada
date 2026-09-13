import clsx from 'clsx';
export function LogoMark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} aria-hidden>
      <rect width="64" height="64" rx="16" fill="#0F3D30" />
      <circle cx="32" cy="32" r="19" fill="none" stroke="#F2F4F1" strokeWidth="3.5" />
      <rect x="30.25" y="5" width="3.5" height="54" fill="#F2F4F1" />
      <circle cx="32" cy="32" r="7" fill="#FFC72C" />
    </svg>
  );
}
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={clsx('flex items-center gap-2', className)}>
      <LogoMark size={30} />
      <span className="font-display text-[26px] font-extrabold leading-none tracking-tight">Racha</span>
    </span>
  );
}
