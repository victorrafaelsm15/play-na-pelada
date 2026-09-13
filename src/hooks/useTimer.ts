import { useEffect, useRef, useState } from 'react';
import type { TimerState } from '@/types';
import { isRunning, remaining } from '@/domain/timer';

/**
 * Deriva o tempo restante de timestamps (não de contagem de renders).
 * O intervalo apenas agenda re-renderizações; o valor vem sempre de Date.now().
 */
export function useTimer(timer: TimerState | undefined, onExpire?: () => void) {
  const [now, setNow] = useState(() => Date.now());
  const fired = useRef(false);
  const cb = useRef(onExpire);
  cb.current = onExpire;

  useEffect(() => {
    if (!timer || !isRunning(timer)) return;
    fired.current = remaining(timer) <= 0;
    const id = window.setInterval(() => setNow(Date.now()), 200);
    const onVis = () => setNow(Date.now());
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [timer]);

  const left = timer ? remaining(timer, isRunning(timer) ? now : undefined) : 0;

  useEffect(() => {
    if (timer && isRunning(timer) && left <= 0 && !fired.current) {
      fired.current = true;
      cb.current?.();
    }
  }, [left, timer]);

  return { remainingMs: left, running: !!timer && isRunning(timer) };
}

/** Apito: Web Audio + vibração quando permitido. */
export function whistle() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    [0, 0.45, 0.9].forEach((t, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'square';
      o.frequency.value = i === 2 ? 2300 : 2100;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + (i === 2 ? 0.8 : 0.3));
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + t);
      o.stop(ctx.currentTime + t + 0.9);
    });
    setTimeout(() => ctx.close(), 2500);
  } catch {
    /* áudio indisponível */
  }
  navigator.vibrate?.([300, 150, 300, 150, 600]);
}

/** Mantém a tela acesa durante a partida, quando o navegador suporta. */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    const request = () =>
      navigator.wakeLock.request('screen').then((l) => (lock = l)).catch(() => undefined);
    request();
    const onVis = () => document.visibilityState === 'visible' && request();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      lock?.release().catch(() => undefined);
    };
  }, [active]);
}
