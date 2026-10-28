import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';

type Toast = { msg: string; action?: { label: string; run: () => void }; ms?: number };
const Ctx = createContext<(t: Toast | string) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [t, setT] = useState<Toast | null>(null);
  const [show, setShow] = useState(false);
  const timer = useRef<number>(0);
  const toast = useCallback((x: Toast | string) => {
    const next = typeof x === 'string' ? { msg: x } : x;
    setT(next);
    setShow(true);
    clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setShow(false), next.ms ?? (next.action ? 6000 : 2200));
  }, []);
  return (
    <Ctx.Provider value={toast}>
      {children}
      <div className={`toast${show ? ' show' : ''}`} role="status" aria-live="polite">
        <span>{t?.msg}</span>
        {t?.action && (
          <button type="button" onClick={() => { setShow(false); t.action!.run(); }}>{t.action.label}</button>
        )}
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
