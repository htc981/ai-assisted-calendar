// User types
export interface User {
  user_id: number;
  name: string;
  email: string;
  created_at?: string;
}

// Event types
export type EventStatus = 'unscheduled' | 'scheduled' | 'cancelled';
export type ParticipantRole = 'organizer' | 'required' | 'optional';
export type ParticipantResponse = 'pending' | 'accepted' | 'declined' | 'tentative';

export interface Participant {
  user_id: number;
  event_id: number;
  role: ParticipantRole;
  response: ParticipantResponse;
  created_at?: string;
  user?: User;
}

export interface Event {
  event_id: number;
  creator_id: number;
  title: string;
  description: string | null;
  priority: number;
  start_time: string | null;
  end_time: string | null;
  status: EventStatus;
  estimated_duration: number | null;
  created_at?: string;
  updated_at?: string;
  participants: Participant[];
}

// API types
export interface LoginRequest {
  email: string;
  name?: string;
}

export interface RegisterRequest {
  name: string;
  email: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

export interface EventCreateRequest {
  title: string;
  description?: string;
  priority?: number;
  start_time?: string;
  end_time?: string;
  status?: EventStatus;
  estimated_duration?: number;
  participant_ids?: number[];
}

export interface EventUpdateRequest {
  title?: string;
  description?: string;
  priority?: number;
  start_time?: string;
  end_time?: string;
  status?: EventStatus;
}

export interface ScheduleRequest {
  start_time: string;
  end_time: string;
}

export interface ParticipantAddRequest {
  user_id: number;
  role?: ParticipantRole;
}

export interface ParticipantResponseUpdate {
  response: ParticipantResponse;
}

// AI types
export interface ParsedEvent {
  title: string;
  description?: string;
  priority: number;
  estimated_duration?: number;
  participant_emails?: string[];
  time_preferences?: string;
}

export interface NLParseRequest {
  text: string;
}

export interface NLParseResponse {
  events: ParsedEvent[];
}

export interface AutoScheduleRequest {
  event_ids: number[];
  range_start: string;
  range_end: string;
}

export interface AutoScheduleResponse {
  success: boolean;
  message: string;
  scheduled_count: number;
  overridden_events?: number[];
}

export interface CreateFromNLRequest {
  text: string;
}

// API Response types
export interface APIResponse {
  success: boolean;
  message: string;
}

// Store types
export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isInitialized: boolean;
  syncFromStorage: () => void;
  login: (token: string) => void;
  logout: () => void;
  setUser: (user: User) => void;
  setInitialized: () => void;
}

export interface UIState {
  selectedTodos: number[];
  selectedEvent: Event | null;
  isAutoScheduleOpen: boolean;
  isNLInputOpen: boolean;
  viewMode: 'dayGridMonth' | 'timeGridWeek' | 'timeGridDay';
  toggleTodo: (eventId: number) => void;
  clearSelectedTodos: () => void;
  setSelectedEvent: (event: Event | null) => void;
  setAutoScheduleOpen: (open: boolean) => void;
  setNLInputOpen: (open: boolean) => void;
  setViewMode: (mode: 'dayGridMonth' | 'timeGridWeek' | 'timeGridDay') => void;
}
