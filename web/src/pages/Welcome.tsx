import { Link } from 'react-router';
import { ThemeToggle } from '../components/bits';
import { Shell } from '../components/Layout';
import { InstallCard } from '../components/Sidebar';
import { useMe, useRooms } from '../lib/queries';
import { RoomCard } from '../components/RoomCards';

export function Welcome() {
  const { me } = useMe();
  const rooms = useRooms();
  return (
    <Shell wide>
      <div className="page-head">
        <h1>Willkommen{me ? `, ${me.name.split(' ')[0]}` : ''}.</h1>
        <p>Drei Dinge, dann bist du drin. Du kannst alles später ändern.</p>
      </div>
      <div className="settings" style={{ paddingTop: 22 }}>
        <section>
          <h2>1 · Such dir Räume aus</h2>
          <p className="note">Ihre Texte erscheinen in deinem Feed. „Heute“ und „Offenes Tagebuch“ haben wir schon für dich geöffnet.</p>
          <div className="room-grid" style={{ marginBottom: 0 }}>{rooms.data?.map((r) => <RoomCard key={r.slug} room={r} />)}</div>
        </section>
        <section>
          <h2>2 · Hell oder dunkel?</h2>
          <div className="row"><ThemeToggle /><span className="note">Viele schreiben nachts. Lapis auch.</span></div>
        </section>
        <section>
          <h2>3 · Wie du schreiben kannst</h2>
          <ul className="rules" style={{ padding: 0 }}>
            <li><span><b>Für alle</b>, <b>für Menschen, die dir folgen</b> oder <b>nur für dich</b> – dein privates Tagebuch.</span></li>
            <li><span><b>Anonym</b>: Für schwere Dinge. Niemand sieht, dass es von dir ist.</span></li>
            <li><span><b>Nur zuhören</b>: Keine Kommentare, nur Resonanz. Oder <b>Werkstatt</b>, wenn du ehrliche Kritik willst.</span></li>
            <li><span><b>Zeitkapsel</b>: Ein Brief an dich, der sich erst an einem bestimmten Tag öffnet.</span></li>
          </ul>
          <div style={{ maxWidth: 340 }}><InstallCard /></div>
          <div className="row">
            <Link className="btn btn-primary btn-lg" to="/schreiben">Den ersten Text schreiben</Link>
            <Link className="btn btn-quiet btn-lg" to="/">Erst mal lesen</Link>
          </div>
        </section>
      </div>
    </Shell>
  );
}
