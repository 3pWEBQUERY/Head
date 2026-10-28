import { Link } from 'react-router';
import { KINDS, KIND_KEYS, RESONANCE, RESONANCE_KEYS } from '../../../shared/constants';
import { Empty } from '../components/bits';
import { Shell } from '../components/Layout';

export function NotFound() {
  return (
    <Shell>
      <Empty title="Diese Seite gibt es nicht" action={<Link className="btn btn-quiet" to="/">Zur Startseite</Link>}>Vielleicht ein Tippfehler – oder ein Text, der nie geschrieben wurde.</Empty>
    </Shell>
  );
}

export function About() {
  return (
    <Shell>
      <article className="legal">
        <h1>Über Lapis</h1>
        <p className="bio">Lapis ist ein Ort zum Aufschreiben. Nicht nur für Menschen, die sich Autorin oder Autor nennen, sondern für alle, die etwas loswerden wollen: was heute passiert ist, das Gute und das Schlechte, ein Gedanke, ein Gedicht, ein Brief, den man nie abschicken wird.</p>
        <h2>Was Lapis anders macht</h2>
        <ul>
          <li><b>Resonanz statt Punkte.</b> Es gibt kein Daumen-runter. Man kann zeigen, wie ein Text angekommen ist: {RESONANCE_KEYS.map((k) => RESONANCE[k].label).join(', ')}.</li>
          <li><b>Leise Stimmen.</b> Eine eigene Ansicht für Texte, auf die noch niemand reagiert hat. Damit nicht nur gelesen wird, wer schon gelesen wird.</li>
          <li><b>Du entscheidest, wer liest.</b> Für alle, für Menschen, die dir folgen, nur für dich – oder anonym.</li>
          <li><b>Du entscheidest, wie geantwortet wird.</b> Gespräch, Werkstatt mit ehrlicher Kritik, oder nur zuhören.</li>
          <li><b>Zeitkapseln, Impulse, Kettengeschichten.</b> Ein Brief an dein zukünftiges Ich, jeden Tag eine Schreibfrage, Geschichten, die andere weiterschreiben.</li>
        </ul>
        <h2>Formen</h2>
        <ul>{KIND_KEYS.map((k) => <li key={k}><b>{KINDS[k].label}</b> – {KINDS[k].hint}</li>)}</ul>
        <h2>Der Name</h2>
        <p>Lapis ist im Italienischen der Bleistift – und der Lapislazuli, aus dem früher das kostbarste Blau gemacht wurde.</p>
      </article>
    </Shell>
  );
}

export function Privacy() {
  return (
    <Shell>
      <article className="legal">
        <h1>Datenschutz</h1>
        <p><i>Vorlage – vor dem Livegang durch eine rechtlich geprüfte Erklärung ersetzen.</i></p>
        <h2>Was wir speichern</h2>
        <p>Dein Konto (Name, Profilname, E-Mail, Passwort als sicherer Hash), deine Texte, Kommentare, Resonanzen, Bilder und die Räume, denen du beitrittst. Private Tagebucheinträge sind nur für dich sichtbar.</p>
        <h2>Was wir nicht tun</h2>
        <p>Keine Werbung, kein Tracking, keine Weitergabe an Dritte. Schriften werden von unserem eigenen Server geladen. Bei Bildern entfernen wir Metadaten wie Standortdaten.</p>
        <h2>Wo die Daten liegen</h2>
        <p>Die Anwendung, die Datenbank (Postgres) und die Bildablage (Bucket) werden bei Railway betrieben.</p>
        <h2>Deine Rechte</h2>
        <p>Du kannst in den Einstellungen jederzeit alle deine Daten exportieren und dein Konto samt allen Inhalten löschen.</p>
        <h2>Cookies</h2>
        <p>Wir verwenden ein einziges, technisch notwendiges Cookie für die Anmeldung. Die Wahl zwischen hellem und dunklem Design wird lokal auf deinem Gerät gespeichert.</p>
      </article>
    </Shell>
  );
}

export function Terms() {
  return (
    <Shell>
      <article className="legal">
        <h1>Nutzungsbedingungen</h1>
        <p><i>Vorlage – vor dem Livegang rechtlich prüfen lassen.</i></p>
        <h2>Deine Texte gehören dir</h2>
        <p>Du räumst Lapis nur das Recht ein, deine Texte so anzuzeigen, wie du es eingestellt hast. Löschst du einen Text, ist er weg.</p>
        <h2>Miteinander</h2>
        <ul>
          <li>Zuhören vor Bewerten. Kritik nur, wo die Werkstatt offen ist.</li>
          <li>Was anonym ist, bleibt anonym. Versuche nicht, Menschen zu identifizieren.</li>
          <li>Keine Hetze, keine Belästigung, keine Inhalte, die andere gefährden.</li>
          <li>Fremde Texte nur mit Quelle und im Rahmen des Zitatrechts.</li>
        </ul>
        <h2>Wenn es dir nicht gut geht</h2>
        <p>Lapis ersetzt keine Hilfe. In der Schweiz erreichst du die Dargebotene Hand unter 143, in Deutschland die Telefonseelsorge unter 0800 111 0 111, in Österreich die Telefonseelsorge unter 142. Im Notfall: 112.</p>
      </article>
    </Shell>
  );
}

export function Imprint() {
  return (
    <Shell>
      <article className="legal">
        <h1>Impressum</h1>
        <p><i>Hier gehören Name, Anschrift und Kontakt der verantwortlichen Person bzw. des Unternehmens hin.</i></p>
      </article>
    </Shell>
  );
}
