# Lapis API

Eine JSON-API für die Web-App und die späteren iOS- und Android-Apps. Alle Pfade beginnen mit `/api`.

## Anmeldung

| | |
|---|---|
| Web | Cookie `lapis_session` (httpOnly, SameSite=Lax). Schreibende Anfragen brauchen den Header `x-lapis: 1`. |
| Native Apps | `POST /api/auth/login` bzw. `/register` mit `"native": true` → Antwort enthält `token`. Danach `Authorization: Bearer <token>` (kein `x-lapis` nötig). |

Fehler kommen immer als `{ "error": "Lesbare Meldung", "code": "maschinen_code" }` mit passendem HTTP-Status.

## Endpunkte

### Konto
- `POST /auth/register` `{ handle, name, email, password, native? }`
- `POST /auth/login` `{ login, password, native? }` (`login` = E-Mail oder Profilname)
- `POST /auth/logout`
- `GET /auth/me` → `{ user | null }`
- `POST /auth/password` `{ current, next }` (meldet andere Sitzungen ab)
- `GET /auth/export` → alle eigenen Daten als JSON
- `DELETE /auth/account` `{ password }`
- `PATCH /me` `{ name?, bio?, avatarKey? }`
- `GET /me/overview` → Räume, Zähler, Serie, Wörter der Woche

### Texte
- `GET /posts` Feed. Parameter: `scope=home|all`, `sort=lesenswert|neu|leise`, `room`, `author`, `kind`, `prompt=YYYY-MM-DD`, `q`, `saved=1`, `journal=1`, `continues=<id>`, `offset`, `limit` → `{ posts, hasMore }`
- `GET /posts/:id`
- `POST /posts` / `PATCH /posts/:id` mit `{ kind, title, body, mood, visibility, anonymous, contentWarning, responseMode, allowContinuation, continuesPostId, promptDay, coverKey, room, unlockAt, publish }`
- `POST /posts/:id/unpublish`, `DELETE /posts/:id`
- `GET /drafts`
- `PUT|DELETE /posts/:id/reactions/:kind` – `kenn_ich | beruehrt | stark | geschmunzelt`
- `GET /posts/:id/reactions` (nur für die Autorin / den Autor)
- `PUT|DELETE /posts/:id/bookmark`
- `POST /reports` `{ postId? | commentId?, reason }`

### Antworten
- `GET /posts/:id/comments` → `{ comments, canModerate }`
- `POST /posts/:id/comments` `{ body, parentId? }`
- `PATCH|DELETE /comments/:id`
- `PUT /comments/:id/thanks` (Autorin bedankt sich, Umschalter)

### Räume, Menschen, Impulse
- `GET /rooms`, `GET /rooms/:slug`, `POST /rooms`, `PUT|DELETE /rooms/:slug/membership`
- `GET /users/:handle` → Profil + Schreibkalender, `PUT|DELETE /users/:handle/follow`, `PUT|DELETE /users/:handle/block`
- `GET /prompts/today`, `GET /prompts?days=14`, `GET /prompts/:day`
- `GET /notifications?before=<id>`, `GET /notifications/unread`, `POST /notifications/read` `{ ids? }`

### Bilder
- `POST /media?purpose=avatar|cover` (multipart, Feld `file`) → `{ key, url }`. Bilder werden zu WebP umgerechnet, Metadaten (GPS!) entfernt.
- `GET /media/<key>` liefert das Bild (beim Bucket per Weiterleitung auf eine signierte URL).

Bild-URLs sind relativ (`/media/...`) – native Apps hängen sie an ihre Basis-URL.

## Gemeinsame Begriffe

`shared/constants.ts` enthält Formen, Stimmungen, Resonanz-Arten, Sichtbarkeiten und Grenzen. Diese Datei ist die Quelle der Wahrheit, auch für die nativen Apps.
