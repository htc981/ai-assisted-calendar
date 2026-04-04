import axios from 'axios';
import type {
  User,
  Event,
  LoginRequest,
  RegisterRequest,
  TokenResponse,
  EventCreateRequest,
  EventUpdateRequest,
  ScheduleRequest,
  ParticipantAddRequest,
  ParticipantResponseUpdate,
  NLParseRequest,
  NLParseResponse,
  AutoScheduleRequest,
  AutoScheduleResponse,
  CreateFromNLRequest,
  APIResponse,
} from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Only clear storage and reload if we have a stored token that became invalid
    // Don't do this for login/register requests (401 is expected for invalid credentials)
    // Also check if the token in the request header matches what's in storage
    const requestToken = error.config?.headers?.Authorization?.replace('Bearer ', '');
    const storedToken = localStorage.getItem('token');
    
    // If token was rejected and it matches what we have in storage, the token has expired
    if (error.response?.status === 401 && storedToken && (!requestToken || requestToken === storedToken)) {
      console.warn('Auth token expired, clearing auth and redirecting to login');
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      // Don't reload immediately - let the app handle redirect
      window.dispatchEvent(new CustomEvent('auth-expired'));
    }
    return Promise.reject(error);
  }
);

// Auth APIs
export const authAPI = {
  login: async (data: LoginRequest): Promise<TokenResponse> => {
    const response = await api.post('/api/auth/login', data);
    return response.data;
  },

  register: async (data: RegisterRequest): Promise<User> => {
    const response = await api.post('/api/auth/register', data);
    return response.data;
  },
};

// User APIs
export const usersAPI = {
  getCurrentUser: async (): Promise<User> => {
    const response = await api.get('/api/users/me');
    return response.data;
  },

  listUsers: async (search?: string): Promise<User[]> => {
    const response = await api.get('/api/users', {
      params: { search },
    });
    return response.data;
  },

  getUser: async (userId: number): Promise<User> => {
    const response = await api.get(`/api/users/${userId}`);
    return response.data;
  },
};

// Event APIs
export const eventsAPI = {
  listEvents: async (params?: {
    status?: 'unscheduled' | 'scheduled' | 'cancelled';
    start_date?: string;
    end_date?: string;
  }): Promise<Event[]> => {
    const response = await api.get('/api/events', { params });
    return response.data;
  },

  getEvent: async (eventId: number): Promise<Event> => {
    const response = await api.get(`/api/events/${eventId}`);
    return response.data;
  },

  createEvent: async (data: EventCreateRequest): Promise<Event> => {
    console.log('[API] Creating event:', data);
    const response = await api.post('/api/events', data);
    console.log('[API] Event created:', response.data);
    return response.data;
  },

  updateEvent: async (eventId: number, data: EventUpdateRequest): Promise<Event> => {
    const response = await api.put(`/api/events/${eventId}`, data);
    return response.data;
  },

  scheduleEvent: async (eventId: number, data: ScheduleRequest): Promise<Event> => {
    const response = await api.post(`/api/events/${eventId}/schedule`, data);
    return response.data;
  },

  cancelEvent: async (eventId: number): Promise<APIResponse> => {
    const response = await api.post(`/api/events/${eventId}/cancel`);
    return response.data;
  },

  deleteEvent: async (eventId: number): Promise<APIResponse> => {
    const response = await api.delete(`/api/events/${eventId}`);
    return response.data;
  },
};

// Participant APIs
export const participantsAPI = {
  listParticipants: async (eventId: number): Promise<ParticipantAddRequest & { user_id: number }[]> => {
    const response = await api.get(`/api/events/${eventId}/participants`);
    return response.data;
  },

  addParticipant: async (eventId: number, data: ParticipantAddRequest): Promise<APIResponse> => {
    const response = await api.post(`/api/events/${eventId}/participants`, data);
    return response.data;
  },

  updateResponse: async (
    eventId: number,
    userId: number,
    data: ParticipantResponseUpdate
  ): Promise<APIResponse> => {
    const response = await api.put(
      `/api/events/${eventId}/participants/${userId}/response`,
      data
    );
    return response.data;
  },

  removeParticipant: async (eventId: number, userId: number): Promise<APIResponse> => {
    const response = await api.delete(`/api/events/${eventId}/participants/${userId}`);
    return response.data;
  },
};

// AI APIs
export const aiAPI = {
  parseEvents: async (data: NLParseRequest): Promise<NLParseResponse> => {
    const response = await api.post('/api/ai/parse', data);
    return response.data;
  },

  scheduleEvents: async (data: AutoScheduleRequest): Promise<AutoScheduleResponse> => {
    const response = await api.post('/api/ai/schedule', data);
    return response.data;
  },

  createFromNL: async (data: CreateFromNLRequest): Promise<Event[]> => {
    const response = await api.post('/api/ai/create-from-nl', data);
    return response.data;
  },
};

export default api;
