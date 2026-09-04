/*
  # Fix coach client view policy

  1. Security Changes
    - Drop existing problematic policy for coaches viewing client profiles
    - Create new policy that properly allows coaches to view all client profiles
    - Ensure coaches can access client data they need for management

  2. Policy Details
    - Allows authenticated users with 'coach' role to view profiles with 'client' role
    - Uses proper role checking from the profiles table
    - Maintains security by restricting access based on user roles
*/

-- Drop the existing problematic policy
DROP POLICY IF EXISTS "Coaches can view all client profiles" ON profiles;

-- Create a new policy that allows coaches to view client profiles
CREATE POLICY "Coaches can view client profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    (role = 'client' AND EXISTS (
      SELECT 1 FROM profiles coach_profile 
      WHERE coach_profile.id = auth.uid() 
      AND coach_profile.role = 'coach'
    ))
    OR 
    (id = auth.uid())
  );