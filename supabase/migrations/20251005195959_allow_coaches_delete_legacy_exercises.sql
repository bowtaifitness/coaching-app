/*
  # Allow Coaches to Delete Legacy Exercises

  1. Problem
    - Many exercises have created_by = NULL
    - Current policy only allows deletion of exercises where created_by = auth.uid()
    - Coaches cannot delete legacy exercises
    
  2. Solution
    - Add policy allowing coaches to delete exercises with NULL created_by
    - This allows cleanup of imported/legacy exercises
    
  3. Security
    - Only coaches and admins can delete
    - Client users still cannot delete exercises
*/

-- Allow coaches to delete exercises with null created_by (legacy exercises)
CREATE POLICY "Coaches can delete legacy exercises"
  ON exercises
  FOR DELETE
  TO authenticated
  USING (
    created_by IS NULL 
    AND EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND (
        auth.users.raw_user_meta_data->>'role' = 'coach'
        OR auth.users.raw_user_meta_data->>'role' = 'admin'
      )
    )
  );