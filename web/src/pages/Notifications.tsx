import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { Link } from 'react-router';
import { KINDS, RESONANCE } from '../../../shared/constants';
import { api } from '../api';
import { Avatar, Empty, Skeletons } from '../components/bits';
import { IClock, IComment, IContinue, IUsers, ResonanceGlyph } from '../components/Icons';
import { Shell } from '../components/Layout';
import { DefaultRight } from '../components/Sidebar';
import { ago, dayLabel, localDay } from '../lib/format';
import { useMe } from '../lib/queries';
import type { Notification } from '../types';
import { RequireLogin } from './Auth';

function describe(n: Notification) {
  const who = n.actor ? <b>{n.actor.name}</b> : <b>Jemand</b>;
  const what = n.post ? <b>{n.post.title || KINDS[n.post.kind]?.label || 'deinen Text'}</b> : null;
  switch (n.type) {
    case 'reaction': return <>{who} {RESONANCE[n.detail as keyof typeof RESONANCE]?.past ?? 'hat reagiert'}: {what}</>;
    case 'comment': return <>{who} hat auf {what} geantwortet</>;
    case 'reply': return <>{who} hat dir geantwortet</>;
    case 'follow': return <>{who} folgt dir jetzt</>;
    case 'continuation': return <>{who} hat deine Geschichte weitergeschrieben</>;
    case 'thanks': return <>{who} sagt Danke für deine Worte</>;
    case 'capsule': return <>Deine Zeitkapsel hat sich geöffnet: {what}</>;
  }
}

function icon(n: Notification) {
  if (n.type === 'capsule') return <span className="n-ico"><IClock size={16} /></span>;
  if (n.actor) return <Avatar person={n.actor} />;
  if (n.type === 'reaction') return <span className="n-ico"><ResonanceGlyph kind={n.detail ?? 'beruehrt'} /></span>;
  if (n.type === 'continuation') return <span className="n-ico"><IContinue size={16} /></span>;
  if (n.type === 'follow') return <span className="n-ico"><IUsers size={16} /></span>;
  return <span className="n-ico"><IComment /></span>;
}

function href(n: Notification) {
  if (n.type === 'follow' && n.actor) return `/@${n.actor.handle}`;
  if (n.type === 'continuation' && n.post) return `/text/${n.post.id}`;
  if (n.post) return `/text/${n.post.id}${n.comment ? '#antworten' : ''}`;
  return '#';
}

export function Notifications() {
  const { me } = useMe();
  const qc = useQueryClient();
  const q = useInfiniteQuery({
    queryKey: ['notifications'],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => api<{ notifications: Notification[]; hasMore: boolean }>(`/api/notifications${pageParam ? `?before=${pageParam}` : ''}`),
    getNextPageParam: (last) => (last.hasMore ? last.notifications[last.notifications.length - 1].id : undefined),
    enabled: Boolean(me),
  });
  const read = useMutation({
    mutationFn: () => api('/api/notifications/read', { body: {} }),
    onSuccess: () => { qc.setQueryData(['unread'], 0); qc.invalidateQueries({ queryKey: ['overview'] }); },
  });
  const items = q.data?.pages.flatMap((p) => p.notifications) ?? [];
  const hasUnread = items.some((n) => !n.read);
  useEffect(() => {
    if (hasUnread) {
      const t = setTimeout(() => read.mutate(), 1500);
      return () => clearTimeout(t);
    }
  }, [hasUnread]);

  if (!me) return <RequireLogin />;
  let lastDay = '';
  return (
    <Shell right={<DefaultRight />}>
      <div className="page-head"><h1>Mitteilungen</h1><p>Wen deine Worte erreicht haben.</p></div>
      {q.isLoading ? <Skeletons /> : !items.length ? (
        <Empty title="Noch ruhig">Wenn jemand auf deine Texte reagiert, antwortet oder dir folgt, erfährst du es hier.</Empty>
      ) : (
        <ul className="notes">
          {items.flatMap((n) => {
            const day = localDay(n.createdAt);
            const out = [];
            if (day !== lastDay) {
              lastDay = day;
              out.push(<li key={`d${day}`} className="label day">{dayLabel(day)}</li>);
            }
            out.push(
              <li key={n.id} className={n.read ? '' : 'unread'}>
                {icon(n)}
                <div>
                  <div className="n-text"><Link className="stretch" to={href(n)}>{describe(n)}</Link></div>
                  {(n.comment?.excerpt || (n.type !== 'follow' && n.post?.excerpt && !n.post.title)) && <div className="n-ex">{n.comment?.excerpt ?? n.post?.excerpt}</div>}
                </div>
                <time dateTime={n.createdAt}>{ago(n.createdAt)}</time>
              </li>,
            );
            return out;
          })}
        </ul>
      )}
      {q.hasNextPage && <button className="btn btn-quiet load-more" type="button" onClick={() => q.fetchNextPage()}>Ältere laden</button>}
    </Shell>
  );
}
