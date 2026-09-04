/*
  # Fix Workout Template Deletion
  
  1. Changes
    - Drop existing foreign key constraint on workouts.template_id
    - Add new foreign key constraint with CASCADE delete
    - This allows templates to be deleted, which will cascade to delete associated workouts
  
  2. Security
    - Maintains existing RLS policies
    - No changes to access control
  
  3. Notes
    - When a template is deleted, all workouts using that template will also be deleted
    - This is the expected behavior for template management
*/

-- Drop the existing foreign key constraint
ALTER TABLE workouts 
DROP CONSTRAINT IF EXISTS workouts_template_id_fkey;

-- Add new foreign key constraint with CASCADE delete
ALTER TABLE workouts
ADD CONSTRAINT workouts_template_id_fkey 
FOREIGN KEY (template_id) 
REFERENCES workout_templates(id) 
ON DELETE CASCADE;
