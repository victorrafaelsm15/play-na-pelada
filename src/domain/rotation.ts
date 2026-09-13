import type { Game, RotationRule } from '@/types';

export interface RotationView {
  now: [string, string] | null;
  next: { a: string | 'winner'; b: string } | null;
  waiting: string[];
}

/** Aplica o resultado de uma partida à fila de times. */
export function applyResult(queue: string[], game: Game, rule: RotationRule): string[] {
  if (queue.length < 2) return queue;
  const [a, b, ...rest] = queue;
  const draw = game.winnerTeamId == null;
  if (rule === 'round-robin' || draw || queue.length === 2) {
    return [...rest, a, b];
  }
  const winner = game.winnerTeamId!;
  const loser = winner === a ? b : a;
  return [winner, ...rest, loser];
}

export function describeRotation(queue: string[], rule: RotationRule): RotationView {
  if (queue.length < 2) return { now: null, next: null, waiting: queue };
  const [a, b, ...rest] = queue;
  if (rest.length === 0) return { now: [a, b], next: null, waiting: [] };
  if (rule === 'winner-stays') {
    return { now: [a, b], next: { a: 'winner', b: rest[0] }, waiting: rest.slice(1) };
  }
  const nextB = rest[1] ?? a;
  return { now: [a, b], next: { a: rest[0], b: nextB }, waiting: rest.slice(rest[1] ? 2 : 1) };
}

export function winnerOf(scoreA: number, scoreB: number, teamAId: string, teamBId: string): string | null {
  if (scoreA === scoreB) return null;
  return scoreA > scoreB ? teamAId : teamBId;
}

export const ROTATION_LABEL: Record<RotationRule, { title: string; hint: string }> = {
  'winner-stays': { title: 'Quem ganha fica', hint: 'Vencedor enfrenta o próximo; perdedor vai para o fim da fila. Empate: os dois saem.' },
  'round-robin': { title: 'Rodízio fixo', hint: 'Os times se revezam em ordem, independente do resultado.' }
};
