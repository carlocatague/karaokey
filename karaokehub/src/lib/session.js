const SESSION_KEY = 'kh_session_id';
const NAME_KEY = 'kh_display_name';

export function getSessionId() {
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

export function getDisplayName() {
  return localStorage.getItem(NAME_KEY) ?? '';
}

export function setDisplayName(name) {
  localStorage.setItem(NAME_KEY, name);
}
