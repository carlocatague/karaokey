# KaraokeHub

A no-account karaoke room app: create a room, share the code, and search any
song straight from YouTube — the queue updates live for everyone in the room.
Built with React + Vite, Supabase (Postgres + Realtime), and the YouTube Data API.

## Features

- **No sign-up.** Type a display name, create or join a room by 5-letter code. Identity is just a random ID stored in your browser's localStorage.
- **Live YouTube karaoke search.** Type a song title or artist and it searches YouTube for `<query> karaoke` as you type (debounced), showing thumbnails and channel names to pick from.
- **Real-time queue.** Everyone in the room sees additions, and the host can mark a song "on stage" or "done" — pushed instantly via Supabase Realtime.
- **Member list** showing who's currently in the room.

## 1. Create the Supabase project

1. Go to [supabase.com](https://supabase.com) and create a new project.
2. In the SQL Editor, paste and run everything in `supabase/schema.sql`. This creates `rooms`, `room_members`, `queue_items`, opens up row-level security policies (there's no account system, so policies are intentionally permissive — see the note in the SQL file), and turns on realtime replication.
3. In **Project Settings → API**, copy the **Project URL** and **anon public** key.

## 2. Get a YouTube Data API key

1. In the [Google Cloud Console](https://console.cloud.google.com/), create a project (or use an existing one).
2. Enable the **YouTube Data API v3** under APIs & Services → Library.
3. Create an API key under APIs & Services → Credentials.
4. **Restrict the key** to the YouTube Data API and, once deployed, to your site's HTTP referrer — it'll be visible in the browser bundle since search runs client-side.
5. Note the free quota: search costs 100 units per call against a 10,000/day quota, so roughly 100 searches/day before you hit the limit or need billing enabled.

## 3. Configure the app

```bash
cp .env.example .env
```

Fill in `.env`:

```
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
VITE_YOUTUBE_API_KEY=your-youtube-data-api-v3-key
```

## 4. Run it

```bash
npm install
npm run dev
```

Open http://localhost:5173.

## 5. Deploy to Vercel via GitHub

This is the easiest path if you're not deploying elsewhere already.

1. **Push the project to GitHub.**
   ```bash
   cd karaokehub
   git init
   git add .
   git commit -m "Initial commit"
   ```
   Create a new empty repository on [github.com/new](https://github.com/new) (don't add a README/license there), then:
   ```bash
   git remote add origin https://github.com/<your-username>/<your-repo>.git
   git branch -M main
   git push -u origin main
   ```
   `.env` is already excluded from git via `.gitignore` — never commit your real keys.

2. **Create a Vercel account** at [vercel.com](https://vercel.com) if you don't have one, and sign in with GitHub (this makes step 3 a one-click import).

3. **Import the project.** From the Vercel dashboard: **Add New → Project**, then pick the GitHub repo you just pushed. Vercel auto-detects Vite and pre-fills:
   - Framework Preset: **Vite**
   - Build Command: `npm run build` (or `vite build`)
   - Output Directory: `dist`

   You don't need to change any of these.

4. **Add environment variables** before deploying — in the same import screen, expand **Environment Variables** and add all three:
   | Name | Value |
   |---|---|
   | `VITE_SUPABASE_URL` | from Supabase → Project Settings → API |
   | `VITE_SUPABASE_ANON_KEY` | from Supabase → Project Settings → API |
   | `VITE_YOUTUBE_API_KEY` | from Google Cloud Console → Credentials |

   (If you forget this step, you can still add them afterward under **Project → Settings → Environment Variables**, then redeploy.)

5. **Click Deploy.** Vercel builds and hosts it, giving you a URL like `karaokehub-yourname.vercel.app`.

6. **Restrict the YouTube API key to your new domain.** In Google Cloud Console → Credentials → your API key → *Application restrictions* → HTTP referrers, add:
   ```
   https://karaokehub-yourname.vercel.app/*
   ```
   (Add `http://localhost:5173/*` too if you still want local dev to keep working with the same key.)

7. **Test it** — open the deployed URL, create a room, and confirm search and the queue work.

**After that:** every `git push` to `main` triggers an automatic redeploy — no need to repeat these steps. If you rename the project or add a custom domain in Vercel, remember to add that URL to the YouTube key's referrer list too, or search will start failing with a 403.

## Project structure

```
src/
  lib/               supabaseClient.js, youtube.js (search), session.js (local identity), utils.js (room codes)
  components/        Navbar, QueueItem, SearchResultCard
  pages/             Home (create/join), RoomDetail (search + live queue)
supabase/
  schema.sql         rooms, room_members, queue_items, RLS, realtime publication
```

## How "host" controls work

There are no accounts, so the host is just whoever's `session_id` matches the
room's `host_session_id`. That check happens client-side — anyone with API
access could bypass it. Fine for a casual karaoke night; don't rely on it for
anything where the boundary actually needs to be secure.

## Extending it

- **Reordering the queue**: `position` is stored but not drag-reorderable yet — `@dnd-kit/core` would slot in cleanly on `RoomDetail.jsx`.
- **Kick a singer**: add a policy/button letting the host delete other `room_members` rows.
- **Lyrics-forward search**: the query already appends "karaoke", which YouTube generally biases toward sing-along/lyrics videos; you could add a toggle for "karaoke" vs "karaoke instrumental" vs "lyrics" to change the appended term.
- **Room expiry**: add a scheduled Supabase Edge Function to set `is_active = false` on rooms inactive for N hours.
