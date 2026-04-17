import { useState } from 'react';
import { useUIStore } from '../store/uiStore';
import TodoItem from './TodoItem';
import { useUpdateEvent, useDeleteEvent } from '../hooks/useEvents';
import ConfirmModal from './ConfirmModal';
import toast from 'react-hot-toast';
import type { Event } from '../types';

interface TodoColumnProps {
  todos: Event[];
  isLoading: boolean;
  onCreateTodo: (data: { title: string; description?: string; priority?: number; estimated_duration?: number }) => void;
  onEditTodo: (todo: Event) => void;
}

export default function TodoColumn({ todos, isLoading, onCreateTodo, onEditTodo }: TodoColumnProps) {
  const { toggleTodo, selectedTodos } = useUIStore();
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newPriority, setNewPriority] = useState(3);
  const [newEstimatedDuration, setNewEstimatedDuration] = useState(30);

  // Confirmation modal state
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  const deleteMutation = useDeleteEvent();

  const handleDelete = (todo: Event) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Todo',
      message: `Delete "${todo.title}"? This cannot be undone.`,
      onConfirm: () => {
        deleteMutation.mutate(todo.event_id, {
          onSuccess: () => {
            toast.success('Todo deleted successfully');
            setConfirmModal(null);
          },
          onError: (error: any) => {
            const message = error.response?.data?.detail;
            if (
              message?.includes('expired') ||
              message?.includes('Invalid or expired token') ||
              error.response?.status === 401
            ) {
              toast.error('Session expired. Please login again.');
            } else if (error.response?.status === 404) {
              toast.success('Todo deleted (already removed)');
              setConfirmModal(null);
            } else if (message) {
              if (message.includes('not found')) {
                toast.error('Todo not found - it may have been already deleted');
              } else if (message.includes('creator')) {
                toast.error('You can only delete your own todos');
              } else {
                toast.error(message);
              }
            } else if (error.message && error.message.includes('SESSION_EXPIRED')) {
              toast.error('Session expired. Please login again.');
            } else {
              toast.error('Failed to delete todo. Please try again.');
            }
            setConfirmModal(null);
          }
        });
      },
    });
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const todoData = {
      title: newTitle,
      description: newDescription || undefined,
      priority: newPriority,
      estimated_duration: newEstimatedDuration,
    };
    console.log('[TodoColumn] Creating todo with data:', {
      ...todoData,
      creator: 'Current User' // User info available in parent component
    });
    onCreateTodo(todoData);

    setNewTitle('');
    setNewDescription('');
    setNewPriority(3);
    setNewEstimatedDuration(30);
    setIsCreating(false);
    toast.success('Todo created!');
  };

  const priorityColors = {
    1: 'bg-red-100 text-red-800',
    2: 'bg-orange-100 text-orange-800',
    3: 'bg-blue-100 text-blue-800',
    4: 'bg-green-100 text-green-800',
    5: 'bg-gray-100 text-gray-800',
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold text-gray-900">
            Unscheduled Todos
          </h2>
          <span className="text-sm text-gray-500">{todos.length} items</span>
        </div>
        <p className="text-sm text-gray-500">
          Select todos and click a time slot to schedule
        </p>
      </div>

      {/* Create Todo Form */}
      {isCreating ? (
        <form onSubmit={handleCreate} className="p-4 border-b border-gray-200 bg-gray-50">
          <div className="space-y-3">
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Todo title (required)"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
              autoFocus
            />
            <textarea
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="Description (optional)"
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm resize-none"
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Estimated Duration (minutes)
              </label>
              <input
                type="number"
                value={newEstimatedDuration}
                onChange={(e) => setNewEstimatedDuration(parseInt(e.target.value) || 30)}
                min="15"
                max="480"
                step="15"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
              />
            </div>
            <div className="flex items-center justify-between">
              <select
                value={newPriority}
                onChange={(e) => setNewPriority(Number(e.target.value))}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
              >
                <option value={1}>Priority 1 (Urgent)</option>
                <option value={2}>Priority 2 (High)</option>
                <option value={3}>Priority 3 (Normal)</option>
                <option value={4}>Priority 4 (Low)</option>
                <option value={5}>Priority 5 (Optional)</option>
              </select>
              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        </form>
      ) : (
        <div className="p-4 border-b border-gray-200">
          <button
            onClick={() => setIsCreating(true)}
            className="w-full px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-primary-500 hover:text-primary-600 transition-colors"
          >
            + Add Todo
          </button>
        </div>
      )}

      {/* Todo List */}
      <div className="flex-1 overflow-auto p-4 space-y-2">
        {isLoading ? (
          <div className="text-center text-gray-500 py-8">Loading...</div>
        ) : todos.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <p className="text-lg mb-2">📝</p>
            <p>No unscheduled todos</p>
            <p className="text-sm mt-1">Create one to get started!</p>
          </div>
        ) : (
          todos.map((todo) => (
            <TodoItem
              key={todo.event_id}
              todo={todo}
              isSelected={selectedTodos.includes(todo.event_id)}
              onToggle={() => toggleTodo(todo.event_id)}
              onEdit={() => onEditTodo(todo)}
              onDelete={() => handleDelete(todo)}
            />
          ))
        )}
      </div>

      {/* Selection Info */}
      {selectedTodos.length > 0 && (
        <div className="p-4 border-t border-gray-200 bg-primary-50">
          <p className="text-sm text-primary-700">
            <span className="font-medium">{selectedTodos.length}</span> todo(s) selected
          </p>
          <p className="text-xs text-primary-600 mt-1">
            Click a time slot on the calendar to schedule
          </p>
        </div>
      )}

      {confirmModal && (
        <ConfirmModal
          isOpen={confirmModal.isOpen}
          title={confirmModal.title}
          message={confirmModal.message}
          type="danger"
          onConfirm={confirmModal.onConfirm}
          onCancel={() => setConfirmModal(null)}
        />
      )}
    </div>
  );
}
