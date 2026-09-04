/*
  # Allow Clients to View All Workout Templates

  1. Purpose
    - Enable clients to view workout templates associated with standard programs
    - Clients need to see templates to follow standard programs independently
    - Previously only coaches could view templates they created

  2. Changes
    - Add SELECT policy allowing all authenticated users to view all workout templates
    - This enables clients to access exercises from standard program templates

  3. Security
    - Read-only access for clients (SELECT only)
    - Clients still cannot create, update, or delete templates
    - Templates remain coach-created content
*/

-- Allow all authenticated users to view workout templates
DROP POLICY IF EXISTS "All users can view workout templates" ON workout_templates;

CREATE POLICY "All users can view workout templates"
  ON workout_templates
  FOR SELECT
  TO authenticated
  USING (true);
