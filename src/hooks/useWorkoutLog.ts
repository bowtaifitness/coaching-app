import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type {
  WorkoutLog,
  ExerciseLog,
  WorkoutLogState,
  ExerciseLogState,
  SetLogEntry,
  WorkoutLogStatus,
} from '../types/workoutLog';

const AUTOSAVE_DELAY_MS = 1500;

interface WorkoutExerciseRow {
  id: string;
  exercise_id: string;
  sets: number | null;
  reps: number | null;
  weight: number | null;
  duration: number | null;
  order_index: number | null;
  exercise: {
    id: string;
    name: string;
    category: string;
  };
}

interface UseWorkoutLogOptions {
  workoutId: string;
  clientId: string;
  enabled?: boolean;
}

interface UseWorkoutLogReturn {
  logState: WorkoutLogState | null;
  loading: boolean;
  saving: boolean;
  lastSavedAt: string | null;
  error: string | null;
  updateSet: (exerciseIndex: number, setIndex: number, field: keyof SetLogEntry, value: unknown) => void;
  toggleSetComplete: (exerciseIndex: number, setIndex: number) => void;
  updateExerciseNotes: (exerciseIndex: number, notes: string) => void;
  updateOverallNotes: (notes: string) => void;
  markWorkoutComplete: () => Promise<void>;
  saveNow: () => Promise<void>;
}

export function useWorkoutLog({ workoutId, clientId, enabled = true }: UseWorkoutLogOptions): UseWorkoutLogReturn {
  const [logState, setLogState] = useState<WorkoutLogState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logStateRef = useRef<WorkoutLogState | null>(null);
  const isMountedRef = useRef(true);

  // Keep ref in sync
  useEffect(() => {
    logStateRef.current = logState;
  }, [logState]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // ── Load or initialize ──────────────────────────────────────────────
  useEffect(() => {
    if (!enabled || !workoutId || !clientId) return;

    const init = async () => {
      try {
        setLoading(true);
        setError(null);

        // 1. Fetch workout exercises (prescribed)
        const { data: weRows, error: weErr } = await supabase
          .from('workout_exercises')
          .select(`
            id, exercise_id, sets, reps, weight, duration, order_index,
            exercise:exercises(id, name, category)
          `)
          .eq('workout_id', workoutId)
          .order('order_index');

        if (weErr) throw weErr;
        const workoutExercises = (weRows || []) as unknown as WorkoutExerciseRow[];

        // 2. Check for existing workout_log
        const { data: existingLogs, error: logErr } = await supabase
          .from('workout_logs')
          .select('*')
          .eq('workout_id', workoutId)
          .eq('client_id', clientId)
          .order('created_at', { ascending: false })
          .limit(1);

        if (logErr) throw logErr;
        const existingLog = existingLogs?.[0] as WorkoutLog | undefined;

        let exerciseLogs: ExerciseLog[] = [];
        if (existingLog) {
          const { data: elRows, error: elErr } = await supabase
            .from('exercise_logs')
            .select('*')
            .eq('workout_log_id', existingLog.id)
            .order('created_at');
          if (elErr) throw elErr;
          exerciseLogs = (elRows || []) as ExerciseLog[];
        }

        // 3. Build state
        const exercises: ExerciseLogState[] = workoutExercises.map((we) => {
          const numSets = we.sets || 1;
          const matchingLogs = exerciseLogs.filter(
            (el) => el.workout_exercise_id === we.id || el.exercise_id === we.exercise_id
          );

          const sets: SetLogEntry[] = Array.from({ length: numSets }, (_, i) => {
            const logged = matchingLogs.find((el) => el.set_number === i + 1);
            return {
              set_number: i + 1,
              prescribed_reps: we.reps,
              prescribed_weight: we.weight,
              prescribed_duration: we.duration,
              actual_reps: logged?.actual_reps ?? null,
              actual_weight: logged?.actual_weight ?? null,
              actual_duration: logged?.actual_duration ?? null,
              rpe: logged?.rpe ?? null,
              completed: logged?.completed ?? false,
              notes: logged?.notes ?? '',
            };
          });

          return {
            exercise_id: we.exercise_id,
            workout_exercise_id: we.id,
            exercise_name: we.exercise?.name ?? 'Unknown Exercise',
            exercise_category: we.exercise?.category ?? '',
            sets,
            notes: matchingLogs.find((el) => el.notes)?.notes ?? '',
            all_sets_completed: sets.every((s) => s.completed),
          };
        });

        if (isMountedRef.current) {
          setLogState({
            workout_log_id: existingLog?.id ?? null,
            workout_id: workoutId,
            status: existingLog?.status as WorkoutLogStatus ?? 'in_progress',
            started_at: existingLog?.started_at ?? new Date().toISOString(),
            duration_seconds: existingLog?.duration_seconds ?? 0,
            overall_notes: existingLog?.overall_notes ?? '',
            exercises,
          });
          if (existingLog) {
            setLastSavedAt(existingLog.updated_at);
          }
        }
      } catch (err: unknown) {
        console.error('useWorkoutLog init error:', err);
        if (isMountedRef.current) {
          setError(err instanceof Error ? err.message : 'Failed to load workout log');
        }
      } finally {
        if (isMountedRef.current) setLoading(false);
      }
    };

    init();
  }, [workoutId, clientId, enabled]);

  // ── Debounced auto-save ─────────────────────────────────────────────
  const scheduleSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      persistState(logStateRef.current);
    }, AUTOSAVE_DELAY_MS);
  }, []);

  // Save on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      persistState(logStateRef.current);
    };
  }, []);

  // ── Persist ─────────────────────────────────────────────────────────
  const persistState = async (state: WorkoutLogState | null) => {
    if (!state || !clientId) return;
    // Only save if there's meaningful data
    const hasData = state.exercises.some((ex) =>
      ex.sets.some((s) => s.actual_reps !== null || s.actual_weight !== null || s.actual_duration !== null || s.completed)
    );
    if (!hasData && !state.overall_notes && state.status === 'in_progress') return;

    try {
      if (isMountedRef.current) setSaving(true);

      let logId = state.workout_log_id;

      // Upsert workout_log
      if (logId) {
        const { error: upErr } = await supabase
          .from('workout_logs')
          .update({
            status: state.status,
            duration_seconds: state.duration_seconds,
            overall_notes: state.overall_notes || null,
            completed_at: state.status === 'completed' ? new Date().toISOString() : null,
          })
          .eq('id', logId);
        if (upErr) throw upErr;
      } else {
        const { data: newLog, error: insErr } = await supabase
          .from('workout_logs')
          .insert({
            client_id: clientId,
            workout_id: state.workout_id,
            status: state.status,
            started_at: state.started_at,
            duration_seconds: state.duration_seconds,
            overall_notes: state.overall_notes || null,
          })
          .select('id')
          .single();
        if (insErr) throw insErr;
        logId = newLog.id;
        // Update state with the new log ID
        if (isMountedRef.current) {
          setLogState((prev) => prev ? { ...prev, workout_log_id: logId! } : prev);
        }
        if (logStateRef.current) {
          logStateRef.current = { ...logStateRef.current, workout_log_id: logId! };
        }
      }

      // Delete existing exercise_logs and re-insert (simpler than individual upserts)
      const { error: delErr } = await supabase
        .from('exercise_logs')
        .delete()
        .eq('workout_log_id', logId!);
      if (delErr) throw delErr;

      const rows = state.exercises.flatMap((ex) =>
        ex.sets.map((s) => ({
          workout_log_id: logId!,
          exercise_id: ex.exercise_id,
          workout_exercise_id: ex.workout_exercise_id,
          set_number: s.set_number,
          prescribed_reps: s.prescribed_reps,
          prescribed_weight: s.prescribed_weight,
          prescribed_duration: s.prescribed_duration,
          actual_reps: s.actual_reps,
          actual_weight: s.actual_weight,
          actual_duration: s.actual_duration,
          rpe: s.rpe,
          completed: s.completed,
          notes: s.notes || null,
        }))
      );

      if (rows.length > 0) {
        const { error: insErr } = await supabase.from('exercise_logs').insert(rows);
        if (insErr) throw insErr;
      }

      const now = new Date().toISOString();
      if (isMountedRef.current) {
        setLastSavedAt(now);
        setError(null);
      }
    } catch (err: unknown) {
      console.error('useWorkoutLog save error:', err);
      if (isMountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to save');
      }
    } finally {
      if (isMountedRef.current) setSaving(false);
    }
  };

  // ── Mutators ────────────────────────────────────────────────────────

  const updateSet = useCallback(
    (exerciseIndex: number, setIndex: number, field: keyof SetLogEntry, value: unknown) => {
      setLogState((prev) => {
        if (!prev) return prev;
        const exercises = [...prev.exercises];
        const ex = { ...exercises[exerciseIndex] };
        const sets = [...ex.sets];
        sets[setIndex] = { ...sets[setIndex], [field]: value };
        ex.sets = sets;
        ex.all_sets_completed = sets.every((s) => s.completed);
        exercises[exerciseIndex] = ex;
        return { ...prev, exercises };
      });
      scheduleSave();
    },
    [scheduleSave]
  );

  const toggleSetComplete = useCallback(
    (exerciseIndex: number, setIndex: number) => {
      setLogState((prev) => {
        if (!prev) return prev;
        const exercises = [...prev.exercises];
        const ex = { ...exercises[exerciseIndex] };
        const sets = [...ex.sets];
        sets[setIndex] = { ...sets[setIndex], completed: !sets[setIndex].completed };
        ex.sets = sets;
        ex.all_sets_completed = sets.every((s) => s.completed);
        exercises[exerciseIndex] = ex;
        return { ...prev, exercises };
      });
      scheduleSave();
    },
    [scheduleSave]
  );

  const updateExerciseNotes = useCallback(
    (exerciseIndex: number, notes: string) => {
      setLogState((prev) => {
        if (!prev) return prev;
        const exercises = [...prev.exercises];
        exercises[exerciseIndex] = { ...exercises[exerciseIndex], notes };
        return { ...prev, exercises };
      });
      scheduleSave();
    },
    [scheduleSave]
  );

  const updateOverallNotes = useCallback(
    (notes: string) => {
      setLogState((prev) => (prev ? { ...prev, overall_notes: notes } : prev));
      scheduleSave();
    },
    [scheduleSave]
  );

  const markWorkoutComplete = useCallback(async () => {
    setLogState((prev) => (prev ? { ...prev, status: 'completed' as WorkoutLogStatus } : prev));
    // Force immediate save
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    const state = logStateRef.current;
    if (state) {
      await persistState({ ...state, status: 'completed' });
    }
    // Also mark the workout itself as completed
    if (logStateRef.current?.workout_id) {
      await supabase
        .from('workouts')
        .update({ completed: true })
        .eq('id', logStateRef.current.workout_id);
    }
  }, []);

  const saveNow = useCallback(async () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    await persistState(logStateRef.current);
  }, []);

  return {
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
  };
}
