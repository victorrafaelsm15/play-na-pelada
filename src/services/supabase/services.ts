import type { Session } from '@supabase/supabase-js';
import type {
  AuthService, EventService, EventSummary, FriendRequestView, GameService, InvitationView,
  NotificationService, ParticipantView, Relationship, Services, StorageService, UserService
} from '../contracts';
import type { Game, Participant } from '@/types';
import { AppError, type AppErrorCode } from '../errors';
import { supabase } from './client';
import {
  mapEvent, mapFriendship, mapGame, mapInvitation, mapNotification, mapParticipant,
  mapPublicUser, mapRotation, mapTeam, mapUser, teamToRpc, gameToRpc
} from './mappers';

const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
const VALID_CODES = new Set<AppErrorCode>(['INVALID_CREDENTIALS', 'NOT_FOUND', 'CONFLICT', 'FORBIDDEN', 'VALIDATION', 'EVENT_FULL', 'NETWORK', 'UNKNOWN']);

function mapError(error: any): AppError {
  const raw: string = error?.message ?? 'Algo deu errado. Tente novamente.';
  const m = /^([A-Z_]+):\s*(.*)$/.exec(raw);
  if (m && VALID_CODES.has(m[1] as AppErrorCode)) return new AppError(m[1] as AppErrorCode, m[2]);
  if (error?.code === 'PGRST116') return new AppError('NOT_FOUND', 'Não encontrado.');
  if (error?.code === '23505') return new AppError('CONFLICT', 'Já existe um registro com esses dados.');
  if (error?.message === 'Failed to fetch') return new AppError('NETWORK', 'Sem conexão com o servidor.');
  return new AppError('UNKNOWN', raw);
}

async function q<T>(builder: PromiseLike<{ data: T | null; error: any }>): Promise<T> {
  const { data, error } = await builder;
  if (error) throw mapError(error);
  return data as T;
}

async function call<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw mapError(error);
  return data as T;
}

// ————————————————————————————————— Auth
async function profileByAuthId(authUserId: string): Promise<any> {
  return q<any>(supabase.from('profiles').select('*').eq('auth_user_id', authUserId).single());
}

async function toSession(session: Session): Promise<Session_> {
  const profile = await profileByAuthId(session.user.id);
  return { userId: profile.id, token: session.access_token, expiresAt: new Date((session.expires_at ?? 0) * 1000).toISOString() };
}
type Session_ = { userId: string; token: string; expiresAt: string };

const auth: AuthService = {
  async login(identifier, password) {
    const email = await call<string | null>('get_email_by_identifier', { p_identifier: identifier });
    if (!email) throw new AppError('INVALID_CREDENTIALS', 'E-mail, usuário ou senha incorretos.');
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.session) throw new AppError('INVALID_CREDENTIALS', 'E-mail, usuário ou senha incorretos.');
    return toSession(data.session);
  },
  async register(input) {
    const { data, error } = await supabase.auth.signUp({
      email: input.email.trim(),
      password: input.password,
      options: { data: { name: input.name.trim(), username: norm(input.username).replace(/^@/, ''), public_id: input.publicId, avatar_url: input.avatarUrl ?? null } }
    });
    if (error) {
      if (/registered|exists/i.test(error.message)) throw new AppError('CONFLICT', 'Já existe uma conta com este e-mail.', 'email');
      throw new AppError('UNKNOWN', error.message);
    }
    if (!data.session) throw new AppError('UNKNOWN', 'Conta criada. Confirme seu e-mail antes de entrar.');
    return toSession(data.session);
  },
  async logout() {
    await supabase.auth.signOut();
  },
  async getSession() {
    const { data } = await supabase.auth.getSession();
    if (!data.session) return null;
    try {
      return await toSession(data.session);
    } catch {
      return null;
    }
  },
  async requestPasswordReset(email) {
    if (!/^\S+@\S+\.\S+$/.test(email)) throw new AppError('VALIDATION', 'Informe um e-mail válido.', 'email');
    await supabase.auth.resetPasswordForEmail(email);
  },
  async isUsernameAvailable(username, exceptUserId) {
    return call<boolean>('is_username_available', { p_username: norm(username).replace(/^@/, ''), p_except_user_id: exceptUserId ?? null });
  },
  async isPublicIdAvailable(publicId, exceptUserId) {
    return call<boolean>('is_publicid_available', { p_public_id: publicId, p_except_user_id: exceptUserId ?? null });
  }
};

// ————————————————————————————————— Users
const users: UserService = {
  async getMe(userId) {
    const row = await q(supabase.from('profiles').select('*').eq('id', userId).single());
    const { data: authData } = await supabase.auth.getUser();
    return mapUser(row, authData.user?.email ?? '');
  },
  async getById(id) {
    const row = await q(supabase.from('profiles').select('*').eq('id', id).single());
    return mapPublicUser(row);
  },
  async getByUsername(username) {
    const row = await q(supabase.from('profiles').select('*').ilike('username', norm(username)).single());
    return mapPublicUser(row);
  },
  async getMany(ids) {
    if (!ids.length) return [];
    const rows = await q(supabase.from('profiles').select('*').in('id', ids));
    return (rows ?? []).map(mapPublicUser);
  },
  async search(query, excludeIds = []) {
    const q2 = norm(query).replace(/^@/, '');
    if (!q2) return [];
    const rows = await call<any[]>('search_users', { p_query: q2, p_exclude_ids: excludeIds });
    return (rows ?? []).map(mapPublicUser);
  },
  async updateProfile(userId, patch) {
    const row: Record<string, unknown> = {};
    if (patch.name !== undefined) row.name = patch.name;
    if (patch.avatarUrl !== undefined) row.avatar_url = patch.avatarUrl;
    if (patch.bio !== undefined) row.bio = patch.bio;
    if (patch.position !== undefined) row.position = patch.position;
    if (patch.dominantFoot !== undefined) row.dominant_foot = patch.dominantFoot;
    if (patch.city !== undefined) row.city = patch.city;
    if (patch.socialLinks !== undefined) row.social_links = patch.socialLinks;
    if (patch.titles !== undefined) row.titles = patch.titles;
    if (patch.videos !== undefined) row.videos = patch.videos;
    if (patch.skill !== undefined) row.skill = patch.skill;
    if (patch.username !== undefined) {
      const username = norm(patch.username).replace(/^@/, '');
      if (!/^[a-z0-9._]{3,20}$/.test(username)) throw new AppError('VALIDATION', 'Use de 3 a 20 caracteres: letras, números, ponto ou _.', 'username');
      row.username = username;
    }
    if (patch.publicId !== undefined) row.public_id = patch.publicId;

    const { data, error } = await supabase.from('profiles').update(row).eq('id', userId).select('*').single();
    if (error) {
      if (error.code === '23505') {
        const field = String(error.message).includes('username') ? 'username' : 'publicId';
        throw new AppError('CONFLICT', field === 'username' ? 'Este nome de usuário já está em uso.' : 'Este ID já está em uso.', field);
      }
      throw mapError(error);
    }
    const { data: authData } = await supabase.auth.getUser();
    return mapUser(data, authData.user?.email ?? '');
  },
  async listFriends(userId) {
    const rows = await q(supabase.from('friendships').select('*, requester:requester_id(*), addressee:addressee_id(*)').eq('status', 'accepted').or(`requester_id.eq.${userId},addressee_id.eq.${userId}`));
    return (rows ?? [])
      .map((f: any) => mapPublicUser(f.requester_id === userId ? f.addressee : f.requester))
      .sort((a, b) => a.name.localeCompare(b.name));
  },
  async listFriendRequests(userId) {
    const rows = await q(supabase.from('friendships').select('*, requester:requester_id(*), addressee:addressee_id(*)').eq('status', 'pending').or(`requester_id.eq.${userId},addressee_id.eq.${userId}`));
    return (rows ?? []).map((f: any) => ({
      friendship: mapFriendship(f),
      direction: f.addressee_id === userId ? 'incoming' : 'outgoing',
      user: mapPublicUser(f.addressee_id === userId ? f.requester : f.addressee)
    })) as FriendRequestView[];
  },
  async relationship(userId, otherId) {
    if (userId === otherId) return 'self';
    const rows = await q(supabase.from('friendships').select('*').or(`and(requester_id.eq.${userId},addressee_id.eq.${otherId}),and(requester_id.eq.${otherId},addressee_id.eq.${userId})`));
    const f = (rows ?? [])[0];
    if (!f) return 'none' as Relationship;
    if (f.status === 'accepted') return 'friend' as Relationship;
    return (f.requester_id === userId ? 'outgoing' : 'incoming') as Relationship;
  },
  async sendFriendRequest(_fromId, toId) {
    await call('send_friend_request', { p_to_id: toId });
  },
  async respondFriendRequest(_userId, friendshipId, accept) {
    await call('respond_friend_request', { p_friendship_id: friendshipId, p_accept: accept });
  },
  async removeFriend(_userId, friendId) {
    await call('remove_friend', { p_friend_id: friendId });
  }
};

// ————————————————————————————————— Events
async function summarize(row: any, viewerId?: string): Promise<EventSummary> {
  const e = mapEvent(row);
  const organizerRow = await q(supabase.from('profiles').select('*').eq('id', e.organizerId).single());
  const { count } = await supabase.from('participants').select('*', { count: 'exact', head: true }).eq('event_id', e.id).eq('status', 'confirmed');
  let myParticipation: Participant | undefined;
  if (viewerId) {
    const rows = await q(supabase.from('participants').select('*').eq('event_id', e.id).eq('user_id', viewerId));
    myParticipation = (rows ?? [])[0] ? mapParticipant(rows[0]) : undefined;
  }
  return { ...e, organizer: mapPublicUser(organizerRow), confirmedCount: count ?? 0, myParticipation };
}

const events: EventService = {
  async create(_organizerId, input) {
    const row = await call<any>('create_event', { p_input: input });
    return mapEvent(row);
  },
  async update(_actorId, eventId, patch) {
    const row = await call<any>('update_event', { p_event_id: eventId, p_patch: patch });
    return mapEvent(row);
  },
  async remove(_actorId, eventId) {
    await call('remove_event', { p_event_id: eventId });
  },
  async getById(eventId, viewerId) {
    const row = await q(supabase.from('events').select('*').eq('id', eventId).single());
    return summarize(row, viewerId);
  },
  async listPublic(viewerId, filters = {}) {
    let query = supabase.from('events').select('*').eq('privacy', 'public').not('status', 'in', '(cancelled,finished)');
    if (filters.dateFrom) query = query.gte('date', filters.dateFrom);
    const rows = await q(query.order('date').order('time'));
    let list = await Promise.all((rows ?? []).map((r: any) => summarize(r, viewerId)));
    const qtext = filters.query ? norm(filters.query) : '';
    if (qtext) list = list.filter((e) => norm(`${e.name} ${e.location.name} ${e.location.address}`).includes(qtext));
    if (filters.onlyWithSpots) list = list.filter((e) => e.confirmedCount < e.maxPlayers);
    return list;
  },
  async listForUser(userId) {
    const mine = await q(supabase.from('participants').select('event_id').eq('user_id', userId).eq('status', 'confirmed'));
    const ids = (mine ?? []).map((p: any) => p.event_id);
    if (!ids.length) return { organized: [], participating: [] };
    const rows = await q(supabase.from('events').select('*').in('id', ids).order('date').order('time'));
    const all = await Promise.all((rows ?? []).map((r: any) => summarize(r, userId)));
    return { organized: all.filter((e) => e.organizerId === userId), participating: all.filter((e) => e.organizerId !== userId) };
  },
  async getParticipants(eventId) {
    const rows = await q(supabase.from('participants').select('*, user:user_id(*)').eq('event_id', eventId));
    const order: Record<string, number> = { owner: 0, organizer: 1, moderator: 2, player: 3 };
    return (rows ?? [])
      .map((p: any) => ({ ...mapParticipant(p), user: mapPublicUser(p.user) }) as ParticipantView)
      .sort((a, b) => order[a.role] - order[b.role] || a.user.name.localeCompare(b.user.name));
  },
  async join(_eventId, eventId) {
    const row = await call<any>('join_event', { p_event_id: eventId });
    return mapParticipant(row);
  },
  async leave(eventId) {
    await call('leave_event', { p_event_id: eventId });
  },
  async addPlayer(_actorId, eventId, userId) {
    await call('add_player', { p_event_id: eventId, p_user_id: userId });
  },
  async addGuestPlayer(_actorId, eventId, name) {
    await call('add_guest_player', { p_event_id: eventId, p_name: name });
  },
  async removePlayer(_actorId, eventId, userId) {
    await call('remove_player', { p_event_id: eventId, p_user_id: userId });
  },
  async reviewRequest(_actorId, eventId, userId, approve) {
    await call('review_request', { p_event_id: eventId, p_user_id: userId, p_approve: approve });
  },
  async setRole(_actorId, eventId, userId, role) {
    await call('set_role', { p_event_id: eventId, p_user_id: userId, p_role: role });
  },
  async addOrganizer(_actorId, eventId, userId) {
    await call('add_organizer', { p_event_id: eventId, p_user_id: userId });
  },
  async invite(_actorId, eventId, receiverId) {
    await call('invite_player', { p_event_id: eventId, p_receiver_id: receiverId });
  },
  async listInvitations(userId) {
    const rows = await q(supabase.from('invitations').select('*, sender:sender_id(*), event:event_id(*)').eq('receiver_id', userId).eq('status', 'pending'));
    const out: InvitationView[] = [];
    for (const r of rows ?? []) {
      out.push({ ...mapInvitation(r), sender: mapPublicUser(r.sender), event: await summarize(r.event, userId) });
    }
    return out;
  },
  async respondInvitation(_userId, invitationId, accept) {
    await call('respond_invitation', { p_invitation_id: invitationId, p_accept: accept });
  }
};

// ————————————————————————————————— Games
const games: GameService = {
  async getTeams(eventId) {
    const rows = await q(supabase.from('teams').select('*').eq('event_id', eventId).order('order_index'));
    return (rows ?? []).map(mapTeam);
  },
  async saveTeams(_actorId, eventId, teams) {
    const row = await call<any>('save_teams', { p_event_id: eventId, p_teams: teams.map(teamToRpc) });
    return mapRotation(row);
  },
  async renameTeam(_actorId, teamId, name) {
    const row = await call<any>('rename_team', { p_team_id: teamId, p_name: name });
    return mapTeam(row);
  },
  async reorderTeams(_actorId, eventId, orderedTeamIds) {
    await call('reorder_teams', { p_event_id: eventId, p_ordered_ids: orderedTeamIds });
  },
  async updateTeamRoster(_actorId, teamId, playerIds) {
    const row = await call<any>('update_team_roster', { p_team_id: teamId, p_player_ids: playerIds });
    return mapTeam(row);
  },
  async getRotation(eventId) {
    const rows = await q(supabase.from('rotations').select('*').eq('event_id', eventId));
    const r = (rows ?? [])[0];
    return r ? mapRotation(r) : null;
  },
  async listGames(eventId) {
    const rows = await q(supabase.from('games').select('*').eq('event_id', eventId).order('round', { ascending: false }));
    return (rows ?? []).map(mapGame);
  },
  async getCurrentGame(eventId) {
    const rows = await q(supabase.from('games').select('*').eq('event_id', eventId).neq('status', 'finished'));
    const g = (rows ?? [])[0];
    return g ? mapGame(g) : null;
  },
  async createGame(_actorId, eventId, teamAId, teamBId, durationMs) {
    const row = await call<any>('create_game', { p_event_id: eventId, p_team_a_id: teamAId, p_team_b_id: teamBId, p_duration_ms: durationMs });
    return mapGame(row);
  },
  async saveGame(_actorId, game) {
    const row = await call<any>('save_game', { p_game: gameToRpc(game as Game) });
    return mapGame(row);
  },
  async finishGame(_actorId, game) {
    const row = await call<{ game: any; rotation: any }>('finish_game', { p_game: gameToRpc(game as Game) });
    return { game: mapGame(row.game), rotation: mapRotation(row.rotation) };
  }
};

// ————————————————————————————————— Notifications
const notifications: NotificationService = {
  async list(userId) {
    const rows = await q(supabase.from('notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false }));
    return (rows ?? []).map(mapNotification);
  },
  async unreadCount(userId) {
    const { count } = await supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('read', false);
    return count ?? 0;
  },
  async markRead(_userId, id) {
    await call('mark_notification_read', { p_id: id });
  },
  async markAllRead(_userId) {
    await call('mark_all_notifications_read');
  }
};

// ————————————————————————————————— Storage
const storage: StorageService = {
  async uploadImage(file, folder) {
    if (!file.type.startsWith('image/')) throw new AppError('VALIDATION', 'Envie um arquivo de imagem.');
    const resized = await resizeToBlob(file, 480);
    const { data: authData } = await supabase.auth.getUser();
    const uid = authData.user?.id;
    if (!uid) return blobToDataUrl(resized);
    const path = `${uid}/${folder}-${Date.now()}.jpg`;
    const { error } = await supabase.storage.from('avatars').upload(path, resized, { contentType: 'image/jpeg', upsert: true });
    if (error) throw new AppError('UNKNOWN', 'Não foi possível enviar a imagem.');
    return supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
  }
};

function resizeToBlob(file: File, max: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      c.toBlob((blob) => (blob ? resolve(blob) : reject(new AppError('VALIDATION', 'Não foi possível ler a imagem.'))), 'image/jpeg', 0.85);
    };
    img.onerror = () => reject(new AppError('VALIDATION', 'Não foi possível ler a imagem.'));
    img.src = URL.createObjectURL(file);
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new AppError('VALIDATION', 'Não foi possível ler a imagem.'));
    reader.readAsDataURL(blob);
  });
}

export const supabaseServices: Services = { auth, users, events, games, notifications, storage };
