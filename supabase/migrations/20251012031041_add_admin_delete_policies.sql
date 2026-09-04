/*
  # Add Admin Delete Policies

  1. Policy Changes
    - Add delete policies for admins on profiles table
    - Ensure admins can delete client profiles
  
  2. Security
    - Only admin users can delete client profiles
    - Explicit role check in policy
*/

-- Drop existing delete policy if it exists
DROP POLICY IF EXISTS "Admins can delete client profiles" ON profiles;

-- Create policy to allow admins to delete client profiles
CREATE POLICY "Admins can delete client profiles"
  ON profiles
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );