export function getYouTubeId(url) {
  if (!url) return null;
  const match = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/
  );
  return match ? match[1] : null;
}

export function getYouTubeThumb(url) {
  const id = getYouTubeId(url);
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null;
}

export function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 5; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

/**
 * Karaoke video titles are usually formatted "Song Title - Artist (tags)".
 * There's no separate "artist" field from a YouTube search result, so this
 * pulls a best-effort split out of the title text itself. Falls back to
 * showing the whole title with no artist if the format doesn't match.
 */
export function parseSongTitle(rawTitle) {
  if (!rawTitle) return { title: '', artist: '' };

  const dashMatch = rawTitle.split(/\s+[-–—]\s+/);
  if (dashMatch.length < 2) {
    return { title: rawTitle.trim(), artist: '' };
  }

  const title = dashMatch[0].trim();
  const rest = dashMatch.slice(1).join(' - ');
  const artist = rest.split(/[([]/)[0].trim();

  return { title: title || rawTitle.trim(), artist };
}
