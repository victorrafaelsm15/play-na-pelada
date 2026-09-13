import type { EventStatus, PlayerPosition } from '@/types';

const WEEKDAYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export function parseLocalDate(date: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function todayISO(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function formatDay(date: string): string {
  const d = parseLocalDate(date);
  const diff = Math.round((d.getTime() - parseLocalDate(todayISO()).getTime()) / 86400000);
  if (diff === 0) return 'Hoje';
  if (diff === 1) return 'Amanhã';
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function dateParts(date: string) {
  const d = parseLocalDate(date);
  return { day: String(d.getDate()).padStart(2, '0'), month: MONTHS[d.getMonth()], weekday: WEEKDAYS[d.getDay()] };
}

export function formatMoney(cents?: number): string {
  if (!cents) return 'Gratuita';
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'agora';
  const m = Math.floor(s / 60);
  if (m < 60) return `há ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  return d === 1 ? 'ontem' : `há ${d} dias`;
}

export const STATUS_LABEL: Record<EventStatus, string> = {
  waiting: 'Aguardando jogadores',
  confirmed: 'Confirmada',
  live: 'Em andamento',
  finished: 'Finalizada',
  cancelled: 'Cancelada'
};

export const POSITION_LABEL: Record<PlayerPosition, string> = {
  goleiro: 'Goleiro',
  zagueiro: 'Zagueiro',
  lateral: 'Lateral',
  volante: 'Volante',
  meia: 'Meia',
  ponta: 'Ponta',
  atacante: 'Atacante',
  coringa: 'Coringa'
};

export function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join('');
}
