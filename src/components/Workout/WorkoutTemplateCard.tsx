import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import {
  MoreVertical,
  Edit3,
  Trash2,
  UserPlus,
  Copy,
  Calendar,
  Dumbbell,
  Clock,
  Target,
  Users,
  CheckCircle,
  X,
  Loader,
  Link
} from 'lucide-react';

interface WorkoutTemplate {
  id: string;
  title: string;
  description?: string;
  category?: string;
  created_by: string;
  created_at: string;
  template_exercises?: Array<{
    id: string;
    exercise: {
      name: string;
      category: string;
    };
    sets?: number;
    reps?: number;
    weight?: number;
    duration?: number;
    superset_group?: number | null;
  }>;
}

interface WorkoutTemplateCardProps {
  template: WorkoutTemplate;
  onEdit: (template: WorkoutTemplate) => void;
  onDelete: (templateId: string) => void;
  onAssign: (template: WorkoutTemplate) => void;
  onDuplicate: (template: WorkoutTemplate) => void;
  compareMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (templateId: string) => void;
}

const WorkoutTemplateCard: React.FC<WorkoutTemplateCardProps> = ({
  template,
  onEdit,
  onDelete,
  onAssign,
  onDuplicate,
  compareMode = false,
  isSelected = false,
  onToggleSelect
}) => {
  const { user } = useAuth();
  const [showDropdown, setShowDropdown] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const handleDropdownToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowDropdown(!showDropdown);
  };

  const handleAction = async (action: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowDropdown(false);
    setActionLoading(action);

    try {
      switch (action) {
        case 'edit':
          onEdit(template);
          break;
        case 'delete':
          const confirmed = window.confirm(
            `Are you sure you want to delete "${template.title}"? This action cannot be undone.`
          );
          if (confirmed) {
            onDelete(template.id);
          }
          break;
        case 'assign':
          onAssign(template);
          break;
        case 'duplicate':
          onDuplicate(template);
          break;
      }
    } finally {
      setActionLoading(null);
    }
  };

  const exerciseCount = template.template_exercises?.length || 0;
  const categories = template.template_exercises
    ? [...new Set(template.template_exercises.map(ex => ex.exercise.category))]
    : [];

  // Count supersets
  const supersetGroups = template.template_exercises
    ? new Set(template.template_exercises.map(ex => ex.superset_group).filter(g => g != null))
    : new Set();
  const supersetCount = supersetGroups.size;

  const getSupersetColor = (groupNumber: number) => {
    const colors = [
      'bg-blue-100 text-blue-700 border-blue-300',
      'bg-green-100 text-green-700 border-green-300',
      'bg-purple-100 text-purple-700 border-purple-300',
      'bg-orange-100 text-orange-700 border-orange-300',
      'bg-pink-100 text-pink-700 border-pink-300',
      'bg-cyan-100 text-cyan-700 border-cyan-300'
    ];
    return colors[(groupNumber - 1) % colors.length];
  };

  const getSupersetLetter = (groupNumber: number) => {
    return String.fromCharCode(64 + groupNumber); // A, B, C, etc.
  };

  const handleCardClick = (e: React.MouseEvent) => {
    if (compareMode && onToggleSelect) {
      e.preventDefault();
      e.stopPropagation();
      onToggleSelect(template.id);
    }
  };

  return (
    <div
      className={`bg-white rounded-lg shadow-sm p-4 hover:shadow-md transition-all relative ${
        compareMode
          ? isSelected
            ? 'border-2 border-blue-500 ring-2 ring-blue-200 bg-blue-50'
            : 'border border-gray-100 hover:border-blue-300 cursor-pointer hover:bg-blue-50'
          : 'border border-gray-100'
      }`}
      onClick={handleCardClick}
      role={compareMode ? 'button' : undefined}
      tabIndex={compareMode ? 0 : undefined}
    >
      {/* Selection Checkbox in Compare Mode */}
      {compareMode && (
        <div
          className="absolute top-3 left-3 z-10"
          onClick={(e) => {
            e.stopPropagation();
            if (onToggleSelect) {
              onToggleSelect(template.id);
            }
          }}
        >
          <div className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-all cursor-pointer ${
            isSelected
              ? 'bg-blue-500 border-blue-500 shadow-md'
              : 'bg-white border-gray-400 hover:border-blue-500 hover:bg-blue-50 shadow-sm'
          }`}>
            {isSelected ? (
              <CheckCircle className="h-4 w-4 text-white" fill="currentColor" />
            ) : (
              <div className="w-3 h-3 rounded border border-gray-300"></div>
            )}
          </div>
        </div>
      )}

      {/* Dropdown Menu */}
      {!compareMode && (
        <div className="absolute top-3 right-3">
          <button
            onClick={handleDropdownToggle}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <MoreVertical className="h-4 w-4" />
          </button>

        {showDropdown && (
          <>
            <div 
              className="fixed inset-0 z-10" 
              onClick={() => setShowDropdown(false)}
            />
            <div className="absolute right-0 top-10 bg-white border border-gray-200 rounded-lg shadow-lg z-20 min-w-[160px]">
              <button
                onClick={(e) => handleAction('edit', e)}
                disabled={actionLoading === 'edit'}
                className="w-full flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-50"
              >
                {actionLoading === 'edit' ? (
                  <Loader className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Edit3 className="h-4 w-4 mr-2" />
                )}
                Edit Template
              </button>
              
              <button
                onClick={(e) => handleAction('assign', e)}
                disabled={actionLoading === 'assign'}
                className="w-full flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-50"
              >
                {actionLoading === 'assign' ? (
                  <Loader className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <UserPlus className="h-4 w-4 mr-2" />
                )}
                Assign to Client
              </button>
              
              <button
                onClick={(e) => handleAction('duplicate', e)}
                disabled={actionLoading === 'duplicate'}
                className="w-full flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-50"
              >
                {actionLoading === 'duplicate' ? (
                  <Loader className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Copy className="h-4 w-4 mr-2" />
                )}
                Duplicate
              </button>
              
              <div className="border-t border-gray-100">
                <button
                  onClick={(e) => handleAction('delete', e)}
                  disabled={actionLoading === 'delete'}
                  className="w-full flex items-center px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                >
                  {actionLoading === 'delete' ? (
                    <Loader className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4 mr-2" />
                  )}
                  Delete
                </button>
              </div>
            </div>
          </>
        )}
        </div>
      )}

      {/* Template Content */}
      <div className={compareMode ? "pr-6 pl-9" : "pr-6"}>
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <div className="flex items-start flex-wrap gap-1.5 mb-1.5">
              <h3 className="text-base font-semibold text-gray-900 leading-tight">{template.title}</h3>
              {template.category && (
                <span className="flex-shrink-0 px-2 py-0.5 bg-green-100 text-green-800 rounded text-xs font-medium capitalize">
                  {template.category.replace('-', ' ')}
                </span>
              )}
            </div>
            {template.description && (
              <p className="text-gray-600 text-xs mb-2 line-clamp-2">{template.description}</p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-gray-600 mb-3">
          <div className="flex items-center">
            <Dumbbell className="h-3 w-3 mr-1" />
            {exerciseCount}
          </div>
          <div className="flex items-center">
            <Target className="h-3 w-3 mr-1" />
            {categories.length}
          </div>
          {supersetCount > 0 && (
            <div className="flex items-center">
              <Link className="h-3 w-3 mr-1" />
              {supersetCount}
            </div>
          )}
        </div>

        {/* Exercise Categories */}
        {categories.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {categories.slice(0, 3).map((category) => (
              <span
                key={category}
                className="px-1.5 py-0.5 bg-gray-100 text-gray-700 rounded text-xs capitalize"
              >
                {category}
              </span>
            ))}
            {categories.length > 3 && (
              <span className="px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded text-xs">
                +{categories.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Quick Preview of Exercises */}
        {template.template_exercises && template.template_exercises.length > 0 && (
          <div className="bg-gray-50 rounded p-2">
            <p className="text-xs font-medium text-gray-700 mb-1">Exercises:</p>
            <div className="space-y-0.5">
              {template.template_exercises.slice(0, 2).map((ex, index) => (
                <div key={ex.id} className="flex items-start gap-1.5 text-xs">
                  <div className="flex-shrink-0 pt-0.5">
                    {ex.superset_group ? (
                      <span className={`px-1 py-0.5 rounded text-xs font-semibold border ${getSupersetColor(ex.superset_group)}`}>
                        {getSupersetLetter(ex.superset_group)}
                      </span>
                    ) : (
                      <span className="text-gray-400 text-xs">{index + 1}.</span>
                    )}
                  </div>
                  <span className="text-gray-600 truncate flex-1">
                    {ex.exercise.name}
                  </span>
                </div>
              ))}
              {template.template_exercises.length > 2 && (
                <p className="text-xs text-gray-500 pl-4">
                  +{template.template_exercises.length - 2} more
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WorkoutTemplateCard;