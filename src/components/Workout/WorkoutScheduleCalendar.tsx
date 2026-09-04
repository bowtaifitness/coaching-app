import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { useScheduledWorkouts, ScheduledWorkout } from '../../hooks/useScheduledWorkouts';
import CopyWorkoutModal from './CopyWorkoutModal';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  CheckCircle,
  X,
  Dumbbell,
  Copy,
  Trash2,
  GripVertical,
  SkipForward,
  Eye,
  List,
  Grid3X3,
  Loader,
} from 'lucide-react';

interface WorkoutScheduleCalendarProps {
  clientId: string;
  clientName?: string;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const WorkoutScheduleCalendar: React.FC<WorkoutScheduleCalendarProps> = ({ clientId, clientName }) => {
  const { user } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'list'>('month');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedWorkout, setSelectedWorkout] = useState<ScheduledWorkout | null>(null);
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [templates, setTemplates] = useState<any[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  // Drag state
  const [dragWorkout, setDragWorkout] = useState<string | null>(null);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);

  // Compute date range for the current view
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1).toISOString().split('T')[0];
  const lastDay = new Date(year, month + 1, 0).toISOString().split('T')[0];

  const {
    scheduledWorkouts,
    loading,
    refresh,
    scheduleWorkout,
    scheduleFromTemplate,
    moveWorkout,
    updateStatus,
    deleteScheduledWorkout,
    copyWorkout,
  } = useScheduledWorkouts(clientId, { start: firstDay, end: lastDay });

  const isCoach = user?.role === 'coach' || user?.role === 'admin';

  useEffect(() => {
    if (isCoach) fetchTemplates();
  }, [isCoach]);

  const fetchTemplates = async () => {
    const { data } = await supabase
      .from('workout_templates')
      .select('id, title, description, category')
      .order('title', { ascending: true });
    setTemplates(data || []);
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  // Calendar grid helpers
  const getDaysInMonth = () => {
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    const days: (Date | null)[] = [];
    for (let i = 0; i < first.getDay(); i++) days.push(null);
    for (let d = 1; d <= last.getDate(); d++) days.push(new Date(year, month, d));
    return days;
  };

  const getWeekDays = () => {
    const start = new Date(currentDate);
    start.setDate(start.getDate() - start.getDay());
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      return d;
    });
  };

  const getWorkoutsForDate = (dateStr: string) =>
    scheduledWorkouts.filter(w => w.scheduled_date === dateStr);

  const navigateMonth = (dir: 'prev' | 'next') => {
    setCurrentDate(prev => {
      const d = new Date(prev);
      d.setMonth(d.getMonth() + (dir === 'next' ? 1 : -1));
      return d;
    });
  };

  const navigateWeek = (dir: 'prev' | 'next') => {
    setCurrentDate(prev => {
      const d = new Date(prev);
      d.setDate(d.getDate() + (dir === 'next' ? 7 : -7));
      return d;
    });
  };

  const todayStr = new Date().toISOString().split('T')[0];

  // Drag handlers
  const handleDragStart = (e: React.DragEvent, workoutId: string) => {
    if (!isCoach) return;
    e.dataTransfer.setData('text/plain', workoutId);
    setDragWorkout(workoutId);
  };

  const handleDragOver = (e: React.DragEvent, dateStr: string) => {
    e.preventDefault();
    setDragOverDate(dateStr);
  };

  const handleDragLeave = () => setDragOverDate(null);

  const handleDrop = async (e: React.DragEvent, dateStr: string) => {
    e.preventDefault();
    setDragOverDate(null);
    const workoutId = e.dataTransfer.getData('text/plain');
    if (!workoutId) return;

    // Check for copy modifier (Alt/Option key)
    if (e.altKey) {
      try {
        await copyWorkout(workoutId, [clientId], dateStr);
        showToast('Workout copied!');
      } catch (err) {
        console.error('Error copying workout:', err);
      }
    } else {
      try {
        await moveWorkout(workoutId, dateStr);
        showToast('Workout moved!');
      } catch (err) {
        console.error('Error moving workout:', err);
      }
    }
    setDragWorkout(null);
  };

  const handleCopyToDay = async (workoutId: string, targetDate: string) => {
    try {
      await copyWorkout(workoutId, [clientId], targetDate);
      showToast('Workout copied!');
    } catch (err) {
      console.error('Error copying workout:', err);
    }
  };

  const handleDeleteWorkout = async (workoutId: string) => {
    if (!confirm('Delete this scheduled workout?')) return;
    try {
      await deleteScheduledWorkout(workoutId);
      showToast('Workout deleted');
      setShowDetailModal(false);
      setSelectedWorkout(null);
    } catch (err) {
      console.error('Error deleting workout:', err);
    }
  };

  const statusColors: Record<string, string> = {
    completed: 'bg-green-500 text-white',
    scheduled: 'bg-blue-500 text-white',
    in_progress: 'bg-yellow-500 text-white',
    skipped: 'bg-gray-400 text-white',
  };

  const statusIcons: Record<string, React.ReactNode> = {
    completed: <CheckCircle className="h-3 w-3" />,
    scheduled: <Clock className="h-3 w-3" />,
    in_progress: <Loader className="h-3 w-3" />,
    skipped: <SkipForward className="h-3 w-3" />,
  };

  // -------------------------------------------------------
  // Render a single day cell
  // -------------------------------------------------------
  const renderDayCell = (date: Date | null, compact = false) => {
    if (!date) return <div key={Math.random()} className="min-h-[80px] sm:min-h-[100px]" />;

    const dateStr = date.toISOString().split('T')[0];
    const dayWorkouts = getWorkoutsForDate(dateStr);
    const isToday = dateStr === todayStr;
    const isDragOver = dateStr === dragOverDate;

    return (
      <div
        key={dateStr}
        className={`min-h-[80px] sm:min-h-[100px] p-1 sm:p-2 border border-gray-100 rounded-lg transition-colors cursor-pointer ${
          isToday ? 'bg-green-50 border-green-300' : 'hover:bg-gray-50'
        } ${isDragOver ? 'bg-blue-50 border-blue-300 ring-2 ring-blue-200' : ''}`}
        onClick={() => {
          setSelectedDate(dateStr);
          if (isCoach) setShowAddModal(true);
        }}
        onDragOver={(e) => handleDragOver(e, dateStr)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, dateStr)}
      >
        <div className={`text-xs sm:text-sm font-medium mb-1 ${isToday ? 'text-green-600 font-bold' : 'text-gray-900'}`}>
          {date.getDate()}
        </div>
        <div className="space-y-0.5 sm:space-y-1">
          {dayWorkouts.slice(0, compact ? 2 : 3).map((w) => (
            <div
              key={w.id}
              draggable={isCoach}
              onDragStart={(e) => handleDragStart(e, w.id)}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedWorkout(w);
                setShowDetailModal(true);
              }}
              className={`text-[10px] sm:text-xs p-0.5 sm:p-1 rounded truncate flex items-center gap-0.5 sm:gap-1 ${statusColors[w.status]} ${
                isCoach ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
              } ${dragWorkout === w.id ? 'opacity-50' : ''}`}
              title={`${w.title} — ${w.status}`}
            >
              {isCoach && <GripVertical className="h-2.5 w-2.5 sm:h-3 sm:w-3 flex-shrink-0 opacity-60" />}
              {statusIcons[w.status]}
              <span className="truncate">{w.title}</span>
            </div>
          ))}
          {dayWorkouts.length > (compact ? 2 : 3) && (
            <div className="text-[10px] text-gray-500 pl-1">+{dayWorkouts.length - (compact ? 2 : 3)} more</div>
          )}
        </div>
      </div>
    );
  };

  // -------------------------------------------------------
  // Add Workout Modal
  // -------------------------------------------------------
  const AddWorkoutModal = () => {
    const [mode, setMode] = useState<'template' | 'custom'>('template');
    const [selectedTemplateId, setSelectedTemplateId] = useState('');
    const [customTitle, setCustomTitle] = useState('');
    const [notes, setNotes] = useState('');
    const [schedDate, setSchedDate] = useState(selectedDate || todayStr);
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      try {
        setSaving(true);
        if (mode === 'template' && selectedTemplateId) {
          await scheduleFromTemplate(selectedTemplateId, clientId, schedDate, notes || undefined);
          showToast('Workout scheduled from template!');
        } else if (mode === 'custom' && customTitle.trim()) {
          await scheduleWorkout({
            client_id: clientId,
            scheduled_date: schedDate,
            title: customTitle.trim(),
            notes: notes || undefined,
          });
          showToast('Workout scheduled!');
        }
        setShowAddModal(false);
      } catch (err) {
        console.error('Error scheduling workout:', err);
        alert('Failed to schedule workout. Please try again.');
      } finally {
        setSaving(false);
      }
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50">
        <div className="bg-white rounded-t-2xl sm:rounded-xl w-full max-w-lg sm:mx-4 max-h-[90dvh] overflow-y-auto">
          <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900">Schedule Workout</h3>
            <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600">
              <X className="h-6 w-6" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
            {/* Mode toggle */}
            <div className="flex rounded-lg bg-gray-100 p-1">
              <button
                type="button"
                onClick={() => setMode('template')}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                  mode === 'template' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-600'
                }`}
              >
                From Template
              </button>
              <button
                type="button"
                onClick={() => setMode('custom')}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                  mode === 'custom' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-600'
                }`}
              >
                Custom
              </button>
            </div>

            {mode === 'template' ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Workout Template</label>
                <select
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  required
                >
                  <option value="">Select a template...</option>
                  {templates.map(t => (
                    <option key={t.id} value={t.id}>{t.title}{t.category ? ` (${t.category})` : ''}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Workout Title</label>
                <input
                  type="text"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="e.g., Upper Body Strength"
                  required
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
              <input
                type="date"
                value={schedDate}
                onChange={(e) => setSchedDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                rows={2}
                placeholder="Instructions for this session..."
              />
            </div>

            <div className="flex space-x-3 pt-2">
              <button
                type="submit"
                disabled={saving || (mode === 'template' ? !selectedTemplateId : !customTitle.trim())}
                className="flex-1 bg-green-500 text-white py-2 rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? 'Scheduling...' : 'Schedule Workout'}
              </button>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  // -------------------------------------------------------
  // Detail Modal
  // -------------------------------------------------------
  const DetailModal = () => {
    if (!selectedWorkout) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50">
        <div className="bg-white rounded-t-2xl sm:rounded-xl w-full max-w-lg sm:mx-4 max-h-[90dvh] overflow-y-auto">
          <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900">{selectedWorkout.title}</h3>
            <button onClick={() => { setShowDetailModal(false); setSelectedWorkout(null); }} className="text-gray-400 hover:text-gray-600">
              <X className="h-6 w-6" />
            </button>
          </div>

          <div className="p-4 sm:p-6 space-y-4">
            {/* Status + date */}
            <div className="flex items-center space-x-4 text-sm text-gray-600">
              <div className="flex items-center">
                <CalendarIcon className="h-4 w-4 mr-1" />
                {new Date(selectedWorkout.scheduled_date + 'T00:00:00').toLocaleDateString()}
              </div>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[selectedWorkout.status]}`}>
                {statusIcons[selectedWorkout.status]} {selectedWorkout.status}
              </span>
            </div>

            {selectedWorkout.notes && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-800"><strong>Notes:</strong> {selectedWorkout.notes}</p>
              </div>
            )}

            {/* Exercises */}
            {selectedWorkout.exercises && selectedWorkout.exercises.length > 0 ? (
              <div>
                <h4 className="font-semibold text-gray-900 mb-3">Exercises</h4>
                <div className="space-y-2">
                  {selectedWorkout.exercises
                    .sort((a, b) => a.order_index - b.order_index)
                    .map((ex, i) => (
                    <div key={ex.id} className="flex items-start p-3 bg-gray-50 rounded-lg">
                      <span className="text-sm font-medium text-gray-500 mr-3 mt-0.5">{i + 1}.</span>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{ex.exercise?.name || 'Exercise'}</p>
                        <div className="flex flex-wrap gap-3 text-xs text-gray-600 mt-1">
                          {ex.sets && <span>{ex.sets} sets</span>}
                          {ex.reps && <span>{ex.reps} reps</span>}
                          {ex.weight && <span>{ex.weight} lbs</span>}
                          {ex.duration && <span>{ex.duration}s</span>}
                        </div>
                        {ex.notes && <p className="text-xs text-gray-500 mt-1">{ex.notes}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-4 text-gray-500">
                <Dumbbell className="h-6 w-6 mx-auto mb-1 text-gray-400" />
                <p className="text-sm">No exercises — schedule from a template to include exercises</p>
              </div>
            )}

            {/* Actions */}
            {isCoach && (
              <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-100">
                {selectedWorkout.status === 'scheduled' && (
                  <button
                    onClick={async () => {
                      await updateStatus(selectedWorkout.id, 'completed');
                      showToast('Marked as completed');
                      setShowDetailModal(false);
                      setSelectedWorkout(null);
                    }}
                    className="flex items-center gap-1 px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 text-sm transition-colors"
                  >
                    <CheckCircle className="h-4 w-4" /> Complete
                  </button>
                )}
                {selectedWorkout.status === 'scheduled' && (
                  <button
                    onClick={async () => {
                      await updateStatus(selectedWorkout.id, 'skipped');
                      showToast('Marked as skipped');
                      setShowDetailModal(false);
                      setSelectedWorkout(null);
                    }}
                    className="flex items-center gap-1 px-3 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 text-sm transition-colors"
                  >
                    <SkipForward className="h-4 w-4" /> Skip
                  </button>
                )}
                <button
                  onClick={() => {
                    setShowDetailModal(false);
                    setShowCopyModal(true);
                  }}
                  className="flex items-center gap-1 px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm transition-colors"
                >
                  <Copy className="h-4 w-4" /> Copy to Client
                </button>
                <button
                  onClick={() => handleDeleteWorkout(selectedWorkout.id)}
                  className="flex items-center gap-1 px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 text-sm transition-colors ml-auto"
                >
                  <Trash2 className="h-4 w-4" /> Delete
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // -------------------------------------------------------
  // List view
  // -------------------------------------------------------
  const renderListView = () => {
    const sorted = [...scheduledWorkouts].sort(
      (a, b) => new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime()
    );

    if (sorted.length === 0) {
      return (
        <div className="text-center py-12">
          <CalendarIcon className="h-10 w-10 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-500">No workouts scheduled this month</p>
          {isCoach && (
            <button
              onClick={() => { setSelectedDate(todayStr); setShowAddModal(true); }}
              className="mt-3 text-green-600 hover:text-green-700 text-sm font-medium"
            >
              + Schedule a workout
            </button>
          )}
        </div>
      );
    }

    return (
      <div className="space-y-2">
        {sorted.map(w => {
          const isToday = w.scheduled_date === todayStr;
          return (
            <div
              key={w.id}
              onClick={() => { setSelectedWorkout(w); setShowDetailModal(true); }}
              className={`flex items-center p-3 rounded-lg cursor-pointer transition-colors ${
                isToday ? 'bg-green-50 border border-green-200' : 'bg-gray-50 hover:bg-gray-100'
              }`}
            >
              <div className={`p-2 rounded-lg mr-3 ${statusColors[w.status]}`}>
                <Dumbbell className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 truncate">{w.title}</p>
                <p className="text-xs text-gray-500">
                  {new Date(w.scheduled_date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                  {w.exercises && w.exercises.length > 0 && ` · ${w.exercises.length} exercises`}
                </p>
              </div>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[w.status]}`}>
                {statusIcons[w.status]} {w.status}
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  // -------------------------------------------------------
  // Main render
  // -------------------------------------------------------
  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Toast */}
      {toast && (
        <div className="fixed top-20 right-4 z-[60] bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg text-sm animate-slide-in-right">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-gray-100">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center space-x-3">
              <button
                onClick={() => viewMode === 'month' ? navigateMonth('prev') : navigateWeek('prev')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center touch-manipulation"
              >
                <ChevronLeft className="h-5 w-5 text-gray-600" />
              </button>
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900 min-w-[140px] sm:min-w-[180px] text-center">
                {viewMode === 'week'
                  ? (() => {
                      const days = getWeekDays();
                      return `${days[0].toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${days[6].toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
                    })()
                  : `${MONTH_NAMES[month]} ${year}`}
              </h2>
              <button
                onClick={() => viewMode === 'month' ? navigateMonth('next') : navigateWeek('next')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center touch-manipulation"
              >
                <ChevronRight className="h-5 w-5 text-gray-600" />
              </button>
            </div>

            <div className="flex items-center gap-2">
              {/* View mode toggle */}
              <div className="flex bg-gray-100 rounded-lg p-0.5">
                <button
                  onClick={() => setViewMode('month')}
                  className={`p-2 rounded-md transition-colors ${viewMode === 'month' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-500'}`}
                  title="Month view"
                >
                  <Grid3X3 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded-md transition-colors ${viewMode === 'list' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-500'}`}
                  title="List view"
                >
                  <List className="h-4 w-4" />
                </button>
              </div>

              {isCoach && (
                <button
                  onClick={() => { setSelectedDate(todayStr); setShowAddModal(true); }}
                  className="flex items-center gap-1 px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm touch-manipulation"
                >
                  <Plus className="h-4 w-4" />
                  <span className="hidden sm:inline">Schedule</span>
                </button>
              )}
            </div>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-3 sm:gap-4 mt-3 text-xs text-gray-600">
            <div className="flex items-center gap-1"><div className="w-3 h-3 bg-blue-500 rounded" /> Scheduled</div>
            <div className="flex items-center gap-1"><div className="w-3 h-3 bg-green-500 rounded" /> Completed</div>
            <div className="flex items-center gap-1"><div className="w-3 h-3 bg-yellow-500 rounded" /> In Progress</div>
            <div className="flex items-center gap-1"><div className="w-3 h-3 bg-gray-400 rounded" /> Skipped</div>
            {isCoach && <span className="text-gray-400 hidden sm:inline">Drag to move · Hold Alt+drag to copy</span>}
          </div>
        </div>

        {/* Calendar content */}
        <div className="p-3 sm:p-6">
          {loading ? (
            <div className="text-center py-12">
              <Loader className="h-8 w-8 text-green-500 animate-spin mx-auto mb-2" />
              <p className="text-gray-600">Loading schedule...</p>
            </div>
          ) : viewMode === 'list' ? (
            renderListView()
          ) : viewMode === 'week' ? (
            <>
              <div className="grid grid-cols-7 gap-1 mb-2">
                {DAY_NAMES.map(d => (
                  <div key={d} className="p-1 sm:p-2 text-center text-xs sm:text-sm font-medium text-gray-600">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {getWeekDays().map(day => renderDayCell(day))}
              </div>
            </>
          ) : (
            <>
              <div className="grid grid-cols-7 gap-1 mb-2">
                {DAY_NAMES.map(d => (
                  <div key={d} className="p-1 sm:p-2 text-center text-xs sm:text-sm font-medium text-gray-600">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {getDaysInMonth().map((day, i) => renderDayCell(day, true))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Modals */}
      {showAddModal && <AddWorkoutModal />}
      {showDetailModal && <DetailModal />}
      {showCopyModal && selectedWorkout && (
        <CopyWorkoutModal
          workoutId={selectedWorkout.id}
          workoutTitle={selectedWorkout.title}
          onClose={() => { setShowCopyModal(false); setSelectedWorkout(null); }}
          onCopyComplete={(count) => {
            showToast(`Workout copied to ${count} client${count !== 1 ? 's' : ''}`);
            setShowCopyModal(false);
            setSelectedWorkout(null);
          }}
        />
      )}
    </div>
  );
};

export default WorkoutScheduleCalendar;
