import { create } from 'zustand';
import type { AuthState, User } from '../types';

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isInitialized: true,

  // Call this on app mount to sync with localStorage
  syncFromStorage: () => {
    try {
      const userStr = localStorage.getItem('user');
      const token = localStorage.getItem('token');
      set({
        user: userStr ? JSON.parse(userStr) : null,
        token: token,
        isAuthenticated: !!token,
      });
    } catch (e) {
      console.error('Failed to sync auth from localStorage:', e);
    }
  },

  login: (token: string) => {
    localStorage.setItem('token', token);
    set({ token, isAuthenticated: true });
  },

  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    set({ token: null, user: null, isAuthenticated: false });
  },

  setUser: (user: User) => {
    localStorage.setItem('user', JSON.stringify(user));
    set({ user });
  },
  
  setInitialized: () => {
    set({ isInitialized: true });
  },
}));

// Sync from localStorage when store is created
useAuthStore.getState().syncFromStorage();
