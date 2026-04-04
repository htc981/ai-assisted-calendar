import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { eventsAPI, aiAPI } from '../services/api';
import type {
  EventCreateRequest,
  EventUpdateRequest,
  ScheduleRequest,
  NLParseRequest,
  AutoScheduleRequest,
  CreateFromNLRequest,
} from '../types';

// Events queries
export function useEvents(filters?: { status?: 'unscheduled' | 'scheduled' }) {
  return useQuery({
    queryKey: ['events', filters],
    queryFn: () => eventsAPI.listEvents(filters),
  });
}

export function useEvent(eventId: number) {
  return useQuery({
    queryKey: ['event', eventId],
    queryFn: () => eventsAPI.getEvent(eventId),
    enabled: !!eventId,
  });
}

export function useCreateEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: EventCreateRequest) => eventsAPI.createEvent(data),
    onSuccess: async () => {
      // Small delay to ensure database transaction completes
      await new Promise(resolve => setTimeout(resolve, 100));
      // Invalidate all events queries (with or without filters)
      queryClient.invalidateQueries({ 
        predicate: (query) => query.queryKey[0] === 'events' 
      });
    },
  });
}

export function useUpdateEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ eventId, data }: { eventId: number; data: EventUpdateRequest }) =>
      eventsAPI.updateEvent(eventId, data),
    onSuccess: async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
      queryClient.invalidateQueries({ 
        predicate: (query) => query.queryKey[0] === 'events' 
      });
    },
  });
}

export function useScheduleEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ eventId, data }: { eventId: number; data: ScheduleRequest }) =>
      eventsAPI.scheduleEvent(eventId, data),
    onSuccess: async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
      queryClient.invalidateQueries({ 
        predicate: (query) => query.queryKey[0] === 'events' 
      });
    },
  });
}

export function useCancelEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (eventId: number) => eventsAPI.cancelEvent(eventId),
    onSuccess: async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
      queryClient.invalidateQueries({ 
        predicate: (query) => query.queryKey[0] === 'events' 
      });
    },
  });
}

export function useDeleteEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (eventId: number) => eventsAPI.deleteEvent(eventId),
    onSuccess: async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
      queryClient.invalidateQueries({ 
        predicate: (query) => query.queryKey[0] === 'events' 
      });
    },
  });
}

// AI mutations
export function useParseEvents() {
  return useMutation({
    mutationFn: (data: NLParseRequest) => aiAPI.parseEvents(data),
  });
}

export function useScheduleEvents() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: AutoScheduleRequest) => aiAPI.scheduleEvents(data),
    onSuccess: async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
      queryClient.invalidateQueries({ 
        predicate: (query) => query.queryKey[0] === 'events' 
      });
    },
  });
}

export function useCreateFromNL() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateFromNLRequest) => aiAPI.createFromNL(data),
    onSuccess: async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
      queryClient.invalidateQueries({ 
        predicate: (query) => query.queryKey[0] === 'events' 
      });
    },
  });
}
