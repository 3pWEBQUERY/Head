# Lapis – Schreib es los

Ein Ort zum Aufschreiben. Nicht nur für Hobbyautor:innen, sondern für alle, die etwas loswerden wollen: was heute passiert ist (gut oder schlecht), Tagebuch, Kurzgeschichten, Gedichte, Briefe, halbe Gedanken.

Läuft als **PWA** (installierbar, offline lesbar, Teilen-Ziel). Die API ist von Anfang an so gebaut, dass die iOS- und Android-Apps sie direkt nutzen können ([docs/API.md](docs/API.md)).

## Was Lapis anders macht als Reddit

| Reddit | Lapis |
|---|---|
| Up-/Downvotes, Karma | **Resonanz**: „Kenn ich“, „Berührt“, „Stark geschrieben“, „Geschmunzelt“. Kein Daumen runter, keine Punkte im Profil. |
| Hot / New / Top | **Lesenswert / Neu / Leise**. „Leise“ zeigt Texte, auf die noch niemand reagiert hat. |
| r/… und u/… | **Räume** mit eigenem Ton und Regeln, Menschen mit Namen statt Präfix |
| Kommentare immer offen | Pro Text wählbar: **Gespräch**, **Werkstatt** (Kritik erwünscht) oder **Nur zuhören** |
| Alles öffentlich | **Für alle**, **wer mir folgt**, **nur ich** (privates Tagebuch) oder **anonym** |
| Titel + Link | **Formen**: Moment, Tagebuch, Geschichte, Gedicht, Brief, Gedanke. Dazu Stimmung, Lesezeit und eine Leseschrift. |

Außerdem:

- **Impuls des Tages**: eine Schreibfrage, für alle dieselbe.
- **Zeitkapsel**: ein privater Brief an dein zukünftiges Ich, der bis zu einem Datum versiegelt bleibt und sich dann meldet.
- **Kettengeschichten**: Wer es erlaubt, dessen Geschichte darf von anderen fortgesetzt werden.
- **Inhaltshinweise**: Schwere Texte sind erst nach einem Klick zu sehen.
- **Schreibkalender und Serie**: Wann und wie viel du geschrieben hast.
- **Fokusmodus**: Ablenkungsfreier Editor mit Autosave und lokalem Backup (auch offline).
- **Danke sagen**: Die Autorin bzw. der Autor kann sich für einen Kommentar bedanken.
- **Sicherheit**: Blockieren, Melden, Kommentare auf eigenen Texten entfernen, Hilfsnummern im Melde-Dialog.
- **Datenhoheit**: kompletter JSON-Export und Konto-Löschung in den Einstellungen. Schriften liegen auf dem eigenen Server (kein Google Fonts), Bild-Metadaten werden entfernt.

## Stack

- **Server**: Node 22, Fastify 5, Postgres (`pg`, eigene SQL-Migrationen), zod, scrypt-Passwörter, Sessions per Cookie oder Bearer-Token
- **Web**: React 19, React Router 7, TanStack Query, Vite, `vite-plugin-pwa` (Workbox)
- **Speicher**: Railway Bucket (S3-kompatibel, privat); Auslieferung per signierter Weiterleitung, damit der Traffic über den kostenlosen Bucket-Egress läuft. Lokal: Ordner `.uploads/`
- **Design**: Geist (UI), Geist Mono (Zahlen), Literata (Texte), Hell/Dunkel mit dem Tag/Nacht-Schalter

```
server/      API, Migrationen, Demo-Daten
web/         PWA (React)
shared/      Begriffe, Grenzen und Impulse für Server, Web und Apps
test/        API-Tests gegen echtes Postgres
.railway/    Railway Infrastructure as Code
```

## Lokal starten

```bash
cp .env.example .env          # DATABASE_URL anpassen
npm install
npm run seed:demo             # optional: Beispieltexte, Login „demo“ / „lapis-demo“
npm run dev                   # API auf :3000, Web auf :5173
```

Migrationen laufen beim Serverstart automatisch (mit Advisory Lock, also auch bei mehreren Instanzen sicher).

```bash
npm test          # API-Tests (braucht eine leere Datenbank, Standard: lapis_test)
npm run typecheck
npm run build     # Web nach dist/web, Server nach dist/node
npm start
```

## Auf Railway

Die Datei `.railway/railway.ts` beschreibt das ganze Projekt: Service `lapis` (aus diesem Repo, Branch `main`), Postgres und einen Bucket, alles in Europa (Amsterdam). Die Bucket-Zugangsdaten und `DATABASE_URL` werden als Referenzen verknüpft.

```bash
railway link            # Projekt verbinden
railway config plan     # Änderungen ansehen
railway config apply    # anlegen bzw. aktualisieren
```

Lieber im Dashboard? Dann reichen: neuer Service aus dem GitHub-Repo, **Postgres** und **Bucket** hinzufügen und beim Service folgende Variablen setzen:

| Variable | Wert |
|---|---|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |
| `BUCKET`, `ENDPOINT`, `REGION`, `ACCESS_KEY_ID`, `SECRET_ACCESS_KEY` | Referenzen auf den Bucket (Tab „Credentials“) |

Build `npm run build`, Start `npm start`, Healthcheck `/api/health`. `NODE_ENV` bitte **nicht** setzen: Sonst installiert npm beim Build die Build-Werkzeuge nicht. Auf Railway schaltet die App automatisch in den Produktionsmodus.

Ältere Buckets brauchen eventuell `S3_FORCE_PATH_STYLE=true`. Ob das nötig ist, steht im Credentials-Tab.

### E-Mail („Passwort vergessen“)

Railway erlaubt SMTP erst ab dem Pro-Plan, darum verschickt Lapis über die HTTP-API von [Resend](https://resend.com):

| Variable | Wert |
|---|---|
| `RESEND_API_KEY` | API-Schlüssel aus dem Resend-Dashboard |
| `MAIL_FROM` | Absender, z. B. `Lapis <hallo@deine-domain.ch>` (Domain bei Resend verifizieren) |
| `PUBLIC_URL` | nur bei eigener Domain nötig, sonst wird `RAILWAY_PUBLIC_DOMAIN` für den Link genutzt |

Ohne Schlüssel werden Reset-Mails lokal in der Konsole ausgegeben; in Produktion wird nur ein Fehler geloggt.

## Vor dem Livegang

- `RESEND_API_KEY` und `MAIL_FROM` setzen, sonst kommen keine „Passwort vergessen“-Mails an.
- Datenschutzerklärung, Nutzungsbedingungen und Impressum (`web/src/pages/Static.tsx`) sind Vorlagen und müssen rechtlich geprüft und ergänzt werden.
- Ein Konto zum Moderator machen: `update users set role = 'admin' where handle = '…';`. Meldungen liegen in der Tabelle `reports`.
