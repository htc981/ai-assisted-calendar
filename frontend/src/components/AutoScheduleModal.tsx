import { Fragment, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon, Cog6ToothIcon, CalendarIcon } from '@heroicons/react/24/outline';
import { useScheduleEvents } from '../hooks/useEvents';
import { useUIStore } from '../store/uiStore';
import toast from 'react-hot-toast';

interface AutoScheduleModalProps {
  onClose: () => void;
  eventIds: number[];
}

export default function AutoScheduleModal({ onClose, eventIds }: AutoScheduleModalProps) {
  const { clearSelectedTodos } = useUIStore();
  const scheduleMutation = useScheduleEvents();
  
  const [rangeType, setRangeType] = useState<'today' | 'week' | 'custom'>('week');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const getDateTimeRange = () => {
    const now = new Date();
    let start: Date;
    let end: Date;

    switch (rangeType) {
      case 'today':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0);
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 18, 0);
        break;
      case 'week':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0);
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7, 18, 0);
        break;
      case 'custom':
        start = customStart ? new Date(customStart) : now;
        end = customEnd ? new Date(customEnd) : new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        break;
    }

    return {
      start: start.toISOString(),
      end: end.toISOString(),
    };
  };

  const handleSchedule = () => {
    const { start, end } = getDateTimeRange();

    scheduleMutation.mutate(
      {
        event_ids: eventIds,
        range_start: start,
        range_end: end,
      },
      {
        onSuccess: (data) => {
          toast.success(data.message || 'Events scheduled successfully');
          clearSelectedTodos();
          onClose();
        },
        onError: (error: any) => {
          const message = error.response?.data?.detail;
          if (message) {
            toast.error(message);
          } else if (error.response?.status === 409) {
            toast.error('Could not find available time slots. Try a wider date range.');
          } else {
            toast.error('Failed to schedule events. Please try again.');
          }
        },
      }
    );
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
              <Dialog.Panel className="w-full max-w-md transform rounded-lg bg-white p-6 shadow-xl transition-all">
                <div className="flex items-center justify-between mb-4">
                  <Dialog.Title as="div" className="flex items-center space-x-2">
                    <Cog6ToothIcon className="w-6 h-6 text-green-600" />
                    <h3 className="text-lg font-semibold text-gray-900">
                      Auto-Schedule Events
                    </h3>
                  </Dialog.Title>
                  <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                    <XMarkIcon className="w-6 h-6" />
                  </button>
                </div>

                <div className="space-y-4">
                  <p className="text-sm text-gray-600">
                    AI will automatically find the best time slots for your selected todos,
                    considering existing events and priorities.
                  </p>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-sm text-blue-800">
                      <span className="font-medium">{eventIds.length}</span> todo(s) will be scheduled
                    </p>
                  </div>

                  {/* Time Range Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Schedule within:
                    </label>
                    <div className="space-y-2">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="rangeType"
                          value="today"
                          checked={rangeType === 'today'}
                          onChange={(e) => setRangeType(e.target.value as any)}
                          className="h-4 w-4 text-green-600 focus:ring-green-500"
                        />
                        <span className="ml-2 text-sm text-gray-700">Today (9 AM - 6 PM)</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="rangeType"
                          value="week"
                          checked={rangeType === 'week'}
                          onChange={(e) => setRangeType(e.target.value as any)}
                          className="h-4 w-4 text-green-600 focus:ring-green-500"
                        />
                        <span className="ml-2 text-sm text-gray-700">This Week (7 days)</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="rangeType"
                          value="custom"
                          checked={rangeType === 'custom'}
                          onChange={(e) => setRangeType(e.target.value as any)}
                          className="h-4 w-4 text-green-600 focus:ring-green-500"
                        />
                        <span className="ml-2 text-sm text-gray-700">Custom Range</span>
                      </label>
                    </div>
                  </div>

                  {rangeType === 'custom' && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Start</label>
                        <input
                          type="datetime-local"
                          value={customStart}
                          onChange={(e) => setCustomStart(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">End</label>
                        <input
                          type="datetime-local"
                          value={customEnd}
                          onChange={(e) => setCustomEnd(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500"
                        />
                      </div>
                    </div>
                  )}

                  {/* Info */}
                  <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600">
                    <p className="flex items-center space-x-1">
                      <CalendarIcon className="w-4 h-4" />
                      <span>Higher priority events get preferred slots</span>
                    </p>
                    <p className="mt-1">
                      ⚡ Lower priority events may be rescheduled if needed
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex justify-end space-x-3 pt-4">
                    <button
                      onClick={onClose}
                      className="px-4 py-2 text-gray-600 hover:text-gray-800"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSchedule}
                      disabled={scheduleMutation.isPending || eventIds.length === 0}
                      className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                    >
                      {scheduleMutation.isPending ? (
                        <>
                          <span className="animate-spin">⏳</span>
                          <span>Scheduling...</span>
                        </>
                      ) : (
                        <>
                          <Cog6ToothIcon className="w-4 h-4" />
                          <span>Auto-Schedule</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
