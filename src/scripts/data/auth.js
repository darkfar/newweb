const TOKEN_KEY = 'story_app_token';
const NAME_KEY = 'story_app_name';

export function saveSession({ token, name }) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(NAME_KEY, name ?? '');
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getUserName() {
  return localStorage.getItem(NAME_KEY) ?? '';
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(NAME_KEY);

  // Hapus cache respons API agar data pengguna sebelumnya tidak terbaca pengguna lain.
  if ('caches' in window) {
    caches
      .keys()
      .then((names) => names.filter((name) => name.startsWith('story-map-api')))
      .then((names) => Promise.all(names.map((name) => caches.delete(name))))
      .catch(() => {});
  }
}

export function isLoggedIn() {
  return Boolean(getToken());
}
