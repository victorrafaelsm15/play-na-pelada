import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** Chamado cedo (main.tsx) para não perder o evento disparado antes da montagem. */
export function captureInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    emit();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    emit();
  });
}

export function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function useInstallPrompt() {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => void listeners.delete(l);
  }, []);

  const standalone = isStandalone();
  return {
    /** o navegador ofereceu instalação nativa */
    canInstall: !!deferred && !standalone,
    /** iOS não dispara o evento: mostrar instrução manual */
    showIOSHint: !deferred && !standalone && isIOS(),
    installed: standalone,
    async install() {
      if (!deferred) return 'unavailable' as const;
      await deferred.prompt();
      const { outcome } = await deferred.userChoice;
      deferred = null;
      emit();
      return outcome;
    }
  };
}
