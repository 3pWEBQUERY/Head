import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { api } from '../api';
import { BrandMark } from '../components/Icons';
import { Shell } from '../components/Layout';
import { useMe } from '../lib/queries';
import { useToast } from '../lib/toast';
import type { Me } from '../types';

const QUOTES = [
  ['Ich schreibe, um herauszufinden, was ich denke.', 'Joan Didion'],
  ['Schreiben ist die Malerei der Stimme.', 'Voltaire'],
  ['Es gibt keine grössere Qual, als eine unerzählte Geschichte in sich zu tragen.', 'Maya Angelou'],
];

function AuthFrame({ children }: { children: ReactNode }) {
  const [q] = useState(() => QUOTES[Math.floor(Math.random() * QUOTES.length)]);
  return (
    <div className="auth">
      <div className="auth-art">
        <span className="rings" aria-hidden="true">
          <i style={{ width: 620, height: 620, background: '#0D1F58' }} />
          <i style={{ width: 460, height: 460, background: '#142767', right: -40, bottom: -40 }} />
          <i style={{ width: 300, height: 300, background: '#1B3075', right: 40, bottom: 40 }} />
        </span>
        <Link className="brand" to="/"><BrandMark /> Lapis</Link>
        <figure style={{ margin: 0 }}>
          <blockquote>„{q[0]}“</blockquote>
          <figcaption>{q[1]}</figcaption>
        </figure>
      </div>
      <div className="auth-form">{children}</div>
    </div>
  );
}

function useAuthDone() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  return (user: Me, to?: string) => {
    qc.setQueryData(['me'], user);
    qc.invalidateQueries();
    const next = params.get('weiter');
    navigate(to ?? (next && next.startsWith('/') && !next.startsWith('//') ? next : '/'), { replace: true });
  };
}

export function Login() {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const done = useAuthDone();
  const m = useMutation({ mutationFn: () => api<{ user: Me }>('/api/auth/login', { body: { login, password } }), onSuccess: (r) => done(r.user) });
  return (
    <AuthFrame>
      <form onSubmit={(e) => { e.preventDefault(); m.mutate(); }}>
        <Link className="brand hide-lg" to="/"><BrandMark /> Lapis</Link>
        <h1>Willkommen zurück</h1>
        <p className="sub">Schön, dass du wieder da bist.</p>
        <div className="field"><label className="label" htmlFor="login">E-Mail oder Name</label>
          <input id="login" className="input" autoComplete="username" value={login} onChange={(e) => setLogin(e.target.value)} required autoFocus /></div>
        <div className="field">
          <div className="label" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <label htmlFor="pw">Passwort</label>
            <Link to={`/passwort-vergessen${login.includes('@') ? `?email=${encodeURIComponent(login)}` : ''}`} className="label-link">Vergessen?</Link>
          </div>
          <input id="pw" className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
        {m.error && <div className="form-error" role="alert">{(m.error as Error).message}</div>}
        <button className="btn btn-primary btn-lg" type="submit" disabled={m.isPending}>Anmelden</button>
        <p className="alt">Neu hier? <Link to="/registrieren">Konto erstellen</Link></p>
      </form>
    </AuthFrame>
  );
}

export function Register() {
  const [name, setName] = useState('');
  const [handle, setHandle] = useState('');
  const [touched, setTouched] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [agree, setAgree] = useState(false);
  const done = useAuthDone();
  useEffect(() => {
    if (!touched) setHandle(name.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').normalize('NFKD').replace(/[^a-z0-9_.]+/g, '').slice(0, 24));
  }, [name, touched]);
  const m = useMutation({
    mutationFn: () => api<{ user: Me }>('/api/auth/register', { body: { name, handle, email, password } }),
    onSuccess: (r) => done(r.user, '/willkommen'),
  });
  return (
    <AuthFrame>
      <form onSubmit={(e) => { e.preventDefault(); m.mutate(); }}>
        <Link className="brand hide-lg" to="/"><BrandMark /> Lapis</Link>
        <h1>Ein Ort für deine Worte</h1>
        <p className="sub">Kostenlos, werbefrei, und du entscheidest, wer was liest.</p>
        <div className="field"><label className="label" htmlFor="name">Wie sollen wir dich nennen?</label>
          <input id="name" className="input" autoComplete="nickname" maxLength={40} value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
          <p className="help">Darf auch ein Pseudonym sein.</p></div>
        <div className="field"><label className="label" htmlFor="handle">Profilname</label>
          <div className="handle-input"><span>@</span><input id="handle" className="input" value={handle} maxLength={24} pattern="[a-z0-9_.]{3,24}" onChange={(e) => { setTouched(true); setHandle(e.target.value.toLowerCase()); }} required /></div>
          <p className="help">3–24 Zeichen: Kleinbuchstaben, Ziffern, Punkt, Unterstrich.</p></div>
        <div className="field"><label className="label" htmlFor="email">E-Mail</label>
          <input id="email" className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
        <div className="field"><label className="label" htmlFor="pw">Passwort</label>
          <input id="pw" className="input" type="password" autoComplete="new-password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required />
          <p className="help">Mindestens 8 Zeichen.</p></div>
        <label className="composer-switch" style={{ alignItems: 'flex-start' }}>
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} required style={{ marginTop: 3 }} />
          <span>Ich akzeptiere die <Link to="/nutzungsbedingungen" style={{ textDecoration: 'underline' }}>Nutzungsbedingungen</Link> und habe die <Link to="/datenschutz" style={{ textDecoration: 'underline' }}>Datenschutzerklärung</Link> gelesen.</span>
        </label>
        {m.error && <div className="form-error" role="alert">{(m.error as Error).message}</div>}
        <button className="btn btn-primary btn-lg" type="submit" disabled={m.isPending || !agree}>Konto erstellen</button>
        <p className="alt">Schon dabei? <Link to="/anmelden">Anmelden</Link></p>
      </form>
    </AuthFrame>
  );
}

export function ForgotPassword() {
  const [params] = useSearchParams();
  const [email, setEmail] = useState(params.get('email') ?? '');
  const m = useMutation({ mutationFn: () => api('/api/auth/forgot', { body: { email } }) });
  return (
    <AuthFrame>
      {m.isSuccess ? (
        <form onSubmit={(e) => e.preventDefault()}>
          <Link className="brand hide-lg" to="/"><BrandMark /> Lapis</Link>
          <h1>Schau in dein Postfach</h1>
          <p className="sub">Wenn es zu <b>{email}</b> ein Konto gibt, ist ein Link unterwegs. Er gilt eine Stunde.</p>
          <p className="note">Nichts angekommen? Sieh im Spam-Ordner nach oder <button type="button" className="label-link" onClick={() => m.reset()}>versuch es noch einmal</button>.</p>
          <p className="alt"><Link to="/anmelden">Zurück zur Anmeldung</Link></p>
        </form>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); m.mutate(); }}>
          <Link className="brand hide-lg" to="/"><BrandMark /> Lapis</Link>
          <h1>Passwort vergessen?</h1>
          <p className="sub">Passiert. Gib deine E-Mail-Adresse ein, wir schicken dir einen Link für ein neues.</p>
          <div className="field"><label className="label" htmlFor="email">E-Mail</label>
            <input id="email" className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus /></div>
          {m.error && <div className="form-error" role="alert">{(m.error as Error).message}</div>}
          <button className="btn btn-primary btn-lg" type="submit" disabled={m.isPending}>Link schicken</button>
          <p className="alt">Doch wieder eingefallen? <Link to="/anmelden">Anmelden</Link></p>
        </form>
      )}
    </AuthFrame>
  );
}

export function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [mismatch, setMismatch] = useState(false);
  const done = useAuthDone();
  const toast = useToast();
  const m = useMutation({
    mutationFn: () => api<{ user: Me }>('/api/auth/reset', { body: { token, password } }),
    onSuccess: (r) => { toast('Neues Passwort gespeichert. Du bist angemeldet.'); done(r.user, '/'); },
  });
  const expired = (m.error as any)?.code === 'reset_invalid' || !token;
  return (
    <AuthFrame>
      <form onSubmit={(e) => { e.preventDefault(); if (password !== repeat) return setMismatch(true); m.mutate(); }}>
        <Link className="brand hide-lg" to="/"><BrandMark /> Lapis</Link>
        <h1>Neues Passwort</h1>
        <p className="sub">Danach bist du direkt angemeldet. Auf allen anderen Geräten wirst du abgemeldet.</p>
        <div className="field"><label className="label" htmlFor="pw">Neues Passwort</label>
          <input id="pw" className="input" type="password" autoComplete="new-password" minLength={8} value={password} onChange={(e) => { setPassword(e.target.value); setMismatch(false); }} required autoFocus />
          <p className="help">Mindestens 8 Zeichen.</p></div>
        <div className="field"><label className="label" htmlFor="pw2">Noch einmal</label>
          <input id="pw2" className="input" type="password" autoComplete="new-password" minLength={8} value={repeat} onChange={(e) => { setRepeat(e.target.value); setMismatch(false); }} required /></div>
        {mismatch && <div className="form-error" role="alert">Die beiden Passwörter sind nicht gleich.</div>}
        {m.error && <div className="form-error" role="alert">{(m.error as Error).message}</div>}
        {expired && !m.error && <div className="form-error" role="alert">Dieser Link ist unvollständig. Öffne ihn direkt aus der E-Mail.</div>}
        <button className="btn btn-primary btn-lg" type="submit" disabled={m.isPending || !token}>Passwort speichern</button>
        {expired && <p className="alt"><Link to="/passwort-vergessen">Neuen Link anfordern</Link></p>}
      </form>
    </AuthFrame>
  );
}

export function RequireLogin() {
  const { loading } = useMe();
  if (loading) return null;
  return (
    <Shell>
      <div className="empty">
        <b>Dafür brauchst du ein Konto</b>
        <p>Mit einem Konto kannst du schreiben, ein privates Tagebuch führen, Texte merken und Menschen folgen.</p>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link className="btn btn-primary" to={`/registrieren?weiter=${encodeURIComponent(location.pathname)}`}>Konto erstellen</Link>
          <Link className="btn btn-quiet" to={`/anmelden?weiter=${encodeURIComponent(location.pathname)}`}>Anmelden</Link>
        </div>
      </div>
    </Shell>
  );
}
