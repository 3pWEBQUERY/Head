import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';
import { countWords, KINDS, KIND_KEYS, MOODS, type Kind, type Mood, type Visibility } from '../../../shared/constants';
import { api } from '../api';
import { useMe, useOverview, useRooms } from '../lib/queries';
import { useToast } from '../lib/toast';
import { Avatar, Switch } from './bits';
import { IMask, IPen } from './Icons';

const PLACEHOLDER: Record<Kind, string> = {
  moment: 'Was ist heute passiert?',
  tagebuch: 'Liebes Tagebuch …',
  geschichte: 'Es war einmal – oder auch nicht.',
  gedicht: 'Eine Zeile. Dann noch eine.',
  brief: 'Liebe …,',
  gedanke: 'Mir geht gerade durch den Kopf …',
};

/** Schnell etwas loswerden – für Längeres gibt es den Fokusmodus. */
export function Composer({ room: fixedRoom, defaultKind = 'moment' }: { room?: string; defaultKind?: Kind }) {
  const { me } = useMe();
  const ov = useOverview(Boolean(me));
  const rooms = useRooms();
  const toast = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<Kind>(defaultKind);
  const [body, setBody] = useState('');
  const [mood, setMood] = useState<Mood | null>(null);
  const [room, setRoom] = useState<string>(fixedRoom ?? 'heute');
  const [visibility, setVisibility] = useState<Visibility>('public');
  const [anonymous, setAnonymous] = useState(false);
  const [err, setErr] = useState('');

  const publish = useMutation({
    mutationFn: () => api<{ id: number }>('/api/posts', {
      body: { kind, body, mood, room: visibility === 'private' ? null : room, visibility, anonymous: visibility === 'public' && anonymous, publish: true },
    }),
    onSuccess: () => {
      const where = visibility === 'private' ? 'in dein Tagebuch' : `in ${rooms.data?.find((r) => r.slug === room)?.name ?? 'Lapis'}`;
      reset();
      qc.invalidateQueries({ queryKey: ['feed'] });
      qc.invalidateQueries({ queryKey: ['overview'] });
      toast(visibility === 'private' ? 'Sicher in deinem Tagebuch.' : `Veröffentlicht ${where}.`);
    },
    onError: (e: Error) => setErr(e.message),
  });

  function reset() {
    setOpen(false);
    setBody('');
    setMood(null);
    setAnonymous(false);
    setErr('');
  }

  if (!me) return null;
  const words = countWords(body);
  const myRooms = ov.data?.rooms ?? [];
  const roomOptions = rooms.data?.length ? rooms.data : myRooms;

  return (
    <form
      className="composer"
      onSubmit={(e) => {
        e.preventDefault();
        if (!words) return setErr('Schreib mindestens ein Wort');
        publish.mutate();
      }}
    >
      <div className="composer-row">
        <Avatar person={anonymous ? null : me} />
        <textarea
          rows={1}
          value={body}
          placeholder={PLACEHOLDER[kind]}
          aria-label="Text"
          onFocus={() => setOpen(true)}
          onChange={(e) => { setBody(e.target.value); setErr(''); }}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) e.currentTarget.form?.requestSubmit(); }}
        />
      </div>
      {open && (
        <div className="composer-more">
          <div className="kinds" role="radiogroup" aria-label="Form" style={{ paddingBottom: 0 }}>
            {KIND_KEYS.map((k) => (
              <button key={k} type="button" className="chip" role="radio" aria-checked={kind === k} aria-pressed={kind === k} style={{ ['--tc' as any]: KINDS[k].color }} onClick={() => setKind(k)}>
                <i className="sw" />{KINDS[k].label}
              </button>
            ))}
          </div>
          <div className="moods" role="radiogroup" aria-label="Stimmung">
            <span className="hint" style={{ marginRight: 4 }}>Stimmung</span>
            {([1, 2, 3, 4, 5] as Mood[]).map((m) => (
              <button key={m} type="button" className="mood-btn" role="radio" aria-checked={mood === m} aria-pressed={mood === m} onClick={() => setMood(mood === m ? null : m)}>
                <i className="mood-dot" style={{ ['--mc' as any]: MOODS[m].color }} />{MOODS[m].label}
              </button>
            ))}
          </div>
          <div className="composer-foot">
            <div className="composer-opts">
              <select className="select" aria-label="Wer darf es lesen?" value={visibility} onChange={(e) => setVisibility(e.target.value as Visibility)}>
                <option value="public">Für alle</option>
                <option value="followers">Wer mir folgt</option>
                <option value="private">Nur ich (Tagebuch)</option>
              </select>
              {visibility !== 'private' && !fixedRoom && (
                <select className="select" aria-label="Raum" value={room} onChange={(e) => setRoom(e.target.value)}>
                  {roomOptions.map((r) => <option key={r.slug} value={r.slug}>{r.name}</option>)}
                </select>
              )}
              {visibility === 'public' && (
                <label className="composer-switch">
                  <Switch checked={anonymous} onChange={setAnonymous} label="Anonym veröffentlichen" />
                  <IMask size={15} /> Anonym
                </label>
              )}
            </div>
            <div className="composer-btns">
              {err ? <span className="hint err">{err}</span> : <span className="hint">{words} {words === 1 ? 'Wort' : 'Wörter'}</span>}
              <button type="button" className="btn btn-ghost btn-sm" onClick={reset}>Abbrechen</button>
              <button type="submit" className="btn btn-primary btn-sm" disabled={publish.isPending}>{visibility === 'private' ? 'Sichern' : 'Teilen'}</button>
            </div>
          </div>
          <Link
            className="composer-switch"
            to="/schreiben"
            state={{ draft: { kind, body, mood, room, visibility, anonymous } }}
          >
            <IPen size={15} /> Ganz in Ruhe weiterschreiben – mit Titel, Bild und mehr
          </Link>
        </div>
      )}
    </form>
  );
}
