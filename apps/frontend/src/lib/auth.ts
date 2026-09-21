import { create } from 'zustand';
import type { User } from '@crm/types';
import { api, getToken, onUnauthorized, setToken } from './api.js';

interface AuthState {
  user: User | null;
  status: 'loading' | 'authenticated' | 'anonymous';
  restore: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  status: 'loading',

  /** Revalida el token guardado al abrir la app. */
  restore: async () => {
    if (!getToken()) {
      set({ status: 'anonymous', user: null });
      return;
    }
    try {
      const { user } = await api.get<{ user: User }>('/auth/me');
      set({ user, status: 'authenticated' });
    } catch {
      setToken(null);
      set({ status: 'anonymous', user: null });
    }
  },

  login: async (email, password) => {
    const { token, user } = await api.post<{ token: string; user: User }>('/auth/login', {
      email,
      password,
    });
    setToken(token);
    set({ user, status: 'authenticated' });
  },

  register: async (name, email, password) => {
    const { token, user } = await api.post<{ token: string; user: User }>('/auth/register', {
      name,
      email,
      password,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
    setToken(token);
    set({ user, status: 'authenticated' });
  },

  logout: () => {
    setToken(null);
    set({ user: null, status: 'anonymous' });
  },
}));

onUnauthorized.handler = () => {
  useAuth.setState({ user: null, status: 'anonymous' });
};
