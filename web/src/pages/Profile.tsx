import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { api } from '../api';
import { Avatar, Empty, Menu, Spinner } from '../components/bits';
import { Feed } from '../components/Feed';
import { KindFilter } from '../components/FeedControls';
import { Heatmap } from '../components/Heatmap';
import { IEdit, IFlag, IMore, IShare } from '../components/Icons';
import { Shell } from '../components/Layout';
import { FootLinks, PromptCard, WritingCard } from '../components/Sidebar';
import { fmt } from '../lib/format';
import { useMe } from '../lib/queries';
import { useToast } from '../lib/toast';
import type { CalendarDay, Profile as P } from '../types';
import { NotFound } from './Static';

export function ProfileRoute() {
  const { handle = '' } = useParams();
  if (!handle.startsWith('@')) return <NotFound />;
  return <Profile key={handle} handle={handle.slice(1).toLowerCase()} />;
}

function Profile({ handle }: { handle: string }) {
  const { me } = useMe();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const [kind, setKind] = useState<string>();
  const q = useQuery({ queryKey: ['user', handle], queryFn: () => api<{ user: P; calendar: CalendarDay[] }>(`/api/users/${handle}`) });
  const follow = useMutation({
    mutationFn: (on: boolean) => api(`/api/users/${handle}/follow`, { method: on ? 'PUT' : 'DELETE' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['user', handle] }); qc.invalidateQueries({ queryKey: ['feed'] }); },
  });
  const block = useMutation({
    mutationFn: (on: boolean) => api(`/api/users/${handle}/block`, { method: on ? 'PUT' : 'DELETE' }),
    onSuccess: (_d, on) => { qc.invalidateQueries({ queryKey: ['user', handle] }); qc.invalidateQueries({ queryKey: ['feed'] }); toast(on ? 'Blockiert. Ihr seht euch gegenseitig nicht mehr.' : 'Blockierung aufgehoben.'); },
  });

  if (q.isLoading) return <Shell><Spinner /></Shell>;
  if (!q.data) return <Shell><Empty title="Dieses Profil gibt es nicht" /></Shell>;
  const { user: u, calendar } = q.data;
  const totalDays = calendar.length;

  return (
    <Shell right={<>{u.self ? <WritingCard /> : null}<PromptCard /><FootLinks /></>}>
      <div className="page-head profile-head">
        <div className="row" style={{ alignItems: 'flex-start' }}>
          <Avatar person={u} size="xl" />
          <div className="grow" style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 6 }}>
            <h1>{u.name}</h1>
            <span className="readinfo">@{u.handle}{u.followsYou && !u.self && <> · <span className="tag-follows">folgt dir</span></>}</span>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {u.self ? (
              <Link className="btn btn-quiet btn-sm" to="/einstellungen"><IEdit size={15} /> Profil bearbeiten</Link>
            ) : !u.blocked && (
              <button className={`btn btn-sm ${u.followed ? 'btn-quiet' : 'btn-primary'}`} type="button" onClick={() => (me ? follow.mutate(!u.followed) : navigate('/anmelden'))}>
                {u.followed ? 'Du folgst' : 'Folgen'}
              </button>
            )}
            <Menu label="Mehr" button={<IMore />}>
              {(close) => (
                <>
                  <button type="button" onClick={async () => { close(); const url = `${location.origin}/@${u.handle}`; try { await navigator.clipboard.writeText(url); toast('Link kopiert'); } catch { toast(url); } }}><IShare size={16} /> Profil teilen</button>
                  {me && !u.self && <button type="button" className="danger" onClick={() => { close(); block.mutate(!u.blocked); }}><IFlag size={16} /> {u.blocked ? 'Nicht mehr blockieren' : 'Blockieren'}</button>}
                </>
              )}
            </Menu>
          </div>
        </div>
        {u.bio && <p className="bio">{u.bio}</p>}
        <div className="stat-line">
          <span><b>{fmt(u.stats.posts)}</b>Texte</span>
          <span><b>{fmt(u.stats.words)}</b>Wörter</span>
          <span><b>{fmt(u.followers)}</b>Folgende</span>
          <span><b>{fmt(u.following)}</b>folgt</span>
          <span>Dabei seit {new Date(u.joinedAt).toLocaleDateString('de-CH', { month: 'long', year: 'numeric' })}</span>
        </div>
        <div>
          <div className="label" style={{ marginBottom: 10 }}>Schreibkalender{u.self ? ' · inklusive Privatem, nur für dich sichtbar' : ''}</div>
          <Heatmap days={calendar} weeks={30} />
          <div className="heat-legend"><span>{totalDays} {totalDays === 1 ? 'Tag' : 'Tage'} mit Texten im letzten Jahr</span>{u.self && u.stats.streak !== undefined && <span>{u.stats.streak} in Folge</span>}</div>
        </div>
      </div>
      {u.blocked ? (
        <Empty title="Du hast diese Person blockiert" />
      ) : (
        <>
          <div style={{ paddingTop: 14 }}><KindFilter value={kind} onChange={setKind} /></div>
          <Feed params={{ author: u.handle, sort: 'neu', kind }} empty={<Empty title={u.self ? 'Noch nichts veröffentlicht' : 'Noch nichts geschrieben'}>{u.self ? 'Anonyme und private Texte erscheinen nicht in deinem Profil.' : undefined}</Empty>} />
        </>
      )}
    </Shell>
  );
}
