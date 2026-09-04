/*
  # Fix workout_exercises RLS policies for client progress saving

  1. Security Updates
    - Add policy for clients to update their own workout exercise progress
    - Ensure clients can save progress data to workout_exercises.notes field
    - Maintain security while allowing necessary updates

  2. Changes
    - Add client update policy for workout_exercises table
    - Allow clients to update notes field for their assigned workouts
*/

-- Drop existing restrictive policies that might be blocking client updates
DROP POLICY IF EXISTS "Clients can update workout exercises for their workouts" ON workout_exercises;

-- Add comprehensive policy for clients to update their workout exercise progress
CREATE POLICY "Clients can update their workout exercise progress"
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

-- Ensure clients can also select their workout exercises (needed for the update to work)
DROP POLICY IF EXISTS "Clients can view their workout exercises" ON workout_exercises;
CREATE POLICY "Clients can view their workout exercises"
  ON workout_exercises
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workouts
      WHERE workouts.id = workout_exercises.workout_id 
        AND workouts.client_id = auth.uid()
    )
  );

-- Add admin policy for full access (if not already exists)
DROP POLICY IF EXISTS "Admin full access to workout_exercises" ON workout_exercises;
CREATE POLICY "Admin full access to workout_exercises"
  ON workout_exercises
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles admin_profile
      WHERE admin_profile.id = auth.uid() AND admin_profile.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles admin_profile
      WHERE admin_profile.id = auth.uid() AND admin_profile.role = 'admin'
    )
  );

-- Ensure coaches can also manage workout exercises for their assigned workouts
DROP POLICY IF EXISTS "Coaches can manage workout exercises for their workouts" ON workout_exercises;
CREATE POLICY "Coaches can manage workout exercises for their workouts"
  ON workout_exercises
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workouts
      WHERE workouts.id = workout_exercises.workout_id 
        AND workouts.coach_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workouts
      WHERE workouts.id = workout_exercises.workout_id 
        AND workouts.coach_id = auth.uid()
    )
  );