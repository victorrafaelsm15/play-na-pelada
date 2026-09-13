import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { PublicUser } from '@/types';
import { Avatar } from '@/components/ui/Avatar';
import { POSITION_LABEL } from '@/lib/format';

export function PlayerRow({ user, meta, actions, link = true }: { user: PublicUser; meta?: ReactNode; actions?: ReactNode; link?: boolean }) {
  const body = (
    <>
      <Avatar name={user.name} src={user.avatarUrl} size={44} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{user.name}</p>
        <p className="truncate text-sm text-ink-muted">@{user.username} <span className="text-ink-muted/60">ID {user.publicId}</span>{user.position ? `, ${POSITION_LABEL[user.position]}` : ''}</p>
        {meta}
      </div>
    </>
  );
  return (
    <div className="flex items-center gap-3 py-2.5">
      {link ? <Link to={`/jogador/${user.username}`} className="flex min-w-0 flex-1 items-center gap-3">{body}</Link> : <div className="flex min-w-0 flex-1 items-center gap-3">{body}</div>}
      {actions && <div className="flex shrink-0 items-center gap-1.5">{actions}</div>}
    </div>
  );
}
