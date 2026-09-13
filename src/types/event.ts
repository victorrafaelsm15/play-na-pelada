import type { UserId } from './user';

export type EventId = string;
export type EventPrivacy = 'public' | 'private';
export type JoinPolicy = 'auto' | 'approval';
export type EventStatus = 'waiting' | 'confirmed' | 'live' | 'finished' | 'cancelled';
export type RotationRule = 'winner-stays' | 'round-robin';

export interface EventLocation {
  name: string;
  address: string;
  court?: string;
  mapsUrl?: string;
}

/** Uma "pelada" (evento). Chamado de Match/Event na especificação. */
export interface PeladaEvent {
  id: EventId;
  name: string;
  description?: string;
  organizerId: UserId;
  /** YYYY-MM-DD */
  date: string;
  /** HH:mm */
  time: string;
  location: EventLocation;
  privacy: EventPrivacy;
  joinPolicy: JoinPolicy;
  maxPlayers: number;
  playersPerTeam: number;
  teamsCount: number;
  matchDurationMin: number;
  /** valor por jogador em centavos */
  priceCents?: number;
  notes?: string;
  rotationRule: RotationRule;
  status: EventStatus;
  createdAt: string;
  updatedAt: string;
}

export type ParticipantStatus = 'confirmed' | 'pending' | 'invited' | 'declined';

export type ParticipantRole = 'owner' | 'organizer' | 'moderator' | 'player';

export interface Participant {
  userId: UserId;
  eventId: EventId;
  status: ParticipantStatus;
  role: ParticipantRole;
  joinedAt: string;
}

export type InvitationStatus = 'pending' | 'accepted' | 'declined';

export interface Invitation {
  id: string;
  senderId: UserId;
  receiverId: UserId;
  eventId: EventId;
  status: InvitationStatus;
  createdAt: string;
}

export interface EventInput {
  name: string;
  description?: string;
  date: string;
  time: string;
  location: EventLocation;
  privacy: EventPrivacy;
  joinPolicy: JoinPolicy;
  maxPlayers: number;
  playersPerTeam: number;
  teamsCount: number;
  matchDurationMin: number;
  priceCents?: number;
  notes?: string;
  rotationRule: RotationRule;
}

export interface EventFilters {
  query?: string;
  dateFrom?: string;
  onlyWithSpots?: boolean;
  // Futuro: near?: { lat: number; lng: number; radiusKm: number }; level?: string; modality?: string;
}
