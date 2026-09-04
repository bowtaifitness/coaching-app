/*
  # Add archived column to workout_programs

  1. Modified Tables
    - `workout_programs`
      - Added `archived` (boolean, default false) - allows soft-archiving programs without deleting them

  2. Notes
    - Existing programs default to not archived
    - Archived programs will be hidden from default views but still accessible
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'workout_programs' AND column_name = 'archived'
  ) THEN
    ALTER TABLE workout_programs ADD COLUMN archived boolean DEFAULT false NOT NULL;
  END IF;
END $$;
