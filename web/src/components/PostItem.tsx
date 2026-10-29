import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { KINDS, RESONANCE, RESONANCE_KEYS, type Resonance } from '../../../shared/constants';
import { ago, dateShort, fmt } from '../lib/format';
import { useMe, usePostActions } from '../lib/queries';
import { useToast } from '../lib/toast';
import type { Post } from '../types';
import { Avatar, KindTag, MoodTag, RoomIcon, useDismiss } from './bits';
import { IClock, IComment, IContinue, IEye, ILock, IMask, ISave, IShare, ResonanceGlyph } from './Icons';
import { plain } from './Prose';

export function PostItem({ post, showRoom = true }: { post: Post; showRoom?: boolean }) {
  const [cwOpen, setCwOpen] = useState(false);
  const href = `/text/${post.id}`;
  const hidden = post.contentWarning && !cwOpen && !post.mine;
  const verse = post.kind === 'gedicht';
  const lead = !post.title;
  return (
    <article className="post" aria-labelledby={`t${post.id}`}>
      <div className="meta">
        <Avatar person={post.author} size="xs" />
        {post.author ? <Link className="who" to={`/@${post.author.handle}`}>{post.author.name}</Link> : <span className="who">Anonym</span>}
        {showRoom && post.room && (
          <>
            <span className="dotsep">·</span>
            <Link className="room" to={`/raum/${post.room.slug}`}>in {post.room.name}</Link>
          </>
        )}
        <span className="dotsep">·</span>
        <time dateTime={post.publishedAt ?? post.createdAt} title={post.publishedAt ? dateShort(post.publishedAt) : undefined}>{ago(post.publishedAt ?? post.updatedAt)}</time>
        <KindTag kind={post.kind} />
        {post.mood && <MoodTag mood={post.mood} />}
        {post.mine && post.anonymous && <span className="flag" title="Für andere anonym"><IMask size={14} /> anonym</span>}
        {post.visibility === 'followers' && <span className="flag" title="Nur für Menschen, die dir folgen"><IEye size={14} /> Folgende</span>}
        {post.visibility === 'private' && <span className="flag"><ILock size={14} /> privat</span>}
      </div>

      {post.title && (
        <h2 id={`t${post.id}`}><Link className="stretch" to={href}>{post.title}</Link></h2>
      )}

      {post.continues && (
        <Link className="cont-link" to={`/text/${post.continues.id}`}>
          <IContinue size={15} /> Fortsetzung von <b>{post.continues.title || 'einem Text'}</b>
          {post.continues.author && <> von {post.continues.author}</>}
        </Link>
      )}

      {post.sealed ? (
        <div className="sealed"><IClock size={16} /> Versiegelt bis {dateShort(post.unlockAt!)}. Bis dahin bleibt der Brief zu.</div>
      ) : hidden ? (
        <div className="cw-gate">
          <span>Inhaltshinweis: <b>{post.contentWarning}</b></span>
          <button type="button" className="btn btn-quiet btn-sm" onClick={() => setCwOpen(true)}>Trotzdem lesen</button>
        </div>
      ) : (
        <>
          {post.body && (
            <p id={lead ? `t${post.id}` : undefined} className={`excerpt clamp${lead ? ' lead' : ''}${verse ? ' verse' : ''}`}>
              {lead ? <Link className="stretch" to={href}>{plain(post.body)}</Link> : plain(post.body)}
            </p>
          )}
          {post.cover && <div className="cover"><img src={post.cover} alt="" loading="lazy" /></div>}
        </>
      )}

      <PostBar post={post} />
    </article>
  );
}

export function PostBar({ post }: { post: Post }) {
  const toast = useToast();
  const { me } = useMe();
  const navigate = useNavigate();
  const { bookmark } = usePostActions();
  const href = `/text/${post.id}`;

  async function share() {
    const url = `${location.origin}${href}`;
    const title = post.title || KINDS[post.kind].label;
    if (navigator.share) {
      try { await navigator.share({ title, url }); } catch {}
      return;
    }
    try { await navigator.clipboard.writeText(url); toast('Link kopiert'); } catch { toast(url); }
  }

  return (
    <div className="bar">
      <ResonanceButton post={post} />
      {post.responseMode !== 'listen' ? (
        <Link className="act" to={`${href}#antworten`}>
          <IComment /><span className="n">{post.counts.comments ? fmt(post.counts.comments) : ''}</span><span className="lbl">{post.responseMode === 'feedback' ? 'Feedback' : post.counts.comments === 1 ? 'Antwort' : 'Antworten'}</span>
        </Link>
      ) : (
        <span className="act" title="Hier wird nur zugehört" style={{ cursor: 'default' }}><span className="lbl">Nur zuhören</span></span>
      )}
      {post.counts.continuations > 0 && (
        <Link className="act" to={`${href}#weiter`}><IContinue size={16} /><span className="n">{post.counts.continuations}</span><span className="lbl">Fortsetzungen</span></Link>
      )}
      <span className="spacer" />
      <span className="readinfo hide-xs">{post.readingMinutes} Min.</span>
      <button className="act" type="button" onClick={share} aria-label="Teilen"><IShare /><span className="lbl">Teilen</span></button>
      <button
        className="act"
        type="button"
        aria-pressed={post.bookmarked}
        aria-label={post.bookmarked ? 'Gemerkt' : 'Merken'}
        onClick={() => {
          if (!me) return navigate('/anmelden');
          bookmark.mutate(post);
          toast(post.bookmarked ? 'Aus „Gemerkt“ entfernt' : 'Gemerkt');
        }}
      >
        <ISave /><span className="lbl">{post.bookmarked ? 'Gemerkt' : 'Merken'}</span>
      </button>
    </div>
  );
}

function ResonanceButton({ post }: { post: Post }) {
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));
  const { me } = useMe();
  const navigate = useNavigate();
  const { react } = usePostActions();
  const mine = post.myReactions.length > 0;
  const top = RESONANCE_KEYS.filter((k) => post.reactions[k]).sort((a, b) => (post.reactions[b] ?? 0) - (post.reactions[a] ?? 0)).slice(0, 3);

  if (post.mine || post.visibility === 'private') {
    if (post.visibility === 'private') return null;
    return (
      <span className={`act res${post.counts.resonance ? ' on' : ''}`} style={{ cursor: 'default' }} title="Resonanz auf deinen Text">
        <span className="res-sum">{(top.length ? top : (['beruehrt'] as Resonance[])).map((k) => <ResonanceGlyph key={k} kind={k} size={15} />)}</span>
        <span className="n">{post.counts.resonance > 0 ? fmt(post.counts.resonance) : ''}</span>
        <span className="lbl">Resonanz</span>
      </span>
    );
  }

  const pick = (kind: Resonance) => {
    if (!me) return navigate('/anmelden');
    react.mutate({ post, kind });
  };

  return (
    <div className="res-wrap" ref={ref}>
      <button
        type="button"
        className={`act res${mine ? ' on' : ''}`}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={`Resonanz, ${post.counts.resonance}`}
        onClick={() => (me ? setOpen((o) => !o) : navigate('/anmelden'))}
      >
        <span className="res-sum">{(top.length ? top : (['beruehrt'] as Resonance[])).map((k) => <ResonanceGlyph key={k} kind={k} size={15} />)}</span>
        <span className="n">{post.counts.resonance > 0 ? fmt(post.counts.resonance) : ''}</span>
        <span className="lbl">Resonanz</span>
      </button>
      {open && (
        <div className="res-pop" role="group" aria-label="Wie hat dich der Text erreicht?">
          {RESONANCE_KEYS.map((k) => (
            <button key={k} type="button" className="res-opt" aria-pressed={post.myReactions.includes(k)} onClick={() => pick(k)}>
              <ResonanceGlyph kind={k} size={20} />
              {RESONANCE[k].label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function RoomLine({ post }: { post: Post }) {
  if (!post.room) return null;
  return <Link className="room" to={`/raum/${post.room.slug}`}><RoomIcon room={post.room} size="xs" />{post.room.name}</Link>;
}
