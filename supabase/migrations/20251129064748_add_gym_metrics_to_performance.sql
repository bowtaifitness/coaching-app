/*
  # Add Gym Performance Metrics

  1. Changes
    - Add gym-related performance metrics columns to performance_metrics table
    - Includes max rep exercises (push-ups, sit-ups, pull-ups)
    - Includes max weight exercises (squat, bench press, deadlift)
    - Includes cardio metrics (mile time)
  
  2. New Columns
    - max_pushups: integer - Maximum consecutive push-ups
    - max_situps: integer - Maximum consecutive sit-ups
    - max_pullups: integer - Maximum consecutive pull-ups
    - max_squat: numeric - Maximum squat weight in lbs
    - max_bench: numeric - Maximum bench press weight in lbs
    - max_deadlift: numeric - Maximum deadlift weight in lbs
    - mile_time: integer - Mile run time in seconds
  
  3. Notes
    - All columns are nullable to allow tracking golf or gym metrics independently
    - Existing golf metrics remain unchanged
*/

-- Add gym metrics columns to performance_metrics table
DO $$
BEGIN
  -- Max rep exercises
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'performance_metrics' AND column_name = 'max_pushups'
  ) THEN
    ALTER TABLE performance_metrics ADD COLUMN max_pushups integer;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'performance_metrics' AND column_name = 'max_situps'
  ) THEN
    ALTER TABLE performance_metrics ADD COLUMN max_situps integer;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'performance_metrics' AND column_name = 'max_pullups'
  ) THEN
    ALTER TABLE performance_metrics ADD COLUMN max_pullups integer;
  END IF;

  -- Max weight exercises
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'performance_metrics' AND column_name = 'max_squat'
  ) THEN
    ALTER TABLE performance_metrics ADD COLUMN max_squat numeric;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'performance_metrics' AND column_name = 'max_bench'
  ) THEN
    ALTER TABLE performance_metrics ADD COLUMN max_bench numeric;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'performance_metrics' AND column_name = 'max_deadlift'
  ) THEN
    ALTER TABLE performance_metrics ADD COLUMN max_deadlift numeric;
  END IF;

  -- Cardio metrics
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'performance_metrics' AND column_name = 'mile_time'
  ) THEN
    ALTER TABLE performance_metrics ADD COLUMN mile_time integer;
  END IF;
END $$;
