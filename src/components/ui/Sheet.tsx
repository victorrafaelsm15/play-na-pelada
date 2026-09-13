import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import clsx from 'clsx';
import { Button } from './Button';

interface SheetProps { open: boolean; onClose(): void; title?: string; children: ReactNode; footer?: ReactNode; className?: string }

/** Painel inferior no celular, diálogo centralizado no desktop. */
export function Sheet({ open, onClose, title, children, footer, className }: SheetProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <button className="absolute inset-0 bg-turf-950/55 backdrop-blur-[2px]" onClick={onClose} aria-label="Fechar" />
      <div className={clsx('relative flex max-h-[90dvh] w-full flex-col rounded-t-3xl bg-white pb-safe shadow-2xl animate-rise sm:max-w-md sm:rounded-3xl', className)}>
        <div className="mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-chalk-line sm:hidden" />
        {title && (
          <div className="flex items-center justify-between px-5 pb-2 pt-3">
            <h2 className="font-display text-2xl font-bold">{title}</h2>
            <button onClick={onClose} className="-mr-2 rounded-full p-2 text-ink-muted hover:bg-chalk" aria-label="Fechar"><X size={20} /></button>
          </div>
        )}
        <div className="overflow-y-auto px-5 pb-5">{children}</div>
        {footer && <div className="border-t border-chalk-line px-5 py-4">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}

interface ConfirmProps {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm(): void;
  onClose(): void;
}

export function ConfirmDialog({ open, title, message, confirmLabel, danger, loading, onConfirm, onClose }: ConfirmProps) {
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <p className="text-ink-soft">{message}</p>
      <div className="mt-6 grid grid-cols-2 gap-3">
        <Button variant="outline" size="lg" onClick={onClose}>Voltar</Button>
        <Button variant={danger ? 'danger' : 'dark'} size="lg" loading={loading} onClick={onConfirm}>{confirmLabel}</Button>
      </div>
    </Sheet>
  );
}
