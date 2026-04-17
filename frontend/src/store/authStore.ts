import { create } from 'zustand';
import type { AuthState, User } from '../types';

// Helper to decode JWT and check expiry
function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const expiry = payload.exp * 1000; // Convert to milliseconds
    return Date.now() >= expiry;
  } catch (e) {
    return true; // Treat invalid token as expired
  }
}

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
      
      // Check if token is expired
      if (token && isTokenExpired(token)) {
        // Clear expired token and dispatch auth-expired event
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        
        // Dispatch auth-expired event to show toast
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('auth-expired'));
        }, 100);
        
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          isInitialized: true,
        });
        return;
      }
      
      set({
        user: userStr ? JSON.parse(userStr) : null,
        token: token,
        isAuthenticated: !!token,
      });
    } catch (e) {
      console.error('Failed to sync auth from localStorage:', e);
      // Clear corrupted data
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      set({
        user: null,
        token: null,
        isAuthenticated: false,
        isInitialized: true,
      });
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
