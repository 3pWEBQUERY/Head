import { useEffect, useState } from 'react';

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
let deferred: BIPEvent | null = null;
const subs = new Set<() => void>();

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferred = e as BIPEvent;
  subs.forEach((f) => f());
});
window.addEventListener('appinstalled', () => {
  deferred = null;
  subs.forEach((f) => f());
});

export const isStandalone = () => matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true;
export const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

/** Installations-Möglichkeit: nativer Dialog (Android/Chrome) oder Anleitung (iOS). */
export function useInstall() {
  const [, force] = useState(0);
  useEffect(() => {
    const f = () => force((n) => n + 1);
    subs.add(f);
    return () => { subs.delete(f); };
  }, []);
  if (isStandalone()) return { kind: 'installed' as const };
  if (deferred) {
    return {
      kind: 'prompt' as const,
      install: async () => {
        const d = deferred!;
        await d.prompt();
        await d.userChoice;
        deferred = null;
        force((n) => n + 1);
      },
    };
  }
  if (isIOS()) return { kind: 'ios' as const };
  return { kind: 'none' as const };
}
