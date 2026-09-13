import type { PublicUser, Team, TeamColor } from '@/types';
import { uid } from '@/lib/id';

export interface DrawConfig {
  eventId: string;
  teamsCount: number;
  playersPerTeam: number;
}

export interface DrawResult {
  teams: Team[];
  /** jogadores que excederam a capacidade dos times */
  bench: string[];
}

/** Estratégia de sorteio: novas estratégias (nível, posição) implementam esta interface. */
export interface DrawStrategy {
  id: string;
  label: string;
  draw(players: PublicUser[], config: DrawConfig): DrawResult;
}

export const TEAM_PALETTE: { color: TeamColor; name: string; hex: string; text: string }[] = [
  { color: 'amarelo', name: 'Amarelo', hex: '#FFC72C', text: '#2E2200' },
  { color: 'branco', name: 'Branco', hex: '#FFFFFF', text: '#14211C' },
  { color: 'verde', name: 'Verde', hex: '#2B8566', text: '#FFFFFF' },
  { color: 'vermelho', name: 'Vermelho', hex: '#E0442F', text: '#FFFFFF' },
  { color: 'azul', name: 'Azul', hex: '#2F6FE0', text: '#FFFFFF' },
  { color: 'preto', name: 'Preto', hex: '#1B1F1D', text: '#FFFFFF' },
  { color: 'laranja', name: 'Laranja', hex: '#F28A1E', text: '#2E1600' },
  { color: 'roxo', name: 'Roxo', hex: '#7A4BD6', text: '#FFFFFF' }
];

export function teamStyle(color: TeamColor) {
  return TEAM_PALETTE.find((p) => p.color === color) ?? TEAM_PALETTE[0];
}

export function secureShuffle<T>(input: T[]): T[] {
  const arr = [...input];
  for (let i = arr.length - 1; i > 0; i--) {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    const j = buf[0] % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function emptyTeams(config: DrawConfig): Team[] {
  return Array.from({ length: config.teamsCount }, (_, i) => ({
    id: uid('team'),
    eventId: config.eventId,
    name: `Time ${TEAM_PALETTE[i % TEAM_PALETTE.length].name}`,
    color: TEAM_PALETTE[i % TEAM_PALETTE.length].color,
    playerIds: []
  }));
}

/** Aleatório: preenche os times em sequência e envia excedentes ao banco. */
export const randomStrategy: DrawStrategy = {
  id: 'random',
  label: 'Aleatório',
  draw(players, config) {
    const teams = emptyTeams(config);
    const shuffled = secureShuffle(players.map((p) => p.id));
    const capacity = config.teamsCount * config.playersPerTeam;
    shuffled.slice(0, capacity).forEach((id, i) => teams[i % config.teamsCount].playerIds.push(id));
    return { teams, bench: shuffled.slice(capacity) };
  }
};

/** Equilibrado por nível (snake draft). Pronto para quando o nível dos jogadores for coletado. */
export const balancedStrategy: DrawStrategy = {
  id: 'balanced',
  label: 'Equilibrado por nível',
  draw(players, config) {
    const teams = emptyTeams(config);
    const capacity = config.teamsCount * config.playersPerTeam;
    const ordered = secureShuffle(players).sort((a, b) => (b.skill ?? 3) - (a.skill ?? 3));
    const inPlay = ordered.slice(0, capacity);
    inPlay.forEach((p, i) => {
      const round = Math.floor(i / config.teamsCount);
      const pos = i % config.teamsCount;
      const idx = round % 2 === 0 ? pos : config.teamsCount - 1 - pos;
      teams[idx].playerIds.push(p.id);
    });
    return { teams, bench: ordered.slice(capacity).map((p) => p.id) };
  }
};

export const DRAW_STRATEGIES: DrawStrategy[] = [randomStrategy, balancedStrategy];
