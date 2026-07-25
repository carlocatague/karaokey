-- KaraokeHub schema (no-account version)
-- Run this in the Supabase SQL editor (Project > SQL Editor > New query)
--
-- There are no user accounts here — anyone with the anon key can read/write.
-- "Identity" is just a random session id generated in the browser and stored
-- in localStorage, plus a display name people type in. This is fine for a
-- casual, ephemeral karaoke-night tool; don't use this policy design for
-- anything that needs real access control.

-- 1. Rooms
create table if not exists rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text unique not null,
  host_session_id text not null,
  is_active boolean default true,
  guest_controls boolean default true,
  queue_limit integer default 10,
  scoring_enabled boolean default true,
  created_at timestamptz default now()
);

-- 2. Room membership (who's currently in the room)
create table if not exists room_members (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references rooms(id) on delete cascade,
  session_id text not null,
  display_name text not null,
  joined_at timestamptz default now(),
  unique (room_id, session_id)
);

-- 3. Queue items — song info is stored directly from the YouTube search
-- result, no separate catalog table needed.
create table if not exists queue_items (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references rooms(id) on delete cascade,
  video_id text not null,
  title text not null,
  thumbnail_url text,
  singer_name text not null,
  session_id text not null,
  status text not null default 'waiting' check (status in ('waiting', 'playing', 'done')),
  position integer not null default 0,
  created_at timestamptz default now()
);

-- 4. Song plays -- a global, cross-room tally used for the "Trending on
-- KaraokeHub" list shown in Add Song. Incremented once per performance
-- (when a song is marked "playing"), not per queue add.
create table if not exists song_plays (
  video_id text primary key,
  title text not null,
  thumbnail_url text,
  play_count integer not null default 1,
  updated_at timestamptz default now()
);

-- Row Level Security — open to anyone with the anon key, since there's no
-- account system to key policies off of.
alter table rooms enable row level security;
alter table room_members enable row level security;
alter table queue_items enable row level security;
alter table song_plays enable row level security;

create policy "rooms_all" on rooms for all using (true) with check (true);
create policy "room_members_all" on room_members for all using (true) with check (true);
create policy "queue_items_all" on queue_items for all using (true) with check (true);
create policy "song_plays_all" on song_plays for all using (true) with check (true);

-- Atomic upsert-and-increment so concurrent rooms playing the same song
-- don't race each other into an inconsistent count.
create or replace function increment_song_play(p_video_id text, p_title text, p_thumbnail text)
returns void as $$
begin
  insert into song_plays (video_id, title, thumbnail_url, play_count, updated_at)
  values (p_video_id, p_title, p_thumbnail, 1, now())
  on conflict (video_id) do update
    set play_count = song_plays.play_count + 1,
        title = excluded.title,
        thumbnail_url = excluded.thumbnail_url,
        updated_at = now();
end;
$$ language plpgsql security definer;

grant execute on function increment_song_play(text, text, text) to anon, authenticated;

-- Realtime: enable replication so the queue and member list update live
alter publication supabase_realtime add table queue_items;
alter publication supabase_realtime add table room_members;
alter publication supabase_realtime add table rooms;

-- If you already ran this schema before the settings columns / song_plays
-- table existed, run this once instead of the whole file to add them to an
-- existing project:
--
-- alter table rooms add column if not exists guest_controls boolean default true;
-- alter table rooms add column if not exists queue_limit integer default 10;
-- alter table rooms add column if not exists scoring_enabled boolean default true;
--
-- create table if not exists song_plays (
--   video_id text primary key,
--   title text not null,
--   thumbnail_url text,
--   play_count integer not null default 1,
--   updated_at timestamptz default now()
-- );
-- alter table song_plays enable row level security;
-- create policy "song_plays_all" on song_plays for all using (true) with check (true);
-- create or replace function increment_song_play(p_video_id text, p_title text, p_thumbnail text)
-- returns void as $$
-- begin
--   insert into song_plays (video_id, title, thumbnail_url, play_count, updated_at)
--   values (p_video_id, p_title, p_thumbnail, 1, now())
--   on conflict (video_id) do update
--     set play_count = song_plays.play_count + 1,
--         title = excluded.title,
--         thumbnail_url = excluded.thumbnail_url,
--         updated_at = now();
-- end;
-- $$ language plpgsql security definer;
-- grant execute on function increment_song_play(text, text, text) to anon, authenticated;
