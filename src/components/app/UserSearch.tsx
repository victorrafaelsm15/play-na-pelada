import { useState, type ReactNode } from 'react';
import { Search } from 'lucide-react';
import type { PublicUser } from '@/types';
import { services } from '@/services';
import { useAsync } from '@/hooks/useAsync';
import { useDebounced } from '@/hooks/useDebounced';
import { Input } from '@/components/ui/Field';
import { Skeleton } from '@/components/ui/States';
import { PlayerRow } from './PlayerRow';

/** Busca de usuários por nome, @usuário ou ID numérico. */
export function UserSearch({ excludeIds = [], renderActions, placeholder = 'Nome, @usuário ou ID' }: { excludeIds?: string[]; renderActions(user: PublicUser): ReactNode; placeholder?: string }) {
  const [q, setQ] = useState('');
  const dq = useDebounced(q.trim());
  const res = useAsync(() => (dq.length >= 2 ? services.users.search(dq, excludeIds) : Promise.resolve([])), [dq, excludeIds.join()]);

  return (
    <div>
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} leading={<Search size={18} />} autoComplete="off" aria-label="Buscar jogadores" />
      <div className="mt-2">
        {dq.length < 2 ? (
          <p className="py-4 text-center text-sm text-ink-muted">Digite ao menos 2 caracteres para buscar.</p>
        ) : res.loading ? (
          <div className="space-y-3 py-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : res.data?.length ? (
          <div className="divide-y divide-chalk-line">{res.data.map((u) => <PlayerRow key={u.id} user={u} link={false} actions={renderActions(u)} />)}</div>
        ) : (
          <p className="py-4 text-center text-sm text-ink-muted">Nenhum jogador encontrado para “{dq}”.</p>
        )}
      </div>
    </div>
  );
}
