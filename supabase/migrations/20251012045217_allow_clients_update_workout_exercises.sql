/*
  # Allow Clients to Update Workout Exercise Progress

  1. Overview
    - Add UPDATE policy on workout_exercises table to allow clients to update their own workout exercises
    - This enables clients to save progress (reps, weight, notes) during workout execution

  2. Changes
    - Create "Clients can update exercises for own workouts" policy
    - Allows clients to update workout_exercises for workouts assigned to them

  3. Security
    - Clients can only update workout exercises for workouts where client_id = auth.uid()
    - Maintains data integrity by restricting updates to their own workouts only
*/

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'workout_exercises' 
    AND policyname = 'Clients can update exercises for own workouts'
  ) THEN
    CREATE POLICY "Clients can update exercises for own workouts"
      ON workout_exercises
      FOR UPDATE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM workouts
          WHERE workouts.id = workout_exercises.workout_id
          AND workouts.client_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM workouts
          WHERE workouts.id = workout_exercises.workout_id
          AND workouts.client_id = auth.uid()
        )
      );
  END IF;
END $$;
