import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useWorkoutLog } from '../../hooks/useWorkoutLog';
import { useExerciseHistory } from '../../hooks/useExerciseHistory';
import { supabase } from '../../lib/supabase';
import ExerciseHistoryModal from './ExerciseHistoryModal';
import {
  ArrowLeft,
  Check,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  Dumbbell,
  History,
  Loader,
  MessageSquare,
  Save,
  Award,
  TrendingUp,
  AlertCircle,
  Play,
  Pause,
  RotateCcw,
  Trophy,
} from 'lucide-react';

interface WorkoutLogViewProps {
  workoutId: string;
  onBack: () => void;
}

const WorkoutLogView: React.FC<WorkoutLogViewProps> = ({ workoutId, onBack }) => {
  const { user } = useAuth();
  const {
    logState,
    loading,
    saving,
    lastSavedAt,
    error,
    updateSet,
    toggleSetComplete,
    updateExerciseNotes,
    updateOverallNotes,
    markWorkoutComplete,
    saveNow,
  } = useWorkoutLog({
    workoutId,
    clientId: user?.id ?? '',
    enabled: !!user,
  });

  const [expandedExercise, setExpandedExercise] = useState<number | null>(0);
  const [showHistoryFor, setShowHistoryFor] = useState<{ exerciseId: string; name: string } | null>(null);
  const [workoutTitle, setWorkoutTitle] = useState('Workout');
  const [workoutDate, setWorkoutDate] = useState('');

  // Timer
  const [elapsed, setElapsed] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch workout title
  useEffect(() => {
    const fetchTitle = async () => {
      const { data } = await supabase
        .from('workouts')
        .select('title, scheduled_date')
        .eq('id', workoutId)
        .maybeSingle();
      if (data) {
        setWorkoutTitle(data.title);
        setWorkoutDate(data.scheduled_date);
      }
    };
    fetchTitle();
  }, [workoutId]);

  // Timer logic
  useEffect(() => {
    if (timerRunning) {
      timerRef.current = setInterval(() => setElapsed((p) => p + 1), 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timerRunning]);

  // Auto-expand first incomplete exercise
  useEffect(() => {
    if (logState && expandedExercise === null) {
      const idx = logState.exercises.findIndex((ex) => !ex.all_sets_completed);
      setExpandedExercise(idx >= 0 ? idx : 0);
    }
  }, [logState]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const getCompletionPercent = () => {
    if (!logState) return 0;
    const totalSets = logState.exercises.reduce((sum, ex) => sum + ex.sets.length, 0);
    const done = logState.exercises.reduce(
      (sum, ex) => sum + ex.sets.filter((s) => s.completed).length,
      0
    );
    return totalSets === 0 ? 0 : Math.round((done / totalSets) * 100);
  };

  const completedExercises = logState?.exercises.filter((ex) => ex.all_sets_completed).length ?? 0;
  const totalExercises = logState?.exercises.length ?? 0;

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <div className="text-center">
          <Loader className="h-8 w-8 text-blue-500 animate-spin mx-auto mb-2" />
          <p className="text-gray-600">Loading workout...</p>
        </div>
      </div>
    );
  }

  if (error && !logState) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex items-center mb-2">
            <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
            <h3 className="text-lg font-medium text-red-800">Error</h3>
          </div>
          <p className="text-red-700">{error}</p>
          <button
            onClick={onBack}
            className="mt-4 flex items-center px-4 py-2.5 min-h-[44px] bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </button>
        </div>
      </div>
    );
  }

  if (!logState) return null;

  const pct = getCompletionPercent();
  const allDone = pct === 100;

  return (
    <div className="p-4 sm:p-6 pb-32">
      {/* ── Header ───────────────────────────────────────────────────── */}
      <div className="mb-4">
        <button
          onClick={async () => {
            await saveNow();
            onBack();
          }}
          className="flex items-center px-3 py-2.5 min-h-[44px] text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors mb-3"
        >
          <ArrowLeft className="h-5 w-5 mr-2" />
          Back to Workouts
        </button>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">{workoutTitle}</h1>
            {workoutDate && (
              <p className="text-sm text-gray-500">
                {new Date(workoutDate + 'T00:00:00').toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            {/* Save indicator */}
            <div className="text-xs text-gray-400 flex items-center gap-1">
              {saving ? (
                <>
                  <Loader className="h-3 w-3 animate-spin" />
                  Saving...
                </>
              ) : lastSavedAt ? (
                <>
                  <Check className="h-3 w-3 text-blue-500" />
                  Saved
                </>
              ) : null}
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-blue-600">{pct}%</div>
              <div className="text-xs text-gray-500">
                {completedExercises}/{totalExercises} exercises
              </div>
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-gray-200 rounded-full h-2.5 mb-4">
          <div
            className="bg-blue-500 h-2.5 rounded-full transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>

        {/* Timer row */}
        <div className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3 mb-4">
          <div className="flex items-center gap-3">
            <Clock className="h-5 w-5 text-gray-400" />
            <span className="text-lg font-mono font-bold text-gray-900">{formatTime(elapsed)}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setTimerRunning(!timerRunning)}
              className={`p-2.5 min-h-[44px] min-w-[44px] rounded-lg transition-colors ${
                timerRunning
                  ? 'bg-orange-500 text-white hover:bg-orange-600'
                  : 'bg-blue-500 text-white hover:bg-blue-600'
              }`}
            >
              {timerRunning ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
            </button>
            <button
              onClick={() => {
                setElapsed(0);
                setTimerRunning(false);
              }}
              className="p-2.5 min-h-[44px] min-w-[44px] bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
            >
              <RotateCcw className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Exercise Cards ───────────────────────────────────────────── */}
      <div className="space-y-3">
        {logState.exercises.map((ex, exIdx) => (
          <ExerciseCard
            key={ex.workout_exercise_id}
            exercise={ex}
            exerciseIndex={exIdx}
            isExpanded={expandedExercise === exIdx}
            onToggleExpand={() =>
              setExpandedExercise(expandedExercise === exIdx ? null : exIdx)
            }
            onUpdateSet={updateSet}
            onToggleSetComplete={toggleSetComplete}
            onUpdateNotes={updateExerciseNotes}
            onShowHistory={() =>
              setShowHistoryFor({ exerciseId: ex.exercise_id, name: ex.exercise_name })
            }
            clientId={user?.id ?? ''}
          />
        ))}
      </div>

      {/* ── Overall Notes ────────────────────────────────────────────── */}
      <div className="mt-6 bg-white rounded-xl border border-gray-200 p-4">
        <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
          <MessageSquare className="h-4 w-4" />
          Workout Notes
        </label>
        <textarea
          value={logState.overall_notes}
          onChange={(e) => updateOverallNotes(e.target.value)}
          placeholder="How did the workout feel overall? Any observations..."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          rows={3}
        />
      </div>

      {/* ── Bottom Action Bar ────────────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 safe-bottom z-40">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <button
            onClick={async () => {
              await saveNow();
              onBack();
            }}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 min-h-[48px] border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
          >
            <Save className="h-4 w-4" />
            Save & Exit
          </button>
          {allDone ? (
            <button
              onClick={async () => {
                await markWorkoutComplete();
                onBack();
              }}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 min-h-[48px] bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold"
            >
              <Award className="h-5 w-5" />
              Complete Workout
            </button>
          ) : (
            <button
              onClick={saveNow}
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 min-h-[48px] bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-medium disabled:opacity-50"
            >
              {saving ? <Loader className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? 'Saving...' : 'Save Progress'}
            </button>
          )}
        </div>
      </div>

      {/* ── History Modal ────────────────────────────────────────────── */}
      {showHistoryFor && user && (
        <ExerciseHistoryModal
          exerciseId={showHistoryFor.exerciseId}
          exerciseName={showHistoryFor.name}
          clientId={user.id}
          onClose={() => setShowHistoryFor(null)}
        />
      )}
    </div>
  );
};

// ── Exercise Card Component ──────────────────────────────────────────────────

interface ExerciseCardProps {
  exercise: import('../../types/workoutLog').ExerciseLogState;
  exerciseIndex: number;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onUpdateSet: (exIdx: number, setIdx: number, field: string, value: unknown) => void;
  onToggleSetComplete: (exIdx: number, setIdx: number) => void;
  onUpdateNotes: (exIdx: number, notes: string) => void;
  onShowHistory: () => void;
  clientId: string;
}

const ExerciseCard: React.FC<ExerciseCardProps> = ({
  exercise,
  exerciseIndex,
  isExpanded,
  onToggleExpand,
  onUpdateSet,
  onToggleSetComplete,
  onUpdateNotes,
  onShowHistory,
  clientId,
}) => {
  const completedSets = exercise.sets.filter((s) => s.completed).length;
  const totalSets = exercise.sets.length;
  const allDone = exercise.all_sets_completed;

  // Last session preview (lightweight — only uses the new exercise_logs table)
  const { history, personalBest } = useExerciseHistory({
    exerciseId: exercise.exercise_id,
    clientId,
    enabled: isExpanded,
  });
  const lastEntry = history.length > 0 ? history[history.length - 1] : null;

  return (
    <div
      className={`bg-white rounded-xl border-2 transition-all ${
        allDone
          ? 'border-blue-300 bg-blue-50/50'
          : isExpanded
          ? 'border-blue-500 shadow-md'
          : 'border-gray-200'
      }`}
    >
      {/* Header - always visible */}
      <button
        type="button"
        onClick={onToggleExpand}
        className="w-full flex items-center justify-between p-4 text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold shrink-0 ${
              allDone
                ? 'bg-blue-500 text-white'
                : completedSets > 0
                ? 'bg-yellow-400 text-white'
                : 'bg-gray-200 text-gray-600'
            }`}
          >
            {allDone ? <CheckCircle className="h-4 w-4" /> : exerciseIndex + 1}
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-gray-900 truncate">{exercise.exercise_name}</h3>
            <p className="text-xs text-gray-500 capitalize">
              {exercise.exercise_category} • {completedSets}/{totalSets} sets
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {allDone && <CheckCircle className="h-5 w-5 text-blue-500" />}
          {isExpanded ? (
            <ChevronUp className="h-5 w-5 text-gray-400" />
          ) : (
            <ChevronDown className="h-5 w-5 text-gray-400" />
          )}
        </div>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-4">
          {/* Previous performance + PB */}
          {(lastEntry || personalBest) && (
            <div className="bg-gradient-to-r from-blue-50 to-blue-50 border border-blue-200 rounded-lg p-3">
              {lastEntry && (
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-blue-600" />
                    <span className="text-xs font-semibold text-gray-700">Last Session</span>
                  </div>
                  <span className="text-[11px] text-gray-500">
                    {new Date(lastEntry.date).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                </div>
              )}
              {lastEntry && (
                <div className="grid grid-cols-3 gap-2 mb-2">
                  <div className="bg-white rounded px-2 py-1 text-center border border-blue-100">
                    <p className="text-[10px] text-gray-500 uppercase">Max Wt</p>
                    <p className="text-sm font-bold text-gray-900">
                      {lastEntry.max_weight ? `${lastEntry.max_weight} lb` : '—'}
                    </p>
                  </div>
                  <div className="bg-white rounded px-2 py-1 text-center border border-blue-100">
                    <p className="text-[10px] text-gray-500 uppercase">Volume</p>
                    <p className="text-sm font-bold text-gray-900">
                      {lastEntry.total_volume || '—'}
                    </p>
                  </div>
                  <div className="bg-white rounded px-2 py-1 text-center border border-blue-100">
                    <p className="text-[10px] text-gray-500 uppercase">Avg RPE</p>
                    <p className="text-sm font-bold text-gray-900">
                      {lastEntry.avg_rpe ?? '—'}
                    </p>
                  </div>
                </div>
              )}
              {personalBest && personalBest.max_weight > 0 && (
                <div className="flex items-center gap-1.5 text-[11px] text-amber-700">
                  <Trophy className="h-3.5 w-3.5" />
                  <span>
                    PB: {personalBest.max_weight} lb
                    {personalBest.max_reps_single_set > 0 &&
                      ` • ${personalBest.max_reps_single_set} reps`}
                  </span>
                </div>
              )}
              <button
                onClick={onShowHistory}
                className="mt-2 text-xs text-blue-700 font-medium hover:underline flex items-center gap-1"
              >
                <History className="h-3 w-3" />
                View full history
              </button>
            </div>
          )}

          {/* ── Set rows ──────────────────────────────────────────── */}
          {/* Table header */}
          <div className="hidden sm:grid sm:grid-cols-[auto_1fr_1fr_1fr_1fr_auto] gap-2 px-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
            <div className="w-12">Set</div>
            <div>Reps</div>
            <div>Weight (lb)</div>
            <div>RPE</div>
            <div>Notes</div>
            <div className="w-12 text-center">✓</div>
          </div>

          {exercise.sets.map((set, setIdx) => {
            const isDuration = (set.prescribed_duration ?? 0) > 0 && !set.prescribed_reps;
            return (
              <div
                key={setIdx}
                className={`rounded-lg border p-3 transition-colors ${
                  set.completed
                    ? 'border-blue-300 bg-blue-50'
                    : 'border-gray-200 bg-white'
                }`}
              >
                <div className="flex items-center justify-between mb-2 sm:hidden">
                  <span className="text-xs font-bold text-gray-500">
                    Set {set.set_number}
                  </span>
                  <span className="text-[11px] text-gray-400">
                    {isDuration
                      ? `Target: ${set.prescribed_duration}s`
                      : `Target: ${set.prescribed_reps ?? '—'} reps${
                          set.prescribed_weight ? ` @ ${set.prescribed_weight} lb` : ''
                        }`}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-[auto_1fr_1fr_1fr_1fr_auto] gap-2 sm:gap-3 items-center">
                  {/* Set # (desktop) */}
                  <div className="hidden sm:flex items-center justify-center w-12">
                    <span className="text-sm font-bold text-gray-500">{set.set_number}</span>
                  </div>

                  {/* Reps / Duration */}
                  <div>
                    <label className="block text-[10px] font-medium text-gray-500 mb-0.5 sm:hidden">
                      {isDuration ? 'Duration (s)' : 'Reps'}
                    </label>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={isDuration ? (set.actual_duration ?? '') : (set.actual_reps ?? '')}
                      onChange={(e) => {
                        const v = e.target.value === '' ? null : parseInt(e.target.value);
                        onUpdateSet(
                          exerciseIndex,
                          setIdx,
                          isDuration ? 'actual_duration' : 'actual_reps',
                          v
                        );
                      }}
                      placeholder={
                        isDuration
                          ? `${set.prescribed_duration ?? ''}`
                          : `${set.prescribed_reps ?? ''}`
                      }
                      className="w-full px-2.5 py-2 min-h-[44px] text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  {/* Weight */}
                  {isDuration ? (
                    <div className="hidden sm:block" />
                  ) : (
                    <div>
                      <label className="block text-[10px] font-medium text-gray-500 mb-0.5 sm:hidden">
                        Weight (lb)
                      </label>
                      <input
                        type="number"
                        inputMode="decimal"
                        step="0.5"
                        value={set.actual_weight ?? ''}
                        onChange={(e) => {
                          const v = e.target.value === '' ? null : parseFloat(e.target.value);
                          onUpdateSet(exerciseIndex, setIdx, 'actual_weight', v);
                        }}
                        placeholder={set.prescribed_weight ? `${set.prescribed_weight}` : '—'}
                        className="w-full px-2.5 py-2 min-h-[44px] text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  )}

                  {/* RPE */}
                  <div>
                    <label className="block text-[10px] font-medium text-gray-500 mb-0.5 sm:hidden">
                      RPE (1-10)
                    </label>
                    <select
                      value={set.rpe ?? ''}
                      onChange={(e) => {
                        const v = e.target.value === '' ? null : parseInt(e.target.value);
                        onUpdateSet(exerciseIndex, setIdx, 'rpe', v);
                      }}
                      className="w-full px-2.5 py-2 min-h-[44px] text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                    >
                      <option value="">—</option>
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Set notes (hidden on mobile, shown inline on desktop) */}
                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-[10px] font-medium text-gray-500 mb-0.5 sm:hidden">
                      Set note
                    </label>
                    <input
                      type="text"
                      value={set.notes}
                      onChange={(e) =>
                        onUpdateSet(exerciseIndex, setIdx, 'notes', e.target.value)
                      }
                      placeholder="Note..."
                      className="w-full px-2.5 py-2 min-h-[44px] text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  {/* Complete checkbox */}
                  <div className="flex items-center justify-center w-full sm:w-12">
                    <button
                      type="button"
                      onClick={() => onToggleSetComplete(exerciseIndex, setIdx)}
                      className={`w-12 h-12 sm:w-10 sm:h-10 rounded-lg border-2 flex items-center justify-center transition-all touch-manipulation ${
                        set.completed
                          ? 'bg-blue-500 border-blue-500 text-white'
                          : 'border-gray-300 text-gray-300 hover:border-blue-400 hover:text-blue-400'
                      }`}
                      aria-label={set.completed ? 'Mark incomplete' : 'Mark complete'}
                    >
                      <Check className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Exercise notes */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Exercise Notes
            </label>
            <input
              type="text"
              value={exercise.notes}
              onChange={(e) => onUpdateNotes(exerciseIndex, e.target.value)}
              placeholder="How did this exercise feel?"
              className="w-full px-3 py-2 min-h-[44px] text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkoutLogView;
