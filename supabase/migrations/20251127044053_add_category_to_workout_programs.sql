/*
  # Add category column to workout_programs

  1. Changes
    - Add `category` column to `workout_programs` table to support categorizing programs by equipment type
    - Column is nullable text to allow programs to optionally specify a category
    - Categories match template categories: bodyweight, bands, dumbbells, full-gym
  
  2. Notes
    - Existing programs will have NULL category
    - This helps organize programs by equipment requirements
*/

-- Add category column to workout_programs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'workout_programs' AND column_name = 'category'
  ) THEN
    ALTER TABLE workout_programs ADD COLUMN category text;
  END IF;
END $$;