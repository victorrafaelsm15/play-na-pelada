import type { TimerState } from '@/types';

export function createTimer(durationMs: number): TimerState {
  return { durationMs, accumulatedMs: 0, runningSince: null };
}

export function elapsed(t: TimerState, now = Date.now()): number {
  return t.accumulatedMs + (t.runningSince ? now - t.runningSince : 0);
}

export function remaining(t: TimerState, now = Date.now()): number {
  return Math.max(0, t.durationMs - elapsed(t, now));
}

export function isRunning(t: TimerState) {
  return t.runningSince !== null;
}

export function start(t: TimerState, now = Date.now()): TimerState {
  return t.runningSince ? t : { ...t, runningSince: now };
}

export function pause(t: TimerState, now = Date.now()): TimerState {
  if (!t.runningSince) return t;
  return { ...t, accumulatedMs: Math.min(t.durationMs, elapsed(t, now)), runningSince: null };
}

export function reset(t: TimerState): TimerState {
  return { ...t, accumulatedMs: 0, runningSince: null };
}

export function setDuration(t: TimerState, durationMs: number): TimerState {
  return { ...t, durationMs };
}

export function formatClock(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
