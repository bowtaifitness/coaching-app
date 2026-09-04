/*
  # Add Equipment Tagging to Exercises

  ## Overview
  Adds an `equipment` array column to the exercises table so that each exercise can
  be tagged with the equipment required to perform it (e.g., barbell, dumbbell, cable).
  This is used to display equipment information in the Exercise Library and to filter
  exercises by available equipment when generating workout programs.

  ## Changes
  1. New Columns
    - `exercises.equipment` (text[]) — array of equipment tags such as
      `barbell`, `dumbbell`, `kettlebell`, `cable`, `bands`, `bodyweight`,
      `machine`, `med_ball`, `trx`. Defaults to an empty array so existing
      rows remain valid and no data is lost.

  ## Security
  - No RLS changes. Existing policies on `exercises` continue to apply.

  ## Notes
  1. Backwards Compatible: Column has a default of `'{}'` so existing rows are unaffected.
  2. Idempotent: Uses IF NOT EXISTS guard so re-running this migration is safe.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'exercises' AND column_name = 'equipment'
  ) THEN
    ALTER TABLE exercises ADD COLUMN equipment text[] DEFAULT '{}'::text[];
  END IF;
END $$;
