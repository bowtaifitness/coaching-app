/*
  # Fix coach assignment RLS policies

  1. Policy Updates
    - Update INSERT policy on coach_client_assignments to allow coaches and admins to create assignments
    - Ensure proper permissions for assignment management

  2. Security
    - Maintain data isolation while allowing necessary operations
    - Allow coaches to assign clients and admins to manage all assignments
*/

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Coaches can manage their assignments" ON coach_client_assignments;
DROP POLICY IF EXISTS "Coaches can view their assignments" ON coach_client_assignments;

-- Create new, working policies for coach_client_assignments
CREATE POLICY "Coaches and admins can insert assignments"
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

CREATE POLICY "Coaches and admins can update assignments"
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

CREATE POLICY "Users can view relevant assignments"
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

CREATE POLICY "Coaches and admins can delete assignments"
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