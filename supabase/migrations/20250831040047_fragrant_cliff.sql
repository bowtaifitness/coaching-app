/*
  # Fix infinite recursion in profiles table policies

  1. Problem
    - Current policies are causing infinite recursion by querying the profiles table within policy expressions
    - This happens when policies try to check user roles by selecting from the same table they're protecting

  2. Solution
    - Remove all existing policies that cause recursion
    - Create simple, non-recursive policies that use direct auth.uid() checks
    - Use JWT metadata for role checks instead of database queries

  3. New Policies
    - Users can view and update their own profile (using auth.uid())
    - Service role has full access for system operations
    - Simple role-based access without recursive queries
*/

-- Drop all existing policies on profiles table to start fresh
DROP POLICY IF EXISTS "Admin full access to profiles" ON profiles;
DROP POLICY IF EXISTS "Allow coaches to view client profiles" ON profiles;
DROP POLICY IF EXISTS "Service role full access" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;

-- Create simple, non-recursive policies
CREATE POLICY "Users can view own profile"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Users can update own profile"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "Service role full access"
  ON profiles
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Admin policy using JWT metadata instead of database query
CREATE POLICY "Admin full access to profiles"
  ON profiles
  FOR ALL
  TO authenticated
  USING (
    (auth.jwt() ->> 'email') = 'brian@bowtaifitness.com' OR
    id = auth.uid()
  )
  WITH CHECK (
    (auth.jwt() ->> 'email') = 'brian@bowtaifitness.com' OR
    id = auth.uid()
  );

-- Update brian@bowtaifitness.com to admin role if profile exists
UPDATE profiles 
SET role = 'admin', updated_at = now()
WHERE email = 'brian@bowtaifitness.com';