import type { MockDB } from './db';
import type { Participant, PeladaEvent, PlayerPosition, User } from '@/types';
import { todayISO } from '@/lib/format';

/** Dados de demonstração. Isolados aqui: nenhuma tela importa este arquivo. */
export function buildSeed(version: number): MockDB {
  const ago = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();

  const people: [string, string, string, PlayerPosition, number][] = [
    ['u_demo', 'Victor Almeida', 'victor', 'meia', 4],
    ['u_rafa', 'Rafael Moura', 'rafamoura', 'atacante', 4],
    ['u_bruno', 'Bruno Carvalho', 'brunocarv', 'zagueiro', 3],
    ['u_camila', 'Camila Rocha', 'camilarocha', 'ponta', 4],
    ['u_diego', 'Diego Nunes', 'diegon', 'goleiro', 3],
    ['u_lucas', 'Lucas Ferreira', 'lucasf', 'volante', 3],
    ['u_joao', 'João Pedro Lima', 'jplima', 'lateral', 2],
    ['u_mateus', 'Mateus Sousa', 'mateus10', 'meia', 5],
    ['u_thiago', 'Thiago Barros', 'tbarros', 'atacante', 3],
    ['u_gabriel', 'Gabriel Costa', 'gabcosta', 'zagueiro', 4],
    ['u_felipe', 'Felipe Araújo', 'felipearaujo', 'coringa', 3],
    ['u_andre', 'André Mendes', 'andremendes', 'goleiro', 2],
    ['u_caio', 'Caio Ribeiro', 'caiorib', 'lateral', 3],
    ['u_renan', 'Renan Oliveira', 'renan.o', 'volante', 4],
    ['u_igor', 'Igor Santana', 'igorsantana', 'ponta', 3],
    ['u_paulo', 'Paulo Henrique', 'ph7', 'atacante', 5],
    ['u_marcos', 'Marcos Vinícius', 'marcosv', 'zagueiro', 2],
    ['u_leo', 'Leonardo Dias', 'leodias', 'meia', 4],
    ['u_samuel', 'Samuel Freitas', 'samuelf', 'lateral', 3],
    ['u_henrique', 'Henrique Pires', 'hpires', 'volante', 3]
  ];

  const users: User[] = people.map(([id, name, username, position, skill], i) => ({
    id,
    publicId: String(48291 + i * 137),
    username,
    name,
    email: `${username.replace('.', '')}@racha.app`,
    position,
    skill,
    bio: i === 0 ? 'Camisa 8 de quinta à noite. Organizo o racha do parque há três anos.' : undefined,
    socialLinks: { instagram: i === 0 ? 'victor.almeida' : undefined, whatsapp: undefined, others: [] },
    titles:
      i === 0
        ? [
            { id: 't1', name: 'Campeão da Copa de Society', year: 2025, description: 'Time Amarelo, final nos pênaltis.' },
            { id: 't2', name: 'Artilheiro do Racha de Quinta', year: 2024 }
          ]
        : [],
    videos: i === 0 ? [{ id: 'v1', title: 'Gol de falta na final', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }] : [],
    dominantFoot: 'direito',
    createdAt: ago(24 * 200 - i)
  }));
  users[0].email = 'demo@racha.app';

  const ev = (e: Partial<PeladaEvent> & Pick<PeladaEvent, 'id' | 'name' | 'organizerId'>): PeladaEvent => ({
    description: '',
    date: todayISO(2),
    time: '20:00',
    location: { name: 'Arena Society', address: 'Rua das Palmeiras, 120 — Centro' },
    privacy: 'public',
    joinPolicy: 'auto',
    maxPlayers: 18,
    playersPerTeam: 5,
    teamsCount: 3,
    matchDurationMin: 10,
    rotationRule: 'winner-stays',
    status: 'waiting',
    createdAt: ago(72),
    updatedAt: ago(10),
    ...e
  });

  const events: PeladaEvent[] = [
    ev({
      id: 'e_quinta', name: 'Racha de Quinta', organizerId: 'u_demo', date: todayISO(2), time: '20:00',
      description: 'Society 5x5 com goleiro revezando. Chegue 15 minutos antes para o sorteio.',
      location: { name: 'Arena Parque Society', address: 'Av. dos Ipês, 850 — Jardim Primavera', court: 'Campo 2' },
      maxPlayers: 18, playersPerTeam: 5, teamsCount: 3, matchDurationMin: 10, priceCents: 2000, status: 'confirmed',
      notes: 'Pix para o organizador até quarta.'
    }),
    ev({
      id: 'e_sabado', name: 'Pelada dos Amigos', organizerId: 'u_demo', date: todayISO(5), time: '16:00',
      privacy: 'private', joinPolicy: 'approval', maxPlayers: 14, playersPerTeam: 7, teamsCount: 2, matchDurationMin: 20,
      location: { name: 'Quadra do Condomínio', address: 'Rua Álvaro Mendes, 300 — Centro' }
    }),
    ev({
      id: 'e_leste', name: 'Fut7 da Zona Leste', organizerId: 'u_rafa', date: todayISO(1), time: '19:30',
      joinPolicy: 'approval', maxPlayers: 21, playersPerTeam: 7, teamsCount: 3, matchDurationMin: 15, priceCents: 1500,
      description: 'Nível intermediário. Chuteira society obrigatória.',
      location: { name: 'Society Leste', address: 'Rua Nova, 45 — Bairro Leste' }
    }),
    ev({
      id: 'e_servidores', name: 'Racha dos Servidores', organizerId: 'u_bruno', date: todayISO(3), time: '06:30',
      maxPlayers: 20, playersPerTeam: 5, teamsCount: 4, matchDurationMin: 8, status: 'confirmed',
      location: { name: 'Campo do Clube', address: 'Av. Principal, 1200 — Setor Sul' }
    }),
    ev({
      id: 'e_premium', name: 'Society Premium', organizerId: 'u_camila', date: todayISO(4), time: '21:00',
      maxPlayers: 12, playersPerTeam: 6, teamsCount: 2, matchDurationMin: 25, priceCents: 3500, status: 'confirmed',
      location: { name: 'Arena Premium', address: 'Rua do Sol, 77 — Bairro Norte' }
    }),
    ev({
      id: 'e_domingo', name: 'Domingão do Diego', organizerId: 'u_diego', date: todayISO(6), time: '08:00',
      privacy: 'private', joinPolicy: 'approval', maxPlayers: 16, playersPerTeam: 8, teamsCount: 2, matchDurationMin: 30,
      location: { name: 'Campo de Areia', address: 'Praça Central, s/n — Vila Nova' }
    })
  ];

  const participants: Participant[] = [];
  const add = (eventId: string, userId: string, role: Participant['role'] = 'player', status: Participant['status'] = 'confirmed') =>
    participants.push({ eventId, userId, role, status, joinedAt: ago(48) });
  const ids = users.map((u) => u.id);

  add('e_quinta', 'u_demo', 'owner');
  ids.slice(1, 15).forEach((id, i) => add('e_quinta', id, i === 0 ? 'organizer' : 'player'));
  add('e_quinta', 'u_leo', 'player', 'pending');

  add('e_sabado', 'u_demo', 'owner');
  ids.slice(5, 14).forEach((id) => add('e_sabado', id));

  add('e_leste', 'u_rafa', 'owner');
  ids.slice(6, 16).forEach((id) => add('e_leste', id));

  add('e_servidores', 'u_bruno', 'owner');
  ['u_demo', 'u_joao', 'u_caio', 'u_renan', 'u_igor', 'u_paulo', 'u_samuel', 'u_henrique'].forEach((id) => add('e_servidores', id));

  add('e_premium', 'u_camila', 'owner');
  ids.slice(8, 19).forEach((id) => add('e_premium', id));

  add('e_domingo', 'u_diego', 'owner');
  ids.slice(9, 14).forEach((id) => add('e_domingo', id));
  add('e_domingo', 'u_demo', 'player', 'invited');

  return {
    version,
    users,
    credentials: users.map((u) => ({ userId: u.id, password: 'racha123' })),
    friendships: [
      ...['u_rafa', 'u_bruno', 'u_camila', 'u_lucas', 'u_mateus', 'u_thiago'].map((id, i) => ({
        id: `f_${i}`, requesterId: 'u_demo', addresseeId: id, status: 'accepted' as const, createdAt: ago(500)
      })),
      { id: 'f_in', requesterId: 'u_diego', addresseeId: 'u_demo', status: 'pending', createdAt: ago(5) },
      { id: 'f_out', requesterId: 'u_demo', addresseeId: 'u_paulo', status: 'pending', createdAt: ago(30) }
    ],
    events,
    participants,
    invitations: [{ id: 'i_domingo', senderId: 'u_diego', receiverId: 'u_demo', eventId: 'e_domingo', status: 'pending', createdAt: ago(3) }],
    teams: [],
    rotations: [],
    games: [],
    notifications: [
      { id: 'n1', userId: 'u_demo', type: 'event_invite', title: 'Convite para pelada', body: 'Diego Nunes convidou você para Domingão do Diego.', link: '/convites', actorId: 'u_diego', refId: 'i_domingo', read: false, createdAt: ago(3) },
      { id: 'n2', userId: 'u_demo', type: 'join_request', title: 'Pedido de participação', body: 'Leonardo Dias quer entrar em Racha de Quinta.', link: '/peladas/e_quinta/gerenciar?aba=pedidos', actorId: 'u_leo', read: false, createdAt: ago(4) },
      { id: 'n3', userId: 'u_demo', type: 'friend_request', title: 'Pedido de amizade', body: 'Diego Nunes quer adicionar você.', link: '/amigos', actorId: 'u_diego', refId: 'f_in', read: false, createdAt: ago(5) },
      { id: 'n4', userId: 'u_demo', type: 'game_soon', title: 'Pelada chegando', body: 'Racha dos Servidores é em 3 dias, às 06:30.', link: '/peladas/e_servidores', read: true, createdAt: ago(20) },
      { id: 'n5', userId: 'u_demo', type: 'added_to_event', title: 'Você entrou na lista', body: 'Bruno Carvalho confirmou você em Racha dos Servidores.', link: '/peladas/e_servidores', actorId: 'u_bruno', read: true, createdAt: ago(40) }
    ].map((n) => ({ ...n, type: n.type as MockDB['notifications'][number]['type'] }))
  };
}
