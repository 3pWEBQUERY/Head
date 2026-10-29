import { useState } from 'react';
import { Feed } from '../components/Feed';
import { KindFilter, remember, remembered, SortTabs, SORTS, type Sort } from '../components/FeedControls';
import { Shell } from '../components/Layout';
import { RoomSlider } from '../components/RoomCards';
import { FootLinks, PromptCard, RulesCard } from '../components/Sidebar';
import { useRooms } from '../lib/queries';

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
      <RoomSlider rooms={rooms.data ?? []} />
      <div className="feed-head">
        <div><h1 style={{ fontSize: 18 }}>Alle Texte</h1><p>{SORTS.find((s) => s.key === sort)!.hint}</p></div>
        <SortTabs value={sort} onChange={(s) => { setSort(s); remember('sort-all', s); }} />
      </div>
      <KindFilter value={kind} onChange={setKind} />
      <Feed params={{ scope: 'all', sort, kind }} />
    </Shell>
  );
}
