export const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:4000/api';

let authToken: string | null = null;

export const setAuthToken = (token: string | null): void => {
  authToken = token;
};

const withAuth = (init?: RequestInit): RequestInit => {
  const headers = new Headers(init?.headers || {});
  if (authToken) {
    headers.set('Authorization', `Bearer ${authToken}`);
  }
  return {
    ...init,
    headers,
  };
};

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`${API_BASE_URL}${path}`, withAuth(init));
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

export const authFetch = (path: string, init?: RequestInit): Promise<Response> => {
  return fetch(`${API_BASE_URL}${path}`, withAuth(init));
};

export const isApiConfigured = (): boolean => Boolean(API_BASE_URL);
