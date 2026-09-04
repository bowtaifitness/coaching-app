/*
  # Fix RLS policy for coaches to view client profiles

  1. Security Changes
    - Drop existing conflicting policies on profiles table
    - Add new policy allowing coaches to view client profiles
    - Maintain user access to their own profiles
    - Preserve service role access

  2. Policy Details
    - Coaches can view all profiles with role = 'client'
    - Users can view and update their own profiles
    - Service role maintains full access for administrative functions
*/

-- Drop existing policies that might be causing conflicts
DROP POLICY IF EXISTS "Coaches can view client profiles" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Service role full access" ON profiles;

-- Create new policies without recursion
CREATE POLICY "Allow coaches to view client profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    role = 'client' AND 
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'coach'
  );

CREATE POLICY "Users can view own profile"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Service role full access"
  ON profiles
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);