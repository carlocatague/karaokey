const TV_MODE_KEY = 'kh_tv_mode';

/**
 * Returns true/false if the person has made a choice before, or null if
 * they haven't been asked yet (so the reminder modal should show).
 */
export function getTvMode() {
  const raw = localStorage.getItem(TV_MODE_KEY);
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  return null;
}

export function setTvMode(enabled) {
  localStorage.setItem(TV_MODE_KEY, enabled ? 'true' : 'false');
}
