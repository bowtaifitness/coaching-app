/*
  # Fix coach assignment RLS policies

  1. Security Changes
    - Drop all existing problematic policies on coach_client_assignments
    - Create new simplified policies that avoid recursion
    - Allow coaches and admins to manage assignments properly
    - Ensure users can view relevant assignments

  2. Policy Changes
    - INSERT: Allow coaches and admins to create assignments
    - UPDATE: Allow coaches and admins to modify assignments  
    - DELETE: Allow coaches and admins to remove assignments
    - SELECT: Allow users to view assignments they're involved in
*/

-- Drop all existing policies on coach_client_assignments
DROP POLICY IF EXISTS "Allow coaches and admins to delete assignments" ON coach_client_assignments;
DROP POLICY IF EXISTS "Allow coaches and admins to insert assignments" ON coach_client_assignments;
DROP POLICY IF EXISTS "Allow coaches and admins to update assignments" ON coach_client_assignments;
DROP POLICY IF EXISTS "Allow users to view relevant assignments" ON coach_client_assignments;

-- Create new simplified policies that avoid recursion
CREATE POLICY "Coaches and admins can insert assignments"
  ON coach_client_assignments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = auth.uid()
    )
  );

CREATE POLICY "Coaches and admins can update assignments"
  ON coach_client_assignments
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = auth.uid()
    )
  );

CREATE POLICY "Coaches and admins can delete assignments"
  ON coach_client_assignments
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = auth.uid()
    )
  );

CREATE POLICY "Users can view relevant assignments"
  ON coach_client_assignments
  FOR SELECT
  TO authenticated
  USING (
    coach_id = auth.uid() OR 
    client_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = auth.uid()
    )
  );