import { Fragment, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon, LightBulbIcon } from '@heroicons/react/24/outline';

interface NLInputModalProps {
  onClose: () => void;
  onSubmit: (text: string) => void;
  isProcessing: boolean;
}

export default function NLInputModal({ onClose, onSubmit, isProcessing }: NLInputModalProps) {
  const [text, setText] = useState('');

  const handleSubmit = () => {
    if (!text.trim()) return;
    onSubmit(text);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      handleSubmit();
    }
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
              <Dialog.Panel className="w-full max-w-2xl transform rounded-lg bg-white p-6 shadow-xl transition-all">
                <div className="flex items-center justify-between mb-4">
                  <Dialog.Title as="div" className="flex items-center space-x-2">
                    <LightBulbIcon className="w-6 h-6 text-purple-600" />
                    <h3 className="text-lg font-semibold text-gray-900">
                      Natural Language Input
                    </h3>
                  </Dialog.Title>
                  <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                    <XMarkIcon className="w-6 h-6" />
                  </button>
                </div>

                <div className="space-y-4">
                  <p className="text-sm text-gray-600">
                    Describe your tasks and events in natural language. The AI will parse them and create todos for you.
                  </p>

                  <div>
                    <textarea
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      onKeyDown={handleKeyPress}
                      placeholder="Example:&#10;• Team meeting tomorrow at 2pm for 1 hour&#10;• Review PR #234 with John (john@example.com)&#10;• Lunch with Sarah on Friday&#10;• Finish the quarterly report by end of week (high priority)"
                      rows={8}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                      autoFocus
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Press Ctrl+Enter to submit
                    </p>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="text-xs text-gray-500">
                      <p>✨ AI will extract:</p>
                      <ul className="list-disc list-inside mt-1">
                        <li>Event titles and descriptions</li>
                        <li>Priority levels</li>
                        <li>Estimated durations</li>
                        <li>Participant emails</li>
                        <li>Time preferences</li>
                      </ul>
                    </div>
                    <button
                      onClick={handleSubmit}
                      disabled={isProcessing || !text.trim()}
                      className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                    >
                      {isProcessing ? (
                        <>
                          <span className="animate-spin">⏳</span>
                          <span>Processing...</span>
                        </>
                      ) : (
                        <>
                          <LightBulbIcon className="w-4 h-4" />
                          <span>Create Events</span>
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
