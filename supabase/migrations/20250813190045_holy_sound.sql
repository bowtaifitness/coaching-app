/*
  # Add deletion policies for exercises table

  1. Security Updates
    - Add policy for coaches to delete exercises they created
    - Add policy for service role to delete any exercises (for bulk operations)
  
  2. Changes
    - Enable proper deletion permissions for exercise management
*/

-- Add policy for coaches to delete exercises they created
CREATE POLICY "Coaches can delete own exercises"
  ON exercises
  FOR DELETE
  TO authenticated
  USING (created_by = auth.uid() AND EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() AND profiles.role = 'coach'
  ));

-- Add policy for service role to delete exercises (for admin operations)
CREATE POLICY "Service role can delete exercises"
  ON exercises
  FOR DELETE
  TO service_role
  USING (true);