import { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { ExclamationTriangleIcon, XMarkIcon } from '@heroicons/react/24/outline';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'info' | 'warning' | 'danger';
  onConfirm: () => void;
  onCancel: () => void;
}

const typeConfig = {
  info: {
    icon: ExclamationTriangleIcon,
    iconColor: 'text-blue-600',
    iconBg: 'bg-blue-100',
    confirmButton: 'bg-blue-600 hover:bg-blue-700',
  },
  warning: {
    icon: ExclamationTriangleIcon,
    iconColor: 'text-yellow-600',
    iconBg: 'bg-yellow-100',
    confirmButton: 'bg-yellow-600 hover:bg-yellow-700',
  },
  danger: {
    icon: ExclamationTriangleIcon,
    iconColor: 'text-red-600',
    iconBg: 'bg-red-100',
    confirmButton: 'bg-red-600 hover:bg-red-700',
  },
};

export default function ConfirmModal({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'info',
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const config = typeConfig[type];

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onCancel}>
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
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className={`flex items-center justify-center w-10 h-10 rounded-full ${config.iconBg}`}>
                      <config.icon className={`w-6 h-6 ${config.iconColor}`} />
                    </div>
                    <Dialog.Title as="h3" className="text-lg font-semibold text-gray-900">
                      {title}
                    </Dialog.Title>
                  </div>
                  <button onClick={onCancel} className="text-gray-400 hover:text-gray-600">
                    <XMarkIcon className="w-5 h-5" />
                  </button>
                </div>

                {/* Message */}
                <div className="mb-6">
                  <p className="text-sm text-gray-600 whitespace-pre-line">{message}</p>
                </div>

                {/* Actions */}
                <div className="flex space-x-3">
                  <button
                    onClick={onCancel}
                    className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    {cancelText}
                  </button>
                  <button
                    onClick={onConfirm}
                    className={`flex-1 px-4 py-2 text-white rounded-lg transition-colors ${config.confirmButton}`}
                  >
                    {confirmText}
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
