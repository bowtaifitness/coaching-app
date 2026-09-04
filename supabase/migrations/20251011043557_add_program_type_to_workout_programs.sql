/*
  # Add Program Type to Workout Programs

  1. Purpose
    - Add a program_type field to distinguish between standard and custom programs
    - Standard programs are pre-built reusable programs
    - Custom programs are client-specific programs

  2. Changes
    - Add program_type column to workout_programs table
    - Set default to 'custom' for existing programs
    - Add check constraint for valid values

  3. Notes
    - Existing programs will default to 'custom' type
    - Valid values are 'standard' and 'custom'
*/

-- Add program_type column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'workout_programs' AND column_name = 'program_type'
  ) THEN
    ALTER TABLE workout_programs 
    ADD COLUMN program_type text DEFAULT 'custom' NOT NULL;
    
    -- Add check constraint for valid program types
    ALTER TABLE workout_programs 
    ADD CONSTRAINT program_type_check 
    CHECK (program_type IN ('standard', 'custom'));
  END IF;
END $$;
