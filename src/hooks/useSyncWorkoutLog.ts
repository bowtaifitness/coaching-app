/**
 * useSyncWorkoutLog – bridge between the legacy workout_exercises.notes JSON
 * progress data and the new workout_logs / exercise_logs tables.
 *
 * Call `syncToWorkoutLog()` after a successful save to the legacy system.
 * It idempotently creates / updates the new rows so coach log views and
 * exercise history charts have data.
 */

import { useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';

interface SetProgress {
  completed?: boolean;
  reps?: number | null;
  weight?: number | null;
  duration?: number | null;
  rpe?: number | null;
}

interface ExerciseProgressData {
  completed?: boolean;
  actualSets?: number;
  actualReps?: number;
  actualWeight?: number;
  actualDuration?: number;
  notes?: string;
  difficulty?: string;
  setProgress?: SetProgress[];
}

interface WorkoutExerciseInfo {
  id: string;            // workout_exercise.id
  exercise_id: string;
  sets: number | null;
  reps: number | null;
  weight: number | null;
  duration: number | null;
}

interface SyncOptions {
  workoutId: string;
  clientId: string;
  workoutExercises: WorkoutExerciseInfo[];
  progressMap: Record<string, ExerciseProgressData>;
  allCompleted: boolean;
}

export function useSyncWorkoutLog() {
  const logIdRef = useRef<string | null>(null);

  const syncToWorkoutLog = useCallback(async (opts: SyncOptions) => {
    const { workoutId, clientId, workoutExercises, progressMap, allCompleted } = opts;

    try {
      // 1. Upsert workout_log
      let logId = logIdRef.current;

      if (!logId) {
        // Check if a log already exists for this workout
        const { data: existing } = await supabase
          .from('workout_logs')
          .select('id')
          .eq('workout_id', workoutId)
          .eq('client_id', clientId)
          .limit(1)
          .maybeSingle();

        logId = existing?.id ?? null;
      }

      const status = allCompleted ? 'completed' : 
        workoutExercises.some(we => {
          const p = progressMap[we.id];
          return p?.completed || p?.setProgress?.some(s => s?.completed || (s?.reps != null) || (s?.weight != null));
        }) ? 'partial' : 'in_progress';

      if (logId) {
        await supabase
          .from('workout_logs')
          .update({
            status,
            completed_at: allCompleted ? new Date().toISOString() : null,
          })
          .eq('id', logId);
      } else {
        const { data: newLog } = await supabase
          .from('workout_logs')
          .insert({
            client_id: clientId,
            workout_id: workoutId,
            status,
            started_at: new Date().toISOString(),
            completed_at: allCompleted ? new Date().toISOString() : null,
          })
          .select('id')
          .single();

        logId = newLog?.id ?? null;
      }

      if (!logId) return;
      logIdRef.current = logId;

      // 2. Delete + re-insert exercise_logs (idempotent)
      await supabase
        .from('exercise_logs')
        .delete()
        .eq('workout_log_id', logId);

      const rows: Array<Record<string, unknown>> = [];

      for (const we of workoutExercises) {
        const progress = progressMap[we.id];
        if (!progress) continue;

        const numSets = we.sets || 1;
        const setProgress = progress.setProgress || [];

        for (let i = 0; i < numSets; i++) {
          const sp = setProgress[i];
          rows.push({
            workout_log_id: logId,
            exercise_id: we.exercise_id,
            workout_exercise_id: we.id,
            set_number: i + 1,
            prescribed_reps: we.reps,
            prescribed_weight: we.weight,
            prescribed_duration: we.duration,
            actual_reps: sp?.reps ?? null,
            actual_weight: sp?.weight ?? null,
            actual_duration: sp?.duration ?? null,
            rpe: sp?.rpe ?? null,
            completed: sp?.completed ?? false,
            notes: null,
          });
        }
      }

      if (rows.length > 0) {
        await supabase.from('exercise_logs').insert(rows);
      }
    } catch (err) {
      // Non-critical: log but don't break the main save flow
      console.error('useSyncWorkoutLog: sync error (non-fatal):', err);
    }
  }, []);

  return { syncToWorkoutLog };
}
