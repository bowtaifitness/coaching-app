/*
  # Add superset_group column to template_exercises

  1. Changes
    - Add `superset_group` column to `template_exercises` table to support superset grouping in workout templates
    - Column is nullable integer to allow exercises to optionally be part of a superset group
    - Exercises with the same superset_group number are part of the same superset
  
  2. Notes
    - Existing exercises will have NULL superset_group (not part of any superset)
    - When creating supersets, assign the same group number to exercises that should be performed together
*/

-- Add superset_group column to template_exercises
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'template_exercises' AND column_name = 'superset_group'
  ) THEN
    ALTER TABLE template_exercises ADD COLUMN superset_group integer;
  END IF;
END $$;