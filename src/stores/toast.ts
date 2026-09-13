import { create } from 'zustand';
import { uid } from '@/lib/id';

export type ToastKind = 'success' | 'error' | 'info';
export interface Toast { id: string; kind: ToastKind; message: string }

interface ToastState {
  toasts: Toast[];
  push(kind: ToastKind, message: string): void;
  dismiss(id: string): void;
}

export const useToasts = create<ToastState>((set) => ({
  toasts: [],
  push(kind, message) {
    const id = uid('t');
    set((s) => ({ toasts: [...s.toasts.slice(-2), { id, kind, message }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 3200);
  },
  dismiss(id) {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  }
}));

export const toast = {
  success: (m: string) => useToasts.getState().push('success', m),
  error: (m: string) => useToasts.getState().push('error', m),
  info: (m: string) => useToasts.getState().push('info', m)
};
