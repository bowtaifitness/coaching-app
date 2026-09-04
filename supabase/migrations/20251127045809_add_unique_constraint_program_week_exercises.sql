/*
  # Add unique constraint to prevent duplicate exercises in program weeks

  1. Changes
    - Add unique constraint on program_week_exercises to prevent the same exercise from being added multiple times to the same program week
    - This will prevent duplicate exercises when customizing workouts
  
  2. Notes
    - The constraint allows the same exercise_id in different program weeks
    - It prevents duplicate exercise_id entries in the same program_week_id
    - This is a database-level protection against race conditions
*/

-- First, clean up any existing duplicates before adding the constraint
WITH duplicates AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (
      PARTITION BY program_week_id, exercise_id, order_index
      ORDER BY created_at DESC
    ) as rn
  FROM program_week_exercises
)
DELETE FROM program_week_exercises
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);

-- Add unique constraint to prevent duplicates
-- Note: We can't use exercise_id + program_week_id as unique because 
-- superset exercises can have the same exercise multiple times
-- Instead, we'll use program_week_id + exercise_id + order_index as unique
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'program_week_exercises_unique_exercise_per_week_order'
  ) THEN
    ALTER TABLE program_week_exercises 
    ADD CONSTRAINT program_week_exercises_unique_exercise_per_week_order 
    UNIQUE (program_week_id, exercise_id, order_index);
  END IF;
END $$;