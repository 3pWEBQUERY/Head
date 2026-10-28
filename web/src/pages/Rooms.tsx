import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { api } from '../api';
import { Dialog, Skeletons } from '../components/bits';
import { IPlus } from '../components/Icons';
import { Shell } from '../components/Layout';
import { useMe, useRooms } from '../lib/queries';
import { RoomCard } from './Discover';

const COLORS = ['#213885', '#5F3475', '#893172', '#4A68C2', '#7A5A3C', '#B0567E', '#1B3075', '#9A8C7A'];

export function Rooms() {
  const rooms = useRooms();
  const { me } = useMe();
  const [open, setOpen] = useState(false);
  const joined = rooms.data?.filter((r) => r.joined) ?? [];
  const other = rooms.data?.filter((r) => !r.joined) ?? [];
  return (
    <Shell wide>
      <div className="page-head">
        <div className="row">
          <div className="grow">
            <h1>Räume</h1>
            <p>Jeder Raum hat seinen eigenen Ton. Tritt bei, um seine Texte in deinem Feed zu lesen.</p>
          </div>
          {me && <button type="button" className="btn btn-quiet" onClick={() => setOpen(true)}><IPlus /> Raum eröffnen</button>}
        </div>
      </div>
      {rooms.isLoading && <Skeletons />}
      {joined.length > 0 && (<><div className="label nav-label" style={{ paddingInline: 0 }}>Deine Räume</div><div className="room-grid">{joined.map((r) => <RoomCard key={r.slug} room={r} />)}</div></>)}
      {other.length > 0 && (<><div className="label nav-label" style={{ paddingInline: 0 }}>{joined.length ? 'Weitere Räume' : 'Alle Räume'}</div><div className="room-grid">{other.map((r) => <RoomCard key={r.slug} room={r} />)}</div></>)}
      <CreateRoom open={open} onClose={() => setOpen(false)} />
    </Shell>
  );
}

function CreateRoom({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(COLORS[0]);
  const [rules, setRules] = useState('');
  const [err, setErr] = useState('');
  const qc = useQueryClient();
  const navigate = useNavigate();
  const m = useMutation({
    mutationFn: () => api<{ slug: string }>('/api/rooms', { body: { name, description, color, guidelines: rules.split('\n').map((s) => s.trim()).filter(Boolean).slice(0, 5) } }),
    onSuccess: (r) => { qc.invalidateQueries({ queryKey: ['rooms'] }); qc.invalidateQueries({ queryKey: ['overview'] }); onClose(); navigate(`/raum/${r.slug}`); },
    onError: (e: Error) => setErr(e.message),
  });
  return (
    <Dialog open={open} onClose={onClose} label="Raum eröffnen">
      <h2>Einen Raum eröffnen</h2>
      <p>Für ein Thema, eine Form oder ein Gefühl, das noch keinen Ort hat.</p>
      <form style={{ display: 'flex', flexDirection: 'column', gap: 12 }} onSubmit={(e) => { e.preventDefault(); m.mutate(); }}>
        <input className="input" placeholder="Name, z. B. Nachtschicht" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} required />
        <textarea className="textarea" placeholder="Worum geht es hier? Ein Satz genügt." value={description} maxLength={280} onChange={(e) => setDescription(e.target.value)} required />
        <textarea className="textarea" placeholder={'Regeln, eine pro Zeile (optional)\nz. B. Keine Ratschläge ungefragt.'} value={rules} onChange={(e) => setRules(e.target.value)} />
        <div className="moods" role="radiogroup" aria-label="Farbe">
          {COLORS.map((c) => (
            <button key={c} type="button" role="radio" aria-checked={color === c} aria-label={c} onClick={() => setColor(c)}
              style={{ width: 28, height: 28, borderRadius: 8, background: c, boxShadow: color === c ? '0 0 0 2px var(--surface), 0 0 0 4px var(--ink)' : undefined }} />
          ))}
        </div>
        {err && <div className="form-error">{err}</div>}
        <div className="row">
          <button className="btn btn-ghost" type="button" onClick={onClose}>Abbrechen</button>
          <button className="btn btn-primary" type="submit" disabled={m.isPending}>Eröffnen</button>
        </div>
      </form>
    </Dialog>
  );
}
