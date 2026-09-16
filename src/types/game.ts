import type { EventId } from './event';
import type { UserId } from './user';

export interface Team {
  id: string;
  eventId: EventId;
  name: string;
  color: TeamColor;
  playerIds: UserId[];
  /** Ordem de exibição/sequência dos times (menor primeiro). */
  orderIndex?: number;
}

export type TeamColor = 'amarelo' | 'branco' | 'verde' | 'vermelho' | 'azul' | 'preto' | 'laranja' | 'roxo';

export type GameStatus = 'scheduled' | 'live' | 'paused' | 'finished';

/** Cronômetro baseado em timestamps: independe de renders. */
export interface TimerState {
  durationMs: number;
  accumulatedMs: number;
  /** epoch ms de quando voltou a correr; null se parado */
  runningSince: number | null;
}

interface GameEventBase {
  id: string;
  teamId: string;
  /** tempo de jogo (ms) em que ocorreu */
  atMs: number;
  createdAt: string;
}

export interface GoalEvent extends GameEventBase {
  type: 'goal';
  playerId?: UserId;
  assistId?: UserId;
}
// Futuro: CardEvent, FoulEvent, SubstitutionEvent...
export type GameEvent = GoalEvent;

export interface Game {
  id: string;
  eventId: EventId;
  round: number;
  teamAId: string;
  teamBId: string;
  scoreA: number;
  scoreB: number;
  timer: TimerState;
  startedAt?: string;
  finishedAt?: string;
  status: GameStatus;
  /** null = empate */
  winnerTeamId?: string | null;
  events: GameEvent[];
}

export interface Rotation {
  eventId: EventId;
  /** fila de times: [0] x [1] jogam agora */
  queue: string[];
}
