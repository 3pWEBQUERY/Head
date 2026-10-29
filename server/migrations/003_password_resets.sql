-- Einmal-Links zum Zurücksetzen des Passworts. Gespeichert wird nur der Hash des Tokens.
create table password_resets (
  token_hash text primary key,
  user_id    uuid not null references users(id) on delete cascade,
  expires_at timestamptz not null,
  used_at    timestamptz,
  created_at timestamptz not null default now()
);
create index password_resets_user_idx on password_resets(user_id, created_at desc);
