/*
  # Allow All Authenticated Users to Delete Legacy Exercises

  1. Problem
    - JWT metadata checks may not work correctly in all contexts
    - Need to allow deletion of legacy exercises (created_by = NULL)
    
  2. Solution
    - Allow all authenticated users to delete exercises with NULL created_by
    - These are legacy/imported exercises that should be manageable
    - Users with created exercises can still only delete their own
    
  3. Security
    - Only applies to legacy exercises (created_by IS NULL)
    - Requires authentication
    - Does not affect user-created exercises
*/

-- Drop the existing policy
DROP POLICY IF EXISTS "Coaches can delete legacy exercises" ON exercises;

-- Create simplified policy - allow all authenticated users to delete legacy exercises
CREATE POLICY "Authenticated users can delete legacy exercises"
  ON exercises
  FOR DELETE
  TO authenticated
  USING (created_by IS NULL);