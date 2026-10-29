import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router';
import { api } from '../api';
import { Empty } from '../components/bits';
import { Feed } from '../components/Feed';
import { Shell } from '../components/Layout';
import { FootLinks, WritingCard } from '../components/Sidebar';
import { dateShort, dayLabel, plural } from '../lib/format';
import { useMe, usePromptToday } from '../lib/queries';
import type { Prompt } from '../types';

export function Prompts() {
  const { day } = useParams();
  const today = usePromptToday();
  const { me } = useMe();
  const archive = useQuery({ queryKey: ['prompts'], queryFn: () => api<{ prompts: Prompt[] }>('/api/prompts?days=21').then((r) => r.prompts) });
  const picked = day ? archive.data?.find((p) => p.day === day) ?? null : today.data;
  const current = picked ?? today.data;
  const isToday = !day || day === today.data?.day;

  const right = (
    <>
      <WritingCard />
      <section className="card">
        <div className="card-h label">Frühere Impulse</div>
        <ul className="archive" style={{ padding: '4px 16px 12px' }}>
          {archive.data?.map((p) => (
            <li key={p.day}>
              <Link to={`/impulse/${p.day}`} aria-current={current?.day === p.day ? 'page' : undefined} style={{ gridTemplateColumns: '64px 1fr auto' }}>
                <span className="d">{dateShort(p.day + 'T12:00:00')}</span>
                <span className="t">{p.text}</span>
                <span className="n">{p.responses || ''}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <FootLinks />
    </>
  );

  return (
    <Shell right={right}>
      {current && (
        <section className="prompt-hero">
          <span className="prompt-mark" aria-hidden="true">„</span>
          <div className="label">{isToday ? 'Impuls des Tages' : `Impuls · ${dayLabel(current.day)}`}</div>
          <p className="q">{current.text}</p>
          <div className="row" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <Link className="btn btn-primary" to={me ? `/schreiben?impuls=${current.day}` : '/registrieren'}>Darauf antworten</Link>
            <span className="note">{current.responses ? plural(current.responses, 'Antwort', 'Antworten') : 'Noch niemand hat geantwortet'}</span>
          </div>
        </section>
      )}
      <div className="feed-head"><h1 style={{ fontSize: 18 }}>Antworten</h1></div>
      {current && <Feed params={{ prompt: current.day, sort: 'neu' }} empty={<Empty title="Noch leer">Jeden Tag eine neue Frage. Wer zuerst antwortet, gibt den Ton an.</Empty>} />}
    </Shell>
  );
}
