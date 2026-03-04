import React, { createContext, useContext, useState, useEffect } from 'react';
import type { PropsWithChildren } from 'react';
import { login as loginRequest, restoreSession, logoutRequest, AuthUser } from '../services/authClient';
import { setAuthToken, setOnUnauthorized } from '../services/api';

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
  initializing: boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<PropsWithChildren> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    let cancelled = false;
    restoreSession()
      .then((restoredUser) => {
        if (!cancelled && restoredUser) {
          setUser(restoredUser);
          setAuthToken(null);
        }
      })
      .finally(() => {
        if (!cancelled) setInitializing(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const login = async (username: string, password: string): Promise<void> => {
    setLoading(true);
    try {
      const result = await loginRequest(username, password);
      setUser(result.user);
      setToken(result.token);
      setAuthToken(result.token);
    } finally {
      setLoading(false);
    }
  };

  const logout = (): void => {
    setUser(null);
    setToken(null);
    setAuthToken(null);
    logoutRequest();
  };

  useEffect(() => {
    setOnUnauthorized(() => logout);
    return () => setOnUnauthorized(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading, initializing }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
};

