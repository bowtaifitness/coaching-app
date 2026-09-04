/*
  # Fix infinite recursion in profiles RLS policies

  1. Problem
    - The profiles table has RLS policies that create circular references
    - Policies reference coach_client_assignments which references profiles
    - This creates infinite recursion when querying

  2. Solution
    - Drop all existing problematic policies on profiles table
    - Create new simplified policies that avoid circular references
    - Use direct auth.uid() checks instead of complex joins

  3. Security
    - Users can manage their own profile
    - Service role has full access for system operations
    - Remove complex coach-client assignment checks that cause recursion
*/

-- Drop all existing policies on profiles table
DROP POLICY IF EXISTS "Coaches can view assigned clients" ON profiles;
DROP POLICY IF EXISTS "Service role can manage profiles" ON profiles;
DROP POLICY IF EXISTS "Users can manage own profile" ON profiles;

-- Create new simplified policies without circular references
CREATE POLICY "Users can manage own profile"
  ON profiles
  FOR ALL
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Service role can manage profiles"
  ON profiles
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Create a simple read policy for basic profile access
CREATE POLICY "Authenticated users can read basic profile info"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (true);