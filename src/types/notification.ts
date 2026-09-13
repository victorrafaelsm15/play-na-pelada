import type { UserId } from './user';

export type NotificationType =
  | 'event_invite'
  | 'join_request'
  | 'join_approved'
  | 'event_updated'
  | 'game_soon'
  | 'added_to_event'
  | 'friend_request'
  | 'friend_accepted';

export interface AppNotification {
  id: string;
  userId: UserId;
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
  actorId?: UserId;
  /** referência para ações (convite, pedido de amizade etc.) */
  refId?: string;
  read: boolean;
  createdAt: string;
}
