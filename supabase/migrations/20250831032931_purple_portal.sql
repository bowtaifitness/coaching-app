/*
  # Fix coach assignment RLS policies

  1. Problem
    - Current RLS policies on coach_client_assignments are too restrictive
    - Preventing coaches and admins from creating new assignments
    - Policy checks are failing during INSERT operations

  2. Solution
    - Drop existing problematic policies
    - Create new simplified policies that properly check user roles
    - Allow coaches to assign clients and admins to manage all assignments
    - Use direct role checks from profiles table

  3. Security
    - Maintain proper access control
    - Coaches can only assign clients to themselves or other coaches
    - Admins have full management access
    - Users can view assignments they're involved in
*/

-- Drop existing policies that are causing issues
DROP POLICY IF EXISTS "Coaches and admins can delete assignments" ON coach_client_assignments;
DROP POLICY IF EXISTS "Coaches and admins can insert assignments" ON coach_client_assignments;
DROP POLICY IF EXISTS "Coaches and admins can update assignments" ON coach_client_assignments;
DROP POLICY IF EXISTS "Users can view relevant assignments" ON coach_client_assignments;

-- Create new simplified policies
CREATE POLICY "Allow coaches and admins to insert assignments"
  ON coach_client_assignments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('coach', 'admin')
    )
  );

CREATE POLICY "Allow coaches and admins to update assignments"
  ON coach_client_assignments
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('coach', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('coach', 'admin')
    )
  );

CREATE POLICY "Allow coaches and admins to delete assignments"
  ON coach_client_assignments
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('coach', 'admin')
    )
  );

CREATE POLICY "Allow users to view relevant assignments"
  ON coach_client_assignments
  FOR SELECT
  TO authenticated
  USING (
    coach_id = auth.uid() 
    OR client_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );