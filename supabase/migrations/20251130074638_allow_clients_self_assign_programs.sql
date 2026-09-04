/*
  # Allow Clients to Self-Assign Programs

  1. Changes
    - Add policy to allow clients to insert their own program assignments
    - This enables clients to start/enroll in standard programs from the workout library
  
  2. Security
    - Clients can only assign programs to themselves (client_id must match auth.uid())
    - They cannot assign programs to other users
*/

-- Drop if exists and recreate
DROP POLICY IF EXISTS "Clients can self-assign programs" ON client_program_assignments;

-- Allow clients to self-assign programs
CREATE POLICY "Clients can self-assign programs"
  ON client_program_assignments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = client_id
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'client'
    )
  );
