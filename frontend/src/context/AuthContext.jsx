import { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // On first load: get the CSRF cookie set, then ask "am I already logged
  // in?" via the session cookie (if the browser has one from before).
  useEffect(() => {
    (async () => {
      await api.getCsrfCookie();
      try {
        setUser(await api.me());
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function login(username, password) {
    setUser(await api.login(username, password));
    // Django's login() rotates the CSRF token server-side (see
    // accounts/views.LoginView) — the in-memory token client.js was
    // using for this very request is now stale for the *next* one.
    // Re-fetch it immediately rather than waiting for a note-creation
    // request to fail and explain why.
    await api.getCsrfCookie();
  }

  async function register(username, password) {
    await api.register(username, password);
    await login(username, password); // register doesn't log you in by itself
  }

  async function logout() {
    await api.logout();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
