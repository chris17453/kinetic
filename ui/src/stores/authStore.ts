import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '../lib/api/types';
import api from '../lib/api/client';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  loginWithEntra: () => void;
  logout: () => void;
  checkAuth: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null });
        try {
          const response = await api.post('/auth/login', { email, password });
          const { token, user } = response.data;
          localStorage.setItem('kinetic_token', token);
          set({ user, token, isAuthenticated: true, isLoading: false });
        } catch (err: unknown) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const axiosErr = err as any;
          const message = axiosErr?.response?.data?.error || (err instanceof Error ? err.message : 'Login failed');
          set({ error: message, isLoading: false });
          throw err;
        }
      },

      loginWithEntra: () => {
        const redirectUrl = `${window.location.origin}/auth/callback`;
        const entraUrl = `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/auth/entra?redirect=${encodeURIComponent(redirectUrl)}`;
        window.location.href = entraUrl;
      },

      logout: () => {
        localStorage.removeItem('kinetic_token');
        set({ user: null, token: null, isAuthenticated: false });
      },

      checkAuth: async () => {
        const token = localStorage.getItem('kinetic_token');
        if (!token) {
          set({ isAuthenticated: false, user: null, token: null });
          return;
        }
        
        try {
          const response = await api.get('/auth/me');
          set({ user: response.data, token, isAuthenticated: true });
        } catch {
          localStorage.removeItem('kinetic_token');
          set({ user: null, token: null, isAuthenticated: false });
        }
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'kinetic-auth',
      partialize: (state) => ({ token: state.token }),
    }
  )
);
