-- Mehr Stimmungen (1–16). Bestehende Werte 1–5 behalten ihre Bedeutung.
alter table posts drop constraint if exists posts_mood_check;
alter table posts add constraint posts_mood_check check (mood between 1 and 16);
