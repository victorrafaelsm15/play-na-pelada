import type {
  AppNotification, EventLocation, Friendship, Game, GameEvent, Invitation, Participant,
  PeladaEvent, PublicUser, Rotation, Team, TimerState, User
} from '@/types';

/** Linhas do Postgres (snake_case) ↔ tipos do app (camelCase). */

export function mapUser(row: any, email = ''): User {
  return {
    id: row.id,
    publicId: row.public_id ?? '',
    username: row.username ?? '',
    name: row.name,
    email,
    avatarUrl: row.avatar_url ?? undefined,
    bio: row.bio ?? undefined,
    position: row.position ?? undefined,
    dominantFoot: row.dominant_foot ?? undefined,
    city: row.city ?? undefined,
    socialLinks: row.social_links ?? { others: [] },
    titles: row.titles ?? [],
    videos: row.videos ?? [],
    skill: row.skill ?? undefined,
    isGuest: row.is_guest ?? false,
    createdAt: row.created_at
  };
}

export function mapPublicUser(row: any): PublicUser {
  return mapUser(row);
}

export function mapEvent(row: any): PeladaEvent {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    organizerId: row.organizer_id,
    date: row.date,
    time: row.time,
    location: row.location as EventLocation,
    privacy: row.privacy,
    joinPolicy: row.join_policy,
    maxPlayers: row.max_players,
    playersPerTeam: row.players_per_team,
    teamsCount: row.teams_count,
    matchDurationMin: row.match_duration_min,
    priceCents: row.price_cents ?? undefined,
    notes: row.notes ?? undefined,
    rotationRule: row.rotation_rule,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function mapParticipant(row: any): Participant {
  return { eventId: row.event_id, userId: row.user_id, status: row.status, role: row.role, joinedAt: row.joined_at };
}

export function mapInvitation(row: any): Invitation {
  return { id: row.id, senderId: row.sender_id, receiverId: row.receiver_id, eventId: row.event_id, status: row.status, createdAt: row.created_at };
}

export function mapTeam(row: any): Team {
  return { id: row.id, eventId: row.event_id, name: row.name, color: row.color, playerIds: row.player_ids ?? [] };
}

export function mapRotation(row: any): Rotation {
  return { eventId: row.event_id, queue: row.queue ?? [] };
}

export function mapGame(row: any): Game {
  return {
    id: row.id,
    eventId: row.event_id,
    round: row.round,
    teamAId: row.team_a_id,
    teamBId: row.team_b_id,
    scoreA: row.score_a,
    scoreB: row.score_b,
    timer: row.timer as TimerState,
    startedAt: row.started_at ?? undefined,
    finishedAt: row.finished_at ?? undefined,
    status: row.status,
    winnerTeamId: row.winner_team_id ?? null,
    events: (row.events ?? []) as GameEvent[]
  };
}

export function mapNotification(row: any): AppNotification {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    title: row.title,
    body: row.body,
    link: row.link ?? undefined,
    actorId: row.actor_id ?? undefined,
    refId: row.ref_id ?? undefined,
    read: row.read,
    createdAt: row.created_at
  };
}

export function mapFriendship(row: any): Friendship {
  return { id: row.id, requesterId: row.requester_id, addresseeId: row.addressee_id, status: row.status, createdAt: row.created_at };
}

/** Serializa o Team do app para o formato esperado pela RPC save_teams (jsonb[]). */
export function teamToRpc(t: Team) {
  return { id: t.id, name: t.name, color: t.color, playerIds: t.playerIds };
}

/** Serializa o Game do app para o formato esperado pelas RPCs save_game/finish_game (jsonb). */
export function gameToRpc(g: Game) {
  return {
    id: g.id,
    eventId: g.eventId,
    scoreA: g.scoreA,
    scoreB: g.scoreB,
    timer: g.timer,
    startedAt: g.startedAt ?? null,
    finishedAt: g.finishedAt ?? null,
    status: g.status,
    winnerTeamId: g.winnerTeamId ?? null,
    events: g.events
  };
}
