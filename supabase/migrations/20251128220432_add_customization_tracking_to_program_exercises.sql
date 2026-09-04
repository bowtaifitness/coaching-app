/*
  # Add Customization Tracking to Program Week Exercises

  1. Changes
    - Add `is_customized` boolean column to `program_week_exercises` table
    - Defaults to FALSE (not customized, still synced with template)
    - When set to TRUE, the exercise won't be updated by template sync
  
  2. Behavior
    - New exercises copied from templates start as is_customized = FALSE
    - When user manually edits sets/reps/weight/etc, set is_customized = TRUE
    - Template sync trigger only updates exercises where is_customized = FALSE
  
  3. Security
    - No changes to RLS policies
    - Maintains existing access controls
*/

-- Add is_customized column to program_week_exercises
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'program_week_exercises' AND column_name = 'is_customized'
  ) THEN
    ALTER TABLE program_week_exercises 
    ADD COLUMN is_customized boolean DEFAULT false NOT NULL;
  END IF;
END $$;

-- Set existing exercises as not customized (they'll sync with future template updates)
UPDATE program_week_exercises 
SET is_customized = false 
WHERE is_customized IS NULL;
