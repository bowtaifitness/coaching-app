/*
  # Allow Clients to View Standard Programs

  1. Purpose
    - Enable all authenticated users (clients, coaches, admins) to view standard programs
    - Standard programs are pre-built training programs available to everyone
    - This supports the business model where basic/trial users can access standard programs

  2. Changes
    - Add SELECT policy for authenticated users to view standard programs
    - Policy only applies to programs where program_type = 'standard'

  3. Security
    - Clients can only SELECT (view) standard programs
    - They cannot modify, delete, or create programs
    - Custom programs remain visible only to their creators and admins
*/

-- Drop policy if it exists to avoid conflicts
DROP POLICY IF EXISTS "All authenticated users can view standard programs" ON workout_programs;

-- Allow all authenticated users to view standard programs
CREATE POLICY "All authenticated users can view standard programs"
  ON workout_programs
  FOR SELECT
  TO authenticated
  USING (program_type = 'standard');
