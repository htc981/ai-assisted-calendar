import { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon, CalendarIcon, EnvelopeIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { Invitation } from '../hooks/useNotifications';

interface MailboxModalProps {
  isOpen: boolean;
  onClose: () => void;
  invitations: Invitation[];
  onAccept: (notificationId: number) => void;
  onDecline: (notificationId: number) => void;
  onMaybe: (notificationId: number) => void;
}

export default function MailboxModal({
  isOpen,
  onClose,
  invitations,
  onAccept,
  onDecline,
  onMaybe
}: MailboxModalProps) {
  const responseColors = {
    accepted: 'bg-green-100 text-green-800',
    declined: 'bg-red-100 text-red-800',
    tentative: 'bg-yellow-100 text-yellow-800',
    pending: 'bg-gray-100 text-gray-800',
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
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
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                <div className="flex items-center justify-between mb-6">
                  <Dialog.Title as="div" className="flex items-center space-x-2">
                    <EnvelopeIcon className="w-6 h-6 text-primary-600" />
                    <h3 className="text-lg font-semibold text-gray-900">
                      My Mailbox ({invitations.length} pending)
                    </h3>
                  </Dialog.Title>
                  <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                    <XMarkIcon className="w-6 h-6" />
                  </button>
                </div>

                {invitations.length === 0 ? (
                  <div className="text-center py-12">
                    <CalendarIcon className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                    <p className="text-gray-500">No pending invitations</p>
                  </div>
                ) : (
                  <div className="space-y-4 max-h-[60vh] overflow-y-auto">
                    {invitations.map((inv) => (
                      <div key={inv.notification_id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <div className="flex items-center space-x-2 mb-2">
                              <span className="text-sm font-medium text-gray-600">
                                From: {inv.from_user.name}
                              </span>
                              {inv.participant_response && (
                                <span className={`px-2 py-0.5 rounded text-xs ${responseColors[inv.participant_response as keyof typeof responseColors]}`}>
                                  {inv.participant_response}
                                </span>
                              )}
                            </div>
                            <h4 className="text-lg font-semibold text-gray-900 mb-1">
                              {inv.event.title}
                            </h4>
                            <p className="text-sm text-gray-500">
                              {inv.event.description || 'No description'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center space-x-4 text-sm text-gray-600 mb-3">
                          {inv.event.start_time && (
                            <div className="flex items-center space-x-1">
                              <span className="text-gray-400">📅</span>
                              <span>{new Date(inv.event.start_time).toLocaleString()}</span>
                            </div>
                          )}
                          {inv.event.estimated_duration && (
                            <div className="flex items-center space-x-1">
                              <span className="text-gray-400">⏱️</span>
                              <span>{inv.event.estimated_duration} min</span>
                            </div>
                          )}
                          {inv.event.priority && (
                            <div className="flex items-center space-x-1">
                              <span className="text-gray-400">⭐</span>
                              <span>{inv.event.priority}</span>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center space-x-2 mt-4 border-t pt-3">
                          <button
                            onClick={() => onAccept(inv.notification_id)}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                          >
                            Accept
                          </button>
                          <button
                            onClick={() => onMaybe(inv.notification_id)}
                            className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors"
                          >
                            Maybe
                          </button>
                          <button
                            onClick={() => onDecline(inv.notification_id)}
                            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                          >
                            Decline
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-6 pt-4 border-t">
                  <p className="text-xs text-gray-500">
                    Click "Accept" to add the event to your calendar. If the time conflicts with a higher-priority event, acceptance will be rejected.
                  </p>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
