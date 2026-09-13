import type { ParticipantRole } from '@/types';

export type Permission =
  | 'event.view'
  | 'event.edit'
  | 'event.delete'
  | 'players.manage'
  | 'requests.review'
  | 'invites.send'
  | 'roles.assign'
  | 'teams.draw'
  | 'games.control';

/** Tabela de capacidades. Para um novo papel, basta acrescentar uma entrada. */
const ROLE_PERMISSIONS: Record<ParticipantRole, Permission[]> = {
  owner: ['event.view', 'event.edit', 'event.delete', 'players.manage', 'requests.review', 'invites.send', 'roles.assign', 'teams.draw', 'games.control'],
  organizer: ['event.view', 'event.edit', 'players.manage', 'requests.review', 'invites.send', 'teams.draw', 'games.control'],
  moderator: ['event.view', 'requests.review', 'invites.send', 'teams.draw', 'games.control'],
  player: ['event.view']
};

export const ROLE_LABEL: Record<ParticipantRole, string> = {
  owner: 'Dono',
  organizer: 'Organizador',
  moderator: 'Moderador',
  player: 'Jogador'
};

export const ASSIGNABLE_ROLES: ParticipantRole[] = ['organizer', 'moderator', 'player'];

export function can(role: ParticipantRole | undefined | null, permission: Permission): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function canManage(role: ParticipantRole | undefined | null): boolean {
  return can(role, 'players.manage') || can(role, 'games.control') || can(role, 'requests.review');
}
