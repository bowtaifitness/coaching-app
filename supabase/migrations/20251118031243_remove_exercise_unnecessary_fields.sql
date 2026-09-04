/*
  # Remove unnecessary fields from exercises table

  1. Changes
    - Drop `equipment` column (text array)
    - Drop `duration` column (integer)
    - Drop `reps` column (integer)
    - Drop `sets` column (integer)
  
  2. Notes
    - These fields are no longer needed for exercise management
    - Exercise data will be simplified to name, category, description, instructions, and video_url
*/

ALTER TABLE exercises 
DROP COLUMN IF EXISTS equipment,
DROP COLUMN IF EXISTS duration,
DROP COLUMN IF EXISTS reps,
DROP COLUMN IF EXISTS sets;
