import { useMemo } from 'react';
import { services } from '@/services';
import { useAsync } from '@/hooks/useAsync';
import { useMe } from '@/stores/session';
import { can, type Permission } from '@/domain/permissions';

/** Carrega pelada + participantes e expõe o papel do usuário atual. */
export function useEvent(eventId: string) {
  const me = useMe();
  const event = useAsync(() => services.events.getById(eventId, me.id), [eventId, me.id]);
  const participants = useAsync(() => services.events.getParticipants(eventId), [eventId]);

  const derived = useMemo(() => {
    const list = participants.data ?? [];
    const mine = list.find((p) => p.userId === me.id);
    const role = mine?.status === 'confirmed' ? mine.role : undefined;
    return {
      mine,
      role,
      confirmed: list.filter((p) => p.status === 'confirmed'),
      pending: list.filter((p) => p.status === 'pending'),
      invited: list.filter((p) => p.status === 'invited'),
      allows: (perm: Permission) => can(role, perm)
    };
  }, [participants.data, me.id]);

  const reload = () => {
    event.reload();
    participants.reload();
  };

  return { me, event, participants, reload, ...derived };
}
