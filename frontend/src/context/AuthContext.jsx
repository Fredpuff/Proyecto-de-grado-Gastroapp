import { createContext, useContext, useEffect, useState } from 'react';
import { authApi } from '../api/resources';

const AuthContext = createContext(null);

const TOKEN_KEY = 'gsi_token';
const USER_KEY = 'gsi_user';

// Marca en sessionStorage (no localStorage: debe expirar con la pestaña) que se
// activa SOLO en un login/registro explícito, nunca al restaurar sesión desde un
// token guardado. Así el chat sabe cuándo saludar sin confundir un F5 con un login.
export const CHAT_PENDING_GREETING_KEY = 'gsi_chat_pending_greeting';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setLoading(false);
      return;
    }
    authApi
      .me()
      .then((freshUser) => {
        setUser(freshUser);
        localStorage.setItem(USER_KEY, JSON.stringify(freshUser));
      })
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  function persistSession({ user: sessionUser, token }) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(sessionUser));
    sessionStorage.setItem(CHAT_PENDING_GREETING_KEY, '1');
    setUser(sessionUser);
  }

  async function login(email, password) {
    const data = await authApi.login({ email, password });
    persistSession(data);
    return data.user;
  }

  async function register(name, email, password, role) {
    const data = await authApi.register({ name, email, password, role });
    persistSession(data);
    return data.user;
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    sessionStorage.removeItem(CHAT_PENDING_GREETING_KEY);
    setUser(null);
  }

  const value = { user, loading, login, register, logout, isAdmin: user?.role === 'admin' };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
