import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { LIMITS } from '../../../shared/constants';
import { api } from '../api';
import { Avatar, Dialog, ThemeToggle } from '../components/bits';
import { IDownload, IImage, IInstall, ILogout } from '../components/Icons';
import { Shell, useLogout } from '../components/Layout';
import { useInstall } from '../lib/install';
import { useMe } from '../lib/queries';
import { useToast } from '../lib/toast';
import type { Me } from '../types';
import { RequireLogin } from './Auth';

export function Settings() {
  const { me } = useMe();
  if (!me) return <RequireLogin />;
  return <SettingsForm me={me} />;
}

function SettingsForm({ me }: { me: Me }) {
  const qc = useQueryClient();
  const toast = useToast();
  const logout = useLogout();
  const navigate = useNavigate();
  const inst = useInstall();
  const file = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(me.name);
  const [bio, setBio] = useState(me.bio);
  const [pw, setPw] = useState({ current: '', next: '' });
  const [del, setDel] = useState(false);
  const [delPw, setDelPw] = useState('');

  const save = useMutation({
    mutationFn: (body: object) => api<{ user: Me }>('/api/me', { method: 'PATCH', body }),
    onSuccess: (r) => { qc.setQueryData(['me'], r.user); qc.invalidateQueries({ queryKey: ['user', me.handle] }); toast('Gespeichert'); },
    onError: (e: Error) => toast(e.message),
  });
  const changePw = useMutation({
    mutationFn: () => api('/api/auth/password', { body: pw }),
    onSuccess: () => { setPw({ current: '', next: '' }); toast('Passwort geändert. Andere Geräte wurden abgemeldet.'); },
    onError: (e: Error) => toast(e.message),
  });
  const remove = useMutation({
    mutationFn: () => api('/api/auth/account', { method: 'DELETE', body: { password: delPw } }),
    onSuccess: async () => { try { await caches.delete('lapis-api'); } catch {} qc.clear(); navigate('/'); toast('Dein Konto und alle Texte sind gelöscht.'); },
    onError: (e: Error) => toast(e.message),
  });

  async function upload(f: File) {
    const fd = new FormData();
    fd.append('file', f);
    try {
      const r = await api<{ key: string }>('/api/media?purpose=avatar', { body: fd });
      save.mutate({ avatarKey: r.key });
    } catch (e) { toast((e as Error).message); }
  }

  return (
    <Shell>
      <div className="page-head"><h1>Einstellungen</h1></div>
      <div className="settings" style={{ paddingTop: 22 }}>
        <section>
          <h2>Profil</h2>
          <div className="row">
            <Avatar person={me} size="xl" />
            <input ref={file} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ''; }} />
            <button type="button" className="btn btn-quiet btn-sm" onClick={() => file.current?.click()}><IImage size={16} /> Bild ändern</button>
            {me.avatar && <button type="button" className="btn btn-ghost btn-sm" onClick={() => save.mutate({ avatarKey: null })}>Entfernen</button>}
          </div>
          <form style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 480 }} onSubmit={(e) => { e.preventDefault(); save.mutate({ name, bio }); }}>
            <div className="field"><label className="label" htmlFor="s-name">Name</label><input id="s-name" className="input" value={name} maxLength={LIMITS.displayName} onChange={(e) => setName(e.target.value)} /></div>
            <div className="field"><label className="label" htmlFor="s-bio">Über dich <span className="hint">{bio.length}/{LIMITS.bio}</span></label>
              <textarea id="s-bio" className="textarea" value={bio} maxLength={LIMITS.bio} onChange={(e) => setBio(e.target.value)} placeholder="Ein, zwei Sätze. Oder eine Zeile aus einem Lieblingsgedicht." /></div>
            <p className="note">@{me.handle} · {me.email}</p>
            <div><button className="btn btn-primary btn-sm" type="submit" disabled={save.isPending}>Speichern</button></div>
          </form>
        </section>

        <section>
          <h2>Darstellung</h2>
          <div className="row"><ThemeToggle /><span className="note">Hell oder dunkel – wird auf diesem Gerät gemerkt.</span></div>
        </section>

        {inst.kind !== 'none' && (
          <section className="install-hint">
            <h2>App</h2>
            {inst.kind === 'installed' && <p className="note">Lapis läuft als App. Schön.</p>}
            {inst.kind === 'prompt' && <div><button className="btn btn-quiet btn-sm" type="button" onClick={inst.install}><IInstall size={16} /> Lapis installieren</button></div>}
            {inst.kind === 'ios' && <p style={{ margin: 0, color: 'var(--ink-2)' }}>Tippe in Safari auf <b>Teilen</b> und dann auf <b>Zum Home-Bildschirm</b>. Lapis öffnet sich dann wie eine App, im Vollbild.</p>}
          </section>
        )}

        <section>
          <h2>Passwort</h2>
          <form style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 480 }} onSubmit={(e) => { e.preventDefault(); changePw.mutate(); }}>
            <input className="input" type="password" autoComplete="current-password" placeholder="Aktuelles Passwort" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} required />
            <input className="input" type="password" autoComplete="new-password" placeholder="Neues Passwort (mind. 8 Zeichen)" minLength={8} value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} required />
            <div><button className="btn btn-quiet btn-sm" type="submit" disabled={changePw.isPending}>Passwort ändern</button></div>
          </form>
        </section>

        <section>
          <h2>Deine Daten</h2>
          <p style={{ margin: 0, color: 'var(--ink-2)' }}>Alles, was du geschrieben hast, gehört dir. Lade es jederzeit als Datei herunter – auch dein privates Tagebuch.</p>
          <div className="row">
            <a className="btn btn-quiet btn-sm" href="/api/auth/export" download><IDownload size={16} /> Alles exportieren (JSON)</a>
            <button className="btn btn-ghost btn-sm" type="button" onClick={logout}><ILogout size={16} /> Abmelden</button>
          </div>
        </section>

        <section>
          <h2>Konto löschen</h2>
          <p style={{ margin: 0, color: 'var(--ink-2)' }}>Löscht dein Konto, alle Texte, Kommentare und Bilder. Sofort und endgültig.</p>
          <div><button className="btn btn-danger btn-sm" type="button" onClick={() => setDel(true)}>Konto löschen …</button></div>
        </section>
      </div>
      <Dialog open={del} onClose={() => setDel(false)} label="Konto löschen">
        <h2>Wirklich alles löschen?</h2>
        <p>Exportiere vorher deine Texte, wenn du sie behalten möchtest. Gib zur Bestätigung dein Passwort ein.</p>
        <input className="input" type="password" autoComplete="current-password" value={delPw} onChange={(e) => setDelPw(e.target.value)} placeholder="Passwort" />
        <div className="row">
          <button className="btn btn-ghost" type="button" onClick={() => setDel(false)}>Abbrechen</button>
          <button className="btn btn-danger" type="button" disabled={!delPw || remove.isPending} onClick={() => remove.mutate()}>Endgültig löschen</button>
        </div>
      </Dialog>
    </Shell>
  );
}
