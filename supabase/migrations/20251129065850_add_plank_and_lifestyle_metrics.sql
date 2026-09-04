/*
  # Add Plank Time and Lifestyle Metrics

  1. Changes
    - Add plank_time to gym metrics (stored in seconds)
    - Add lifestyle metrics columns to performance_metrics table
  
  2. New Columns
    - plank_time: integer - Maximum plank hold time in seconds
    - weight: numeric - Body weight in lbs
    - body_fat_percentage: numeric - Body fat percentage
    - resting_heart_rate: integer - Resting heart rate in bpm
    - vo2_max: numeric - VO2 max measurement
    - sleep_hours: numeric - Average sleep hours per night
  
  3. Notes
    - All columns are nullable to allow tracking different metrics independently
    - Existing golf and gym metrics remain unchanged
*/

-- Add plank time to gym metrics
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'performance_metrics' AND column_name = 'plank_time'
  ) THEN
    ALTER TABLE performance_metrics ADD COLUMN plank_time integer;
  END IF;
END $$;

-- Add lifestyle metrics
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'performance_metrics' AND column_name = 'weight'
  ) THEN
    ALTER TABLE performance_metrics ADD COLUMN weight numeric;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'performance_metrics' AND column_name = 'body_fat_percentage'
  ) THEN
    ALTER TABLE performance_metrics ADD COLUMN body_fat_percentage numeric;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'performance_metrics' AND column_name = 'resting_heart_rate'
  ) THEN
    ALTER TABLE performance_metrics ADD COLUMN resting_heart_rate integer;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'performance_metrics' AND column_name = 'vo2_max'
  ) THEN
    ALTER TABLE performance_metrics ADD COLUMN vo2_max numeric;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'performance_metrics' AND column_name = 'sleep_hours'
  ) THEN
    ALTER TABLE performance_metrics ADD COLUMN sleep_hours numeric;
  END IF;
END $$;
