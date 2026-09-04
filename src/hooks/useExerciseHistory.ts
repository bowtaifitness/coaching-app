import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { ExerciseHistoryEntry, ExercisePersonalBest } from '../types/workoutLog';

interface UseExerciseHistoryOptions {
  exerciseId: string;
  clientId: string;
  enabled?: boolean;
}

interface UseExerciseHistoryReturn {
  history: ExerciseHistoryEntry[];
  personalBest: ExercisePersonalBest | null;
  loading: boolean;
  error: string | null;
}

export function useExerciseHistory({
  exerciseId,
  clientId,
  enabled = true,
}: UseExerciseHistoryOptions): UseExerciseHistoryReturn {
  const [history, setHistory] = useState<ExerciseHistoryEntry[]>([]);
  const [personalBest, setPersonalBest] = useState<ExercisePersonalBest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !exerciseId || !clientId) {
      setLoading(false);
      return;
    }

    const fetch = async () => {
      try {
        setLoading(true);
        setError(null);

        // Get exercise name for display
        const { data: exerciseData } = await supabase
          .from('exercises')
          .select('name')
          .eq('id', exerciseId)
          .maybeSingle();

        // Fetch from exercise_logs joined with workout_logs
        const { data: logRows, error: logErr } = await supabase
          .from('exercise_logs')
          .select(`
            set_number,
            actual_reps,
            actual_weight,
            actual_duration,
            rpe,
            completed,
            created_at,
            workout_log:workout_logs!inner(
              id,
              client_id,
              started_at,
              status,
              workout:workouts(title, scheduled_date)
            )
          `)
          .eq('exercise_id', exerciseId)
          .eq('workout_logs.client_id', clientId)
          .order('created_at', { ascending: false });

        if (logErr) throw logErr;

        // Group by workout_log_id
        const grouped = new Map<string, {
          date: string;
          title: string;
          sets: Array<{
            set_number: number;
            actual_reps: number | null;
            actual_weight: number | null;
            actual_duration: number | null;
            rpe: number | null;
          }>;
        }>();

        for (const row of logRows || []) {
          const wl = row.workout_log as any;
          const logId = wl.id;
          if (!grouped.has(logId)) {
            grouped.set(logId, {
              date: wl.workout?.scheduled_date || wl.started_at,
              title: wl.workout?.title || 'Workout',
              sets: [],
            });
          }
          grouped.get(logId)!.sets.push({
            set_number: row.set_number,
            actual_reps: row.actual_reps,
            actual_weight: row.actual_weight,
            actual_duration: row.actual_duration,
            rpe: row.rpe,
          });
        }

        // Build history entries
        const entries: ExerciseHistoryEntry[] = [];
        let bestWeight = 0;
        let bestReps = 0;
        let bestVolume = 0;
        let bestDate = '';

        for (const [, group] of grouped) {
          const sortedSets = group.sets.sort((a, b) => a.set_number - b.set_number);
          let maxWeight = 0;
          let totalVolume = 0;
          let rpeSum = 0;
          let rpeCount = 0;

          for (const s of sortedSets) {
            const w = s.actual_weight ?? 0;
            const r = s.actual_reps ?? 0;
            if (w > maxWeight) maxWeight = w;
            totalVolume += w * r;
            if (r > bestReps) bestReps = r;
            if (s.rpe !== null) {
              rpeSum += s.rpe;
              rpeCount++;
            }
          }

          if (maxWeight > bestWeight) {
            bestWeight = maxWeight;
            bestDate = group.date;
          }
          if (totalVolume > bestVolume) bestVolume = totalVolume;

          entries.push({
            date: group.date,
            workout_title: group.title,
            sets: sortedSets,
            max_weight: maxWeight,
            total_volume: totalVolume,
            avg_rpe: rpeCount > 0 ? Math.round((rpeSum / rpeCount) * 10) / 10 : null,
          });
        }

        // Sort chronologically (oldest first for charts)
        entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        setHistory(entries);

        if (entries.length > 0) {
          setPersonalBest({
            exercise_id: exerciseId,
            exercise_name: exerciseData?.name ?? 'Unknown',
            max_weight: bestWeight,
            max_reps_single_set: bestReps,
            max_volume_session: bestVolume,
            achieved_at: bestDate,
          });
        } else {
          setPersonalBest(null);
        }
      } catch (err: unknown) {
        console.error('useExerciseHistory error:', err);
        setError(err instanceof Error ? err.message : 'Failed to load history');
      } finally {
        setLoading(false);
      }
    };

    fetch();
  }, [exerciseId, clientId, enabled]);

  return { history, personalBest, loading, error };
}
