/*
  # Add Warm-up Template Support to Workout Programs

  1. Changes
    - Add warmup_template_id column to workout_programs table
    - This allows coaches to assign a warm-up workout template to a program
    - The warm-up will be automatically available in every week of the program
  
  2. New Column
    - warmup_template_id: uuid - References workout_templates table
    - Nullable - programs don't require a warm-up template
  
  3. Foreign Key
    - References workout_templates(id) with ON DELETE SET NULL
    - If the warm-up template is deleted, the reference is cleared
*/

-- Add warmup_template_id to workout_programs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'workout_programs' AND column_name = 'warmup_template_id'
  ) THEN
    ALTER TABLE workout_programs 
    ADD COLUMN warmup_template_id uuid REFERENCES workout_templates(id) ON DELETE SET NULL;
  END IF;
END $$;
