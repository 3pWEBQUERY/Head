import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router';
import { countWords, KINDS, KIND_KEYS, MOOD_GROUPS, MOODS, RESPONSE_MODES, VISIBILITY, WORDS_PER_MINUTE, type Kind, type Mood, type ResponseMode, type Visibility } from '../../../shared/constants';
import { api, ApiError } from '../api';
import type { Editor as TiptapEditor } from '@tiptap/react';
import { Spinner, Switch, ThemeToggle } from '../components/bits';
import { FormatBar, RichEditor } from '../components/RichEditor';
import { IBack, IClose, IContinue, IEye, IGear, IImage, ILock, IMask, IUsers } from '../components/Icons';
import { useOnline } from '../components/Layout';
import { ago } from '../lib/format';
import { useMe, useRooms } from '../lib/queries';
import { useToast } from '../lib/toast';
import type { Post } from '../types';

type Draft = {
  kind: Kind;
  title: string;
  body: string;
  mood: Mood | null;
  visibility: Visibility;
  anonymous: boolean;
  contentWarning: string;
  responseMode: ResponseMode;
  allowContinuation: boolean;
  continuesPostId: number | null;
  promptDay: string | null;
  coverKey: string | null;
  cover: string | null;
  room: string | null;
  unlockAt: string | null;
};

const EMPTY: Draft = {
  kind: 'moment', title: '', body: '', mood: null, visibility: 'public', anonymous: false, contentWarning: '',
  responseMode: 'open', allowContinuation: false, continuesPostId: null, promptDay: null, coverKey: null, cover: null, room: 'heute', unlockAt: null,
};

const DEFAULT_ROOM: Record<Kind, string> = {
  moment: 'heute', tagebuch: 'tagebuch', geschichte: 'kurzgeschichten', gedicht: 'lyrik', brief: 'briefe', gedanke: 'gedankenstrich',
};

const local = {
  key: (id: number | null) => `lapis-draft-${id ?? 'neu'}`,
  get(id: number | null): Draft | null {
    try { const s = localStorage.getItem(this.key(id)); return s ? JSON.parse(s) : null; } catch { return null; }
  },
  set(id: number | null, d: Draft) { try { localStorage.setItem(this.key(id), JSON.stringify(d)); } catch {} },
  clear(id: number | null) { try { localStorage.removeItem(this.key(id)); } catch {} },
};

function fromPost(p: Post): Draft {
  return {
    kind: p.kind, title: p.title, body: p.body, mood: p.mood, visibility: p.visibility, anonymous: p.anonymous,
    contentWarning: p.contentWarning ?? '', responseMode: p.responseMode, allowContinuation: p.allowContinuation,
    continuesPostId: p.continues?.id ?? null, promptDay: p.promptDay, coverKey: p.coverKey ?? null, cover: p.cover,
    room: p.room?.slug ?? null, unlockAt: p.unlockAt,
  };
}

function payload(d: Draft, publish: boolean) {
  const { cover, ...rest } = d;
  return { ...rest, contentWarning: d.contentWarning.trim() || null, room: d.visibility === 'private' ? null : d.room, publish };
}

export function Write() {
  const { id } = useParams();
  const { me, loading } = useMe();
  const navigate = useNavigate();
  const postId = id ? Number(id) : null;
  const existing = useQuery({ queryKey: ['post', postId], queryFn: () => api<{ post: Post }>(`/api/posts/${postId}`), enabled: Boolean(postId && me) });

  useEffect(() => { if (!loading && !me) navigate('/anmelden?weiter=' + encodeURIComponent(location.pathname + location.search), { replace: true }); }, [loading, me]);
  if (loading || !me || (postId && existing.isLoading)) return <Spinner />;
  if (postId && (existing.isError || !existing.data?.post.mine || existing.data.post.sealed)) {
    return <div className="empty" style={{ paddingTop: 120 }}><b>Diesen Text kannst du nicht bearbeiten</b><Link className="btn btn-quiet" to="/">Zur Startseite</Link></div>;
  }
  return <Editor key={postId ?? 'neu'} initialId={postId} post={existing.data?.post ?? null} />;
}

function Editor({ initialId, post }: { initialId: number | null; post: Post | null }) {
  const navigate = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();
  const online = useOnline();
  const rooms = useRooms();
  const [params] = useSearchParams();
  const { state } = useLocation() as { state: { draft?: Partial<Draft> } | null };
  const published = post?.status === 'published';

  const [d, setD] = useState<Draft>(() => {
    if (post) return { ...fromPost(post), ...(local.get(post.id) && !published ? local.get(post.id)! : {}) };
    const fromComposer = state?.draft;
    const shared = [params.get('title'), params.get('text'), params.get('url')].filter(Boolean);
    if (fromComposer) return { ...EMPTY, ...fromComposer };
    if (shared.length) return { ...EMPTY, kind: 'gedanke', room: 'gedankenstrich', title: params.get('title') ?? '', body: [params.get('text'), params.get('url')].filter(Boolean).join('\n\n') };
    const base: Draft = { ...EMPTY };
    const kind = params.get('form') as Kind | null;
    if (kind && KINDS[kind]) { base.kind = kind; base.room = DEFAULT_ROOM[kind]; }
    if (params.get('impuls')) { base.promptDay = params.get('impuls'); base.kind = kind ?? 'gedanke'; base.room = DEFAULT_ROOM[base.kind]; }
    if (params.get('weiter')) { base.continuesPostId = Number(params.get('weiter')); base.kind = 'geschichte'; base.room = 'kurzgeschichten'; }
    if (params.get('privat')) { base.visibility = 'private'; base.kind = kind ?? 'tagebuch'; }
    const restored = !params.toString() ? local.get(null) : null;
    return restored && (restored.body || restored.title) ? restored : base;
  });
  const [id, setId] = useState<number | null>(initialId);
  const [status, setStatus] = useState<'idle' | 'dirty' | 'saving' | 'saved' | 'error'>(post ? 'saved' : 'idle');
  const [savedAt, setSavedAt] = useState<string | null>(post?.updatedAt ?? null);
  const [err, setErr] = useState('');
  const [panel, setPanel] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editor, setEditor] = useState<TiptapEditor | null>(null);
  const [, tick] = useState(0);
  const saving = useRef<Promise<number | null> | null>(null);
  const latest = useRef(d);
  latest.current = d;
  const idRef = useRef(id);
  idRef.current = id;

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => { setD((x) => ({ ...x, [k]: v })); setStatus('dirty'); setErr(''); };

  // Lokale Sicherung bei jeder Änderung – auch offline geht nichts verloren.
  useEffect(() => { if (status === 'dirty') local.set(id, d); }, [d, status, id]);
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 15_000); return () => clearInterval(t); }, []);

  const saveDraft = useCallback(async (): Promise<number | null> => {
    if (saving.current) await saving.current.catch(() => {});
    const cur = latest.current;
    if (!cur.body.trim() && !cur.title.trim()) return idRef.current;
    const run = (async () => {
      setStatus('saving');
      try {
        if (idRef.current) {
          await api(`/api/posts/${idRef.current}`, { method: 'PATCH', body: payload(cur, false) });
        } else {
          const r = await api<{ id: number }>('/api/posts', { body: payload(cur, false) });
          local.clear(null);
          setId(r.id);
          idRef.current = r.id;
          window.history.replaceState(window.history.state, '', `/schreiben/${r.id}`);
        }
        local.clear(idRef.current);
        setStatus(latest.current === cur ? 'saved' : 'dirty');
        setSavedAt(new Date().toISOString());
        qc.invalidateQueries({ queryKey: ['overview'] });
        return idRef.current;
      } catch (e) {
        setStatus('error');
        if (e instanceof ApiError && e.code !== 'offline') setErr(e.message);
        return idRef.current;
      } finally {
        saving.current = null;
      }
    })();
    saving.current = run;
    return run;
  }, [qc]);

  // Entwürfe speichern sich selbst. Veröffentlichte Texte erst auf Knopfdruck.
  useEffect(() => {
    if (status !== 'dirty' || published || !online) return;
    const t = setTimeout(saveDraft, 1500);
    return () => clearTimeout(t);
  }, [d, status, published, online, saveDraft]);

  async function publish() {
    setErr('');
    if (!countWords(d.body) && !countWords(d.title)) return setErr('Ein leeres Blatt kann man nicht veröffentlichen.');
    setBusy(true);
    try {
      let target = idRef.current;
      if (target) await api(`/api/posts/${target}`, { method: 'PATCH', body: payload(d, true) });
      else target = (await api<{ id: number }>('/api/posts', { body: payload(d, true) })).id;
      local.clear(idRef.current);
      local.clear(null);
      qc.invalidateQueries({ queryKey: ['feed'] });
      qc.invalidateQueries({ queryKey: ['post', target] });
      qc.invalidateQueries({ queryKey: ['overview'] });
      qc.invalidateQueries({ queryKey: ['prompt'] });
      toast(published ? 'Änderungen gespeichert.' : d.visibility === 'private' ? (d.unlockAt ? 'Zeitkapsel versiegelt.' : 'Sicher in deinem Tagebuch.') : 'Veröffentlicht. Danke fürs Teilen.');
      navigate(`/text/${target}`, { replace: true });
    } catch (e) {
      setErr((e as Error).message);
      setPanel(true);
    } finally {
      setBusy(false);
    }
  }

  async function upload(file: File) {
    const fd = new FormData();
    fd.append('file', file);
    try {
      const r = await api<{ key: string; url: string }>('/api/media?purpose=cover', { body: fd });
      setD((x) => ({ ...x, coverKey: r.key, cover: r.url }));
      setStatus('dirty');
    } catch (e) {
      toast((e as Error).message);
    }
  }

  const words = countWords(d.body);
  const minutes = Math.max(1, Math.round(words / WORDS_PER_MINUTE));
  const actionLabel = published ? 'Speichern' : d.visibility === 'private' ? (d.unlockAt ? 'Versiegeln' : 'Ins Tagebuch') : 'Veröffentlichen';
  const statusText = !online ? 'Offline · lokal gesichert'
    : status === 'saving' ? 'Speichert …'
    : status === 'error' ? 'Nicht gespeichert'
    : status === 'dirty' ? (published ? 'Ungespeicherte Änderungen' : 'Änderungen …')
    : savedAt ? `${published ? 'Veröffentlicht' : 'Entwurf gesichert'} · ${ago(savedAt)}`
    : 'Neuer Text';

  return (
    <div className="editor-shell">
      <div className="editor-top">
        <div className="editor-top-in">
          <button type="button" className="icon-btn" aria-label="Zurück" onClick={async () => { if (status === 'dirty' && !published) await saveDraft(); history.length > 1 ? navigate(-1) : navigate('/'); }}><IBack /></button>
          <span className="status" role="status"><i className={`dot${status === 'saving' || status === 'dirty' ? ' pending' : ''}${!online || status === 'error' ? ' off' : ''}`} />{statusText}</span>
          <span className="grow" />
          <span className="hide-xs"><ThemeToggle /></span>
          <button type="button" className="icon-btn panel-toggle" aria-label="Einstellungen" onClick={() => setPanel(true)}><IGear /></button>
          <button type="button" className="btn btn-primary" disabled={busy} onClick={publish}>{actionLabel}</button>
        </div>
      </div>

      <div className="editor-body">
        <div className="paper">
          <div className="editor-kinds" role="radiogroup" aria-label="Form">
            {KIND_KEYS.map((k) => (
              <button key={k} type="button" className="chip" role="radio" aria-checked={d.kind === k} aria-pressed={d.kind === k} title={KINDS[k].hint}
                style={{ ['--tc' as any]: KINDS[k].color }}
                onClick={() => setD((x) => {
                  setStatus('dirty');
                  // Den Raum mitführen, solange er noch der Standard der alten Form war.
                  const room = x.room === DEFAULT_ROOM[x.kind] ? DEFAULT_ROOM[k] : x.room;
                  return { ...x, kind: k, room };
                })}>
                <i className="sw" />{KINDS[k].label}
              </button>
            ))}
          </div>
          {d.promptDay && <PromptRef day={d.promptDay} onRemove={() => set('promptDay', null)} />}
          {d.continuesPostId && <ContinuesRef id={d.continuesPostId} onRemove={() => set('continuesPostId', null)} />}
          {d.cover && (
            <div className="cover">
              <img src={d.cover} alt="" />
              <button type="button" className="icon-btn" aria-label="Bild entfernen" onClick={() => setD((x) => ({ ...x, cover: null, coverKey: null }))}><IClose /></button>
            </div>
          )}
          <input className="title" value={d.title} maxLength={140} onChange={(e) => set('title', e.target.value)}
            onKeyDown={(e) => {
              // Fokus sofort setzen (nicht verzögert), damit schnell getippte Zeichen nicht im Titel landen.
              if (e.key === 'Enter' && editor) { e.preventDefault(); editor.view.focus(); editor.commands.setTextSelection(1); }
            }}
            placeholder={d.kind === 'moment' || d.kind === 'gedanke' ? 'Titel (optional)' : 'Titel'} aria-label="Titel" />
          <RichEditor value={d.body} onChange={(text) => set('body', text)} autoFocus={!post} placeholder={placeholderFor(d.kind)} onReady={setEditor} />
          {err && <div className="form-error" role="alert">{err}</div>}
        </div>

        <Panel d={d} set={set} setD={setD} rooms={rooms.data ?? []} open={panel} onClose={() => setPanel(false)} upload={upload} />
      </div>
      <FormatBar editor={editor} info={<>{words} {words === 1 ? 'Wort' : 'Wörter'}<span className="hide-xs"> · {minutes} Min.</span></>} />
    </div>
  );
}

function placeholderFor(k: Kind) {
  return {
    moment: 'Was ist heute passiert? Das Gute, das Schlechte, das Dazwischen.',
    tagebuch: 'Liebes Tagebuch …',
    geschichte: 'Erster Satz. Der Rest kommt von allein.',
    gedicht: 'Zeilenumbrüche bleiben, wie du sie setzt.',
    brief: 'Liebe …,\n\nich wollte dir schon lange sagen …',
    gedanke: 'Mir geht gerade durch den Kopf …',
  }[k];
}

function Panel({ d, set, setD, rooms, open, onClose, upload }: {
  d: Draft;
  set: <K extends keyof Draft>(k: K, v: Draft[K]) => void;
  setD: React.Dispatch<React.SetStateAction<Draft>>;
  rooms: { slug: string; name: string }[];
  open: boolean;
  onClose: () => void;
  upload: (f: File) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const isPublic = d.visibility === 'public';
  const minCapsule = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  const visIcon = { public: <IEye size={16} />, followers: <IUsers size={16} />, private: <ILock size={16} /> };

  const body = (
    <>
      <div className="panel-sheet-head"><b>Einstellungen</b><button type="button" className="icon-btn sm" aria-label="Schliessen" onClick={onClose}><IClose /></button></div>

      <div className="field">
        <span className="label">Wer darf es lesen?</span>
        <div className="options" role="radiogroup">
          {(Object.keys(VISIBILITY) as Visibility[]).map((v) => (
            <button key={v} type="button" role="radio" className="option" aria-checked={d.visibility === v} onClick={() => setD((x) => ({ ...x, visibility: v, anonymous: v === 'public' && x.anonymous, unlockAt: v === 'private' ? x.unlockAt : null }))}>
              {visIcon[v]}
              <span className="o-t"><b>{VISIBILITY[v].label}</b><span>{VISIBILITY[v].hint}</span></span>
            </button>
          ))}
        </div>
      </div>

      {d.visibility !== 'private' && (
        <div className="field">
          <label className="label" htmlFor="room">Raum</label>
          <select id="room" className="select" style={{ height: 40, fontSize: 14 }} value={d.room ?? ''} onChange={(e) => set('room', e.target.value || null)}>
            <option value="">Kein Raum</option>
            {rooms.map((r) => <option key={r.slug} value={r.slug}>{r.name}</option>)}
          </select>
        </div>
      )}

      {isPublic && (
        <div className="switch-row">
          <span className="o-t"><b><IMask size={15} style={{ display: 'inline', verticalAlign: '-3px' }} /> Anonym</b><span>Niemand sieht, dass es von dir ist. Auch nicht in deinem Profil.</span></span>
          <Switch checked={d.anonymous} onChange={(v) => set('anonymous', v)} label="Anonym veröffentlichen" />
        </div>
      )}

      {d.visibility === 'private' && (
        <div className="field">
          <label className="label" htmlFor="capsule">Zeitkapsel</label>
          <input id="capsule" type="date" className="input" min={minCapsule} value={d.unlockAt ? d.unlockAt.slice(0, 10) : ''}
            onChange={(e) => set('unlockAt', e.target.value ? new Date(e.target.value + 'T08:00:00').toISOString() : null)} />
          <p className="help">Ein Brief an dein zukünftiges Ich. Bis zu diesem Tag bleibt er versiegelt – dann meldet er sich bei dir.</p>
        </div>
      )}

      <div className="field">
        <span className="label">Stimmung</span>
        {MOOD_GROUPS.map((g) => (
          <div key={g.label} className="mood-group" role="group" aria-label={g.label}>
            <span className="mood-group-label">{g.label}</span>
            <div className="moods">
              {g.moods.map((m) => (
                <button key={m} type="button" className="mood-btn" aria-pressed={d.mood === m} onClick={() => set('mood', d.mood === m ? null : m)}>
                  <i className="mood-dot" style={{ ['--mc' as any]: MOODS[m].color }} />{MOODS[m].label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {d.visibility !== 'private' && (
        <>
          <div className="field">
            <span className="label">Antworten</span>
            <div className="options" role="radiogroup">
              {(Object.keys(RESPONSE_MODES) as ResponseMode[]).map((m) => (
                <button key={m} type="button" role="radio" className="option" aria-checked={d.responseMode === m} onClick={() => set('responseMode', m)}>
                  <span className="o-t"><b>{RESPONSE_MODES[m].label}</b><span>{RESPONSE_MODES[m].hint}</span></span>
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <label className="label" htmlFor="cw">Inhaltshinweis</label>
            <input id="cw" className="input" maxLength={80} value={d.contentWarning} onChange={(e) => set('contentWarning', e.target.value)} placeholder="z. B. Trauer, Krankheit, Gewalt" />
            <p className="help">Der Text wird erst nach einem Klick angezeigt.</p>
          </div>
        </>
      )}

      {isPublic && d.kind !== 'tagebuch' && (
        <div className="switch-row">
          <span className="o-t"><b>Weiterschreiben erlauben</b><span>Andere dürfen eine Fortsetzung schreiben.</span></span>
          <Switch checked={d.allowContinuation} onChange={(v) => set('allowContinuation', v)} label="Weiterschreiben erlauben" />
        </div>
      )}

      <div className="field">
        <span className="label">Bild</span>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ''; }} />
        <button type="button" className="btn btn-quiet btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => fileRef.current?.click()}><IImage size={16} /> {d.cover ? 'Anderes Bild' : 'Titelbild hinzufügen'}</button>
        <p className="help">Standortdaten und andere Metadaten werden entfernt.</p>
      </div>
    </>
  );

  return (
    <>
      {open && createPortal(<div className="sheet-back" onClick={onClose} />, document.body)}
      <aside className={`panel${open ? ' open' : ''}`} aria-label="Einstellungen zum Text">{body}</aside>
    </>
  );
}

function PromptRef({ day, onRemove }: { day: string; onRemove: () => void }) {
  const q = useQuery({ queryKey: ['prompt', day], queryFn: () => api<{ prompt: { text: string } }>(`/api/prompts/${day}`) });
  return (
    <div className="prompt-ref">
      <span>Impuls: <em>{q.data?.prompt.text ?? '…'}</em></span>
      <button type="button" className="icon-btn sm" aria-label="Impuls entfernen" onClick={onRemove}><IClose size={14} /></button>
    </div>
  );
}

function ContinuesRef({ id, onRemove }: { id: number; onRemove: () => void }) {
  const q = useQuery({ queryKey: ['post', id], queryFn: () => api<{ post: Post }>(`/api/posts/${id}`) });
  return (
    <div className="cont-ref">
      <IContinue size={16} />
      <span>Fortsetzung von <b>{q.data?.post.title || 'einem Text'}</b>{q.data?.post.author && <> von {q.data.post.author.name}</>}</span>
      <button type="button" className="icon-btn sm" aria-label="Verknüpfung entfernen" onClick={onRemove}><IClose size={14} /></button>
    </div>
  );
}
