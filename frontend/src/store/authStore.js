import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authAPI } from '../api/auth.api';
import toast from 'react-hot-toast';

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      loading: false,

      login: async (email, password) => {
        set({ loading: true });
        try {
          const data = await authAPI.login(email, password);
          set({
            user: data.user,
            accessToken: data.accessToken,
            refreshToken: data.refreshToken,
            loading: false,
          });
          return { success: true };
        } catch (error) {
          set({ loading: false });
          return { success: false, error: error.response?.data?.message || 'Login failed' };
        }
      },

      register: async (username, email, password) => {
        set({ loading: true });
        try {
          const data = await authAPI.register(username, email, password);
          set({
            user: data.user,
            accessToken: data.accessToken,
            refreshToken: data.refreshToken,
            loading: false,
          });
          return { success: true };
        } catch (error) {
          set({ loading: false });
          return { success: false, error: error.response?.data?.message || 'Registration failed' };
        }
      },

      logout: async () => {
        try {
          await authAPI.logout();
        } catch {}
        set({ user: null, accessToken: null, refreshToken: null });
      },

      setAccessToken: (token) => set({ accessToken: token }),

      updateUser: (updates) => set((state) => ({ user: { ...state.user, ...updates } })),
    }),
    {
      name: 'chatterbox-auth',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
      }),
    }
  )
);

