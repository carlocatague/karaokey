const FAVORITES_KEY = 'kh_favorites';

export function getFavorites() {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function isFavorited(videoId) {
  return getFavorites().some((f) => f.videoId === videoId);
}

export function toggleFavorite(song) {
  const current = getFavorites();
  const exists = current.some((f) => f.videoId === song.videoId);
  const next = exists
    ? current.filter((f) => f.videoId !== song.videoId)
    : [{ ...song, savedAt: Date.now() }, ...current];
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
  return next;
}