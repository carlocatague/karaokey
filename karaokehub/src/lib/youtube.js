import { supabase } from './supabaseClient';

const API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY;
const SEARCH_URL = 'https://www.googleapis.com/youtube/v3/search';

// Cross-session, in-memory only -- resets on page reload, but means retyping
// or backspacing back to a term you already searched this visit costs
// nothing at all, not even a database round-trip.
const memoryCache = new Map();
const MEMORY_TTL_MS = 10 * 60 * 1000; // 10 minutes

// How long a shared result in Supabase is considered fresh before a search
// is allowed to hit the YouTube API again for that same term.
const SHARED_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// YouTube's API returns titles with HTML entities encoded (e.g. &#39; for
// an apostrophe). Decoding via a detached textarea is a safe, standard trick
// -- the browser parses entities into text without ever executing markup.
function decodeHtmlEntities(str) {
  if (!str) return str;
  const el = document.createElement('textarea');
  el.innerHTML = str;
  return el.value;
}

/**
 * Search YouTube for karaoke versions of a song.
 * Appends "karaoke" to the query so results favor sing-along/instrumental
 * versions with on-screen lyrics rather than the original music video.
 */
export async function searchKaraoke(query) {
  if (!query?.trim()) return [];
  const cacheKey = query.trim().toLowerCase();

  // 1. In-memory cache (this browser tab, this page load) -- instant, free.
  const cached = memoryCache.get(cacheKey);
  if (cached && Date.now() - cached.savedAt < MEMORY_TTL_MS) {
    return cached.results;
  }

  // 2. Shared cache in Supabase -- free for the API, works across every
  // room and every visitor searching the same term.
  const { data: sharedRow } = await supabase
    .from('search_cache')
    .select('results, created_at')
    .eq('query', cacheKey)
    .maybeSingle();

  if (sharedRow && Date.now() - new Date(sharedRow.created_at).getTime() < SHARED_CACHE_TTL_MS) {
    memoryCache.set(cacheKey, { results: sharedRow.results, savedAt: Date.now() });
    return sharedRow.results;
  }

  // 3. Nothing usable cached -- fall through to a real YouTube API call.
  if (!API_KEY) {
    throw new Error(
      'Missing VITE_YOUTUBE_API_KEY. Add it to your .env file (see README).'
    );
  }

  const params = new URLSearchParams({
    part: 'snippet',
    type: 'video',
    videoEmbeddable: 'true',
    maxResults: '8',
    q: `${query} karaoke`,
    key: API_KEY,
  });

  const res = await fetch(`${SEARCH_URL}?${params.toString()}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message || 'YouTube search failed.');
  }
  const data = await res.json();

  const results = (data.items ?? []).map((item) => ({
    videoId: item.id.videoId,
    title: decodeHtmlEntities(item.snippet.title),
    channel: decodeHtmlEntities(item.snippet.channelTitle),
    thumbnail: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url,
    url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
  }));

  memoryCache.set(cacheKey, { results, savedAt: Date.now() });
  supabase
    .from('search_cache')
    .upsert({ query: cacheKey, results, created_at: new Date().toISOString() })
    .then(() => {});

  return results;
}
