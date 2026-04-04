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
import TodoColumn from '../components/TodoColumn';
import EventModal from '../components/EventModal';
import NLInputModal from '../components/NLInputModal';
import AutoScheduleModal from '../components/AutoScheduleModal';
import ConfirmModal from '../components/ConfirmModal';
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
    toggleTodo,
    clearSelectedTodos,
    setSelectedEvent,
    setAutoScheduleOpen,
    setNLInputOpen,
    setViewMode,
  } = useUIStore();

  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const calendarRef = useRef<CalendarApi>(null);

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

  const { data: events = [], isLoading, refetch } = useEvents();
  const { data: currentUser, error: userError, isLoading: userLoading } = useCurrentUser();
  
  // Store user in Zustand when fetched (using useEffect to avoid render-time updates)
  useEffect(() => {
    if (currentUser && !user) {
      setUser(currentUser);
    }
  }, [currentUser, user, setUser]);
  
  // Filter selectedTodos to only include existing unscheduled events
  const validSelectedTodos = selectedTodos.filter(id => 
    events.some(e => e.event_id === id && e.status === 'unscheduled')
  );
  
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

  // Helper function to schedule todos
  const scheduleTodos = (startDate: Date, endDate: Date) => {
    let scheduledCount = 0;
    validSelectedTodos.forEach((eventId) => {
      const event = events.find((e) => e.event_id === eventId);
      const duration = Math.max(30, event?.estimated_duration || 30);

      const finalEndDate = endDate || new Date(startDate.getTime() + duration * 60 * 1000);

      scheduleMutation.mutate(
        {
          eventId,
          data: {
            start_time: formatDateTime(startDate),
            end_time: formatDateTime(finalEndDate),
          },
        },
        {
          onSuccess: () => {
            scheduledCount++;
            if (scheduledCount === validSelectedTodos.length) {
              clearSelectedTodos();
            }
          },
          onError: (error: any) => {
            const message = error.response?.data?.detail;
            if (message) {
              toast.error(message);
            } else if (error.response?.status === 409) {
              toast.error('Time conflict detected. Please choose a different time slot.');
            } else {
              toast.error('Failed to schedule. Please try again.');
            }
          },
        }
      );
    });
  };

  // Helper function to schedule todos at clicked event's time
  const scheduleTodosAtEvent = (clickedEvent: CalendarEvent) => {
    let scheduledCount = 0;
    validSelectedTodos.forEach((eventId) => {
      const todoEvent = events.find((e) => e.event_id === eventId);

      // Calculate duration from clicked event (in minutes), minimum 30
      let duration = 30;
      if (clickedEvent.start_time && clickedEvent.end_time) {
        const durationMs = new Date(clickedEvent.end_time).getTime() - new Date(clickedEvent.start_time).getTime();
        duration = Math.max(30, Math.floor(durationMs / 60000));
      } else if (todoEvent?.estimated_duration) {
        duration = Math.max(30, todoEvent.estimated_duration);
      }

      const startDate = new Date(clickedEvent.start_time!);
      const endDate = clickedEvent.end_time
        ? new Date(clickedEvent.end_time)
        : new Date(startDate.getTime() + duration * 60 * 1000);

      scheduleMutation.mutate(
        {
          eventId,
          data: {
            start_time: formatDateTime(startDate),
            end_time: formatDateTime(endDate),
          },
        },
        {
          onSuccess: () => {
            scheduledCount++;
            if (scheduledCount === validSelectedTodos.length) {
              clearSelectedTodos();
            }
          },
          onError: (error: any) => {
            const message = error.response?.data?.detail;
            if (message) {
              toast.error(message);
            } else if (error.response?.status === 409) {
              toast.error('Time conflict detected. Please choose a different time slot.');
            } else {
              toast.error('Failed to schedule. Please try again.');
            }
          },
        }
      );
    });
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
            const endDate = new Date(clickedStart.getTime() + 30 * 60 * 1000);
            scheduleTodos(startDate, endDate);
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
          const endDate = new Date(clickedStart.getTime() + 30 * 60 * 1000);
          scheduleTodos(startDate, endDate);
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
          if (message) {
            toast.error(message);
          } else if (error.response?.status === 400) {
            toast.error('Could not parse the text. Please try a different description.');
          } else {
            toast.error('Failed to create events. Please try again.');
          }
        },
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
            onCreateTodo={(data) =>
              createMutation.mutate(data)
            }
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
