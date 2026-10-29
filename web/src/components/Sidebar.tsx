import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router';
import { api } from '../api';
import { fmt, plural } from '../lib/format';
import { useInstall } from '../lib/install';
import { useMe, useOverview, usePromptToday, useRooms } from '../lib/queries';
import { useToast } from '../lib/toast';
import type { Room } from '../types';
import { RoomIcon } from './bits';
import { Heatmap } from './Heatmap';

export function PromptCard() {
  const p = usePromptToday();
  if (!p.data) return null;
  return (
    <section className="card prompt-card" aria-labelledby="prompt-h">
      <span className="prompt-mark" aria-hidden="true">„</span>
      <div className="label" id="prompt-h">Impuls des Tages</div>
      <p className="q">{p.data.text}</p>
      <div className="foot-row">
        <Link className="meta-sm" to={`/impulse/${p.data.day}`}>{p.data.responses ? plural(p.data.responses, 'Antwort', 'Antworten') : 'Noch keine Antworten'}</Link>
        {p.data.answered
          ? <span className="meta-sm">Du hast geantwortet ✓</span>
          : <Link className="btn btn-primary btn-sm" to={`/schreiben?impuls=${p.data.day}`}>Darauf antworten</Link>}
      </div>
    </section>
  );
}

export function WritingCard() {
  const { me } = useMe();
  const ov = useOverview(Boolean(me));
  if (!me || !ov.data) return null;
  const d = ov.data;
  return (
    <section className="card card-pad" aria-labelledby="writing-h">
      <div className="label" id="writing-h">Dein Schreiben</div>
      <div className="streak">
        <b>{d.streak}</b>
        <span>{d.streak === 1 ? 'Tag in Folge' : 'Tage in Folge'}{!d.wroteToday && d.streak > 0 ? ' – heute fehlt noch' : ''}</span>
      </div>
      <Heatmap days={d.recentDays} weeks={16} />
      <div className="heat-legend"><span>{fmt(d.wordsWeek)} Wörter diese Woche</span><Link to={`/@${me.handle}`}>Kalender</Link></div>
    </section>
  );
}

export function useJoin() {
  const qc = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();
  const { me } = useMe();
  const m = useMutation({
    mutationFn: (r: Room) => api(`/api/rooms/${r.slug}/membership`, { method: r.joined ? 'DELETE' : 'PUT' }),
    onSuccess: (_d, r) => {
      toast(r.joined ? `${r.name} verlassen` : `Willkommen in ${r.name}`);
      qc.invalidateQueries({ queryKey: ['rooms'] });
      qc.invalidateQueries({ queryKey: ['room', r.slug] });
      qc.invalidateQueries({ queryKey: ['overview'] });
      qc.invalidateQueries({ queryKey: ['feed', { scope: 'home' }], exact: false });
    },
    onError: (e: Error) => toast(e.message),
  });
  return (r: Room) => (me ? m.mutate(r) : navigate('/anmelden'));
}

export function RoomsCard({ title = 'Wächst diese Woche', exclude }: { title?: string; exclude?: string }) {
  const rooms = useRooms();
  const join = useJoin();
  const list = (rooms.data ?? []).filter((r) => r.slug !== exclude).sort((a, b) => b.stats.newMembers - a.stats.newMembers || b.stats.postsWeek - a.stats.postsWeek).slice(0, 4);
  if (!list.length) return null;
  return (
    <section className="card">
      <div className="card-h label">{title}<Link to="/raeume">Alle Räume</Link></div>
      <ul className="rows">
        {list.map((r) => (
          <li key={r.slug}>
            <RoomIcon room={r} />
            <div className="t">
              <b><Link className="stretch" to={`/raum/${r.slug}`}>{r.name}</Link></b>
              <span>{plural(r.stats.members, 'Mitglied', 'Mitglieder')}{r.stats.newMembers > 0 && <> · <span className="grow">+{r.stats.newMembers}</span></>}</span>
            </div>
            <button className={`btn btn-sm ${r.joined ? 'btn-quiet' : 'btn-primary'}`} type="button" onClick={() => join(r)}>{r.joined ? 'Dabei' : 'Beitreten'}</button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function RulesCard({ rules, title = 'So schreiben wir hier' }: { rules?: string[]; title?: string }) {
  const list = rules?.length ? rules : [
    'Zuhören vor Bewerten.',
    'Kritik nur, wo die Werkstatt offen ist.',
    'Was anonym ist, bleibt anonym.',
    'Inhaltshinweise für schwere Themen.',
  ];
  return (
    <section className="card">
      <div className="card-h label">{title}</div>
      <ol className="rules">{list.map((r, i) => <li key={i}>{r}</li>)}</ol>
    </section>
  );
}

export function InstallCard() {
  const inst = useInstall();
  if (inst.kind === 'installed' || inst.kind === 'none') return null;
  return (
    <section className="card card-pad install-hint">
      <div className="label">Lapis als App</div>
      {inst.kind === 'prompt' ? (
        <>
          <p>Auf dem Homescreen, im Vollbild, mit Offline-Lesen.</p>
          <button className="btn btn-quiet btn-sm" type="button" onClick={inst.install}>App installieren</button>
        </>
      ) : (
        <p>In Safari auf <b>Teilen</b> tippen und <b>Zum Home-Bildschirm</b> wählen.</p>
      )}
    </section>
  );
}

export function FootLinks() {
  return (
    <div className="foot">
      <Link to="/ueber">Über Lapis</Link>
      <Link to="/datenschutz">Datenschutz</Link>
      <Link to="/nutzungsbedingungen">Nutzungsbedingungen</Link>
      <Link to="/impressum">Impressum</Link>
      <span>© {new Date().getFullYear()} Lapis</span>
    </div>
  );
}

export function DefaultRight() {
  return (
    <>
      <PromptCard />
      <WritingCard />
      <RoomsCard />
      <RulesCard />
      <InstallCard />
      <FootLinks />
    </>
  );
}
