import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  ArrowLeft,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Clock,
  Dumbbell,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Send,
  Loader,
  TrendingUp,
  BarChart3,
  Calendar,
  User,
} from 'lucide-react';

interface WorkoutLogRow {
  id: string;
  workout_id: string | null;
  status: string;
  started_at: string;
  completed_at: string | null;
  duration_seconds: number | null;
  overall_notes: string | null;
  coach_feedback: string | null;
  feedback_at: string | null;
  workout?: {
    title: string;
    scheduled_date: string;
  };
}

interface ExerciseLogRow {
  id: string;
  exercise_id: string;
  set_number: number;
  prescribed_reps: number | null;
  prescribed_weight: number | null;
  prescribed_duration: number | null;
  actual_reps: number | null;
  actual_weight: number | null;
  actual_duration: number | null;
  rpe: number | null;
  completed: boolean;
  notes: string | null;
  exercise?: {
    name: string;
    category: string;
  };
}

interface CoachClientLogViewProps {
  clientId: string;
  clientName: string;
  onBack: () => void;
}

const STATUS_CONFIG: Record<string, { icon: React.ReactNode; label: string; bg: string; text: string; border: string }> = {
  completed: {
    icon: <CheckCircle className="h-4 w-4" />,
    label: 'Completed',
    bg: 'bg-green-50',
    text: 'text-green-700',
    border: 'border-green-200',
  },
  partial: {
    icon: <AlertTriangle className="h-4 w-4" />,
    label: 'Partial',
    bg: 'bg-yellow-50',
    text: 'text-yellow-700',
    border: 'border-yellow-200',
  },
  in_progress: {
    icon: <Clock className="h-4 w-4" />,
    label: 'In Progress',
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200',
  },
  skipped: {
    icon: <XCircle className="h-4 w-4" />,
    label: 'Skipped',
    bg: 'bg-red-50',
    text: 'text-red-700',
    border: 'border-red-200',
  },
};

const CoachClientLogView: React.FC<CoachClientLogViewProps> = ({
  clientId,
  clientName,
  onBack,
}) => {
  const { user } = useAuth();
  const [logs, setLogs] = useState<WorkoutLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [expandedExercises, setExpandedExercises] = useState<ExerciseLogRow[]>([]);
  const [loadingExercises, setLoadingExercises] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [savingFeedback, setSavingFeedback] = useState(false);

  // Stats
  const completedCount = logs.filter((l) => l.status === 'completed').length;
  const partialCount = logs.filter((l) => l.status === 'partial').length;
  const missedCount = logs.filter((l) => l.status === 'skipped').length;

  useEffect(() => {
    fetchLogs();
  }, [clientId]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('workout_logs')
        .select(`
          id, workout_id, status, started_at, completed_at,
          duration_seconds, overall_notes, coach_feedback, feedback_at,
          workout:workouts(title, scheduled_date)
        `)
        .eq('client_id', clientId)
        .order('started_at', { ascending: false });

      if (error) throw error;
      setLogs((data || []) as unknown as WorkoutLogRow[]);
    } catch (err) {
      console.error('Error fetching workout logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = async (logId: string) => {
    if (expandedLogId === logId) {
      setExpandedLogId(null);
      return;
    }

    setExpandedLogId(logId);
    setLoadingExercises(true);

    // Pre-fill feedback
    const log = logs.find((l) => l.id === logId);
    setFeedbackText(log?.coach_feedback ?? '');

    try {
      const { data, error } = await supabase
        .from('exercise_logs')
        .select(`
          id, exercise_id, set_number,
          prescribed_reps, prescribed_weight, prescribed_duration,
          actual_reps, actual_weight, actual_duration,
          rpe, completed, notes,
          exercise:exercises(name, category)
        `)
        .eq('workout_log_id', logId)
        .order('exercise_id')
        .order('set_number');

      if (error) throw error;
      setExpandedExercises((data || []) as unknown as ExerciseLogRow[]);
    } catch (err) {
      console.error('Error fetching exercise logs:', err);
    } finally {
      setLoadingExercises(false);
    }
  };

  const saveFeedback = async (logId: string) => {
    if (!user) return;
    setSavingFeedback(true);
    try {
      const { error } = await supabase
        .from('workout_logs')
        .update({
          coach_feedback: feedbackText || null,
          feedback_at: new Date().toISOString(),
          feedback_by: user.id,
        })
        .eq('id', logId);

      if (error) throw error;

      setLogs((prev) =>
        prev.map((l) =>
          l.id === logId
            ? { ...l, coach_feedback: feedbackText, feedback_at: new Date().toISOString() }
            : l
        )
      );
    } catch (err) {
      console.error('Error saving feedback:', err);
    } finally {
      setSavingFeedback(false);
    }
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '—';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
  };

  // Group exercise logs by exercise
  const groupedExercises = expandedExercises.reduce<
    Record<string, { name: string; category: string; sets: ExerciseLogRow[] }>
  >((acc, row) => {
    const key = row.exercise_id;
    if (!acc[key]) {
      acc[key] = {
        name: row.exercise?.name ?? 'Unknown',
        category: row.exercise?.category ?? '',
        sets: [],
      };
    }
    acc[key].sets.push(row);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <div className="text-center">
          <Loader className="h-8 w-8 text-green-500 animate-spin mx-auto mb-2" />
          <p className="text-gray-600">Loading workout logs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={onBack}
          className="flex items-center px-3 py-2.5 min-h-[44px] text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors mb-3"
        >
          <ArrowLeft className="h-5 w-5 mr-2" />
          Back
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="bg-green-100 p-2 rounded-full">
            <User className="h-6 w-6 text-green-700" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
              {clientName}'s Workout Logs
            </h1>
            <p className="text-sm text-gray-500">{logs.length} total sessions logged</p>
          </div>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <CheckCircle className="h-4 w-4 text-green-600" />
            </div>
            <p className="text-2xl font-bold text-green-700">{completedCount}</p>
            <p className="text-xs text-green-600 font-medium">Completed</p>
          </div>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
            </div>
            <p className="text-2xl font-bold text-yellow-700">{partialCount}</p>
            <p className="text-xs text-yellow-600 font-medium">Partial</p>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <XCircle className="h-4 w-4 text-red-600" />
            </div>
            <p className="text-2xl font-bold text-red-700">{missedCount}</p>
            <p className="text-xs text-red-600 font-medium">Skipped</p>
          </div>
        </div>
      </div>

      {/* Log list */}
      {logs.length === 0 ? (
        <div className="text-center py-12">
          <Dumbbell className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600 text-lg">No workout logs yet</p>
          <p className="text-gray-500 text-sm mt-1">
            Logs will appear here once {clientName} starts logging workouts.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {logs.map((log) => {
            const cfg = STATUS_CONFIG[log.status] ?? STATUS_CONFIG.in_progress;
            const isExpanded = expandedLogId === log.id;

            return (
              <div
                key={log.id}
                className={`bg-white rounded-xl border-2 transition-all ${
                  isExpanded ? 'border-green-500 shadow-md' : 'border-gray-200'
                }`}
              >
                {/* Log header */}
                <button
                  type="button"
                  onClick={() => toggleExpand(log.id)}
                  className="w-full flex items-center justify-between p-4 text-left"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.text} border ${cfg.border}`}
                    >
                      {cfg.icon}
                      {cfg.label}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-gray-900 truncate text-sm">
                        {log.workout?.title ?? 'Workout'}
                      </h3>
                      <p className="text-xs text-gray-500 flex items-center gap-2">
                        <Calendar className="h-3 w-3" />
                        {new Date(log.workout?.scheduled_date || log.started_at).toLocaleDateString(
                          'en-US',
                          { month: 'short', day: 'numeric', year: 'numeric' }
                        )}
                        {log.duration_seconds ? (
                          <>
                            <span>•</span>
                            <Clock className="h-3 w-3" />
                            {formatDuration(log.duration_seconds)}
                          </>
                        ) : null}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {log.coach_feedback && (
                      <MessageSquare className="h-4 w-4 text-green-500" />
                    )}
                    {isExpanded ? (
                      <ChevronUp className="h-5 w-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-gray-400" />
                    )}
                  </div>
                </button>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-gray-100 pt-4 space-y-4">
                    {/* Client notes */}
                    {log.overall_notes && (
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-xs font-semibold text-gray-500 mb-1">
                          Client's Notes
                        </p>
                        <p className="text-sm text-gray-700">{log.overall_notes}</p>
                      </div>
                    )}

                    {/* Exercise details */}
                    {loadingExercises ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader className="h-5 w-5 text-green-500 animate-spin mr-2" />
                        <span className="text-sm text-gray-500">Loading exercises...</span>
                      </div>
                    ) : Object.keys(groupedExercises).length === 0 ? (
                      <p className="text-sm text-gray-500 italic">
                        No exercise data logged for this session.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {Object.entries(groupedExercises).map(([exId, group]) => {
                          const allCompleted = group.sets.every((s) => s.completed);
                          const someCompleted = group.sets.some((s) => s.completed);

                          return (
                            <div
                              key={exId}
                              className={`rounded-lg border p-3 ${
                                allCompleted
                                  ? 'border-green-200 bg-green-50/50'
                                  : someCompleted
                                  ? 'border-yellow-200 bg-yellow-50/30'
                                  : 'border-gray-200'
                              }`}
                            >
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <Dumbbell className="h-4 w-4 text-gray-400" />
                                  <h4 className="font-semibold text-sm text-gray-900">
                                    {group.name}
                                  </h4>
                                </div>
                                <span
                                  className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                                    allCompleted
                                      ? 'bg-green-100 text-green-700'
                                      : someCompleted
                                      ? 'bg-yellow-100 text-yellow-700'
                                      : 'bg-gray-100 text-gray-600'
                                  }`}
                                >
                                  {group.sets.filter((s) => s.completed).length}/{group.sets.length} sets
                                </span>
                              </div>

                              {/* Sets table */}
                              <div className="overflow-x-auto">
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="text-gray-500 border-b border-gray-200">
                                      <th className="py-1 px-1 text-left font-medium">Set</th>
                                      <th className="py-1 px-1 text-center font-medium">
                                        Prescribed
                                      </th>
                                      <th className="py-1 px-1 text-center font-medium">Actual</th>
                                      <th className="py-1 px-1 text-center font-medium">RPE</th>
                                      <th className="py-1 px-1 text-center font-medium">✓</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {group.sets.map((s) => {
                                      const prescribed = s.prescribed_duration
                                        ? `${s.prescribed_duration}s`
                                        : `${s.prescribed_reps ?? '—'} × ${
                                            s.prescribed_weight ? `${s.prescribed_weight} lb` : '—'
                                          }`;
                                      const actual = s.actual_duration
                                        ? `${s.actual_duration}s`
                                        : `${s.actual_reps ?? '—'} × ${
                                            s.actual_weight ? `${s.actual_weight} lb` : '—'
                                          }`;

                                      // Color code: did they hit target?
                                      const hitTarget =
                                        s.completed &&
                                        ((s.actual_reps ?? 0) >= (s.prescribed_reps ?? 0)) &&
                                        ((s.actual_weight ?? 0) >= (s.prescribed_weight ?? 0));

                                      return (
                                        <tr
                                          key={s.id}
                                          className="border-b border-gray-100 last:border-0"
                                        >
                                          <td className="py-1.5 px-1 font-medium text-gray-600">
                                            {s.set_number}
                                          </td>
                                          <td className="py-1.5 px-1 text-center text-gray-500">
                                            {prescribed}
                                          </td>
                                          <td
                                            className={`py-1.5 px-1 text-center font-medium ${
                                              hitTarget
                                                ? 'text-green-700'
                                                : s.completed
                                                ? 'text-yellow-700'
                                                : 'text-gray-500'
                                            }`}
                                          >
                                            {actual}
                                          </td>
                                          <td className="py-1.5 px-1 text-center text-gray-600">
                                            {s.rpe ?? '—'}
                                          </td>
                                          <td className="py-1.5 px-1 text-center">
                                            {s.completed ? (
                                              <CheckCircle className="h-3.5 w-3.5 text-green-500 inline" />
                                            ) : (
                                              <XCircle className="h-3.5 w-3.5 text-gray-300 inline" />
                                            )}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Coach feedback */}
                    <div className="border-t border-gray-200 pt-4">
                      <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                        <MessageSquare className="h-4 w-4" />
                        Coach Feedback
                      </label>
                      <div className="flex gap-2">
                        <textarea
                          value={feedbackText}
                          onChange={(e) => setFeedbackText(e.target.value)}
                          placeholder="Leave feedback on this workout..."
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                          rows={2}
                        />
                        <button
                          onClick={() => saveFeedback(log.id)}
                          disabled={savingFeedback}
                          className="self-end px-4 py-2.5 min-h-[44px] bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 flex items-center gap-1 text-sm font-medium"
                        >
                          {savingFeedback ? (
                            <Loader className="h-4 w-4 animate-spin" />
                          ) : (
                            <Send className="h-4 w-4" />
                          )}
                          Save
                        </button>
                      </div>
                      {log.feedback_at && (
                        <p className="text-[11px] text-gray-400 mt-1">
                          Last updated{' '}
                          {new Date(log.feedback_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CoachClientLogView;
