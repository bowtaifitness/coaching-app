/*
  # Add category column to workout_templates

  1. Changes
    - Add `category` column to `workout_templates` table
    - Column is optional (nullable) to allow existing templates without breaking
    - Valid categories: bodyweight, bands, dumbbells, full-gym

  2. Notes
    - Existing templates will have NULL category initially
    - New templates can specify a category
*/

-- Add category column to workout_templates
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'workout_templates' AND column_name = 'category'
  ) THEN
    ALTER TABLE workout_templates ADD COLUMN category text;
  END IF;
END $$;