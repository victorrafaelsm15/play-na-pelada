import { create } from 'zustand';
import type { User } from '@/types';
import { services, type RegisterInput } from '@/services';

type Status = 'loading' | 'guest' | 'authed';

interface SessionState {
  status: Status;
  user: User | null;
  init(): Promise<void>;
  login(identifier: string, password: string, remember: boolean): Promise<void>;
  register(input: RegisterInput): Promise<void>;
  logout(): Promise<void>;
  refreshUser(): Promise<void>;
  setUser(user: User): void;
}

export const useSession = create<SessionState>((set, get) => ({
  status: 'loading',
  user: null,
  async init() {
    const session = await services.auth.getSession();
    if (!session) return set({ status: 'guest', user: null });
    const user = await services.users.getMe(session.userId);
    set({ status: 'authed', user });
  },
  async login(identifier, password, remember) {
    const s = await services.auth.login(identifier, password, remember);
    set({ status: 'authed', user: await services.users.getMe(s.userId) });
  },
  async register(input) {
    const s = await services.auth.register(input);
    set({ status: 'authed', user: await services.users.getMe(s.userId) });
  },
  async logout() {
    await services.auth.logout();
    set({ status: 'guest', user: null });
  },
  async refreshUser() {
    const u = get().user;
    if (u) set({ user: await services.users.getMe(u.id) });
  },
  setUser(user) {
    set({ user });
  }
}));

/** Usuário autenticado (usar apenas dentro de rotas protegidas). */
export function useMe(): User {
  const user = useSession((s) => s.user);
  if (!user) throw new Error('useMe fora de rota autenticada');
  return user;
}
