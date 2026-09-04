/*
  # Simplify Legacy Exercise Deletion Policy

  1. Problem
    - Previous policy queries auth.users which may cause issues
    - Need simpler policy for legacy exercise deletion
    
  2. Solution
    - Replace with policy that checks JWT metadata directly
    - Allows coaches and admins to delete exercises with NULL created_by
    
  3. Changes
    - Drop old policy
    - Create new simplified policy using auth.jwt()
*/

-- Drop the problematic policy
DROP POLICY IF EXISTS "Coaches can delete legacy exercises" ON exercises;

-- Create simplified policy using JWT metadata
CREATE POLICY "Coaches can delete legacy exercises"
  ON exercises
  FOR DELETE
  TO authenticated
  USING (
    created_by IS NULL 
    AND (
      (auth.jwt() ->> 'email') = 'brian@bowtaifitness.com'
      OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'coach'
      OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
    )
  );