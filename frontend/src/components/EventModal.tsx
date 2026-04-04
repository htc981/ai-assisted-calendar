import { Fragment, useState, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { useUpdateEvent, useCancelEvent, useDeleteEvent } from '../hooks/useEvents';
import { useAddParticipant, useRemoveParticipant, useUpdateParticipantResponse, useCurrentUser } from '../hooks/useAuth';
import { useUsers } from '../hooks/useAuth';
import { useAuthStore } from '../store/authStore';
import { useUIStore } from '../store/uiStore';
import ConfirmModal from './ConfirmModal';
import toast from 'react-hot-toast';
import type { Event, ParticipantResponse } from '../types';

interface EventModalProps {
  event: Event;
  onClose: () => void;
}

const priorityLabels = {
  1: 'Urgent',
  2: 'High',
  3: 'Normal',
  4: 'Low',
  5: 'Optional',
};

const responseColors = {
  pending: 'bg-gray-100 text-gray-600',
  accepted: 'bg-green-100 text-green-700',
  declined: 'bg-red-100 text-red-700',
  tentative: 'bg-yellow-100 text-yellow-700',
};

export default function EventModal({ event, onClose }: EventModalProps) {
  const { user: storeUser, setUser } = useAuthStore();
  const { setSelectedEvent } = useUIStore();
  const { data: users = [] } = useUsers();
  const { data: currentUser } = useCurrentUser();
  
  // Use store user or fallback to API user
  const [user, setUserState] = useState(storeUser || currentUser);
  
  // Sync user state
  useEffect(() => {
    const u = storeUser || currentUser;
    if (u) setUserState(u);
  }, [storeUser, currentUser]);

  const updateMutation = useUpdateEvent();
  const cancelMutation = useCancelEvent();
  const deleteMutation = useDeleteEvent();
  const addParticipantMutation = useAddParticipant(event.event_id);
  const removeParticipantMutation = useRemoveParticipant(event.event_id);
  const updateResponseMutation = useUpdateParticipantResponse(event.event_id);

  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
    title: event.title,
    description: event.description || '',
    priority: event.priority,
    start_time: event.start_time || '',
    end_time: event.end_time || '',
  });
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);

  // Confirmation modal state
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'info' | 'warning' | 'danger';
    onConfirm: () => void;
  } | null>(null);

  const isCreator = user?.user_id === event.creator_id;

  const handleSave = () => {
    // Validate required fields
    if (!editData.title.trim()) {
      toast.error('Title is required');
      return;
    }

    // Validate time if event is scheduled
    if (editData.start_time && editData.end_time) {
      const start = new Date(editData.start_time);
      const end = new Date(editData.end_time);
      if (start >= end) {
        toast.error('End time must be after start time');
        return;
      }
    }

    updateMutation.mutate(
      { eventId: event.event_id, data: editData },
      {
        onSuccess: () => {
          toast.success('Event updated successfully');
          setIsEditing(false);
        },
        onError: (error: any) => {
          const message = error.response?.data?.detail;
          if (message) {
            toast.error(message);
          } else if (error.response?.status === 404) {
            toast.error('Event not found');
          } else if (error.response?.status === 403) {
            toast.error('You do not have permission to edit this event');
          } else if (error.response?.status === 401) {
            toast.error('Session expired. Please login again.');
          } else {
            toast.error('Failed to update event. Please try again.');
          }
        },
      }
    );
  };

  const handleCancel = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Cancel Event',
      message: 'Are you sure you want to cancel this event?',
      type: 'warning',
      onConfirm: () => {
        cancelMutation.mutate(event.event_id, {
          onSuccess: () => {
            toast.success('Event cancelled successfully');
            setConfirmModal(null);
            onClose();
          },
          onError: (error: any) => {
            const message = error.response?.data?.detail;
            if (message) {
              toast.error(message);
            } else if (error.response?.status === 403) {
              toast.error('You do not have permission to cancel this event');
            } else {
              toast.error('Failed to cancel event. Please try again.');
            }
            setConfirmModal(null);
          },
        });
      },
    });
  };

  const handleDelete = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Event',
      message: 'Are you sure you want to delete this event? This cannot be undone.',
      type: 'danger',
      onConfirm: () => {
        deleteMutation.mutate(event.event_id, {
          onSuccess: () => {
            toast.success('Event deleted successfully');
            setConfirmModal(null);
            onClose();
          },
          onError: (error: any) => {
            const message = error.response?.data?.detail;
            if (message) {
              toast.error(message);
            } else if (error.response?.status === 404) {
              toast.error('Event not found - it may have been already deleted');
            } else if (error.response?.status === 403) {
              toast.error('You do not have permission to delete this event');
            } else {
              toast.error('Failed to delete event. Please try again.');
            }
            setConfirmModal(null);
          },
        });
      },
    });
  };

  const handleAddParticipant = () => {
    if (!selectedUserId) return;

    addParticipantMutation.mutate(
      { user_id: selectedUserId, role: 'required' },
      {
        onSuccess: () => {
          toast.success('Participant added successfully');
          setSelectedUserId(null);
        },
        onError: (error: any) => {
          const message = error.response?.data?.detail;
          if (message) {
            toast.error(message);
          } else if (error.response?.status === 409) {
            toast.error('This user is already a participant');
          } else {
            toast.error('Failed to add participant. Please try again.');
          }
        },
      }
    );
  };

  const handleUpdateResponse = (response: ParticipantResponse) => {
    if (!user?.user_id) return;

    updateResponseMutation.mutate(
      { userId: user.user_id, data: { response } },
      {
        onSuccess: () => {
          toast.success(`Response updated to ${response}`);
        },
        onError: (error: any) => {
          const message = error.response?.data?.detail;
          if (message) {
            toast.error(message);
          } else {
            toast.error('Failed to update response. Please try again.');
          }
        },
      }
    );
  };

  const handleRemoveParticipant = (userId: number) => {
    removeParticipantMutation.mutate(userId, {
      onSuccess: () => {
        toast.success('Participant removed successfully');
      },
      onError: (error: any) => {
        const message = error.response?.data?.detail;
        if (message) {
          toast.error(message);
        } else {
          toast.error('Failed to remove participant. Please try again.');
        }
      },
    });
  };

  const handleUnschedule = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Unschedule Event',
      message: 'Move this event back to unscheduled?',
      type: 'info',
      onConfirm: () => {
        updateMutation.mutate(
          {
            eventId: event.event_id,
            data: { start_time: null, end_time: null, status: 'unscheduled' },
          },
          {
            onSuccess: () => {
              toast.success('Event moved to unscheduled');
              setConfirmModal(null);
              onClose();
            },
            onError: (error: any) => {
              const message = error.response?.data?.detail;
              if (message) {
                toast.error(message);
              } else {
                toast.error('Failed to unschedule event. Please try again.');
              }
              setConfirmModal(null);
            },
          }
        );
      },
    });
  };

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return 'Not scheduled';
    const date = new Date(dateStr);
    return date.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  // Convert ISO datetime to local datetime-local input value (YYYY-MM-DDTHH:mm)
  const toLocalDateTimeValue = (dateStr: string) => {
    const date = new Date(dateStr);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  // Convert datetime-local input value to MySQL datetime format (YYYY-MM-DD HH:MM:SS)
  // We send local time as-is, backend stores it as-is in MySQL DATETIME
  const toApiDateTime = (localValue: string) => {
    // Parse the local datetime string (YYYY-MM-DDTHH:mm)
    const [datePart, timePart] = localValue.split('T');
    const [year, month, day] = datePart.split('-');
    const [hours, minutes] = timePart.split(':');
    
    // Return in MySQL datetime format
    return `${year}-${month}-${day} ${hours}:${minutes}:00`;
  };

  return (
    <Transition appear show={true} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/25" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-lg transform rounded-lg bg-white p-6 shadow-xl transition-all">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                  <Dialog.Title as="h3" className="text-lg font-semibold text-gray-900">
                    {isEditing ? 'Event Details (Editing)' : 'Event Details'}
                  </Dialog.Title>
                  <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                    <XMarkIcon className="w-6 h-6" />
                  </button>
                </div>

                {/* Content */}
                <div className="space-y-4">
                  {isEditing ? (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                        <input
                          type="text"
                          value={editData.title}
                          onChange={(e) => setEditData({ ...editData, title: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                          placeholder="Event title"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                        <textarea
                          value={editData.description}
                          onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                          placeholder="Description"
                          rows={3}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 resize-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                        <select
                          value={editData.priority}
                          onChange={(e) => setEditData({ ...editData, priority: Number(e.target.value) })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                        >
                          <option value={1}>Priority 1 (Urgent)</option>
                          <option value={2}>Priority 2 (High)</option>
                          <option value={3}>Priority 3 (Normal)</option>
                          <option value={4}>Priority 4 (Low)</option>
                          <option value={5}>Priority 5 (Optional)</option>
                        </select>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
                          <input
                            type="datetime-local"
                            value={editData.start_time ? toLocalDateTimeValue(editData.start_time) : ''}
                            onChange={(e) => setEditData({ ...editData, start_time: e.target.value ? toApiDateTime(e.target.value) : '' })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
                          <input
                            type="datetime-local"
                            value={editData.end_time ? toLocalDateTimeValue(editData.end_time) : ''}
                            onChange={(e) => setEditData({ ...editData, end_time: e.target.value ? toApiDateTime(e.target.value) : '' })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm"
                          />
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <h4 className="text-xl font-semibold text-gray-900">{event.title}</h4>
                        <span className={`inline-block mt-1 px-2 py-0.5 text-xs rounded-full ${
                          event.priority === 1 ? 'bg-red-100 text-red-700' :
                          event.priority === 2 ? 'bg-orange-100 text-orange-700' :
                          event.priority === 3 ? 'bg-amber-100 text-amber-700' :
                          event.priority === 4 ? 'bg-lime-100 text-lime-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {priorityLabels[event.priority as keyof typeof priorityLabels]}
                        </span>
                      </div>

                      {event.description && (
                        <p className="text-sm text-gray-600">{event.description}</p>
                      )}

                      <div className="text-sm text-gray-600">
                        <div>
                          <span className="font-medium">Start:</span> {formatDateTime(event.start_time)}
                        </div>
                        <div>
                          <span className="font-medium">End:</span> {formatDateTime(event.end_time)}
                        </div>
                        <div>
                          <span className="font-medium">Status:</span> {event.status}
                        </div>
                      </div>
                    </>
                  )}

                  {/* Participants */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-900 mb-2">
                      Participants
                      {isEditing && <span className="text-xs text-gray-500 ml-2">(Click Remove to delete)</span>}
                    </h4>
                    <div className="space-y-2 max-h-40 overflow-auto">
                      {event.participants.map((p) => {
                        // Find user info for this participant
                        const participantUser = users.find(u => u.user_id === p.user_id);
                        const displayName = participantUser?.name || 'Unknown';
                        const displayEmail = participantUser?.email || '';
                        
                        return (
                          <div key={p.user_id} className="flex items-center justify-between text-sm">
                            <div className="flex items-center space-x-2">
                              <span className={`px-2 py-0.5 rounded text-xs ${responseColors[p.response]}`}>
                                {p.response}
                              </span>
                              <span className="text-gray-700 font-medium">{displayName}</span>
                              {displayEmail && (
                                <span className="text-gray-500 text-xs">({displayEmail})</span>
                              )}
                              <span className="text-gray-400 text-xs">[{p.role}]</span>
                            </div>
                            {isCreator && isEditing && p.user_id !== user?.user_id && (
                              <button
                                onClick={() => handleRemoveParticipant(p.user_id)}
                                className="text-red-500 hover:text-red-700 text-xs px-2 py-1 rounded hover:bg-red-50"
                              >
                                Remove
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Add participant (creator only, edit mode only) */}
                    {isCreator && isEditing && (
                      <div className="mt-2 flex space-x-2">
                        <select
                          value={selectedUserId || ''}
                          onChange={(e) => setSelectedUserId(Number(e.target.value))}
                          className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                        >
                          <option value="">Select user...</option>
                          {users
                            .filter((u) => !event.participants.find((p) => p.user_id === u.user_id))
                            .map((u) => (
                              <option key={u.user_id} value={u.user_id}>
                                {u.name} ({u.email})
                              </option>
                            ))}
                        </select>
                        <button
                          onClick={handleAddParticipant}
                          disabled={!selectedUserId}
                          className="px-3 py-1 bg-primary-600 text-white rounded text-sm hover:bg-primary-700 disabled:opacity-50"
                        >
                          Add
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Response buttons (for participants) */}
                  {!isCreator && event.status === 'scheduled' && (
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleUpdateResponse('accepted')}
                        className="flex-1 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => handleUpdateResponse('tentative')}
                        className="flex-1 px-3 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 text-sm"
                      >
                        Maybe
                      </button>
                      <button
                        onClick={() => handleUpdateResponse('declined')}
                        className="flex-1 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
                      >
                        Decline
                      </button>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="mt-6 flex items-center justify-between">
                  {isCreator ? (
                    <>
                      {isEditing ? (
                        <div className="flex space-x-2">
                          <button
                            onClick={handleSave}
                            disabled={updateMutation.isPending}
                            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setIsEditing(false)}
                            className="px-4 py-2 text-gray-600 hover:text-gray-800"
                          >
                            Discard
                          </button>
                        </div>
                      ) : (
                        <div className="flex space-x-2">
                          <button
                            onClick={() => setIsEditing(true)}
                            className="px-4 py-2 text-primary-600 hover:text-primary-700"
                          >
                            Edit
                          </button>
                          {event.status === 'scheduled' && (
                            <button
                              onClick={handleUnschedule}
                              className="px-4 py-2 text-orange-600 hover:text-orange-700"
                            >
                              Unschedule
                            </button>
                          )}
                          <button
                            onClick={handleDelete}
                            className="px-4 py-2 text-red-600 hover:text-red-700"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </>
                  ) : (
                    <div />
                  )}
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>

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
      </Dialog>
    </Transition>
  );
}
