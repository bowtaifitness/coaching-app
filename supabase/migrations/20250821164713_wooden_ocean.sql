/*
  # Add RLS policies for workout_exercises table

  1. Security
    - Add policy for coaches to insert workout exercises for their own workouts
    - Add policy for users to view workout exercises for workouts they have access to
    - Add policy for coaches to update workout exercises for their own workouts
    - Add policy for coaches to delete workout exercises for their own workouts

  This fixes the RLS violation error when creating workouts with exercises.
*/

-- Policy for inserting workout exercises (coaches can add exercises to their own workouts)
CREATE POLICY "Coaches can insert workout exercises for their workouts"
  ON workout_exercises
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workouts 
      WHERE workouts.id = workout_exercises.workout_id 
      AND workouts.coach_id = auth.uid()
    )
  );

-- Policy for selecting workout exercises (users can view exercises for workouts they have access to)
CREATE POLICY "Users can view workout exercises for accessible workouts"
  ON workout_exercises
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workouts 
      WHERE workouts.id = workout_exercises.workout_id 
      AND (workouts.coach_id = auth.uid() OR workouts.client_id = auth.uid())
    )
  );

-- Policy for updating workout exercises (coaches can update exercises for their own workouts)
CREATE POLICY "Coaches can update workout exercises for their workouts"
  ON workout_exercises
  FOR UPDATE
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

-- Policy for deleting workout exercises (coaches can delete exercises from their own workouts)
CREATE POLICY "Coaches can delete workout exercises from their workouts"
  ON workout_exercises
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workouts 
      WHERE workouts.id = workout_exercises.workout_id 
      AND workouts.coach_id = auth.uid()
    )
  );