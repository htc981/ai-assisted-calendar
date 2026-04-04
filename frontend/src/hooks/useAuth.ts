import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersAPI, participantsAPI } from '../services/api';
import type { ParticipantAddRequest, ParticipantResponseUpdate } from '../types';

// Users queries
export function useCurrentUser() {
  return useQuery({
    queryKey: ['currentUser'],
    queryFn: () => usersAPI.getCurrentUser(),
    retry: false,  // Don't retry on auth failure
    staleTime: 5 * 60 * 1000,  // Consider data fresh for 5 minutes
  });
}

export function useUsers(search?: string) {
  return useQuery({
    queryKey: ['users', search],
    queryFn: () => usersAPI.listUsers(search),
    enabled: true, // Always fetch for participant selection
  });
}

// Participants mutations
export function useAddParticipant(eventId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ParticipantAddRequest) =>
      participantsAPI.addParticipant(eventId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
    },
  });
}

export function useUpdateParticipantResponse(eventId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, data }: { userId: number; data: ParticipantResponseUpdate }) =>
      participantsAPI.updateResponse(eventId, userId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
    },
  });
}

export function useRemoveParticipant(eventId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: number) =>
      participantsAPI.removeParticipant(eventId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
    },
  });
}
