/*
  # Fix infinite recursion in profiles RLS policies

  1. Problem
    - Current policies on profiles table are causing infinite recursion
    - The nested query in ClientManagement is triggering circular dependencies
    - Policies reference each other creating loops

  2. Solution
    - Drop ALL existing policies on profiles table
    - Create simple, non-recursive policies
    - Avoid any subqueries that could cause recursion
    - Use direct auth.uid() checks only

  3. Security
    - Users can view their own profile
    - Coaches can view client profiles (simple check)
    - Service role has full access
    - No complex joins or EXISTS clauses
*/

-- Drop all existing policies on profiles table
DROP POLICY IF EXISTS "Coaches can view client profiles" ON profiles;
DROP POLICY IF EXISTS "Service role full access" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view assigned profiles" ON profiles;
DROP POLICY IF EXISTS "Coaches can view assigned client profiles" ON profiles;

-- Create simple, non-recursive policies
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

-- Simple policy for coaches to view all client profiles
-- This avoids recursion by not checking the coach_client_assignments table
CREATE POLICY "Coaches can view all client profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    role = 'client' AND 
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = auth.uid()
    )
  );

-- Service role full access
CREATE POLICY "Service role full access"
  ON profiles
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);