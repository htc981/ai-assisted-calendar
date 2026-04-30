import { useState, useRef, useEffect } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import type { CalendarApi } from '@fullcalendar/core';
import { useAuthStore } from '../store/authStore';
import { useUIStore } from '../store/uiStore';
import { useEvents, useScheduleEvent, useCreateEvent, useCreateFromNL } from '../hooks/useEvents';
import { useCurrentUser } from '../hooks/useAuth';
import { usePendingInvitations, useHandleInvitationResponse } from '../hooks/useNotifications';
import TodoColumn from '../components/TodoColumn';
import EventModal from '../components/EventModal';
import NLInputModal from '../components/NLInputModal';
import AutoScheduleModal from '../components/AutoScheduleModal';
import ConfirmModal from '../components/ConfirmModal';
import MailboxModal from '../components/MailboxModal';
import toast from 'react-hot-toast';
import type { Event as CalendarEvent } from '../types';

export default function Calendar() {
  const { user, logout, setUser } = useAuthStore();
  const {
    selectedTodos,
    selectedEvent,
    isAutoScheduleOpen,
    isNLInputOpen,
    viewMode,
    clearSelectedTodos,
    setSelectedEvent,
    setAutoScheduleOpen,
    setNLInputOpen,
    setViewMode,
  } = useUIStore();

  const calendarRef = useRef<CalendarApi>(null);
  const [isMailboxOpen, setIsMailboxOpen] = useState(false);

  const { data: pendingInvitations, refetch: refetchInvitations } = usePendingInvitations();
  const handleInvitationMutation = useHandleInvitationResponse();

  // Calculate unactioned count (new or pending responses)
  const unactionedCount = (pendingInvitations?.invitations || []).filter(
    inv => !inv.participant_response || inv.participant_response === 'pending'
  ).length;
  
  // If no unactioned invitations, show Maybe count
  const maybeCount = (pendingInvitations?.invitations || []).filter(
    inv => inv.participant_response === 'tentative'
  ).length;
  
  const badgeCount = unactionedCount > 0 ? unactionedCount : maybeCount;
  const isMaybeBadge = unactionedCount === 0 && maybeCount > 0;

  // Confirmation modal state
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'info' | 'warning' | 'danger';
    onConfirm: () => void;
  } | null>(null);

  const handleViewChange = (mode: 'dayGridMonth' | 'timeGridWeek' | 'timeGridDay') => {
    setViewMode(mode);
    // Change the calendar view using the calendar API
    const calendarApi = calendarRef.current?.getApi();
    if (calendarApi) {
      calendarApi.changeView(mode);
    }
  };

  const { data: events = [], isLoading } = useEvents();
  const { data: currentUser } = useCurrentUser();
  
  // Store user in Zustand when fetched (using useEffect to avoid render-time updates)
  useEffect(() => {
    if (currentUser && !user) {
      setUser(currentUser);
    }
  }, [currentUser, user, setUser]);
  
  // Filter selectedTodos to only include existing unscheduled events
  const validSelectedTodos = selectedTodos.filter(id =>
    events.some(e => e.event_id === id && e.status === 'unscheduled')
  ).sort((a, b) => {
    // Sort by priority (lower number = higher priority = schedule first)
    const priorityA = events.find(e => e.event_id === a)?.priority || 5;
    const priorityB = events.find(e => e.event_id === b)?.priority || 5;
    return priorityA - priorityB;
  });
  
  const scheduleMutation = useScheduleEvent();
  const createMutation = useCreateEvent();
  const createFromNLMutation = useCreateFromNL();

  // Helper function to format datetime for API
  const formatDateTime = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  };

  // Helper function to schedule todos sequentially
  const scheduleTodos = (startDate: Date, endDate: Date | undefined) => {
    let currentIndex = 0;
    let currentStart = startDate;  // Track current start time for sequential scheduling

    const scheduleNext = () => {
      if (currentIndex >= validSelectedTodos.length) {
        clearSelectedTodos();
        return;
      }

      const eventId = validSelectedTodos[currentIndex];
      const event = events.find((e) => e.event_id === eventId);
      const duration = Math.max(30, event?.estimated_duration || 30);

      // Determine the end time for this event
      // If endDate is provided (from time slot selection), cap at that
      // Otherwise, use start + duration
      let finalEndDate: Date;
      if (endDate) {
        // Cap at the provided end time if it falls before calculated end
        const calculatedEnd = new Date(currentStart.getTime() + duration * 60 * 1000);
        finalEndDate = calculatedEnd <= endDate ? calculatedEnd : endDate;
      } else {
        // No cap - just use start + duration
        finalEndDate = new Date(currentStart.getTime() + duration * 60 * 1000);
      }

      scheduleMutation.mutate(
        {
          eventId,
          data: {
            start_time: formatDateTime(currentStart),
            end_time: formatDateTime(finalEndDate),
          },
        },
        {
          onSuccess: () => {
            currentIndex++;

            // Schedule next event at the end of this event's time
            currentStart = new Date(finalEndDate);
            scheduleNext();
          },
          onError: (error: any) => {
            // Check for session expired error
            if (error.message === 'SESSION_EXPIRED' || error.message?.includes('SESSION_EXPIRED')) {
              toast.error('Session expired. Please login again.');
              return;
            }

            const message = error.response?.data?.detail;
            if (message) {
              toast.error(message);
            } else if (error.response?.status === 409) {
              toast.error('Time conflict detected. Please choose a different time slot.');
            } else {
              toast.error('Failed to schedule. Please try again.');
            }
            // Continue with next event even if one fails
            currentIndex++;
            scheduleNext();
          },
        }
      );
    };
    
    scheduleNext();
  };

  // Helper function to schedule todos at clicked event's time (sequentially)
  const scheduleTodosAtEvent = (clickedEvent: CalendarEvent) => {
    let currentIndex = 0;
    let cumulativeDuration = 0;

    const scheduleNext = () => {
      if (currentIndex >= validSelectedTodos.length) {
        clearSelectedTodos();
        return;
      }

      const eventId = validSelectedTodos[currentIndex];
      const todoEvent = events.find((e) => e.event_id === eventId);

      // Calculate duration: priority is todo's estimated_duration, then clicked event's duration, minimum 30
      let eventDuration = 30;
      if (todoEvent?.estimated_duration) {
        eventDuration = Math.max(30, todoEvent.estimated_duration);
      } else if (clickedEvent.start_time && clickedEvent.end_time) {
        const durationMs = new Date(clickedEvent.end_time).getTime() - new Date(clickedEvent.start_time).getTime();
        eventDuration = Math.floor(durationMs / 60000);
      }

      // Calculate start/end for this event (sequential - no gap)
      const baseStart = new Date(clickedEvent.start_time!);

      // Start time is baseStart plus cumulative duration from previous events
      const eventStart = new Date(baseStart.getTime() + cumulativeDuration * 60 * 1000);
      const eventEnd = new Date(eventStart.getTime() + eventDuration * 60 * 1000);

      scheduleMutation.mutate(
        {
          eventId,
          data: {
            start_time: formatDateTime(eventStart),
            end_time: formatDateTime(eventEnd),
          },
        },
        {
          onSuccess: () => {
            currentIndex++;
            // Add this event's duration to cumulative for next event
            cumulativeDuration += eventDuration;
            scheduleNext();
          },
          onError: (error: any) => {
            // Check for session expired error
            if (error.message === 'SESSION_EXPIRED' || error.message?.includes('SESSION_EXPIRED')) {
              toast.error('Session expired. Please login again.');
              return;
            }

            const message = error.response?.data?.detail;
            if (message) {
              toast.error(message);
            } else if (error.response?.status === 409) {
              toast.error('Time conflict detected. Please choose a different time slot.');
            } else {
              toast.error('Failed to schedule. Please try again.');
            }
            // Continue with next event even if one fails - still advance cumulative duration
            cumulativeDuration += eventDuration;
            currentIndex++;
            scheduleNext();
          },
        }
      );
    };

    scheduleNext();
  };

  // Transform events for FullCalendar
  const calendarEvents = events
    .filter((e) => e.status === 'scheduled' && e.start_time && e.end_time)
    .map((event) => ({
      id: event.event_id.toString(),
      title: event.title,
      start: event.start_time,
      end: event.end_time,
      extendedProps: {
        event,
        priority: event.priority,
      },
      classNames: [`priority-${event.priority}`],
    }));

  const handleEventClick = (info: any) => {
    const clickedEvent = events.find((e) => e.event_id.toString() === info.event.id);
    if (!clickedEvent) return;

    // If todos are selected, offer to schedule them at this event's time slot (override)
    if (validSelectedTodos.length > 0) {
      setConfirmModal({
        isOpen: true,
        title: 'Schedule Todos',
        message: `You have ${validSelectedTodos.length} todo(s) selected.\n\nScheduling them will override "${clickedEvent.title}" (it will return to unscheduled).`,
        type: 'warning',
        onConfirm: () => {
          scheduleTodosAtEvent(clickedEvent);
          setConfirmModal(null);
        },
      });
      return;
    }

    // When clicking an existing event on calendar, open event details
    setSelectedEvent(clickedEvent);
  };

  const handleDateSelect = (info: any) => {
    // If todos are selected, schedule them
    if (validSelectedTodos.length > 0) {
      // Check for conflicts at this time slot
      const clickedStart = new Date(info.startStr);
      const clickedEnd = new Date(info.endStr || info.start);

      // Find events that overlap with the selected time slot
      const conflictingEvents = events.filter((e) => {
        if (e.status !== 'scheduled' || !e.start_time || !e.end_time) return false;
        if (e.event_id && validSelectedTodos.includes(e.event_id)) return false; // Don't count self

        const eventStart = new Date(e.start_time);
        const eventEnd = new Date(e.end_time);

        // Check for overlap
        return clickedStart < eventEnd && clickedEnd > eventStart;
      });

      // If there are conflicts, show override confirmation
      if (conflictingEvents.length > 0) {
        const conflictNames = conflictingEvents.map(e => e.title).join(', ');
        setConfirmModal({
          isOpen: true,
          title: 'Schedule Conflict',
          message: `This time slot conflicts with:\n${conflictNames}\n\nScheduling will override these events (they will return to unscheduled).`,
          type: 'danger',
          onConfirm: () => {
            const startDate = info.start;
            // Don't pass an end date - let scheduleTodos determine end time based on duration
            scheduleTodos(startDate, undefined);
            setConfirmModal(null);
          },
        });
        return;
      }

      // No conflicts - show simple confirmation
      setConfirmModal({
        isOpen: true,
        title: 'Schedule Todos',
        message: `Schedule ${validSelectedTodos.length} selected todo(s) at ${info.startStr}?`,
        type: 'info',
        onConfirm: () => {
          const startDate = info.start;
          // Don't pass an end date - let scheduleTodos determine end time based on duration
          scheduleTodos(startDate, undefined);
          setConfirmModal(null);
        },
      });
      return;
    }

    // If no todos selected, show info message
    toast('Select todos from the right panel first, then click a time slot', {
      icon: 'ℹ️',
      duration: 3000
    });
  };

  const handleNLCreate = async (text: string) => {
    createFromNLMutation.mutate(
      { text },
      {
        onSuccess: () => {
          toast.success('Events created successfully from natural language!');
          setNLInputOpen(false);
        },
        onError: (error: any) => {
          const message = error.response?.data?.detail;
          if (message?.includes('expired') || message?.includes('Invalid or expired token')) {
            toast.error('Session expired. Please login again.');
          } else if (error.response?.status === 400) {
            toast.error('Could not parse the text. Please try a different description.');
          } else if (error.message && error.message.includes('SESSION_EXPIRED')) {
            toast.error('Session expired. Please login again.');
          } else {
            toast.error('Failed to create events. Please try again.');
          }
        },
      }
    );
  };

  // Mailbox handlers
  const handleAcceptInvitation = (notificationId: number) => {
    handleInvitationMutation.mutate(
      { notificationId, response: 'accepted' },
      {
        onSuccess: (data: any) => {
          toast.success(data.message || 'Invitation accepted!');
          // Don't close mailbox - allow processing multiple invitations
        },
        onError: (error: any) => {
          const message = error.response?.data?.detail;
          if (message) {
            if (message.includes('expired') || message.includes('Invalid or expired token')) {
              toast.error('Session expired. Please login again.');
            } else {
              toast.error(message);
            }
          } else {
            toast.error('Failed to accept invitation');
          }
        }
      }
    );
  };

  const handleDeclineInvitation = (notificationId: number) => {
    handleInvitationMutation.mutate(
      { notificationId, response: 'declined' },
      {
        onSuccess: (data: any) => {
          toast.success(data.message || 'Invitation declined');
          // Don't close mailbox - allow processing multiple invitations
        },
        onError: (error: any) => {
          const message = error.response?.data?.detail;
          if (message) {
            if (message.includes('expired') || message.includes('Invalid or expired token')) {
              toast.error('Session expired. Please login again.');
            } else {
              toast.error(message);
            }
          } else {
            toast.error('Failed to decline invitation');
          }
        }
      }
    );
  };

  const handleTentativeInvitation = (notificationId: number) => {
    handleInvitationMutation.mutate(
      { notificationId, response: 'tentative' },
      {
        onSuccess: (data: any) => {
          toast.success(data.message || 'Response set to Maybe');
          // Don't close mailbox - allow processing multiple invitations
          // Refetch to update the mailbox list
          refetchInvitations();
        },
        onError: (error: any) => {
          const message = error.response?.data?.detail;
          if (message) {
            if (message.includes('expired') || message.includes('Invalid or expired token')) {
              toast.error('Session expired. Please login again.');
            } else {
              toast.error(message);
            }
          } else {
            toast.error('Failed to update response');
          }
        }
      }
    );
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h1 className="text-xl font-bold text-gray-900">AI-Assisted Calendar</h1>
            <div className="flex space-x-2">
              <button
                onClick={() => handleViewChange('dayGridMonth')}
                className={`px-3 py-1 text-sm rounded ${
                  viewMode === 'dayGridMonth'
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Month
              </button>
              <button
                onClick={() => handleViewChange('timeGridWeek')}
                className={`px-3 py-1 text-sm rounded ${
                  viewMode === 'timeGridWeek'
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Week
              </button>
              <button
                onClick={() => handleViewChange('timeGridDay')}
                className={`px-3 py-1 text-sm rounded ${
                  viewMode === 'timeGridDay'
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Day
              </button>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <button
              onClick={() => setNLInputOpen(true)}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center space-x-2"
            >
              <span>✨</span>
              <span>Natural Language</span>
            </button>
            <button
              onClick={() => setAutoScheduleOpen(true)}
              disabled={validSelectedTodos.length === 0}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              <span>🤖</span>
              <span>Auto-Schedule ({validSelectedTodos.length})</span>
            </button>
            <div className="relative">
              <button
                onClick={() => setIsMailboxOpen(true)}
                className="px-3 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors flex items-center space-x-2"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span>Inbox</span>
                {badgeCount > 0 && (
                  <span className={`absolute -top-1 -right-1 text-white text-xs font-bold px-2 py-0.5 rounded-full ${isMaybeBadge ? 'bg-yellow-500' : 'bg-red-500'}`}>
                    {badgeCount}
                  </span>
                )}
              </button>
            </div>
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <span>{user?.name || currentUser?.name || 'Loading...'}</span>
              <button
                onClick={logout}
                className="text-gray-500 hover:text-gray-700"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Calendar Column (Left) */}
        <div className="flex-1 p-4 overflow-auto">
          <div className="bg-white rounded-lg shadow h-full">
            <FullCalendar
              ref={calendarRef}
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
              initialView={viewMode}
              events={calendarEvents}
              selectable={true}
              select={handleDateSelect}
              eventClick={handleEventClick}
              headerToolbar={{
                left: 'prev,next today',
                center: 'title',
                right: '',
              }}
              allDaySlot={false}
              slotMinTime="06:00:00"
              slotMaxTime="22:00:00"
              height="100%"
              eventDisplay="block"
              timeZone="local"
              eventContent={(arg) => (
                <div className="p-1 text-xs truncate">
                  <div className="font-medium">{arg.event.title}</div>
                </div>
              )}
            />
          </div>
        </div>

        {/* TODO Column (Right) */}
        <div className="w-96 border-l border-gray-200 bg-white overflow-auto">
          <TodoColumn
            todos={events.filter((e) => e.status === 'unscheduled')}
            isLoading={isLoading}
            onCreateTodo={(data) => {
              createMutation.mutate(data);
            }}
            onEditTodo={(todo) => {
              setSelectedEvent(todo);
            }}
          />
        </div>
      </div>

      {/* Modals */}
      {selectedEvent && (
        <EventModal
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
        />
      )}

      {isNLInputOpen && (
        <NLInputModal
          onClose={() => setNLInputOpen(false)}
          onSubmit={handleNLCreate}
          isProcessing={createFromNLMutation.isPending}
        />
      )}

      {isAutoScheduleOpen && (
        <AutoScheduleModal
          onClose={() => setAutoScheduleOpen(false)}
          eventIds={validSelectedTodos}
        />
      )}

      {isMailboxOpen && (
        <MailboxModal
          isOpen={isMailboxOpen}
          onClose={() => setIsMailboxOpen(false)}
          invitations={pendingInvitations?.invitations || []}
          onAccept={handleAcceptInvitation}
          onDecline={handleDeclineInvitation}
          onMaybe={handleTentativeInvitation}
        />
      )}

      {confirmModal && (
        <ConfirmModal
          isOpen={confirmModal.isOpen}
          title={confirmModal.title}
          message={confirmModal.message}
          type={confirmModal.type}
          onConfirm={confirmModal.onConfirm}
          onCancel={() => setConfirmModal(null)}
        />
      )}
    </div>
  );
}
