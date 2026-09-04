/*
  # Allow Clients to Create Their Own Workouts

  1. Purpose
    - Enable clients to create workout instances for themselves when following standard programs
    - Supports the self-guided training feature for basic/trial tier users
    - Clients can generate workouts from program templates they want to follow

  2. Changes
    - Add INSERT policy for clients to create workouts for themselves
    - Ensures clients can only create workouts where they are the client_id

  3. Security
    - Clients can only create workouts for their own account (client_id = auth.uid())
    - Clients cannot create workouts for other users
    - Coach assignment is optional for self-created workouts
*/

-- Allow clients to create workouts for themselves
DROP POLICY IF EXISTS "Clients can create own workouts" ON workouts;

CREATE POLICY "Clients can create own workouts"
  ON workouts
  FOR INSERT
  TO authenticated
  WITH CHECK (client_id = auth.uid());
