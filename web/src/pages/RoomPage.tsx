import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { api } from '../api';
import { Empty, RoomIcon, Spinner } from '../components/bits';
import { Composer } from '../components/Composer';
import { Feed } from '../components/Feed';
import { KindFilter, SortTabs, type Sort } from '../components/FeedControls';
import { Shell } from '../components/Layout';
import { FootLinks, PromptCard, RoomsCard, RulesCard, useJoin } from '../components/Sidebar';
import { fmt } from '../lib/format';
import type { Room } from '../types';

export function RoomPage() {
  const { slug } = useParams();
  const q = useQuery({ queryKey: ['room', slug], queryFn: () => api<{ room: Room }>(`/api/rooms/${slug}`).then((r) => r.room) });
  const [sort, setSort] = useState<Sort>('neu');
  const [kind, setKind] = useState<string>();
  const join = useJoin();
  if (q.isLoading) return <Shell><Spinner /></Shell>;
  if (!q.data) return <Shell><Empty title="Diesen Raum gibt es nicht" action={<Link className="btn btn-quiet" to="/raeume">Alle Räume</Link>} /></Shell>;
  const r = q.data;
  const right = (
    <>
      <section className="card card-pad">
        <div className="comm-id"><RoomIcon room={r} size="lg" /><div><h3>{r.name}</h3><span>Seit {new Date(r.createdAt).getFullYear()}{r.official ? ' · von Lapis' : ''}</span></div></div>
        <p>{r.description}</p>
        <div className="facts">
          <div><b>{fmt(r.stats.members)}</b><span>Mitglieder</span></div>
          <div><b><i className="live" />{fmt(r.stats.postsWeek)}</b><span>Texte diese Woche</span></div>
        </div>
        <button className={`btn w-full ${r.joined ? 'btn-quiet' : 'btn-primary'}`} type="button" onClick={() => join(r)}>{r.joined ? 'Beigetreten' : 'Beitreten'}</button>
      </section>
      {r.guidelines.length > 0 && <RulesCard title="Raumregeln" rules={r.guidelines} />}
      <PromptCard />
      <RoomsCard title="Weitere Räume" exclude={r.slug} />
      <FootLinks />
    </>
  );
  return (
    <Shell right={right}>
      <div className="page-head">
        <div className="row">
          <RoomIcon room={r} size="xl" />
          <div className="grow">
            <h1>{r.name}</h1>
            <p>{r.description}</p>
          </div>
          <button className={`btn ${r.joined ? 'btn-quiet' : 'btn-primary'} hide-lg`} type="button" onClick={() => join(r)}>{r.joined ? 'Dabei' : 'Beitreten'}</button>
        </div>
      </div>
      <div className="feed-head" style={{ paddingTop: 14 }}>
        <span className="readinfo">{fmt(r.stats.posts)} Texte · {fmt(r.stats.members)} Mitglieder</span>
        <SortTabs value={sort} onChange={setSort} />
      </div>
      <Composer key={r.slug} room={r.slug} />
      <KindFilter value={kind} onChange={setKind} />
      <Feed params={{ room: r.slug, sort, kind }} showRoom={false} empty={<Empty title="Noch leer hier">Schreib den ersten Text in {r.name}.</Empty>} />
    </Shell>
  );
}
