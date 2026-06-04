const API_BASE = 'http://localhost:3001';
const TOKEN_KEY = 'nexu:auth_token';

function getToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}

function setToken(token: string): void {
  try { localStorage.setItem(TOKEN_KEY, token); } catch { /* ignore */ }
}

function clearToken(): void {
  try { localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ }
}

function isAuthenticated(): boolean {
  return !!getToken();
}

async function apiRequest<T = unknown>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = { ...(options.headers as Record<string, string> || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (!headers['Content-Type'] && options.body) headers['Content-Type'] = 'application/json';

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
  } catch {
    throw new Error('Cannot reach backend server — make sure it\'s running: cd server && npm start');
  }

  let data: any;
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    data = await res.json();
  } else {
    const text = await res.text();
    if (text.includes('DOCTYPE') || text.includes('<html')) {
      throw new Error('Backend returned HTML — restart the server (old process may be running)');
    }
    throw new Error(text ? 'Backend error — try restarting the server' : 'Server not responding');
  }

  if (!res.ok) {
    throw new Error(data.error || `Request failed: ${res.status}`);
  }
  return data;
}

// ─── Auth API ───────────────────────────────────────────────────────────────

async function register(username: string, password: string) {
  const data = await apiRequest<{ result: { token: string; user: { id: string; username: string } } }>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  setToken(data.result.token);
  return data.result.user;
}

async function login(username: string, password: string) {
  const data = await apiRequest<{ result: { token: string; user: { id: string; username: string } } }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  setToken(data.result.token);
  return data.result.user;
}

async function verifyToken(): Promise<{ id: string; username: string } | null> {
  try {
    const data = await apiRequest<{ result: { id: string; username: string } }>('/api/auth/me');
    return data.result;
  } catch {
    clearToken();
    return null;
  }
}

function logout(): void {
  clearToken();
}

export { apiRequest, getToken, setToken, clearToken, isAuthenticated, register, login, verifyToken, logout, API_BASE };
