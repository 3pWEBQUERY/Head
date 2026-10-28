create extension if not exists pgcrypto;

create table users (
  id            uuid primary key default gen_random_uuid(),
  handle        text not null unique check (handle ~ '^[a-z0-9_.]{3,24}$'),
  display_name  text not null,
  email         text not null unique,
  password_hash text not null,
  bio           text not null default '',
  avatar_key    text,
  role          text not null default 'member' check (role in ('member', 'moderator', 'admin')),
  created_at    timestamptz not null default now()
);

create table sessions (
  token_hash  text primary key,
  user_id     uuid not null references users(id) on delete cascade,
  user_agent  text,
  created_at  timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at  timestamptz not null
);
create index sessions_user_idx on sessions(user_id);

create table rooms (
  id           serial primary key,
  slug         text not null unique check (slug ~ '^[a-z0-9-]{2,32}$'),
  name         text not null,
  description  text not null default '',
  color        text not null default '#213885',
  guidelines   text[] not null default '{}',
  created_by   uuid references users(id) on delete set null,
  official     boolean not null default false,
  created_at   timestamptz not null default now()
);

create table room_members (
  room_id   int not null references rooms(id) on delete cascade,
  user_id   uuid not null references users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id)
);
create index room_members_user_idx on room_members(user_id);

create table posts (
  id                 bigserial primary key,
  author_id          uuid not null references users(id) on delete cascade,
  room_id            int references rooms(id) on delete set null,
  status             text not null default 'draft' check (status in ('draft', 'published')),
  kind               text not null check (kind in ('moment', 'tagebuch', 'geschichte', 'gedicht', 'brief', 'gedanke')),
  title              text not null default '',
  body               text not null default '',
  mood               smallint check (mood between 1 and 5),
  visibility         text not null default 'public' check (visibility in ('public', 'followers', 'private')),
  anonymous          boolean not null default false,
  content_warning    text,
  response_mode      text not null default 'open' check (response_mode in ('open', 'feedback', 'listen')),
  allow_continuation boolean not null default false,
  continues_post_id  bigint references posts(id) on delete set null,
  prompt_day         date,
  cover_key          text,
  word_count         int not null default 0,
  unlock_at          timestamptz,
  capsule_notified   boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  published_at       timestamptz,
  search             tsvector generated always as (
                       setweight(to_tsvector('german', coalesce(title, '')), 'A') ||
                       setweight(to_tsvector('german', coalesce(body, '')), 'B')
                     ) stored
);
create index posts_feed_idx on posts(published_at desc) where status = 'published';
create index posts_author_idx on posts(author_id, created_at desc);
create index posts_room_idx on posts(room_id, published_at desc) where status = 'published';
create index posts_prompt_idx on posts(prompt_day) where prompt_day is not null;
create index posts_continues_idx on posts(continues_post_id) where continues_post_id is not null;
create index posts_search_idx on posts using gin(search);

create table reactions (
  post_id    bigint not null references posts(id) on delete cascade,
  user_id    uuid not null references users(id) on delete cascade,
  kind       text not null check (kind in ('kenn_ich', 'beruehrt', 'stark', 'geschmunzelt')),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id, kind)
);
create index reactions_user_idx on reactions(user_id);

create table comments (
  id         bigserial primary key,
  post_id    bigint not null references posts(id) on delete cascade,
  author_id  uuid not null references users(id) on delete cascade,
  parent_id  bigint references comments(id) on delete cascade,
  body       text not null,
  thanked    boolean not null default false,
  created_at timestamptz not null default now(),
  edited_at  timestamptz,
  deleted_at timestamptz
);
create index comments_post_idx on comments(post_id, created_at);

create table bookmarks (
  user_id    uuid not null references users(id) on delete cascade,
  post_id    bigint not null references posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

create table follows (
  follower_id uuid not null references users(id) on delete cascade,
  followee_id uuid not null references users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);
create index follows_followee_idx on follows(followee_id);

create table notifications (
  id         bigserial primary key,
  user_id    uuid not null references users(id) on delete cascade,
  actor_id   uuid references users(id) on delete cascade,
  type       text not null check (type in ('reaction', 'comment', 'reply', 'follow', 'continuation', 'capsule', 'thanks')),
  post_id    bigint references posts(id) on delete cascade,
  comment_id bigint references comments(id) on delete cascade,
  detail     text,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on notifications(user_id, created_at desc);

create table media (
  key        text primary key,
  user_id    uuid references users(id) on delete set null,
  width      int,
  height     int,
  bytes      int,
  created_at timestamptz not null default now()
);

create table reports (
  id          bigserial primary key,
  reporter_id uuid references users(id) on delete set null,
  post_id     bigint references posts(id) on delete cascade,
  comment_id  bigint references comments(id) on delete cascade,
  reason      text not null,
  resolved_at timestamptz,
  created_at  timestamptz not null default now()
);

create table blocks (
  blocker_id uuid not null references users(id) on delete cascade,
  blocked_id uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);

insert into rooms (slug, name, description, color, official, guidelines) values
  ('heute', 'Heute', 'Was heute passiert ist. Das Gute, das Schlechte, das Dazwischen.', '#893172', true,
    array['Kein Moment ist zu klein.', 'Zuhören vor Ratschlägen.', 'Was hier steht, bleibt hier.']),
  ('tagebuch', 'Offenes Tagebuch', 'Tagebucheinträge, die gelesen werden dürfen.', '#5F3475', true,
    array['Schreib für dich – Leser sind Gäste.', 'Keine Diagnosen, keine Belehrungen.', 'Inhaltshinweise für schwere Themen.']),
  ('kurzgeschichten', 'Kurzgeschichten', 'Erfundenes, Halbwahres und alles mit Anfang, Mitte und Ende.', '#213885', true,
    array['Genre egal, Länge egal.', 'Fortsetzungen verlinken.', 'Kritik nur, wenn die Werkstatt offen ist.']),
  ('lyrik', 'Lyrik', 'Gedichte, Songtexte, Zeilen, die nicht in Prosa passen.', '#B0567E', true,
    array['Reim ist erlaubt, nicht Pflicht.', 'Zeilenumbrüche sind Absicht.', 'Fremde Texte immer mit Quelle.']),
  ('briefe', 'Ungeschickte Briefe', 'Briefe an Menschen, die sie nie lesen werden.', '#7A5A3C', true,
    array['Keine echten Namen von anderen.', 'Gern anonym.', 'Antworten sind Umarmungen, keine Urteile.']),
  ('werkstatt', 'Schreibwerkstatt', 'Texte, die besser werden wollen. Hier ist ehrliche Kritik ausdrücklich erwünscht.', '#4A68C2', true,
    array['Konkret statt pauschal.', 'Erst was funktioniert, dann was nicht.', 'Nimm Kritik als Angebot.']),
  ('gedankenstrich', 'Gedankenstrich', 'Halbe Gedanken, Beobachtungen, Fragen ohne Antwort.', '#9A8C7A', true,
    array['Unfertig ist willkommen.', 'Neugier vor Rechthaben.']),
  ('fantastisch', 'Fantastisch', 'Fantasy, Science-Fiction, Märchen und andere Welten.', '#1B3075', true,
    array['Spoiler markieren.', 'Weltenbau darf ausufern.']);
