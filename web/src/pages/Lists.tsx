import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router';
import { KINDS } from '../../../shared/constants';
import { api } from '../api';
import { Empty, KindTag, Skeletons } from '../components/bits';
import { Feed } from '../components/Feed';
import { Heatmap } from '../components/Heatmap';
import { IDrafts, IPen } from '../components/Icons';
import { Shell } from '../components/Layout';
import { plain } from '../components/Prose';
import { DefaultRight, FootLinks, PromptCard, RoomsCard } from '../components/Sidebar';
import { ago } from '../lib/format';
import { useMe, useOverview } from '../lib/queries';
import type { Post } from '../types';
import { RequireLogin } from './Auth';

export function Journal() {
  const { me } = useMe();
  const ov = useOverview(Boolean(me));
  const profile = useQuery({
    queryKey: ['user', me?.handle],
    queryFn: () => api<{ calendar: any[] }>(`/api/users/${me!.handle}`),
    enabled: Boolean(me),
  });
  if (!me) return <RequireLogin />;
  return (
    <Shell right={<><PromptCard /><FootLinks /></>}>
      <div className="page-head">
        <div className="row">
          <div className="grow">
            <h1>Mein Tagebuch</h1>
            <p>Nur du kannst lesen, was hier steht. Kein Raum, kein Publikum, keine Resonanz – nur du und das Papier.</p>
          </div>
          <Link className="btn btn-primary" to="/schreiben?privat=1"><IPen size={16} /> Neuer Eintrag</Link>
        </div>
        {profile.data && <Heatmap days={profile.data.calendar} weeks={26} />}
        {ov.data && <div className="stat-line"><span><b>{ov.data.streak}</b>{ov.data.streak === 1 ? 'Tag' : 'Tage'} in Folge geschrieben</span><span><b>{ov.data.counts.journal}</b>private Einträge</span></div>}
      </div>
      <Feed params={{ journal: true, sort: 'neu' }} showRoom={false}
        empty={<Empty title="Noch keine Einträge" action={<Link className="btn btn-primary" to="/schreiben?privat=1">Ersten Eintrag schreiben</Link>}>Schreib auf, was dich beschäftigt. Oder einen Brief an dich in einem Jahr – als Zeitkapsel.</Empty>} />
    </Shell>
  );
}

export function Saved() {
  const { me } = useMe();
  if (!me) return <RequireLogin />;
  return (
    <Shell right={<DefaultRight />}>
      <div className="page-head"><h1>Gemerkt</h1><p>Texte, zu denen du zurückkehren willst.</p></div>
      <Feed params={{ saved: true }} empty={<Empty title="Noch nichts gemerkt">Tippe bei einem Text auf „Merken“, um ihn hier wiederzufinden. Funktioniert auch offline.</Empty>} />
    </Shell>
  );
}

export function Drafts() {
  const { me } = useMe();
  const q = useQuery({ queryKey: ['drafts'], queryFn: () => api<{ posts: Post[] }>('/api/drafts').then((r) => r.posts), enabled: Boolean(me) });
  if (!me) return <RequireLogin />;
  return (
    <Shell right={<><PromptCard /><FootLinks /></>}>
      <div className="page-head"><h1>Entwürfe</h1><p>Angefangenes. Alles speichert sich von selbst, während du schreibst.</p></div>
      {q.isLoading ? <Skeletons /> : !q.data?.length ? (
        <Empty title="Keine Entwürfe" action={<Link className="btn btn-primary" to="/schreiben">Etwas anfangen</Link>} />
      ) : (
        <ul className="notes">
          {q.data.map((p) => (
            <li key={p.id}>
              <span className="n-ico"><IDrafts size={16} /></span>
              <div>
                <div className="n-text"><Link className="stretch" to={`/schreiben/${p.id}`}><b>{p.title || KINDS[p.kind].label + ' ohne Titel'}</b></Link></div>
                {p.body && <div className="n-ex">{plain(p.body)}</div>}
                <div className="meta" style={{ marginTop: 6 }}><KindTag kind={p.kind} /><span className="readinfo">{p.wordCount} Wörter</span></div>
              </div>
              <time>{ago(p.updatedAt)}</time>
            </li>
          ))}
        </ul>
      )}
    </Shell>
  );
}

export function Search() {
  const [params] = useSearchParams();
  const q = params.get('q') ?? '';
  return (
    <Shell right={<><RoomsCard /><FootLinks /></>}>
      <div className="page-head"><h1>Suche</h1><p>{q ? <>Texte zu „{q}“</> : 'Wonach suchst du?'}</p></div>
      {q && <Feed key={q} params={{ q, sort: 'neu' }} empty={<Empty title="Nichts gefunden">Versuch ein anderes Wort – die Suche kennt auch Wortformen, „regnet“ findet „Regen“.</Empty>} />}
    </Shell>
  );
}

