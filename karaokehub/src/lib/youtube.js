const API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY;
const SEARCH_URL = 'https://www.googleapis.com/youtube/v3/search';

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
  if (!API_KEY) {
    throw new Error(
      'Missing VITE_YOUTUBE_API_KEY. Add it to your .env file (see README).'
    );
  }
  if (!query?.trim()) return [];

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

  return (data.items ?? []).map((item) => ({
    videoId: item.id.videoId,
    title: decodeHtmlEntities(item.snippet.title),
    channel: decodeHtmlEntities(item.snippet.channelTitle),
    thumbnail: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url,
    url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
  }));
}
