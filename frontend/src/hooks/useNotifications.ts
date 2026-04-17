import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from '../services/api';

interface Invitation {
  notification_id: number;
  created_at: string;
  from_user: {
    user_id: number;
    name: string;
    email: string;
  };
  event: {
    event_id: number;
    title: string;
    description: string | null;
    priority: number;
    start_time: string | null;
    end_time: string | null;
    status: string;
    estimated_duration: number | null;
  };
  participant_response: string | null;
}

interface GetInvitationsResponse {
  invitations: Invitation[];
}

interface HandleResponseRequest {
  response: 'accepted' | 'declined' | 'tentative';
}

export const usePendingInvitations = () => {
  return useQuery<GetInvitationsResponse, Error>({
    queryKey: ['pendingInvitations'],
    queryFn: async () => {
      const response = await axios.get<GetInvitationsResponse>('/api/notifications');
      return response.data;
    },
  });
};

export const useHandleInvitationResponse = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ notificationId, response }: { notificationId: number, response: 'accepted' | 'declined' | 'tentative' }) => {
      const res = await axios.put(`/api/notifications/${notificationId}/action`, { response });
      return res.data;
    },
    onSuccess: () => {
      // Refetch pending invitations
      queryClient.invalidateQueries({ queryKey: ['pendingInvitations'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
    },
  });
};
