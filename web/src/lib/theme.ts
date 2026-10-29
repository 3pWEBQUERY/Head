import { useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';

function current(): Theme {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

export function applyTheme(t: Theme, save = true) {
  document.documentElement.setAttribute('data-theme', t);
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', t === 'dark' ? '#0D0F14' : '#F7F4F0'));
  if (save) {
    try { localStorage.setItem('lapis-theme', t); } catch {}
  }
  window.dispatchEvent(new CustomEvent('lapis-theme', { detail: t }));
}

export function useTheme(): [Theme, (t: Theme) => void] {
  const [t, setT] = useState<Theme>(current);
  useEffect(() => {
    const on = () => setT(current());
    window.addEventListener('lapis-theme', on);
    return () => window.removeEventListener('lapis-theme', on);
  }, []);
  return [t, applyTheme];
}
