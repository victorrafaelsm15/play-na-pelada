import type {
  AppNotification, EventFilters, EventInput, Friendship, Game, Invitation, Participant,
  ParticipantRole, PeladaEvent, PublicUser, Rotation, Session, Team, User
} from '@/types';

/**
 * Contratos da camada de dados. A UI depende apenas destas interfaces.
 * Implementações: ./mock (localStorage) e ./http (API real — Supabase, Neon + API própria etc.).
 */

export interface RegisterInput {
  name: string;
  username: string;
  publicId: string;
  email: string;
  password: string;
  avatarUrl?: string;
}

export interface AuthService {
  login(identifier: string, password: string, remember: boolean): Promise<Session>;
  register(input: RegisterInput): Promise<Session>;
  logout(): Promise<void>;
  getSession(): Promise<Session | null>;
  requestPasswordReset(email: string): Promise<void>;
  isUsernameAvailable(username: string, exceptUserId?: string): Promise<boolean>;
  isPublicIdAvailable(publicId: string, exceptUserId?: string): Promise<boolean>;
}

export interface FriendRequestView {
  friendship: Friendship;
  user: PublicUser;
  direction: 'incoming' | 'outgoing';
}

export type Relationship = 'self' | 'friend' | 'incoming' | 'outgoing' | 'none';

export interface UserService {
  getMe(userId: string): Promise<User>;
  getById(id: string): Promise<PublicUser>;
  getByUsername(username: string): Promise<PublicUser>;
  getMany(ids: string[]): Promise<PublicUser[]>;
  /** busca por nome, @username ou ID numérico */
  search(query: string, excludeIds?: string[]): Promise<PublicUser[]>;
  updateProfile(userId: string, patch: Partial<Omit<User, 'id' | 'email' | 'createdAt'>>): Promise<User>;
  listFriends(userId: string): Promise<PublicUser[]>;
  listFriendRequests(userId: string): Promise<FriendRequestView[]>;
  relationship(userId: string, otherId: string): Promise<Relationship>;
  sendFriendRequest(fromId: string, toId: string): Promise<void>;
  respondFriendRequest(userId: string, friendshipId: string, accept: boolean): Promise<void>;
  removeFriend(userId: string, friendId: string): Promise<void>;
}

export interface ParticipantView extends Participant {
  user: PublicUser;
}

export interface EventSummary extends PeladaEvent {
  organizer: PublicUser;
  confirmedCount: number;
  myParticipation?: Participant;
}

export interface InvitationView extends Invitation {
  event: EventSummary;
  sender: PublicUser;
}

export interface EventService {
  create(organizerId: string, input: EventInput): Promise<PeladaEvent>;
  update(actorId: string, eventId: string, patch: Partial<EventInput & { status: PeladaEvent['status'] }>): Promise<PeladaEvent>;
  remove(actorId: string, eventId: string): Promise<void>;
  getById(eventId: string, viewerId?: string): Promise<EventSummary>;
  listPublic(viewerId: string, filters?: EventFilters): Promise<EventSummary[]>;
  listForUser(userId: string): Promise<{ organized: EventSummary[]; participating: EventSummary[] }>;
  getParticipants(eventId: string): Promise<ParticipantView[]>;
  join(eventId: string, userId: string): Promise<Participant>;
  leave(eventId: string, userId: string): Promise<void>;
  addPlayer(actorId: string, eventId: string, userId: string): Promise<void>;
  /** Adiciona um jogador avulso, sem conta no app, identificado só pelo nome. */
  addGuestPlayer(actorId: string, eventId: string, name: string): Promise<void>;
  removePlayer(actorId: string, eventId: string, userId: string): Promise<void>;
  reviewRequest(actorId: string, eventId: string, userId: string, approve: boolean): Promise<void>;
  setRole(actorId: string, eventId: string, userId: string, role: ParticipantRole): Promise<void>;
  /** Concede acesso de organizador diretamente a um usuário, mesmo que ainda não esteja na lista. */
  addOrganizer(actorId: string, eventId: string, userId: string): Promise<void>;
  invite(actorId: string, eventId: string, receiverId: string): Promise<void>;
  listInvitations(userId: string): Promise<InvitationView[]>;
  respondInvitation(userId: string, invitationId: string, accept: boolean): Promise<void>;
}

export interface GameService {
  getTeams(eventId: string): Promise<Team[]>;
  saveTeams(actorId: string, eventId: string, teams: Team[]): Promise<Rotation>;
  getRotation(eventId: string): Promise<Rotation | null>;
  listGames(eventId: string): Promise<Game[]>;
  getCurrentGame(eventId: string): Promise<Game | null>;
  createGame(actorId: string, eventId: string, teamAId: string, teamBId: string, durationMs: number): Promise<Game>;
  saveGame(actorId: string, game: Game): Promise<Game>;
  finishGame(actorId: string, game: Game): Promise<{ game: Game; rotation: Rotation }>;
}

export interface NotificationService {
  list(userId: string): Promise<AppNotification[]>;
  unreadCount(userId: string): Promise<number>;
  markRead(userId: string, id: string): Promise<void>;
  markAllRead(userId: string): Promise<void>;
  // Futuro: subscribePush(userId, subscription: PushSubscriptionJSON)
}

/** Armazenamento de arquivos (avatar). Futuro: bucket (Supabase Storage, S3, Vercel Blob). */
export interface StorageService {
  uploadImage(file: File, folder: string): Promise<string>;
}

export interface Services {
  auth: AuthService;
  users: UserService;
  events: EventService;
  games: GameService;
  notifications: NotificationService;
  storage: StorageService;
}
