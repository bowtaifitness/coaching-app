/*
  # Allow clients to insert workout exercises for their own workouts

  1. Changes
    - Add INSERT policy on workout_exercises table to allow clients to create exercises for their own workouts
  
  2. Security
    - Clients can only insert workout exercises for workouts assigned to them (client_id = auth.uid())
    - This allows clients to start workouts from standard programs
*/

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'workout_exercises' 
    AND policyname = 'Clients can insert exercises for own workouts'
  ) THEN
    CREATE POLICY "Clients can insert exercises for own workouts"
      ON workout_exercises
      FOR INSERT
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM workouts
          WHERE workouts.id = workout_exercises.workout_id
          AND workouts.client_id = auth.uid()
        )
      );
  END IF;
END $$;
