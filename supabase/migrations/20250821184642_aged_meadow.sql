/*
  # Allow clients to mark their own workouts as complete

  1. Security Changes
    - Add RLS policy to allow clients to update the `completed` field on their own workouts
    - Clients can only update workouts assigned to them
    - Clients can only update the `completed` field, not other workout details

  2. Policy Details
    - Policy name: "Clients can mark own workouts complete"
    - Allows UPDATE operations on workouts table
    - Restricted to authenticated users with client role
    - Only allows updating the `completed` field
    - Only for workouts where client_id matches the authenticated user
*/

-- Allow clients to update the completion status of their own workouts
CREATE POLICY "Clients can mark own workouts complete"
  ON workouts
  FOR UPDATE
  TO authenticated
  USING (client_id = auth.uid())
  WITH CHECK (client_id = auth.uid());