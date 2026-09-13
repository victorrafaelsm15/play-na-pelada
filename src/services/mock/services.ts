import type {
  AuthService, EventService, EventSummary, FriendRequestView, GameService, InvitationView,
  NotificationService, ParticipantView, Relationship, Services, StorageService, UserService
} from '../contracts';
import type { AppNotification, Game, Participant, PeladaEvent, PublicUser, Session, User } from '@/types';
import { AppError } from '../errors';
import { db, latency, type MockDB } from './db';
import { uid } from '@/lib/id';
import { can, type Permission } from '@/domain/permissions';
import { applyResult } from '@/domain/rotation';
import { createTimer } from '@/domain/timer';
import { todayISO } from '@/lib/format';

const SESSION_KEY = 'racha:session';

const toPublic = (u: User): PublicUser => {
  const { email: _email, ...rest } = u;
  return rest;
};

const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

function findUser(d: MockDB, id: string): User {
  const u = d.users.find((x) => x.id === id);
  if (!u) throw new AppError('NOT_FOUND', 'Usuário não encontrado.');
  return u;
}

function findEvent(d: MockDB, id: string): PeladaEvent {
  const e = d.events.find((x) => x.id === id);
  if (!e) throw new AppError('NOT_FOUND', 'Pelada não encontrada.');
  return e;
}

function roleOf(d: MockDB, eventId: string, userId: string) {
  return d.participants.find((p) => p.eventId === eventId && p.userId === userId && p.status === 'confirmed')?.role;
}

function assertCan(d: MockDB, eventId: string, userId: string, perm: Permission) {
  if (!can(roleOf(d, eventId, userId), perm)) throw new AppError('FORBIDDEN', 'Você não tem permissão para esta ação.');
}

function notify(d: MockDB, n: Omit<AppNotification, 'id' | 'read' | 'createdAt'>) {
  d.notifications.unshift({ ...n, id: uid('n'), read: false, createdAt: new Date().toISOString() });
}

function summarize(d: MockDB, e: PeladaEvent, viewerId?: string): EventSummary {
  return {
    ...e,
    organizer: toPublic(findUser(d, e.organizerId)),
    confirmedCount: d.participants.filter((p) => p.eventId === e.id && p.status === 'confirmed').length,
    myParticipation: viewerId ? d.participants.find((p) => p.eventId === e.id && p.userId === viewerId) : undefined
  };
}

const byDate = (a: PeladaEvent, b: PeladaEvent) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`);

function recomputeStatus(d: MockDB, e: PeladaEvent) {
  if (e.status === 'live' || e.status === 'finished' || e.status === 'cancelled') return;
  const count = d.participants.filter((p) => p.eventId === e.id && p.status === 'confirmed').length;
  e.status = count >= e.playersPerTeam * 2 ? 'confirmed' : 'waiting';
}

// ————————————————————————————————— Auth
const auth: AuthService = {
  async login(identifier, password, remember) {
    await latency(600);
    const id = norm(identifier).replace(/^@/, '');
    const session = db.read((d) => {
      const user = d.users.find((u) => norm(u.email) === id || norm(u.username) === id || u.publicId === id);
      const cred = user && d.credentials.find((c) => c.userId === user.id);
      if (!user || !cred || cred.password !== password) {
        throw new AppError('INVALID_CREDENTIALS', 'E-mail, usuário ou senha incorretos.');
      }
      return { userId: user.id, token: uid('tok'), expiresAt: new Date(Date.now() + 30 * 86400_000).toISOString() } satisfies Session;
    });
    const store = remember ? localStorage : sessionStorage;
    (remember ? sessionStorage : localStorage).removeItem(SESSION_KEY);
    store.setItem(SESSION_KEY, JSON.stringify(session));
    return session;
  },
  async register(input) {
    await latency(700);
    const session = db.write((d) => {
      const username = norm(input.username).replace(/^@/, '');
      if (d.users.some((u) => norm(u.username) === username)) throw new AppError('CONFLICT', 'Este nome de usuário já está em uso.', 'username');
      if (d.users.some((u) => u.publicId === input.publicId)) throw new AppError('CONFLICT', 'Este ID já está em uso.', 'publicId');
      if (d.users.some((u) => norm(u.email) === norm(input.email))) throw new AppError('CONFLICT', 'Já existe uma conta com este e-mail.', 'email');
      const user: User = {
        id: uid('u'), publicId: input.publicId, username, name: input.name.trim(), email: input.email.trim(),
        avatarUrl: input.avatarUrl, socialLinks: { others: [] }, titles: [], videos: [], createdAt: new Date().toISOString()
      };
      d.users.push(user);
      d.credentials.push({ userId: user.id, password: input.password });
      return { userId: user.id, token: uid('tok'), expiresAt: new Date(Date.now() + 30 * 86400_000).toISOString() };
    });
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return session;
  },
  async logout() {
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_KEY);
  },
  async getSession() {
    const raw = localStorage.getItem(SESSION_KEY) ?? sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    try {
      const s = JSON.parse(raw) as Session;
      if (new Date(s.expiresAt) < new Date()) return null;
      const exists = db.read((d) => d.users.some((u) => u.id === s.userId));
      return exists ? s : null;
    } catch {
      return null;
    }
  },
  async requestPasswordReset(email) {
    await latency(700);
    if (!/^\S+@\S+\.\S+$/.test(email)) throw new AppError('VALIDATION', 'Informe um e-mail válido.', 'email');
    // Por segurança, a resposta é a mesma exista ou não a conta.
  },
  async isUsernameAvailable(username, exceptUserId) {
    await latency(250);
    const u = norm(username).replace(/^@/, '');
    return db.read((d) => !d.users.some((x) => norm(x.username) === u && x.id !== exceptUserId));
  },
  async isPublicIdAvailable(publicId, exceptUserId) {
    await latency(250);
    return db.read((d) => !d.users.some((x) => x.publicId === publicId && x.id !== exceptUserId));
  }
};

// ————————————————————————————————— Users
const users: UserService = {
  async getMe(userId) {
    await latency(150);
    return db.read((d) => findUser(d, userId));
  },
  async getById(id) {
    await latency(150);
    return db.read((d) => toPublic(findUser(d, id)));
  },
  async getByUsername(username) {
    await latency(200);
    return db.read((d) => {
      const u = d.users.find((x) => norm(x.username) === norm(username));
      if (!u) throw new AppError('NOT_FOUND', 'Jogador não encontrado.');
      return toPublic(u);
    });
  },
  async getMany(ids) {
    return db.read((d) => ids.map((id) => d.users.find((u) => u.id === id)).filter(Boolean).map((u) => toPublic(u!)));
  },
  async search(query, excludeIds = []) {
    await latency(300);
    const q = norm(query).replace(/^@/, '');
    if (!q) return [];
    return db.read((d) =>
      d.users
        .filter((u) => !u.isGuest)
        .filter((u) => !excludeIds.includes(u.id))
        .filter((u) => norm(u.name).includes(q) || norm(u.username).includes(q) || u.publicId.startsWith(q))
        .slice(0, 20)
        .map(toPublic)
    );
  },
  async updateProfile(userId, patch) {
    await latency(500);
    return db.write((d) => {
      const u = findUser(d, userId);
      if (patch.username !== undefined) {
        const username = norm(patch.username).replace(/^@/, '');
        if (!/^[a-z0-9._]{3,20}$/.test(username)) throw new AppError('VALIDATION', 'Use de 3 a 20 caracteres: letras, números, ponto ou _.', 'username');
        if (d.users.some((x) => x.id !== userId && norm(x.username) === username)) throw new AppError('CONFLICT', 'Este nome de usuário já está em uso.', 'username');
        patch.username = username;
      }
      if (patch.publicId !== undefined && d.users.some((x) => x.id !== userId && x.publicId === patch.publicId)) {
        throw new AppError('CONFLICT', 'Este ID já está em uso.', 'publicId');
      }
      Object.assign(u, patch);
      return u;
    });
  },
  async listFriends(userId) {
    await latency(300);
    return db.read((d) =>
      d.friendships
        .filter((f) => f.status === 'accepted' && (f.requesterId === userId || f.addresseeId === userId))
        .map((f) => toPublic(findUser(d, f.requesterId === userId ? f.addresseeId : f.requesterId)))
        .sort((a, b) => a.name.localeCompare(b.name))
    );
  },
  async listFriendRequests(userId) {
    await latency(300);
    return db.read((d) =>
      d.friendships
        .filter((f) => f.status === 'pending' && (f.requesterId === userId || f.addresseeId === userId))
        .map<FriendRequestView>((f) => ({
          friendship: f,
          direction: f.addresseeId === userId ? 'incoming' : 'outgoing',
          user: toPublic(findUser(d, f.addresseeId === userId ? f.requesterId : f.addresseeId))
        }))
    );
  },
  async relationship(userId, otherId) {
    return db.read<Relationship>((d) => {
      if (userId === otherId) return 'self';
      const f = d.friendships.find(
        (x) => (x.requesterId === userId && x.addresseeId === otherId) || (x.requesterId === otherId && x.addresseeId === userId)
      );
      if (!f) return 'none';
      if (f.status === 'accepted') return 'friend';
      return f.requesterId === userId ? 'outgoing' : 'incoming';
    });
  },
  async sendFriendRequest(fromId, toId) {
    await latency(400);
    db.write((d) => {
      if (d.friendships.some((x) => (x.requesterId === fromId && x.addresseeId === toId) || (x.requesterId === toId && x.addresseeId === fromId))) return;
      d.friendships.push({ id: uid('f'), requesterId: fromId, addresseeId: toId, status: 'pending', createdAt: new Date().toISOString() });
      const from = findUser(d, fromId);
      notify(d, { userId: toId, type: 'friend_request', title: 'Pedido de amizade', body: `${from.name} quer adicionar você.`, link: '/amigos', actorId: fromId });
    });
  },
  async respondFriendRequest(userId, friendshipId, accept) {
    await latency(400);
    db.write((d) => {
      const f = d.friendships.find((x) => x.id === friendshipId);
      if (!f) throw new AppError('NOT_FOUND', 'Pedido não encontrado.');
      if (f.addresseeId !== userId && f.requesterId !== userId) throw new AppError('FORBIDDEN', 'Pedido de outra pessoa.');
      if (accept && f.addresseeId === userId) {
        f.status = 'accepted';
        notify(d, { userId: f.requesterId, type: 'friend_accepted', title: 'Amizade aceita', body: `${findUser(d, userId).name} aceitou seu pedido.`, link: '/amigos', actorId: userId });
      } else {
        d.friendships = d.friendships.filter((x) => x.id !== friendshipId);
      }
    });
  },
  async removeFriend(userId, friendId) {
    await latency(400);
    db.write((d) => {
      d.friendships = d.friendships.filter(
        (x) => !((x.requesterId === userId && x.addresseeId === friendId) || (x.requesterId === friendId && x.addresseeId === userId))
      );
    });
  }
};

// ————————————————————————————————— Events
const events: EventService = {
  async create(organizerId, input) {
    await latency(700);
    return db.write((d) => {
      const t = new Date().toISOString();
      const e: PeladaEvent = { ...input, id: uid('e'), organizerId, status: 'waiting', createdAt: t, updatedAt: t };
      d.events.push(e);
      d.participants.push({ eventId: e.id, userId: organizerId, role: 'owner', status: 'confirmed', joinedAt: t });
      return e;
    });
  },
  async update(actorId, eventId, patch) {
    await latency(500);
    return db.write((d) => {
      assertCan(d, eventId, actorId, 'event.edit');
      const e = findEvent(d, eventId);
      Object.assign(e, patch, { updatedAt: new Date().toISOString() });
      if (!patch.status) recomputeStatus(d, e);
      d.participants
        .filter((p) => p.eventId === eventId && p.status === 'confirmed' && p.userId !== actorId)
        .forEach((p) => notify(d, { userId: p.userId, type: 'event_updated', title: 'Pelada alterada', body: `${e.name} teve informações atualizadas.`, link: `/peladas/${e.id}` }));
      return e;
    });
  },
  async remove(actorId, eventId) {
    await latency(500);
    db.write((d) => {
      assertCan(d, eventId, actorId, 'event.delete');
      d.events = d.events.filter((e) => e.id !== eventId);
      d.participants = d.participants.filter((p) => p.eventId !== eventId);
      d.invitations = d.invitations.filter((i) => i.eventId !== eventId);
      d.teams = d.teams.filter((t) => t.eventId !== eventId);
      d.games = d.games.filter((g) => g.eventId !== eventId);
      d.rotations = d.rotations.filter((r) => r.eventId !== eventId);
    });
  },
  async getById(eventId, viewerId) {
    await latency(350);
    return db.read((d) => {
      const e = findEvent(d, eventId);
      const mine = viewerId ? d.participants.find((p) => p.eventId === eventId && p.userId === viewerId) : undefined;
      if (e.privacy === 'private' && !mine) throw new AppError('FORBIDDEN', 'Esta pelada é privada. Somente convidados podem ver.');
      return summarize(d, e, viewerId);
    });
  },
  async listPublic(viewerId, filters = {}) {
    await latency(500);
    return db.read((d) => {
      const q = filters.query ? norm(filters.query) : '';
      return d.events
        .filter((e) => e.privacy === 'public' && e.status !== 'cancelled' && e.status !== 'finished')
        .filter((e) => e.date >= (filters.dateFrom ?? todayISO()))
        .filter((e) => !q || norm(`${e.name} ${e.location.name} ${e.location.address}`).includes(q))
        .map((e) => summarize(d, e, viewerId))
        .filter((e) => !filters.onlyWithSpots || e.confirmedCount < e.maxPlayers)
        .sort(byDate);
    });
  },
  async listForUser(userId) {
    await latency(450);
    return db.read((d) => {
      const mine = d.participants.filter((p) => p.userId === userId && p.status === 'confirmed');
      const all = mine.map((p) => summarize(d, findEvent(d, p.eventId), userId)).sort(byDate);
      return { organized: all.filter((e) => e.organizerId === userId), participating: all.filter((e) => e.organizerId !== userId) };
    });
  },
  async getParticipants(eventId) {
    await latency(300);
    const order = { owner: 0, organizer: 1, moderator: 2, player: 3 };
    return db.read((d) =>
      d.participants
        .filter((p) => p.eventId === eventId)
        .map<ParticipantView>((p) => ({ ...p, user: toPublic(findUser(d, p.userId)) }))
        .sort((a, b) => order[a.role] - order[b.role] || a.user.name.localeCompare(b.user.name))
    );
  },
  async join(eventId, userId) {
    await latency(500);
    return db.write<Participant>((d) => {
      const e = findEvent(d, eventId);
      const existing = d.participants.find((p) => p.eventId === eventId && p.userId === userId);
      if (existing?.status === 'confirmed' || existing?.status === 'pending') return existing;
      const confirmed = d.participants.filter((p) => p.eventId === eventId && p.status === 'confirmed').length;
      if (e.privacy === 'private' && existing?.status !== 'invited') throw new AppError('FORBIDDEN', 'Pelada privada: é preciso convite.');
      const autoOk = e.joinPolicy === 'auto' || existing?.status === 'invited';
      if (autoOk && confirmed >= e.maxPlayers) throw new AppError('EVENT_FULL', 'A lista está completa.');
      const status = autoOk ? 'confirmed' : 'pending';
      const p: Participant = existing ?? { eventId, userId, role: 'player', status, joinedAt: new Date().toISOString() };
      p.status = status;
      if (!existing) d.participants.push(p);
      const user = findUser(d, userId);
      if (status === 'pending') {
        d.participants
          .filter((x) => x.eventId === eventId && can(x.role, 'requests.review'))
          .forEach((x) => notify(d, { userId: x.userId, type: 'join_request', title: 'Pedido de participação', body: `${user.name} quer entrar em ${e.name}.`, link: `/peladas/${e.id}/gerenciar?aba=pedidos`, actorId: userId }));
      }
      recomputeStatus(d, e);
      return p;
    });
  },
  async leave(eventId, userId) {
    await latency(400);
    db.write((d) => {
      const e = findEvent(d, eventId);
      if (e.organizerId === userId) throw new AppError('FORBIDDEN', 'O dono não pode sair da própria pelada.');
      d.participants = d.participants.filter((p) => !(p.eventId === eventId && p.userId === userId));
      recomputeStatus(d, e);
    });
  },
  async addPlayer(actorId, eventId, userId) {
    await latency(400);
    db.write((d) => {
      assertCan(d, eventId, actorId, 'players.manage');
      const e = findEvent(d, eventId);
      const confirmed = d.participants.filter((p) => p.eventId === eventId && p.status === 'confirmed').length;
      if (confirmed >= e.maxPlayers) throw new AppError('EVENT_FULL', 'A lista está completa.');
      const existing = d.participants.find((p) => p.eventId === eventId && p.userId === userId);
      if (existing) existing.status = 'confirmed';
      else d.participants.push({ eventId, userId, role: 'player', status: 'confirmed', joinedAt: new Date().toISOString() });
      notify(d, { userId, type: 'added_to_event', title: 'Você foi adicionado', body: `Você está na lista de ${e.name}.`, link: `/peladas/${e.id}`, actorId });
      recomputeStatus(d, e);
    });
  },
  async addGuestPlayer(actorId, eventId, name) {
    await latency(400);
    db.write((d) => {
      assertCan(d, eventId, actorId, 'players.manage');
      const e = findEvent(d, eventId);
      const trimmed = name.trim();
      if (!trimmed) throw new AppError('VALIDATION', 'Informe um nome.', 'name');
      const confirmed = d.participants.filter((p) => p.eventId === eventId && p.status === 'confirmed').length;
      if (confirmed >= e.maxPlayers) throw new AppError('EVENT_FULL', 'A lista está completa.');
      const guest: User = {
        id: uid('guest'), publicId: '', username: '', name: trimmed, email: '',
        socialLinks: { others: [] }, titles: [], videos: [], isGuest: true, createdAt: new Date().toISOString()
      };
      d.users.push(guest);
      d.participants.push({ eventId, userId: guest.id, role: 'player', status: 'confirmed', joinedAt: new Date().toISOString() });
      recomputeStatus(d, e);
    });
  },
  async removePlayer(actorId, eventId, userId) {
    await latency(400);
    db.write((d) => {
      assertCan(d, eventId, actorId, 'players.manage');
      const e = findEvent(d, eventId);
      if (e.organizerId === userId) throw new AppError('FORBIDDEN', 'O dono não pode ser removido.');
      const user = d.users.find((u) => u.id === userId);
      d.participants = d.participants.filter((p) => !(p.eventId === eventId && p.userId === userId));
      d.teams.filter((t) => t.eventId === eventId).forEach((t) => (t.playerIds = t.playerIds.filter((id) => id !== userId)));
      if (user?.isGuest) d.users = d.users.filter((u) => u.id !== userId);
      recomputeStatus(d, e);
    });
  },
  async reviewRequest(actorId, eventId, userId, approve) {
    await latency(400);
    db.write((d) => {
      assertCan(d, eventId, actorId, 'requests.review');
      const e = findEvent(d, eventId);
      const p = d.participants.find((x) => x.eventId === eventId && x.userId === userId && x.status === 'pending');
      if (!p) throw new AppError('NOT_FOUND', 'Pedido não encontrado.');
      if (approve) {
        const confirmed = d.participants.filter((x) => x.eventId === eventId && x.status === 'confirmed').length;
        if (confirmed >= e.maxPlayers) throw new AppError('EVENT_FULL', 'A lista está completa.');
        p.status = 'confirmed';
        notify(d, { userId, type: 'join_approved', title: 'Participação aprovada', body: `Você foi aceito em ${e.name}.`, link: `/peladas/${e.id}`, actorId });
      } else {
        d.participants = d.participants.filter((x) => x !== p);
      }
      recomputeStatus(d, e);
    });
  },
  async setRole(actorId, eventId, userId, role) {
    await latency(350);
    db.write((d) => {
      assertCan(d, eventId, actorId, 'roles.assign');
      if (role === 'owner') throw new AppError('FORBIDDEN', 'A posse da pelada não pode ser transferida por aqui.');
      const p = d.participants.find((x) => x.eventId === eventId && x.userId === userId);
      if (!p || p.role === 'owner') throw new AppError('FORBIDDEN', 'Não é possível alterar este papel.');
      if (role !== 'player' && findUser(d, userId).isGuest) throw new AppError('FORBIDDEN', 'Um jogador avulso não pode ter esse papel.');
      p.role = role;
    });
  },
  async addOrganizer(actorId, eventId, userId) {
    await latency(400);
    db.write((d) => {
      assertCan(d, eventId, actorId, 'roles.assign');
      const e = findEvent(d, eventId);
      const user = findUser(d, userId);
      if (user.isGuest) throw new AppError('FORBIDDEN', 'Um jogador avulso não pode ser organizador.');
      const existing = d.participants.find((p) => p.eventId === eventId && p.userId === userId);
      if (existing) {
        if (existing.role === 'owner') throw new AppError('FORBIDDEN', 'Não é possível alterar este papel.');
        existing.status = 'confirmed';
        existing.role = 'organizer';
      } else {
        d.participants.push({ eventId, userId, role: 'organizer', status: 'confirmed', joinedAt: new Date().toISOString() });
      }
      notify(d, { userId, type: 'added_to_event', title: 'Você agora é organizador', body: `Você recebeu acesso de organizador em ${e.name}.`, link: `/peladas/${e.id}/gerenciar`, actorId });
      recomputeStatus(d, e);
    });
  },
  async invite(actorId, eventId, receiverId) {
    await latency(400);
    db.write((d) => {
      assertCan(d, eventId, actorId, 'invites.send');
      const e = findEvent(d, eventId);
      const existing = d.participants.find((p) => p.eventId === eventId && p.userId === receiverId);
      if (existing?.status === 'confirmed') throw new AppError('CONFLICT', 'Este jogador já está na lista.');
      if (d.invitations.some((i) => i.eventId === eventId && i.receiverId === receiverId && i.status === 'pending')) return;
      const inv = { id: uid('i'), senderId: actorId, receiverId, eventId, status: 'pending' as const, createdAt: new Date().toISOString() };
      d.invitations.push(inv);
      if (!existing) d.participants.push({ eventId, userId: receiverId, role: 'player', status: 'invited', joinedAt: inv.createdAt });
      notify(d, { userId: receiverId, type: 'event_invite', title: 'Convite para pelada', body: `${findUser(d, actorId).name} convidou você para ${e.name}.`, link: '/convites', actorId, refId: inv.id });
    });
  },
  async listInvitations(userId) {
    await latency(350);
    return db.read((d) =>
      d.invitations
        .filter((i) => i.receiverId === userId && i.status === 'pending' && d.events.some((e) => e.id === i.eventId))
        .map<InvitationView>((i) => ({ ...i, event: summarize(d, findEvent(d, i.eventId), userId), sender: toPublic(findUser(d, i.senderId)) }))
    );
  },
  async respondInvitation(userId, invitationId, accept) {
    await latency(450);
    db.write((d) => {
      const inv = d.invitations.find((i) => i.id === invitationId && i.receiverId === userId);
      if (!inv) throw new AppError('NOT_FOUND', 'Convite não encontrado.');
      const e = findEvent(d, inv.eventId);
      const p = d.participants.find((x) => x.eventId === inv.eventId && x.userId === userId);
      if (accept) {
        const confirmed = d.participants.filter((x) => x.eventId === inv.eventId && x.status === 'confirmed').length;
        if (confirmed >= e.maxPlayers) throw new AppError('EVENT_FULL', 'A lista está completa.');
        if (p) p.status = 'confirmed';
        else d.participants.push({ eventId: e.id, userId, role: 'player', status: 'confirmed', joinedAt: new Date().toISOString() });
      } else if (p && p.status === 'invited') {
        d.participants = d.participants.filter((x) => x !== p);
      }
      inv.status = accept ? 'accepted' : 'declined';
      recomputeStatus(d, e);
    });
  }
};

// ————————————————————————————————— Games
const games: GameService = {
  async getTeams(eventId) {
    await latency(250);
    return db.read((d) => d.teams.filter((t) => t.eventId === eventId));
  },
  async saveTeams(actorId, eventId, teams) {
    await latency(400);
    return db.write((d) => {
      assertCan(d, eventId, actorId, 'teams.draw');
      d.teams = d.teams.filter((t) => t.eventId !== eventId).concat(teams);
      const rotation = { eventId, queue: teams.map((t) => t.id) };
      d.rotations = d.rotations.filter((r) => r.eventId !== eventId).concat(rotation);
      d.games = d.games.filter((g) => !(g.eventId === eventId && g.status !== 'finished'));
      return rotation;
    });
  },
  async getRotation(eventId) {
    return db.read((d) => d.rotations.find((r) => r.eventId === eventId) ?? null);
  },
  async listGames(eventId) {
    await latency(250);
    return db.read((d) => d.games.filter((g) => g.eventId === eventId).sort((a, b) => b.round - a.round));
  },
  async getCurrentGame(eventId) {
    return db.read((d) => d.games.find((g) => g.eventId === eventId && g.status !== 'finished') ?? null);
  },
  async createGame(actorId, eventId, teamAId, teamBId, durationMs) {
    return db.write((d) => {
      assertCan(d, eventId, actorId, 'games.control');
      const open = d.games.find((g) => g.eventId === eventId && g.status !== 'finished');
      if (open) return open;
      const round = d.games.filter((g) => g.eventId === eventId).length + 1;
      const game: Game = { id: uid('g'), eventId, round, teamAId, teamBId, scoreA: 0, scoreB: 0, timer: createTimer(durationMs), status: 'scheduled', events: [] };
      d.games.push(game);
      return game;
    });
  },
  async saveGame(actorId, game) {
    return db.write((d) => {
      assertCan(d, game.eventId, actorId, 'games.control');
      const idx = d.games.findIndex((g) => g.id === game.id);
      if (idx < 0) throw new AppError('NOT_FOUND', 'Partida não encontrada.');
      d.games[idx] = game;
      const e = findEvent(d, game.eventId);
      if (game.status === 'live' && e.status !== 'live') e.status = 'live';
      return game;
    });
  },
  async finishGame(actorId, game) {
    return db.write((d) => {
      assertCan(d, game.eventId, actorId, 'games.control');
      const idx = d.games.findIndex((g) => g.id === game.id);
      if (idx < 0) throw new AppError('NOT_FOUND', 'Partida não encontrada.');
      d.games[idx] = game;
      const e = findEvent(d, game.eventId);
      let rotation = d.rotations.find((r) => r.eventId === game.eventId);
      if (!rotation) {
        rotation = { eventId: game.eventId, queue: [game.teamAId, game.teamBId] };
        d.rotations.push(rotation);
      }
      rotation.queue = applyResult(rotation.queue, game, e.rotationRule);
      return { game, rotation };
    });
  }
};

// ————————————————————————————————— Notifications
const notifications: NotificationService = {
  async list(userId) {
    await latency(350);
    return db.read((d) => d.notifications.filter((n) => n.userId === userId));
  },
  async unreadCount(userId) {
    return db.read((d) => d.notifications.filter((n) => n.userId === userId && !n.read).length);
  },
  async markRead(userId, id) {
    db.write((d) => d.notifications.filter((n) => n.userId === userId && n.id === id).forEach((n) => (n.read = true)));
  },
  async markAllRead(userId) {
    db.write((d) => d.notifications.filter((n) => n.userId === userId).forEach((n) => (n.read = true)));
  }
};

// ————————————————————————————————— Storage
const storage: StorageService = {
  async uploadImage(file) {
    if (!file.type.startsWith('image/')) throw new AppError('VALIDATION', 'Envie um arquivo de imagem.');
    return resizeToDataUrl(file, 320);
  }
};

function resizeToDataUrl(file: File, max: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      resolve(c.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => reject(new AppError('VALIDATION', 'Não foi possível ler a imagem.'));
    img.src = URL.createObjectURL(file);
  });
}

export const mockServices: Services = { auth, users, events, games, notifications, storage };
export const resetMockData = () => db.reset();
