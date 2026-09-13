import { create } from 'zustand';

/** Contador de invalidação simples: telas recarregam quando a "chave" muda. */
type Key = 'notifications' | 'events' | 'friends' | 'invites';
interface RefreshState { ticks: Record<Key, number>; invalidate(...keys: Key[]): void }

export const useRefresh = create<RefreshState>((set) => ({
  ticks: { notifications: 0, events: 0, friends: 0, invites: 0 },
  invalidate: (...keys) => set((s) => ({ ticks: { ...s.ticks, ...Object.fromEntries(keys.map((k) => [k, s.ticks[k] + 1])) } }))
}));

export const invalidate = (...keys: Key[]) => useRefresh.getState().invalidate(...keys);
