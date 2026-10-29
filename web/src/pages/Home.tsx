import { useState } from 'react';
import { Link } from 'react-router';
import { Empty } from '../components/bits';
import { Composer } from '../components/Composer';
import { Feed } from '../components/Feed';
import { KindFilter, remember, remembered, SortTabs, SORTS, type Sort } from '../components/FeedControls';
import { Shell } from '../components/Layout';
import { DefaultRight } from '../components/Sidebar';
import { useMe } from '../lib/queries';

export function Home() {
  const { me, loading } = useMe();
  const [sort, setSort] = useState<Sort>(() => remembered('sort-home', 'lesenswert'));
  const [kind, setKind] = useState<string>();
  const greeting = greet();

  return (
    <Shell right={<DefaultRight />}>
      {!loading && !me && <Welcome />}
      <div className="feed-head">
        <div>
          <h1>{me ? `${greeting}, ${me.name.split(' ')[0]}` : 'Gerade geschrieben'}</h1>
          <p>{SORTS.find((s) => s.key === sort)!.hint}</p>
        </div>
        <SortTabs value={sort} onChange={(s) => { setSort(s); remember('sort-home', s); }} />
      </div>
      <Composer />
      <KindFilter value={kind} onChange={setKind} />
      <Feed
        params={{ scope: me ? 'home' : 'all', sort, kind }}
        empty={
          sort === 'leise'
            ? <Empty title="Alles gehört">Gerade wartet kein Text auf eine erste Antwort. Schön.</Empty>
            : <Empty title="Noch ganz still hier" action={<Link className="btn btn-primary" to="/schreiben">Den ersten Text schreiben</Link>}>Tritt ein paar Räumen bei oder schreib selbst etwas.</Empty>
        }
      />
    </Shell>
  );
}

function greet() {
  const h = new Date().getHours();
  if (h < 5) return 'Noch wach';
  if (h < 11) return 'Guten Morgen';
  if (h < 17) return 'Hallo';
  if (h < 22) return 'Guten Abend';
  return 'Gute Nacht';
}

function Welcome() {
  return (
    <section className="welcome" aria-labelledby="welcome-h">
      <span className="rings" aria-hidden="true">
        <i style={{ width: 340, height: 340, right: -120, top: -150, background: '#0D1F58' }} />
        <i style={{ width: 240, height: 240, right: -70, top: -100, background: '#142767' }} />
        <i style={{ width: 140, height: 140, right: -20, top: -50, background: '#1B3075' }} />
      </span>
      <h1 id="welcome-h">Schreib es los. Für dich, für andere, für später.</h1>
      <p>Lapis ist ein Ort für alles, was raus will: was heute passiert ist, ein Tagebucheintrag, eine Geschichte, ein Brief, den du nie abschicken wirst. Öffentlich, anonym oder nur für dich.</p>
      <div className="kinds-line"><span>Momente</span><span>Tagebuch</span><span>Geschichten</span><span>Gedichte</span><span>Briefe</span><span>Gedanken</span></div>
      <div className="row">
        <Link className="btn btn-primary" to="/registrieren">Kostenlos anfangen</Link>
        <Link className="btn btn-quiet" to="/anmelden">Ich habe schon ein Konto</Link>
      </div>
    </section>
  );
}
