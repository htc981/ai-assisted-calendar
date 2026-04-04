import { create } from 'zustand';
import type { UIState, Event } from '../types';

export const useUIStore = create<UIState>((set) => ({
  selectedTodos: [],
  selectedEvent: null,
  isAutoScheduleOpen: false,
  isNLInputOpen: false,
  viewMode: 'timeGridWeek',

  toggleTodo: (eventId: number) =>
    set((state) => ({
      selectedTodos: state.selectedTodos.includes(eventId)
        ? state.selectedTodos.filter((id) => id !== eventId)
        : [...state.selectedTodos, eventId],
    })),

  clearSelectedTodos: () => set({ selectedTodos: [] }),

  setSelectedEvent: (event: Event | null) => set({ selectedEvent: event }),

  setAutoScheduleOpen: (open: boolean) => set({ isAutoScheduleOpen: open }),

  setNLInputOpen: (open: boolean) => set({ isNLInputOpen: open }),

  setViewMode: (mode: 'dayGridMonth' | 'timeGridWeek' | 'timeGridDay') =>
    set({ viewMode: mode }),
}));
