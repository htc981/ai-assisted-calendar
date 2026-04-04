import { CheckIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline';
import type { Event } from '../types';

interface TodoItemProps {
  todo: Event;
  isSelected: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

const priorityLabels = {
  1: { label: 'Urgent', color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' },
  2: { label: 'High', color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200' },
  3: { label: 'Normal', color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' },
  4: { label: 'Low', color: 'text-lime-600', bg: 'bg-lime-50', border: 'border-lime-200' },
  5: { label: 'Optional', color: 'text-gray-500', bg: 'bg-gray-50', border: 'border-gray-200' },
};

export default function TodoItem({ todo, isSelected, onToggle, onEdit, onDelete }: TodoItemProps) {
  const priority = priorityLabels[todo.priority as keyof typeof priorityLabels] || priorityLabels[3];

  return (
    <div
      className={`p-3 rounded-lg border transition-all ${
        isSelected
          ? 'border-primary-500 bg-primary-50 shadow-sm'
          : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
      }`}
    >
      <div className="flex items-start space-x-3">
        {/* Priority indicator bar */}
        <div className={`w-1 rounded-full ${priority.bg} ${priority.border} border`} />

        {/* Checkbox */}
        <div
          className={`flex-shrink-0 w-5 h-5 rounded border flex items-center justify-center transition-colors cursor-pointer ${
            isSelected
              ? 'bg-primary-600 border-primary-600'
              : 'border-gray-300 hover:border-gray-400'
          }`}
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
        >
          {isSelected && <CheckIcon className="w-4 h-4 text-white" />}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 cursor-pointer" onClick={onToggle}>
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-medium text-gray-900 truncate">
              {todo.title}
            </h3>
          </div>

          {todo.description && (
            <p className="text-xs text-gray-500 line-clamp-2 mb-2">
              {todo.description}
            </p>
          )}

          <div className="flex items-center justify-between">
            <span className={`text-xs font-medium ${priority.color}`}>
              {priority.label}
            </span>

            {todo.participants && todo.participants.length > 1 && (
              <span className="text-xs text-gray-400">
                {todo.participants.length - 1} participant(s)
              </span>
            )}
          </div>

          {todo.estimated_duration && (
            <p className="text-xs text-gray-400 mt-1">
              ~{todo.estimated_duration} min
            </p>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex space-x-1" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={onEdit}
            className="p-1 text-gray-400 hover:text-primary-600 rounded hover:bg-gray-100"
            title="Edit"
          >
            <PencilIcon className="w-4 h-4" />
          </button>
          <button
            onClick={onDelete}
            className="p-1 text-gray-400 hover:text-red-600 rounded hover:bg-gray-100"
            title="Delete"
          >
            <TrashIcon className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
