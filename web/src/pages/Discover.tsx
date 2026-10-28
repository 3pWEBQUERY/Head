import { useState } from 'react';
import { Link } from 'react-router';
import { RoomIcon } from '../components/bits';
import { Feed } from '../components/Feed';
import { KindFilter, remember, remembered, SortTabs, SORTS, type Sort } from '../components/FeedControls';
import { Shell } from '../components/Layout';
import { FootLinks, PromptCard, RulesCard, useJoin } from '../components/Sidebar';
import { plural } from '../lib/format';
import { useRooms } from '../lib/queries';
import type { Room } from '../types';

export function Discover() {
  const [sort, setSort] = useState<Sort>(() => remembered('sort-all', 'neu'));
  const [kind, setKind] = useState<string>();
  const rooms = useRooms();
  return (
    <Shell right={<><PromptCard /><RulesCard /><FootLinks /></>}>
      <div className="page-head">
        <h1>Entdecken</h1>
        <p>Alles, was gerade öffentlich auf Lapis geschrieben wird – quer durch alle Räume.</p>
      </div>
      <div className="room-grid" style={{ marginTop: 18 }}>
        {(rooms.data ?? []).slice(0, 6).map((r) => <RoomCard key={r.slug} room={r} />)}
      </div>
      <div className="feed-head">
        <div><h1 style={{ fontSize: 18 }}>Alle Texte</h1><p>{SORTS.find((s) => s.key === sort)!.hint}</p></div>
        <SortTabs value={sort} onChange={(s) => { setSort(s); remember('sort-all', s); }} />
      </div>
      <KindFilter value={kind} onChange={setKind} />
      <Feed params={{ scope: 'all', sort, kind }} />
    </Shell>
  );
}

export function RoomCard({ room }: { room: Room }) {
  const join = useJoin();
  return (
    <div className="room-card">
      <div className="comm-id">
        <RoomIcon room={room} size="lg" />
        <h3><Link className="stretch" to={`/raum/${room.slug}`}>{room.name}</Link></h3>
      </div>
      <p>{room.description}</p>
      <div className="r-foot">
        <span>{plural(room.stats.members, 'Mitglied', 'Mitglieder')} · {room.stats.postsWeek} diese Woche</span>
        <button type="button" className={`btn btn-sm ${room.joined ? 'btn-quiet' : 'btn-primary'}`} onClick={() => join(room)}>{room.joined ? 'Dabei' : 'Beitreten'}</button>
      </div>
    </div>
  );
}
