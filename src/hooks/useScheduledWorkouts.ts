import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export interface ScheduledWorkout {
  id: string;
  workout_template_id: string | null;
  client_id: string;
  coach_id: string;
  scheduled_date: string;
  status: 'scheduled' | 'in_progress' | 'completed' | 'skipped';
  title: string;
  notes: string | null;
  copied_from_id: string | null;
  created_at: string;
  updated_at: string;
  exercises?: ScheduledWorkoutExercise[];
}

export interface ScheduledWorkoutExercise {
  id: string;
  scheduled_workout_id: string;
  exercise_id: string;
  sets: number | null;
  reps: number | null;
  weight: number | null;
  duration: number | null;
  notes: string | null;
  order_index: number;
  superset_group: number | null;
  exercise?: {
    id: string;
    name: string;
    category: string;
  };
}

export const useScheduledWorkouts = (clientId: string | null, dateRange?: { start: string; end: string }) => {
  const { user } = useAuth();
  const [scheduledWorkouts, setScheduledWorkouts] = useState<ScheduledWorkout[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchScheduledWorkouts = useCallback(async () => {
    if (!clientId || !user) return;

    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('scheduled_workouts')
        .select(`
          *,
          exercises:scheduled_workout_exercises(
            id, scheduled_workout_id, exercise_id, sets, reps, weight, duration, notes, order_index, superset_group,
            exercise:exercises(id, name, category)
          )
        `)
        .eq('client_id', clientId)
        .order('scheduled_date', { ascending: true });

      if (dateRange) {
        query = query.gte('scheduled_date', dateRange.start).lte('scheduled_date', dateRange.end);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;
      setScheduledWorkouts(data || []);
    } catch (err: any) {
      console.error('Error fetching scheduled workouts:', err);
      setError(err.message || 'Failed to fetch scheduled workouts');
    } finally {
      setLoading(false);
    }
  }, [clientId, user, dateRange?.start, dateRange?.end]);

  useEffect(() => {
    fetchScheduledWorkouts();
  }, [fetchScheduledWorkouts]);

  const scheduleWorkout = async (data: {
    workout_template_id?: string;
    client_id: string;
    scheduled_date: string;
    title: string;
    notes?: string;
    exercises?: Array<{
      exercise_id: string;
      sets?: number;
      reps?: number;
      weight?: number;
      duration?: number;
      notes?: string;
      order_index: number;
      superset_group?: number;
    }>;
  }) => {
    if (!user) throw new Error('Not authenticated');

    const { data: workout, error: insertError } = await supabase
      .from('scheduled_workouts')
      .insert([{
        workout_template_id: data.workout_template_id || null,
        client_id: data.client_id,
        coach_id: user.id,
        scheduled_date: data.scheduled_date,
        title: data.title,
        notes: data.notes || null,
        status: 'scheduled',
      }])
      .select()
      .single();

    if (insertError) throw insertError;

    // Insert exercises if provided
    if (data.exercises && data.exercises.length > 0) {
      const exerciseRows = data.exercises.map(ex => ({
        scheduled_workout_id: workout.id,
        exercise_id: ex.exercise_id,
        sets: ex.sets ?? null,
        reps: ex.reps ?? null,
        weight: ex.weight ?? null,
        duration: ex.duration ?? null,
        notes: ex.notes ?? null,
        order_index: ex.order_index,
        superset_group: ex.superset_group ?? null,
      }));

      const { error: exError } = await supabase
        .from('scheduled_workout_exercises')
        .insert(exerciseRows);

      if (exError) throw exError;
    }

    await fetchScheduledWorkouts();
    return workout;
  };

  const scheduleFromTemplate = async (templateId: string, clientId: string, scheduledDate: string, notes?: string) => {
    if (!user) throw new Error('Not authenticated');

    // Fetch template with exercises
    const { data: template, error: templateError } = await supabase
      .from('workout_templates')
      .select(`
        id, title, description,
        template_exercises(
          exercise_id, sets, reps, weight, duration, notes, order_index, superset_group
        )
      `)
      .eq('id', templateId)
      .single();

    if (templateError) throw templateError;

    return scheduleWorkout({
      workout_template_id: templateId,
      client_id: clientId,
      scheduled_date: scheduledDate,
      title: template.title,
      notes: notes || template.description || undefined,
      exercises: template.template_exercises?.map((ex: any, i: number) => ({
        exercise_id: ex.exercise_id,
        sets: ex.sets,
        reps: ex.reps,
        weight: ex.weight,
        duration: ex.duration,
        notes: ex.notes,
        order_index: ex.order_index ?? i,
        superset_group: ex.superset_group,
      })),
    });
  };

  const moveWorkout = async (workoutId: string, newDate: string) => {
    const { error: updateError } = await supabase
      .from('scheduled_workouts')
      .update({ scheduled_date: newDate })
      .eq('id', workoutId);

    if (updateError) throw updateError;
    await fetchScheduledWorkouts();
  };

  const updateStatus = async (workoutId: string, status: ScheduledWorkout['status']) => {
    const { error: updateError } = await supabase
      .from('scheduled_workouts')
      .update({ status })
      .eq('id', workoutId);

    if (updateError) throw updateError;
    await fetchScheduledWorkouts();
  };

  const deleteScheduledWorkout = async (workoutId: string) => {
    const { error: deleteError } = await supabase
      .from('scheduled_workouts')
      .delete()
      .eq('id', workoutId);

    if (deleteError) throw deleteError;
    await fetchScheduledWorkouts();
  };

  const copyWorkout = async (workoutId: string, targetClientIds: string[], targetDate: string) => {
    if (!user) throw new Error('Not authenticated');

    // Fetch the source workout with exercises
    const { data: source, error: sourceError } = await supabase
      .from('scheduled_workouts')
      .select(`
        *,
        exercises:scheduled_workout_exercises(
          exercise_id, sets, reps, weight, duration, notes, order_index, superset_group
        )
      `)
      .eq('id', workoutId)
      .single();

    if (sourceError) throw sourceError;

    const results = await Promise.all(
      targetClientIds.map(async (cid) => {
        const { data: newWorkout, error: insertError } = await supabase
          .from('scheduled_workouts')
          .insert([{
            workout_template_id: source.workout_template_id,
            client_id: cid,
            coach_id: user.id,
            scheduled_date: targetDate,
            title: source.title,
            notes: source.notes,
            status: 'scheduled',
            copied_from_id: workoutId,
          }])
          .select()
          .single();

        if (insertError) throw insertError;

        if (source.exercises && source.exercises.length > 0) {
          const exerciseRows = source.exercises.map((ex: any) => ({
            scheduled_workout_id: newWorkout.id,
            exercise_id: ex.exercise_id,
            sets: ex.sets,
            reps: ex.reps,
            weight: ex.weight,
            duration: ex.duration,
            notes: ex.notes,
            order_index: ex.order_index,
            superset_group: ex.superset_group,
          }));

          const { error: exError } = await supabase
            .from('scheduled_workout_exercises')
            .insert(exerciseRows);

          if (exError) throw exError;
        }

        return newWorkout;
      })
    );

    await fetchScheduledWorkouts();
    return results;
  };

  const copyWeek = async (
    sourceClientId: string,
    sourceWeekStart: string,
    targetClientIds: string[],
    targetWeekStart: string
  ) => {
    if (!user) throw new Error('Not authenticated');

    // Calculate source week range (7 days from start)
    const sourceStart = new Date(sourceWeekStart);
    const sourceEnd = new Date(sourceStart);
    sourceEnd.setDate(sourceEnd.getDate() + 6);

    // Fetch all workouts for the source week
    const { data: sourceWorkouts, error: fetchError } = await supabase
      .from('scheduled_workouts')
      .select(`
        *,
        exercises:scheduled_workout_exercises(
          exercise_id, sets, reps, weight, duration, notes, order_index, superset_group
        )
      `)
      .eq('client_id', sourceClientId)
      .gte('scheduled_date', sourceWeekStart)
      .lte('scheduled_date', sourceEnd.toISOString().split('T')[0])
      .order('scheduled_date', { ascending: true });

    if (fetchError) throw fetchError;
    if (!sourceWorkouts || sourceWorkouts.length === 0) return [];

    const targetStart = new Date(targetWeekStart);
    let totalCopied = 0;

    for (const clientId of targetClientIds) {
      for (const workout of sourceWorkouts) {
        // Calculate day offset from source week start
        const workoutDate = new Date(workout.scheduled_date);
        const dayOffset = Math.round((workoutDate.getTime() - sourceStart.getTime()) / (1000 * 60 * 60 * 24));
        const newDate = new Date(targetStart);
        newDate.setDate(newDate.getDate() + dayOffset);

        const { data: newWorkout, error: insertError } = await supabase
          .from('scheduled_workouts')
          .insert([{
            workout_template_id: workout.workout_template_id,
            client_id: clientId,
            coach_id: user.id,
            scheduled_date: newDate.toISOString().split('T')[0],
            title: workout.title,
            notes: workout.notes,
            status: 'scheduled',
            copied_from_id: workout.id,
          }])
          .select()
          .single();

        if (insertError) throw insertError;

        if (workout.exercises && workout.exercises.length > 0) {
          const exerciseRows = workout.exercises.map((ex: any) => ({
            scheduled_workout_id: newWorkout.id,
            exercise_id: ex.exercise_id,
            sets: ex.sets,
            reps: ex.reps,
            weight: ex.weight,
            duration: ex.duration,
            notes: ex.notes,
            order_index: ex.order_index,
            superset_group: ex.superset_group,
          }));

          await supabase.from('scheduled_workout_exercises').insert(exerciseRows);
        }

        totalCopied++;
      }
    }

    await fetchScheduledWorkouts();
    return totalCopied;
  };

  return {
    scheduledWorkouts,
    loading,
    error,
    refresh: fetchScheduledWorkouts,
    scheduleWorkout,
    scheduleFromTemplate,
    moveWorkout,
    updateStatus,
    deleteScheduledWorkout,
    copyWorkout,
    copyWeek,
  };
};
