export const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:4000/api';

let authToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

export const setAuthToken = (token: string | null): void => {
  authToken = token;
};

export const getAuthToken = (): string | null => authToken;

/** Register a callback to run on 401/403 (e.g. clear user and show login). */
export const setOnUnauthorized = (fn: (() => void) | null): void => {
  onUnauthorized = fn;
};

const withAuth = (init?: RequestInit): RequestInit => {
  const headers = new Headers(init?.headers || {});
  if (authToken) {
    headers.set('Authorization', `Bearer ${authToken}`);
  }
  return {
    ...init,
    credentials: 'include',
    headers,
  };
};

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`${API_BASE_URL}${path}`, withAuth(init));
  if (response.status === 401 || response.status === 403) {
    if (onUnauthorized) onUnauthorized();
    const errorText = await response.text().catch(() => '');
    throw new Error(errorText || 'session_expired');
  }
  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(errorText || 'request_failed');
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
};

export { request as apiRequest };

export const authFetch = async (path: string, init?: RequestInit): Promise<Response> => {
  const response = await fetch(`${API_BASE_URL}${path}`, withAuth({ ...init, credentials: 'include' }));
  if (response.status === 401 || response.status === 403) {
    if (onUnauthorized) onUnauthorized();
  }
  return response;
};

// Like authFetch(), but supports absolute URLs (e.g. when API returns a full https://... URL).
export const authorizedFetch = async (urlOrPath: string, init?: RequestInit): Promise<Response> => {
  const url = /^https?:\/\//i.test(urlOrPath) ? urlOrPath : `${API_BASE_URL}${urlOrPath}`;
  const response = await fetch(url, withAuth({ ...init, credentials: 'include' }));
  if (response.status === 401 || response.status === 403) {
    if (onUnauthorized) onUnauthorized();
  }
  return response;
};

export const isApiConfigured = (): boolean => Boolean(API_BASE_URL);
