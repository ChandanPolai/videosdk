const AUTH_KEY = 'ai_calling_auth';

const DEFAULT_EMAIL = 'admin@gmail.com';
const DEFAULT_PASSWORD = '123456';

export function getAuth() {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data?.email && data?.loggedIn) return data;
  } catch {
    /* ignore */
  }
  return null;
}

export function isLoggedIn() {
  return Boolean(getAuth());
}

export function login(email, password) {
  const e = String(email || '').trim().toLowerCase();
  const p = String(password || '');
  if (e === DEFAULT_EMAIL && p === DEFAULT_PASSWORD) {
    const data = { email: DEFAULT_EMAIL, loggedIn: true, at: Date.now() };
    localStorage.setItem(AUTH_KEY, JSON.stringify(data));
    return { ok: true, data };
  }
  return { ok: false, error: 'Invalid email or password' };
}

export function logout() {
  localStorage.removeItem(AUTH_KEY);
}
