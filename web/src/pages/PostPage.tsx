import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { KINDS, RESONANCE, RESONANCE_KEYS, RESPONSE_MODES } from '../../../shared/constants';
import { api } from '../api';
import { Avatar, Dialog, Empty, KindTag, Menu, MoodTag, RoomIcon, Spinner } from '../components/bits';
import { Feed } from '../components/Feed';
import { IBack, IClock, IContinue, IEdit, IEye, IFlag, ILock, IMask, IMore, IShare, ISave, ITrash, ResonanceGlyph } from '../components/Icons';
import { Shell } from '../components/Layout';
import { Prose } from '../components/Prose';
import { FootLinks, PromptCard } from '../components/Sidebar';
import { ago, dateLong, dateShort, fmt, plural } from '../lib/format';
import { useMe, usePostActions } from '../lib/queries';
import { useToast } from '../lib/toast';
import type { Comment, Post } from '../types';

export function PostPage() {
  const { id } = useParams();
  const postId = Number(id);
  const q = useQuery({ queryKey: ['post', postId], queryFn: () => api<{ post: Post }>(`/api/posts/${postId}`), enabled: Number.isFinite(postId) });
  const { hash } = useLocation();

  useEffect(() => {
    if (q.data && hash) setTimeout(() => document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth' }), 50);
  }, [q.data, hash]);

  useEffect(() => {
    const p = q.data?.post;
    document.title = p ? `${p.title || KINDS[p.kind].label} – Lapis` : 'Lapis';
    return () => { document.title = 'Lapis – Schreib es los'; };
  }, [q.data]);

  if (q.isLoading) return <Shell><Spinner /></Shell>;
  if (q.isError || !q.data) {
    return <Shell><Empty title="Dieser Text ist nicht (mehr) da" action={<Link className="btn btn-quiet" to="/">Zur Startseite</Link>}>Vielleicht wurde er gelöscht oder ist nur für bestimmte Menschen sichtbar.</Empty></Shell>;
  }
  return <Reader post={q.data.post} />;
}

function Reader({ post }: { post: Post }) {
  const navigate = useNavigate();
  const { me } = useMe();
  const toast = useToast();
  const qc = useQueryClient();
  const { react, bookmark } = usePostActions();
  const [cwOpen, setCwOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [report, setReport] = useState(false);
  const [who, setWho] = useState(false);
  const hidden = post.contentWarning && !cwOpen && !post.mine;

  const del = useMutation({
    mutationFn: () => api(`/api/posts/${post.id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['feed'] });
      qc.invalidateQueries({ queryKey: ['overview'] });
      toast('Gelöscht.');
      navigate('/');
    },
  });

  async function share() {
    const url = `${location.origin}/text/${post.id}`;
    if (navigator.share) { try { await navigator.share({ title: post.title || KINDS[post.kind].label, url }); } catch {} return; }
    try { await navigator.clipboard.writeText(url); toast('Link kopiert'); } catch { toast(url); }
  }

  const right = (
    <>
      {post.room && (
        <section className="card card-pad">
          <div className="comm-id">
            <RoomIcon room={post.room} size="lg" />
            <div><h3>{post.room.name}</h3><span>Raum</span></div>
          </div>
          <Link className="btn btn-quiet btn-sm" to={`/raum/${post.room.slug}`}>Mehr aus diesem Raum</Link>
        </section>
      )}
      <PromptCard />
      <FootLinks />
    </>
  );

  return (
    <Shell right={right}>
      <article className="read" lang="de">
        <button type="button" className="read-back" onClick={() => (history.length > 1 ? navigate(-1) : navigate('/'))}><IBack size={15} /> Zurück</button>
        <header>
          <div className="read-meta meta">
            <KindTag kind={post.kind} />
            {post.room && <Link className="room" to={`/raum/${post.room.slug}`}>in {post.room.name}</Link>}
            {post.mood && <MoodTag mood={post.mood} />}
            {post.visibility === 'private' && <span className="flag"><ILock size={14} /> Nur für dich</span>}
            {post.visibility === 'followers' && <span className="flag"><IEye size={14} /> Für Menschen, die dir folgen</span>}
            {post.mine && post.anonymous && <span className="flag"><IMask size={14} /> Für andere anonym</span>}
            {post.status === 'draft' && <span className="pill">Entwurf</span>}
          </div>
          {post.title && <h1>{post.title}</h1>}
          {post.continues && (
            <Link className="cont-link" to={`/text/${post.continues.id}`}><IContinue size={15} /> Fortsetzung von <b>{post.continues.title || 'einem Text'}</b>{post.continues.author && <> von {post.continues.author}</>}</Link>
          )}
          {post.promptDay && <PromptRef day={post.promptDay} />}
          <div className="byline">
            <Avatar person={post.author} />
            <div className="t">
              {post.author ? <Link to={`/@${post.author.handle}`}><b>{post.author.name}</b></Link> : <b>Anonym</b>}
              <span>
                <time dateTime={post.publishedAt ?? post.createdAt} title={dateLong(post.publishedAt ?? post.createdAt)}>{ago(post.publishedAt ?? post.createdAt)}</time>
                {' · '}{post.readingMinutes} Min. Lesezeit · {fmt(post.wordCount)} Wörter
              </span>
            </div>
            <Menu label="Mehr" button={<IMore />}>
              {(close) => (
                <>
                  <button type="button" onClick={() => { close(); share(); }}><IShare size={16} /> Teilen</button>
                  {post.mine ? (
                    <>
                      {!post.sealed && <Link to={`/schreiben/${post.id}`} onClick={close}><IEdit size={16} /> Bearbeiten</Link>}
                      {post.counts.resonance > 0 && <button type="button" onClick={() => { close(); setWho(true); }}><ResonanceGlyph kind="beruehrt" /> Wer hat reagiert?</button>}
                      <hr />
                      <button type="button" className="danger" onClick={() => { close(); setConfirmDelete(true); }}><ITrash size={16} /> Löschen</button>
                    </>
                  ) : me && (
                    <button type="button" onClick={() => { close(); setReport(true); }}><IFlag size={16} /> Melden</button>
                  )}
                </>
              )}
            </Menu>
          </div>
        </header>

        {post.sealed ? (
          <div className="sealed"><IClock size={18} /> Diese Zeitkapsel öffnet sich am {dateLong(post.unlockAt!)}. Bis dahin bleibt sie versiegelt – auch für dich.</div>
        ) : hidden ? (
          <div className="cw-gate">
            <span>Inhaltshinweis: <b>{post.contentWarning}</b>. Lies nur, wenn es dir gerade gut genug geht.</span>
            <button type="button" className="btn btn-quiet btn-sm" onClick={() => setCwOpen(true)}>Ich möchte lesen</button>
          </div>
        ) : (
          <>
            {post.cover && <div className="cover"><img src={post.cover} alt="" /></div>}
            {post.contentWarning && post.mine && <div className="mode-note">Inhaltshinweis für andere: {post.contentWarning}</div>}
            <Prose text={post.body} verse={post.kind === 'gedicht'} />
          </>
        )}

        <div className="read-end">
          {post.visibility !== 'private' && post.status === 'published' && (
            <div className="res-row" role="group" aria-label="Resonanz">
              {RESONANCE_KEYS.map((k) => (
                <button
                  key={k}
                  type="button"
                  className="res-big"
                  aria-pressed={post.myReactions.includes(k)}
                  disabled={post.mine}
                  title={post.mine ? 'Auf eigene Texte reagiert man nicht' : undefined}
                  onClick={() => (me ? react.mutate({ post, kind: k }) : navigate('/anmelden'))}
                >
                  <ResonanceGlyph kind={k} size={17} />{RESONANCE[k].label}
                  {!!post.reactions[k] && <span className="n">{post.reactions[k]}</span>}
                </button>
              ))}
            </div>
          )}
          <div className="bar">
            <button type="button" className="act" onClick={share}><IShare /><span className="lbl">Teilen</span></button>
            {!post.mine && (
              <button type="button" className="act" aria-pressed={post.bookmarked} onClick={() => (me ? bookmark.mutate(post) : navigate('/anmelden'))}>
                <ISave /><span className="lbl">{post.bookmarked ? 'Gemerkt' : 'Merken'}</span>
              </button>
            )}
            {post.mine && !post.sealed && <Link className="act" to={`/schreiben/${post.id}`}><IEdit size={16} /><span className="lbl">Bearbeiten</span></Link>}
            <span className="spacer" />
            <span className="readinfo">{post.updatedAt !== post.createdAt && post.publishedAt && new Date(post.updatedAt) > new Date(post.publishedAt) ? `bearbeitet ${ago(post.updatedAt)}` : ''}</span>
          </div>
          {post.author && !post.mine && <AuthorCard post={post} inline />}
        </div>

        {post.visibility === 'public' && post.status === 'published' && (post.allowContinuation || post.counts.continuations > 0 || post.mine) && post.kind !== 'tagebuch' && (
          <Continuations post={post} />
        )}

        {post.visibility !== 'private' && post.status === 'published' && <Comments post={post} />}
      </article>

      <Dialog open={confirmDelete} onClose={() => setConfirmDelete(false)} label="Text löschen">
        <h2>Diesen Text löschen?</h2>
        <p>Kommentare und Resonanz verschwinden mit. Das lässt sich nicht rückgängig machen.</p>
        <div className="row">
          <button className="btn btn-ghost" type="button" onClick={() => setConfirmDelete(false)}>Behalten</button>
          <button className="btn btn-danger" type="button" onClick={() => del.mutate()} disabled={del.isPending}>Endgültig löschen</button>
        </div>
      </Dialog>
      <ReportDialog open={report} onClose={() => setReport(false)} postId={post.id} />
      {who && <WhoReacted postId={post.id} onClose={() => setWho(false)} />}
    </Shell>
  );
}

function PromptRef({ day }: { day: string }) {
  const q = useQuery({ queryKey: ['prompt', day], queryFn: () => api<{ prompt: { text: string } }>(`/api/prompts/${day}`) });
  if (!q.data) return null;
  return (
    <Link to={`/impulse/${day}`} className="cont-link" style={{ fontFamily: 'var(--serif)', fontStyle: 'italic' }}>
      Antwort auf den Impuls vom {dateShort(day + 'T12:00:00')}: „{q.data.prompt.text}“
    </Link>
  );
}

function AuthorCard({ post, inline = false }: { post: Post; inline?: boolean }) {
  const { me } = useMe();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const handle = post.author!.handle;
  const profile = useQuery({ queryKey: ['user', handle], queryFn: () => api<{ user: any }>(`/api/users/${handle}`).then((r) => r.user) });
  const follow = useMutation({
    mutationFn: (on: boolean) => api(`/api/users/${handle}/follow`, { method: on ? 'PUT' : 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['user', handle] }),
  });
  const u = profile.data;
  const btn = u && !u.self && (
    <button className={`btn btn-sm ${u.followed ? 'btn-quiet' : 'btn-primary'}`} type="button" onClick={() => (me ? follow.mutate(!u.followed) : navigate('/anmelden'))}>
      {u.followed ? 'Du folgst' : 'Folgen'}
    </button>
  );
  if (inline) {
    return (
      <div className="author-card">
        <Avatar person={post.author} size="lg" />
        <div className="t">
          <b><Link to={`/@${handle}`}>{post.author!.name}</Link></b>
          {u?.bio && <span>{u.bio}</span>}
          {u && <span className="readinfo">{plural(u.stats.posts, 'Text', 'Texte')} · {fmt(u.stats.words)} Wörter</span>}
        </div>
        {btn}
      </div>
    );
  }
  return (
    <section className="card card-pad">
      <div className="comm-id">
        <Avatar person={post.author} size="lg" />
        <div><h3><Link to={`/@${handle}`}>{post.author!.name}</Link></h3><span>@{handle}</span></div>
      </div>
      {u?.bio && <p>{u.bio}</p>}
      {u && <div className="facts"><div><b>{fmt(u.stats.posts)}</b><span>Texte</span></div><div><b>{fmt(u.stats.words)}</b><span>Wörter</span></div></div>}
      {btn && <div style={{ display: 'flex' }}>{btn}</div>}
    </section>
  );
}

function Continuations({ post }: { post: Post }) {
  const { me } = useMe();
  return (
    <section id="weiter" aria-labelledby="weiter-h">
      <div className="section-h">
        <h2 id="weiter-h">Wie es weitergeht</h2>
        {(post.allowContinuation || post.mine) && (
          <Link className="btn btn-quiet btn-sm" to={me ? `/schreiben?weiter=${post.id}` : '/anmelden'}><IContinue size={15} /> Weiterschreiben</Link>
        )}
      </div>
      {post.allowContinuation && !post.mine && (
        <p className="note" style={{ marginTop: 0 }}>Diese Geschichte ist offen. Schreib den nächsten Teil – so entstehen Kettengeschichten.</p>
      )}
      <Feed params={{ continues: post.id, sort: 'neu' }} showRoom={false} empty={<p className="note">Noch keine Fortsetzung.</p>} />
    </section>
  );
}

function Comments({ post }: { post: Post }) {
  const { me } = useMe();
  const qc = useQueryClient();
  const toast = useToast();
  const key = ['comments', post.id];
  const q = useQuery({ queryKey: key, queryFn: () => api<{ comments: Comment[]; canModerate: boolean }>(`/api/posts/${post.id}/comments`) });
  const [replyTo, setReplyTo] = useState<number | null>(null);
  const listen = post.responseMode === 'listen';

  const tree = useMemo(() => {
    const all = q.data?.comments ?? [];
    const roots = all.filter((c) => !c.parentId);
    return roots.map((r) => ({ ...r, replies: all.filter((c) => c.parentId === r.id) })).filter((r) => !r.deleted || r.replies.length);
  }, [q.data]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: key });
    qc.invalidateQueries({ queryKey: ['post', post.id] });
  };
  const del = useMutation({ mutationFn: (id: number) => api(`/api/comments/${id}`, { method: 'DELETE' }), onSuccess: refresh });
  const thank = useMutation({
    mutationFn: (id: number) => api<{ thanked: boolean }>(`/api/comments/${id}/thanks`, { method: 'PUT' }),
    onSuccess: (r) => { refresh(); if (r.thanked) toast('Danke gesagt'); },
  });

  const count = q.data?.comments.filter((c) => !c.deleted).length ?? post.counts.comments;

  const one = (c: Comment, root: number) => (
    <div className="comment" key={c.id}>
      <Avatar person={c.author} size="sm" />
      <div>
        <div className="c-meta">
          <b>{c.deleted ? '—' : c.author ? <Link to={`/@${c.author.handle}`}>{c.author.name}</Link> : 'Anonym'}</b>
          {c.byAuthor && !c.deleted && <span className="pill">{post.kind === 'tagebuch' || post.kind === 'moment' ? 'Hat das geschrieben' : 'Verfasser:in'}</span>}
          {c.thanked && <span className="pill thanks">Danke</span>}
          <span>{ago(c.createdAt)}{c.editedAt ? ' · bearbeitet' : ''}</span>
        </div>
        <p className={`c-body${c.deleted ? ' gone' : ''}`}>{c.deleted ? 'Dieser Kommentar wurde entfernt.' : c.body}</p>
        {!c.deleted && me && (
          <div className="c-acts">
            {!listen && <button type="button" className="act" onClick={() => setReplyTo(replyTo === root ? null : root)}>Antworten</button>}
            {q.data?.canModerate && !c.mine && (
              <button type="button" className="act" aria-pressed={c.thanked} onClick={() => thank.mutate(c.id)}>{c.thanked ? 'Bedankt' : 'Danke sagen'}</button>
            )}
            {(c.mine || q.data?.canModerate) && <button type="button" className="act" onClick={() => del.mutate(c.id)}>{c.mine ? 'Löschen' : 'Entfernen'}</button>}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <section id="antworten" aria-labelledby="antworten-h">
      <div className="section-h">
        <h2 id="antworten-h">{post.responseMode === 'feedback' ? 'Werkstatt' : 'Antworten'}</h2>
        <span>{count ? plural(count, 'Antwort', 'Antworten') : ''}</span>
      </div>
      {post.responseMode === 'feedback' && <div className="mode-note">Kritik ausdrücklich erwünscht. Konkret statt pauschal: Was funktioniert? Wo bist du hängen geblieben?</div>}
      {listen ? (
        <div className="mode-note">{RESPONSE_MODES.listen.label}: Hier wird nicht kommentiert. Wenn dich der Text erreicht hat, zeig es mit einer Resonanz.</div>
      ) : me ? (
        replyTo === null && <ReplyBox post={post} onDone={refresh} />
      ) : (
        <div className="mode-note"><span><Link to="/anmelden" style={{ textDecoration: 'underline' }}>Melde dich an</Link>, um zu antworten.</span></div>
      )}
      <div className="comments" style={{ marginTop: 8 }}>
        {tree.map((r) => (
          <div key={r.id}>
            {one(r, r.id)}
            {(r.replies.length > 0 || replyTo === r.id) && (
              <div className="replies">
                {r.replies.map((c) => one(c, r.id))}
                {replyTo === r.id && <ReplyBox post={post} parentId={r.id} autoFocus onDone={() => { setReplyTo(null); refresh(); }} onCancel={() => setReplyTo(null)} />}
              </div>
            )}
          </div>
        ))}
      </div>
      {!q.isLoading && !tree.length && !listen && <p className="note" style={{ padding: '12px 0' }}>Noch keine Antworten. Ein paar ehrliche Worte bedeuten oft mehr, als man denkt.</p>}
    </section>
  );
}

function ReplyBox({ post, parentId, onDone, onCancel, autoFocus }: { post: Post; parentId?: number; onDone: () => void; onCancel?: () => void; autoFocus?: boolean }) {
  const [body, setBody] = useState('');
  const [err, setErr] = useState('');
  const m = useMutation({
    mutationFn: () => api(`/api/posts/${post.id}/comments`, { body: { body, parentId } }),
    onSuccess: () => { setBody(''); onDone(); },
    onError: (e: Error) => setErr(e.message),
  });
  const placeholder = post.responseMode === 'feedback' ? 'Was funktioniert? Was noch nicht?' : parentId ? 'Deine Antwort …' : post.kind === 'tagebuch' || post.kind === 'moment' ? 'Sag etwas Freundliches …' : 'Was hat der Text mit dir gemacht?';
  return (
    <form className="reply-box" onSubmit={(e) => { e.preventDefault(); if (body.trim()) m.mutate(); }}>
      <textarea value={body} onChange={(e) => { setBody(e.target.value); setErr(''); }} placeholder={placeholder} aria-label="Antwort" autoFocus={autoFocus} maxLength={4000}
        onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) e.currentTarget.form?.requestSubmit(); }} />
      <div className="row">
        <span className={err ? 'err-text' : 'hint'}>{err || (body.length > 3500 ? `${4000 - body.length} Zeichen übrig` : '')}</span>
        <div style={{ display: 'flex', gap: 8 }}>
          {onCancel && <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>Abbrechen</button>}
          <button type="submit" className="btn btn-primary btn-sm" disabled={!body.trim() || m.isPending}>Antworten</button>
        </div>
      </div>
    </form>
  );
}

function ReportDialog({ open, onClose, postId }: { open: boolean; onClose: () => void; postId: number }) {
  const [reason, setReason] = useState('');
  const toast = useToast();
  const m = useMutation({
    mutationFn: () => api('/api/reports', { body: { postId, reason } }),
    onSuccess: () => { toast('Danke. Wir schauen es uns an.'); setReason(''); onClose(); },
    onError: (e: Error) => toast(e.message),
  });
  return (
    <Dialog open={open} onClose={onClose} label="Text melden">
      <h2>Text melden</h2>
      <p>Was stimmt nicht? Wenn jemand in Gefahr ist, wende dich bitte sofort an den Notruf (112) oder an die Dargebotene Hand (143) bzw. die Telefonseelsorge (0800 111 0 111).</p>
      <textarea className="textarea" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Kurz beschreiben …" maxLength={500} />
      <div className="row">
        <button className="btn btn-ghost" type="button" onClick={onClose}>Abbrechen</button>
        <button className="btn btn-primary" type="button" disabled={reason.trim().length < 3 || m.isPending} onClick={() => m.mutate()}>Melden</button>
      </div>
    </Dialog>
  );
}

function WhoReacted({ postId, onClose }: { postId: number; onClose: () => void }) {
  const q = useQuery({ queryKey: ['reactions', postId], queryFn: () => api<{ reactions: { kind: string; at: string; user: any }[] }>(`/api/posts/${postId}/reactions`) });
  return (
    <Dialog open onClose={onClose} label="Resonanz">
      <h2>Wen dein Text erreicht hat</h2>
      {!q.data ? <Spinner /> : (
        <ul className="rows" style={{ padding: 0 }}>
          {q.data.reactions.map((r, i) => (
            <li key={i}>
              <Avatar person={r.user} size="sm" />
              <div className="t"><b><Link to={`/@${r.user.handle}`}>{r.user.name}</Link></b><span>{RESONANCE[r.kind as keyof typeof RESONANCE]?.past} · {ago(r.at)}</span></div>
              <ResonanceGlyph kind={r.kind} />
            </li>
          ))}
        </ul>
      )}
      <div className="row"><button className="btn btn-quiet" type="button" onClick={onClose}>Schliessen</button></div>
    </Dialog>
  );
}
